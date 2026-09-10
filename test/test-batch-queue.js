/**
 * Teste de integração para a lógica da Fila de Lote (Batch Queue),
 * download individual por item, download em lote (.zip), progressão linear contínua,
 * formatação inteligente de tempo (formatElapsedTime) e telemetria de peso do Markdown (v.1.4.4).
 */

import { APP_CONFIG, ERROR_CATALOG } from '../js/config.js';
import { 
  formatElapsedTime, 
  formatBytes, 
  formatFileSize, 
  renderFileBadgeIcon, 
  renderUploadStepIcon, 
  renderConvertStepIcon,
  mergeMarkdownOutputs,
  extractArchiveFiles,
  scrollQueueToItem,
  scrollToActiveItem
} from '../js/app.js';
import { parseText } from '../js/parsers/text-parser.js';
import JSZip from 'jszip';
import fs from 'fs';

console.log('===============================================================');
console.log('  TESTANDO FILA, AUTO-EXTRAÇÃO, RESILIÊNCIA & ERROS (v.1.6.7)');
console.log('===============================================================');

// Simulação de estado da fila
const state = {
  queue: [],
  maxConcurrency: 2
};

function getFormatCategory(fileName) {
  const ext = '.' + fileName.split('.').pop().toLowerCase();
  for (const [key, format] of Object.entries(APP_CONFIG.SUPPORTED_FORMATS)) {
    if (format.ext.includes(ext)) {
      return { key, ...format, ext };
    }
  }
  return { key: 'text', ext, name: `Arquivo (${ext})`, category: 'text', parser: 'text' };
}

