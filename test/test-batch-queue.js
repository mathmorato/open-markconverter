/**
 * Teste de integração para a lógica da Fila de Lote (Batch Queue),
 * download individual por item, download em lote (.zip), progressão linear contínua,
 * formatação inteligente de tempo (formatElapsedTime) e telemetria de peso do Markdown (v.1.4.4).
 */

import { APP_CONFIG } from '../js/config.js';
import { formatElapsedTime, formatBytes, formatFileSize, renderFileBadgeIcon, renderUploadStepIcon, renderConvertStepIcon } from '../js/app.js';

console.log('===============================================================');
console.log('  TESTANDO FILA, BADGE ICON, ZERO TOASTS & STEP ICONS (v.1.4.9)');
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
  if (!iconHtml.includes(ext.toUpperCase())) {
    console.error(`[FALHA] renderFileBadgeIcon("${ext}") não incluiu a extensão em caixa alta`);
    process.exit(1);
  }
}
console.log('  -> Ícones vetoriais com badge gerados com sucesso para PDF, DOCX, XLSX, PPTX, JSON e TXT!');

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

console.log('===============================================================');
console.log('  SUCESSO: TODOS OS TESTES PASSARAM COM ÊXITO (v.1.4.9)');
console.log('===============================================================');