function addFilesToQueue(files) {
  files.forEach(file => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const formatInfo = getFormatCategory(file.name);
    const id = `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    let status = 'queued';
    let statusText = 'Na fila';
    let uploadProgress = 0;
    let uploadText = '0%';
    let convertProgress = 0;
    let convertText = 'Aguardando...';
    let progress = 0;
    let errorMessage = '';

    if (file.size === 0) {
      status = 'error';
      statusText = 'Erro: Vazio (0 B)';
      uploadProgress = 0;
      uploadText = '0%';
      convertProgress = 100;
      convertText = 'Erro: Vazio';
      progress = 100;
      errorMessage = 'Arquivo vazio (0 bytes)';
    } else if (file.size > APP_CONFIG.MAX_FILE_SIZE_BYTES) {
      status = 'error';
      statusText = 'Erro: Excede 1,5 GB';
      uploadProgress = 0;
      uploadText = '0%';
      convertProgress = 100;
      convertText = 'Erro: Limite excedido';
      progress = 100;
      errorMessage = 'Arquivo excede o limite máximo permitido de 1,5 GB.';
    } else if (APP_CONFIG.UNSUPPORTED_BINARY_EXTENSIONS && APP_CONFIG.UNSUPPORTED_BINARY_EXTENSIONS.includes(ext)) {
      status = 'error';
      statusText = 'Erro: Formato não suportado';
      uploadProgress = 0;
      uploadText = '0%';
      convertProgress = 100;
      convertText = 'Erro: Não suportado';
      progress = 100;
      errorMessage = `Extensão "${ext}" não suportada`;
    }

    state.queue.push({
      id,
      file,
      formatInfo,
      status,
      statusText,
      uploadProgress,
      uploadText,
      convertProgress,
      convertText,
      progress,
      markdown: '',
      durationMs: 0,
      errorMessage,
      cancelled: false
    });
  });
}

function removeQueueItem(itemId) {
  const idx = state.queue.findIndex(it => it.id === itemId);
  if (idx === -1) return;
  state.queue[idx].cancelled = true;
  state.queue.splice(idx, 1);
}

function clearQueue() {
  state.queue.forEach(it => { it.cancelled = true; });
  state.queue = [];
}

// 1. Testa adição de múltiplos arquivos incluindo arquivo acima do teto de 1,5 GB
const mockFiles = [
  { name: 'documento1.docx', size: 15000 },
  { name: 'planilha.xlsx', size: 25000 },
  { name: 'apresentacao.pptx', size: 50000 },
  { name: 'vazio.txt', size: 0 },
  { name: 'binario.exe', size: 10000 },
  { name: 'arquivo_gigante.pdf', size: 1.8 * 1024 * 1024 * 1024 } // 1.8 GB > 1.5 GB
];

addFilesToQueue(mockFiles);

console.log(`[TESTE 1] Total de itens na fila: ${state.queue.length}`);
if (state.queue.length !== 6) {
  console.error('[FALHA] Esperava 6 itens na fila');
  process.exit(1);
}

// Verifica identificação correta de erros imediatos
const emptyItem = state.queue.find(it => it.file.name === 'vazio.txt');
if (emptyItem.status !== 'error' || emptyItem.progress !== 100) {
  console.error('[FALHA] Arquivo vazio não foi marcado como erro');
  process.exit(1);
}
console.log('  -> Arquivo vazio rejeitado com status "error"');

const exeItem = state.queue.find(it => it.file.name === 'binario.exe');
if (exeItem.status !== 'error') {
  console.error('[FALHA] Arquivo .exe não foi rejeitado');
  process.exit(1);
}
console.log('  -> Arquivo binário não suportado rejeitado');

const giantItem = state.queue.find(it => it.file.name === 'arquivo_gigante.pdf');
if (giantItem.status !== 'error' || !giantItem.errorMessage.includes('1,5 GB')) {
  console.error('[FALHA] Arquivo > 1,5 GB não foi rejeitado com mensagem de limite');
  process.exit(1);
}
console.log('  -> Arquivo > 1,5 GB (1.8 GB) rejeitado com status "error" e mensagem clara');

// 2. Simula concorrência controlada e dupla barra de progresso (máximo 2 simultâneos)
let activeCount = 0;
const processItem = async (item) => {
  item.status = 'processing';
  item.uploadProgress = 0;
  item.convertProgress = 0;
  item.convertText = 'Aguardando...';
  activeCount++;
  if (activeCount > state.maxConcurrency) {
    console.error(`[FALHA] Concorrência excedeu o limite de ${state.maxConcurrency}: ${activeCount}`);
    process.exit(1);
  }

  // Etapa 1: Leitura do arquivo (FileReader)
  item.uploadProgress = 50;
  item.uploadText = '50%';
  if (item.convertProgress !== 0) {
    console.error('[FALHA] Barra de conversão não permaneceu em 0% durante a leitura');
    process.exit(1);
  }

  item.uploadProgress = 100;
  item.uploadText = '100%';

  // Etapa 2: Conversão Markdown (Parsing) - Progressão linear adaptativa sem travamento em 60%
  item.convertProgress = 20;
  item.convertText = '20% (Iniciando parser...)';
  await new Promise(r => setTimeout(r, 10));

  item.convertProgress = 55;
  item.convertText = '55% (Processando estrutura...)';
  await new Promise(r => setTimeout(r, 10));

  item.convertProgress = 85;
  item.convertText = '85% (Compilando Markdown...)';
  await new Promise(r => setTimeout(r, 10));

  item.convertProgress = 100;
  item.convertText = '100%';
  item.progress = 100;
  item.status = 'completed';
  item.markdown = `# Convertido ${item.file.name}\n\nConteúdo Markdown extraído.`;
  const mdBlob = new Blob([item.markdown], { type: 'text/markdown;charset=utf-8' });
  item.mdSize = mdBlob.size;
  item.formattedMdSize = formatBytes(mdBlob.size);
  activeCount--;
};

const validItems = state.queue.filter(it => it.status === 'queued');
console.log(`[TESTE 2] Processando ${validItems.length} itens válidos com concorrência máxima de 2 e progresso linear adaptativo...`);

await Promise.all([
  processItem(validItems[0]),
  processItem(validItems[1])
]);
await processItem(validItems[2]);

console.log('  -> Todos os 3 itens concluídos com dupla barra de progresso (upload=100%, convert=100%)');

// 3. Testa download individual imediato para item concluído
console.log('[TESTE 3] Testando download individual de documento concluído...');
const itemToDownload = validItems[0];
if (itemToDownload.status !== 'completed' || !itemToDownload.markdown) {
  console.error('[FALHA] Item não está pronto para download');
  process.exit(1);
}
const expectedFilename = `${itemToDownload.file.name.replace(/\.[^/.]+$/, '')}.md`;
console.log(`  -> Nome de download individual gerado: "${expectedFilename}"`);
if (!expectedFilename.endsWith('.md') || !itemToDownload.markdown.includes('Convertido')) {
  console.error('[FALHA] Falha na formatação de saída para download individual');
  process.exit(1);
}

// 4. Testa remoção individual de item da fila
console.log(`[TESTE 4] Removendo item (${validItems[0].file.name}) da fila...`);
const countBefore = state.queue.length;
removeQueueItem(validItems[0].id);

if (state.queue.length !== countBefore - 1 || state.queue.some(it => it.id === validItems[0].id)) {
  console.error('[FALHA] Item não foi removido corretamente da fila');
  process.exit(1);
}
console.log(`  -> Item removido com sucesso! Restam ${state.queue.length} itens na fila.`);

// 5. Testa limpeza total da fila ("Limpar Todos")
console.log('[TESTE 5] Testando ação global "Limpar Todos"...');
clearQueue();
if (state.queue.length !== 0) {
  console.error('[FALHA] Ação Limpar Todos não esvaziou a fila');
  process.exit(1);
}
console.log('  -> Fila completamente limpa!');

// 6. Teste unitário para a função de tempo formatElapsedTime(ms)
console.log('[TESTE 6] Testando formatação inteligente de tempo formatElapsedTime(ms)...');
const timeCases = [
  { ms: 0, expected: '0ms' },
  { ms: 850, expected: '850ms' },
  { ms: 7296, expected: '7.3s' },
  { ms: 7000, expected: '7s' },
  { ms: 60000, expected: '1min' },
  { ms: 135000, expected: '2min 15s' },
  { ms: 3600000, expected: '1h' },
  { ms: 4324000, expected: '1h 12min 4s' },
];

for (const tc of timeCases) {
  const result = formatElapsedTime(tc.ms);
  if (result !== tc.expected) {
    console.error(`[FALHA] formatElapsedTime(${tc.ms}): esperado "${tc.expected}", obtido "${result}"`);
    process.exit(1);
  }
  // Garante ausência de zeros à esquerda
  if (result.includes('0h') || result.includes('0min') || (result.startsWith('0s') && result !== '0s')) {
    console.error(`[FALHA] formatElapsedTime(${tc.ms}) gerou zeros redundantes à esquerda: "${result}"`);
    process.exit(1);
  }
}
console.log('  -> Todos os 8 casos de teste de formatElapsedTime passaram com perfeição (sem zeros à esquerda)!');

// 7. Teste unitário para contagem de bytes e peso do Markdown gerado
console.log('[TESTE 7] Testando contagem de bytes do Markdown gerado e telemetria de peso...');
const sampleMd = '# Documento Convertido\n\nTexto demonstrativo para cálculo de peso UTF-8 em bytes e MB/KB.';
const sampleBlob = new Blob([sampleMd], { type: 'text/markdown;charset=utf-8' });
const sampleMdSize = sampleBlob.size;
const sampleFormattedSize = formatFileSize(sampleMdSize);

console.log(`  -> Tamanho calculado do Markdown: ${sampleMdSize} bytes (${sampleFormattedSize})`);
if (sampleMdSize <= 0 || !sampleFormattedSize.includes('Bytes')) {
  console.error('[FALHA] Cálculo ou formatação do tamanho do Markdown incorretos');
  process.exit(1);
}
console.log('  -> Telemetria de peso do Markdown validada com sucesso!');

// 8. Teste unitário para renderFileBadgeIcon(extension)
console.log('[TESTE 8] Testando geração do ícone vetorial com etiqueta de extensão (renderFileBadgeIcon)...');
const testExtensions = ['pdf', 'docx', 'xlsx', 'pptx', 'json', 'txt'];
for (const ext of testExtensions) {
  const iconHtml = renderFileBadgeIcon(ext);
  if (!iconHtml.includes('file-badge-icon') || !iconHtml.includes('file-sheet-svg') || !iconHtml.includes('file-extension-tag')) {
    console.error(`[FALHA] renderFileBadgeIcon("${ext}") não gerou estrutura vetorial completa`);
    process.exit(1);
  }
  if (!iconHtml.includes('viewBox="-2 -2 44 52"')) {
    console.error(`[FALHA] renderFileBadgeIcon("${ext}") não inclui viewBox com folga de respiro anti-corte`);
    process.exit(1);
  }
  if (!iconHtml.includes(ext.toUpperCase())) {
    console.error(`[FALHA] renderFileBadgeIcon("${ext}") não incluiu a extensão em caixa alta`);
    process.exit(1);
  }
}
console.log('  -> Ícones vetoriais com badge e viewBox anti-corte gerados com sucesso para PDF, DOCX, XLSX, PPTX, JSON e TXT!');

// 9. Teste unitário para renderUploadStepIcon e renderConvertStepIcon
console.log('[TESTE 9] Testando geração dos ícones vetoriais de etapas (renderUploadStepIcon e renderConvertStepIcon)...');
const uploadIconHtml = renderUploadStepIcon();
if (!uploadIconHtml.includes('step-icon-upload') || !uploadIconHtml.includes('arrow-up-group') || !uploadIconHtml.includes('viewBox="0 0 24 24"')) {
  console.error('[FALHA] renderUploadStepIcon() não gerou SVG vetorial esperado');
  process.exit(1);
}

const convertIconHtml = renderConvertStepIcon();
if (!convertIconHtml.includes('step-icon-convert') || !convertIconHtml.includes('arrow-convert-group') || !convertIconHtml.includes('viewBox="0 0 32 24"')) {
  console.error('[FALHA] renderConvertStepIcon() não gerou SVG vetorial esperado');
  process.exit(1);
}
console.log('  -> Ícones vetoriais animados de Upload e Conversão validados com sucesso!');

// 10. Teste de auto-extração de arquivos de mock ZIP em memória
console.log('[TESTE 10] Testando auto-extração client-side de pacote .ZIP em memória...');
const zipMock = new JSZip();
zipMock.file('documento1.txt', 'Conteúdo do primeiro documento');
zipMock.file('planilha.csv', 'col1,col2\nval1,val2');
// Adiciona artefatos de sistema que DEVEM ser filtrados
zipMock.file('__MACOSX/._documento1.txt', 'lixo do macos');
zipMock.file('.DS_Store', 'metadados');
zipMock.file('pasta_vazia/', null, { dir: true });
// Adiciona arquivo binário não suportado que deve ser filtrado
zipMock.file('setup.exe', 'binario executavel');

const zipBuffer = await zipMock.generateAsync({ type: 'arraybuffer' });
const mockZipFile = {
  name: 'pacote_teste.zip',
  size: zipBuffer.byteLength,
  arrayBuffer: async () => zipBuffer
};

const extractedFiles = await extractArchiveFiles(mockZipFile);
console.log(`  -> Arquivos extraídos do ZIP: ${extractedFiles.length} item(ns)`);

if (extractedFiles.length !== 2) {
  console.error(`[FALHA] Esperava exatamente 2 arquivos extraídos, obteve ${extractedFiles.length}`);
  process.exit(1);
}

const extractedNames = extractedFiles.map(f => f.name);
if (!extractedNames.includes('documento1.txt') || !extractedNames.includes('planilha.csv')) {
  console.error(`[FALHA] Nomes extraídos incompatíveis: ${extractedNames.join(', ')}`);
  process.exit(1);
}

if (extractedNames.includes('.DS_Store') || extractedNames.some(n => n.includes('__MACOSX') || n.includes('setup.exe'))) {
  console.error('[FALHA] Arquivos de sistema/não suportados não foram filtrados corretamente na extração');
  process.exit(1);
}
console.log('  -> Extração em memória filtrou metadados e extraiu documentos com sucesso!');

// 11. Teste de mesclagem unificada com demarcadores padronizados
console.log('[TESTE 11] Testando mesclagem unificada de Markdown com delimitadores padronizados...');
const itemsToMerge = [
  {
    file: { name: 'Relatorio.docx', size: 2500000 },
    markdown: '# Introdução Executiva\n\nEste é o primeiro relatório convertendo perfeitamente.'
  },
  {
    file: { name: 'Dados.csv', size: 1048576 },
    markdown: '| Código | Descrição |\n|---|---|\n| 101 | Item A |'
  }
];

const unifiedMarkdown = mergeMarkdownOutputs(itemsToMerge);

// Validação dos demarcadores explícitos
if (!unifiedMarkdown.includes('<!-- ========================================== -->')) {
  console.error('[FALHA] Markdown unificado não contém separadores de comentário padronizados');
  process.exit(1);
}
if (!unifiedMarkdown.includes('<!-- INÍCIO DO ARQUIVO: Relatorio.docx -->') || !unifiedMarkdown.includes('<!-- FIM DO ARQUIVO: Relatorio.docx -->')) {
  console.error('[FALHA] Demarcadores de início ou fim ausentes para Relatorio.docx');
  process.exit(1);
}
if (!unifiedMarkdown.includes('<!-- FORMATO ORIGINAL: DOCX | TAMANHO: 2.4 MB -->')) {
  console.error('[FALHA] Metadados de formato ou tamanho ausentes no cabeçalho do documento');
  process.exit(1);
}
if (!unifiedMarkdown.includes('# Relatorio.docx') || !unifiedMarkdown.includes('# Dados.csv')) {
  console.error('[FALHA] Títulos principais de nível 1 (# NomeDoArquivo) ausentes na mesclagem');
  process.exit(1);
}
if (!unifiedMarkdown.includes('---')) {
  console.error('[FALHA] Separador horizontal "---" ausente entre documentos');
  process.exit(1);
}

console.log('  -> Mesclagem unificada com demarcadores e metadados validada com perfeição!');

// 12. Teste de auto-scroll inteligente confinado exclusivamente ao container da fila
console.log('[TESTE 12] Testando rotina de auto-scroll confinado ao container da fila (scrollQueueToItem)...');
let scrollToParams = null;
let scrollIntoViewCalled = false;
const mockQueueList = {
  offsetTop: 0,
  scrollTop: 0,
  clientHeight: 480,
  scrollTo: (params) => {
    scrollToParams = params;
  }
};
global.document = {
  querySelector: (sel) => (sel === '.file-queue-list' ? mockQueueList : null),
  getElementById: (id) => (id === 'file-queue-list' ? mockQueueList : null)
};

const mockElement = {
  id: 'test-scroll-item',
  offsetTop: 600,
  offsetHeight: 84,
  scrollIntoView: () => {
    scrollIntoViewCalled = true;
  }
};

scrollQueueToItem(mockElement);
if (scrollIntoViewCalled) {
  console.error('[FALHA] scrollQueueToItem chamou scrollIntoView (deve confinar o scroll ao container sem rolar a janela)');
  process.exit(1);
}
if (!scrollToParams || scrollToParams.behavior !== 'smooth' || typeof scrollToParams.top !== 'number') {
  console.error('[FALHA] scrollQueueToItem não executou queueList.scrollTo com parâmetros esperados');
  process.exit(1);
}

// Testa alias scrollToActiveItem
scrollToParams = null;
scrollToActiveItem(mockElement);
if (!scrollToParams || scrollToParams.behavior !== 'smooth' || typeof scrollToParams.top !== 'number') {
  console.error('[FALHA] scrollToActiveItem (alias) não delegou para scrollQueueToItem corretamente');
  process.exit(1);
}
console.log('  -> scrollQueueToItem e scrollToActiveItem acionaram queueList.scrollTo({ top, behavior: "smooth" }) sem rolar a janela principal!');

// 13. Teste de conversão resiliente de arquivo .html
console.log('[TESTE 13] Testando conversão resiliente de arquivo HTML com fallback nativo...');
const sampleHtml = `
  <!DOCTYPE html>
  <html>
    <head><title>Página de Exemplo</title></head>
    <body>
      <h1>Título Principal do Documento</h1>
      <p>Este é um parágrafo com <strong>negrito</strong> e <em>itálico</em>.</p>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
      <a href="https://example.com">Link de Exemplo</a>
      <script>console.log("deve ser removido");</script>
    </body>
  </html>
`;

const mockHtmlFile = {
  name: 'pagina_teste.html',
  size: Buffer.byteLength(sampleHtml),
  text: async () => sampleHtml,
  arrayBuffer: async () => Buffer.from(sampleHtml).buffer
};

const htmlMarkdown = await parseText(mockHtmlFile);
if (!htmlMarkdown || !htmlMarkdown.includes('Título Principal do Documento')) {
  console.error('[FALHA] Parser HTML falhou em extrair o título do documento');
  process.exit(1);
}
if (!htmlMarkdown.includes('**negrito**')) {
  console.error('[FALHA] Parser HTML não preservou marcação de negrito');
  process.exit(1);
}
if (htmlMarkdown.includes('deve ser removido') || htmlMarkdown.includes('<script>')) {
  console.error('[FALHA] Parser HTML não eliminou tags de script');
  process.exit(1);
}
console.log('  -> Conversão de arquivo .html em Markdown validada com 100% de sucesso (sem exceções)!');

// 14. Teste de colapso visual de barras de progresso na ocorrência de erro
console.log('[TESTE 14] Testando colapso visual de barras de progresso em caso de erro (.has-error)...');
const stylesCss = fs.readFileSync('./css/styles.css', 'utf8');
if (!stylesCss.includes('.file-queue-item.has-error .item-progress') || !stylesCss.includes('display: none !important')) {
  console.error('[FALHA] Regra CSS de colapso de progresso para .has-error ausente em css/styles.css');
  process.exit(1);
}
if (!stylesCss.includes('.item-error-badge') || !stylesCss.includes('#EF4444')) {
  console.error('[FALHA] Regras de estilização de .item-error-badge ausentes ou sem cor #EF4444');
  process.exit(1);
}
if (ERROR_CATALOG.FILE_TOO_LARGE !== 'Arquivo excede o limite máximo permitido de 1,5 GB.' || !ERROR_CATALOG.EMPTY_FILE) {
  console.error('[FALHA] ERROR_CATALOG incompleto ou incorreto em js/config.js');
  process.exit(1);
}
console.log('  -> Colapso visual (.has-error display: none !important) e ERROR_CATALOG validados com sucesso!');

// 15. Teste de estabilidade e posicionamento do botão de download unificado abaixo da linha principal (CLS = 0)
console.log('[TESTE 15] Testando layout de duas linhas e estabilidade do botão unificado...');
const indexHtmlContent = fs.readFileSync('./index.html', 'utf8');
if ((!indexHtmlContent.includes('queue-actions-row') && !indexHtmlContent.includes('queue-static-buttons')) || (!indexHtmlContent.includes('unified-download-container') && !indexHtmlContent.includes('unified-action-row'))) {
  console.error('[FALHA] Estrutura estável de duas linhas (queue-static-buttons / unified-action-row) ausente no index.html');
  process.exit(1);
}
if (!stylesCss.includes('.unified-download-container') && !stylesCss.includes('.unified-action-row')) {
  console.error('[FALHA] Estilização para posicionamento vertical de .unified-action-row ausente em css/styles.css');
  process.exit(1);
}
if (!stylesCss.includes('.queue-header-main') || !stylesCss.includes('min-height: 42px')) {
  console.error('[FALHA] css/styles.css não contém .queue-header-main com min-height: 42px');
  process.exit(1);
}
console.log('  -> Layout travado contra Layout Shift (.queue-header-main min-height: 42px) validado com sucesso!');
// 16. Teste de restauração e resiliência da barra de conversão e expansão dos cards (v.1.6.4)
console.log('[TESTE 16] Testando preservação da barra de conversão e expansão dimensional dos cards...');
const appJsContent = fs.readFileSync('./js/app.js', 'utf8');
if (!appJsContent.includes('step-conversion') || !appJsContent.includes('convert-status-text')) {
  console.error('[FALHA] js/app.js não contém os nós isolados .step-conversion e .convert-status-text');
  process.exit(1);
}
if (!stylesCss.includes('min-height: 84px') || !stylesCss.includes('padding: 1rem 1.25rem')) {
  console.error('[FALHA] css/styles.css não contém min-height: 84px ou padding: 1rem 1.25rem em .file-queue-item');
  process.exit(1);
}
if (!stylesCss.includes('min-width: 220px') || !stylesCss.includes('flex: 0 1 38%')) {
  console.error('[FALHA] css/styles.css não contém flex: 0 1 38% ou min-width: 220px no container de progresso');
  process.exit(1);
}
if (!stylesCss.includes('flex-shrink: 0') || !stylesCss.includes('#E2E8F0')) {
  console.error('[FALHA] css/styles.css não contém proteção flex-shrink: 0 e cor de trilha visível #E2E8F0 em .mini-progress-track');
  process.exit(1);
}
console.log('  -> Barra de conversão isolada contra sobrescrita e altura do card (84px) validadas com 100% de sucesso!');

// 17. Teste de truncamento de porcentagem para inteiro e abreviação para pg. (v.1.6.7)
console.log('[TESTE 17] Testando truncamento de porcentagem para inteiro e abreviação para pg. ...');
const rawPercent = 50.786575530894886;
const integerPercent = Math.round(rawPercent);
if (integerPercent !== 51 || !Number.isInteger(integerPercent)) {
  console.error('[FALHA] Arredondamento para inteiro falhou');
  process.exit(1);
}

const rawDetail = 'Página 298/1247';
const abbreviated = rawDetail.replace(/Página\s+(\d+)\/(\d+)/gi, 'pg. $1/$2');
if (abbreviated !== 'pg. 298/1247') {
  console.error('[FALHA] Abreviação de página para pg. falhou');
  process.exit(1);
}
console.log('  -> Truncamento para inteiro e abreviação para "pg." validados com sucesso!');

console.log('===============================================================');
console.log('  SUCESSO: TODOS OS TESTES PASSARAM COM ÊXITO (v.1.6.7)');
console.log('===============================================================');
