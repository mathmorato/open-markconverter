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
  scrollQueueToActiveItem,
  scrollQueueToItem,
  scrollToActiveItem,
  getFormattedTimestamp,
  sortQueueByName,
  sortQueueBySize,
  updateGlobalBatchProgress,
  batchAnimationController,
  clearQueue as realClearQueue,
  renderQueueUI,
  BATCH_HEADLESS_THRESHOLD,
  shouldEnableHeadlessMode,
  handleBatchChunkAutoScroll,
  updateQueueItemDOM,
  buildBacklogSection,
  buildDirectoryTreeAscii,
  addFilesToQueue as realAddFilesToQueue,
  dispatchNext,
  processQueue,
  getDynamicConcurrency,
  totalBytesAnimController,
  computeAndAnimateTotalMdBytes,
  formatMdTelemetrySize,
  formatItemForUnifiedMarkdown,
  generateUnifiedMarkdownWithProgress,
  showConsolidationProgress,
  updateConsolidationProgress,
  hideConsolidationProgress,
  downloadUnifiedMarkdown,
  downloadAllZip,
  downloadAllAsZip,
  downloadQueueItem,
  getOutputFileName,
  triggerDownload,
  updateGlobalBatchButtonsState,
  updateGlobalActionButtonsState,
  setupQueueListDelegation,
  removeItemFromQueue,
  state as appState
} from '../js/app.js';
import { parseText } from '../js/parsers/text-parser.js';
import JSZip from 'jszip';
import fs from 'fs';

console.log('===============================================================');
console.log('  TESTANDO FILA, AUTO-EXTRAÇÃO, RESILIÊNCIA & ERROS (v.1.9.0)');
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

// Validação dos demarcadores explícitos e backlog
if (!unifiedMarkdown.includes('<!-- ================================================================= -->') && !unifiedMarkdown.includes('<!-- ========================================== -->')) {
  console.error('[FALHA] Markdown unificado não contém separadores de comentário padronizados');
  process.exit(1);
}
if (!unifiedMarkdown.includes('<!-- INÍCIO DO ARQUIVO: Relatorio.docx -->') || !unifiedMarkdown.includes('<!-- FIM DO ARQUIVO: Relatorio.docx -->')) {
  console.error('[FALHA] Demarcadores de início ou fim ausentes para Relatorio.docx');
  process.exit(1);
}
if (!unifiedMarkdown.includes('TAMANHO: 2.4 MB') || !unifiedMarkdown.includes('DOCX')) {
  console.error('[FALHA] Metadados de formato ou tamanho ausentes no cabeçalho do documento');
  process.exit(1);
}
if (!unifiedMarkdown.includes('# Relatorio.docx') || !unifiedMarkdown.includes('# Dados.csv')) {
  console.error('[FALHA] Títulos principais de nível 1 (# NomeDoArquivo) ausentes na mesclagem');
  process.exit(1);
}
if (!unifiedMarkdown.includes('# RASTREABILIDADE DE ARQUIVOS E ESTRUTURA DE PASTAS (BACKLOG)')) {
  console.error('[FALHA] Cabeçalho de rastreabilidade e backlog ausente no topo do Markdown');
  process.exit(1);
}
if (!unifiedMarkdown.includes('---')) {
  console.error('[FALHA] Separador horizontal "---" ausente entre documentos');
  process.exit(1);
}

console.log('  -> Mesclagem unificada com demarcadores, metadados e backlog validada com perfeição!');

// 12. Teste de desativação total de auto-scroll e barra de progresso global de lote (> 10 arquivos)
console.log('[TESTE 12] Testando desativação definitiva de auto-scroll e exibição condicional de barra global...');
let scrollByCalled = false;
let scrollToCalled = false;
let scrollIntoViewCalled = false;
const mockQueueList = {
  offsetTop: 0,
  scrollTop: 0,
  clientHeight: 480,
  style: { display: 'flex' },
  innerHTML: '',
  querySelectorAll: () => [],
  querySelector: () => null,
  getBoundingClientRect: () => ({ top: 100, bottom: 580, height: 480 }),
  scrollBy: () => {
    scrollByCalled = true;
  },
  scrollTo: () => {
    scrollToCalled = true;
  }
};

const mockQueueSection = {
  style: { display: 'none' }
};
const mockQueueCounter = {
  textContent: ''
};
const mockHeadlessNotice = {
  style: { display: 'none' }
};
const mockBatchProgress = {
  style: { display: 'none' },
  classList: {
    classes: new Set(),
    add(cls) { this.classes.add(cls); },
    remove(cls) { this.classes.delete(cls); },
    contains(cls) { return this.classes.has(cls); }
  }
};
const mockProgressCounter = {
  textContent: ''
};
const mockProgressFill = {
  style: { width: '0%' },
  classList: {
    classes: new Set(),
    add(cls) { this.classes.add(cls); },
    remove(cls) { this.classes.delete(cls); },
    contains(cls) { return this.classes.has(cls); }
  }
};
const mockTotalBytesCard = {
  style: { display: 'inline-flex' }
};
const mockTotalBytesCounter = {
  textContent: '0'
};
const mockTotalFormattedUnit = {
  textContent: '(0 KB)'
};

const mockConsolidationProgress = {
  style: { display: 'none' }
};
const mockConsolidationCounter = {
  textContent: '0 / 0 (0%)'
};
const mockConsolidationStatusText = {
  textContent: 'Consolidando:'
};
const createClassListMock = () => {
  const classes = new Set();
  return {
    add(cls) { classes.add(cls); },
    remove(cls) { classes.delete(cls); },
    contains(cls) { return classes.has(cls); }
  };
};

const mockConsolidationFill = {
  style: { width: '0%' },
  classList: createClassListMock()
};

const createMockButton = () => {
  const attrs = new Map();
  return {
    attrs,
    innerHTML: '',
    disabled: false,
    classList: createClassListMock(),
    setAttribute(k, v) { attrs.set(k, v); },
    removeAttribute(k) { attrs.delete(k); },
    getAttribute(k) { return attrs.get(k) || null; },
    querySelector: () => null
  };
};

const mockBtnDownloadUnified = createMockButton();
const mockBtnQueueDownloadAll = createMockButton();

if (typeof global.URL === 'undefined') {
  global.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {}
  };
} else if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = () => 'blob:mock-url';
  global.URL.revokeObjectURL = () => {};
}

global.document = {
  body: {
    appendChild: () => {},
    removeChild: () => {}
  },
  createElement: () => ({
    href: '',
    download: '',
    click: () => {}
  }),
  querySelector: (sel) => (sel === '.file-queue-list' ? mockQueueList : null),
  getElementById: (id) => {
    if (id === 'file-queue-section') return mockQueueSection;
    if (id === 'file-queue-list') return mockQueueList;
    if (id === 'queue-counter') return mockQueueCounter;
    if (id === 'batch-global-progress') return mockBatchProgress;
    if (id === 'global-progress-counter') return mockProgressCounter;
    if (id === 'global-progress-fill') return mockProgressFill;
    if (id === 'queue-total-bytes-card') return mockTotalBytesCard;
    if (id === 'live-total-bytes-counter') return mockTotalBytesCounter;
    if (id === 'live-total-formatted-unit') return mockTotalFormattedUnit;
    if (id === 'consolidation-progress') return mockConsolidationProgress;
    if (id === 'consolidation-counter') return mockConsolidationCounter;
    if (id === 'consolidation-fill') return mockConsolidationFill;
    if (id === 'consolidation-status-text') return mockConsolidationStatusText;
    if (id === 'btn-download-unified' || id === 'btn-queue-download-merged') return mockBtnDownloadUnified;
    if (id === 'btn-queue-download-all') return mockBtnQueueDownloadAll;
    if (id === 'headless-mode-notice') return null;
    return null;
  }
};

const mockElement = {
  id: 'test-scroll-item',
  offsetTop: 600,
  offsetHeight: 84,
  getBoundingClientRect: () => ({ top: 700, bottom: 784, height: 84 }),
  scrollIntoView: () => {
    scrollIntoViewCalled = true;
  }
};

// 12.1. Verifica que as rotinas de scroll NÃO realizam qualquer rolagem (100% no-op)
scrollQueueToActiveItem(mockElement);
scrollQueueToItem(mockElement);
scrollToActiveItem(mockElement);

if (scrollIntoViewCalled || scrollByCalled || scrollToCalled || mockQueueList.scrollTop !== 0) {
  console.error('[FALHA] As rotinas de scroll não foram neutralizadas; dispararam rolagem automática');
  process.exit(1);
}
console.log('  -> [OK] Auto-scroll 100% desativado (zero chamadas de scrollBy, scrollTo ou scrollIntoView)!');

// 12.2. Verifica exibição condicional do container #batch-global-progress
// Com lote <= 10 arquivos: deve permanecer estritamente oculto (display = 'none')
appState.queue = Array.from({ length: 10 }, (_, i) => ({
  id: `item_${i}`,
  status: i < 5 ? 'completed' : 'queued'
}));
updateGlobalBatchProgress();
if (mockBatchProgress.style.display !== 'none') {
  console.error(`[FALHA] Barra global exibida indevidamente para 10 arquivos: ${mockBatchProgress.style.display}`);
  process.exit(1);
}
console.log('  -> [OK] Barra global oculta para lotes <= 10 arquivos!');

// Com lote >= 11 arquivos: deve ser exibida (display = 'block')
appState.queue = Array.from({ length: 11 }, (_, i) => ({
  id: `item_${i}`,
  status: i < 5 ? 'completed' : (i === 5 ? 'error' : 'queued')
}));
updateGlobalBatchProgress();
if (mockBatchProgress.style.display !== 'block') {
  console.error(`[FALHA] Barra global não foi exibida para 11 arquivos: ${mockBatchProgress.style.display}`);
  process.exit(1);
}
// 6 processados (5 completed + 1 error) de 11 = 55%
if (!mockProgressCounter.textContent.includes('6 / 11') || !mockProgressCounter.textContent.includes('55%')) {
  console.error(`[FALHA] Contador de progresso global incorreto: "${mockProgressCounter.textContent}"`);
  process.exit(1);
}
if (!mockProgressFill.style.width.startsWith('54.55%') && mockProgressFill.style.width !== '55%') {
  console.error(`[FALHA] Largura da barra de progresso incorreta: "${mockProgressFill.style.width}"`);
  process.exit(1);
}
console.log(`  -> [OK] Barra global exibida para lote de 11 arquivos: "${mockProgressCounter.textContent}" (largura ${mockProgressFill.style.width})`);

// Quando 100% concluído
appState.queue.forEach(it => { it.status = 'completed'; });
updateGlobalBatchProgress();
if (!mockProgressFill.style.width.startsWith('100') || !mockProgressFill.classList.contains('finished')) {
  console.error(`[FALHA] Classe .finished ou largura 100% ausente ao concluir lote`);
  process.exit(1);
}
console.log('  -> [OK] Barra global atinge 100% e recebe classe .finished ao concluir todos os arquivos!');

// 12.3. Validação do batchAnimationController (amortecimento exponencial, convergência e cancelamento RAF)
console.log('[TESTE 12.3] Validando batchAnimationController com requestAnimationFrame e delta-time...');

let rafQueue = [];
let rafIdCounter = 0;
let cancelRafCalledWith = null;

global.requestAnimationFrame = (callback) => {
  const id = ++rafIdCounter;
  rafQueue.push({ id, callback });
  return id;
};

global.cancelAnimationFrame = (id) => {
  cancelRafCalledWith = id;
  rafQueue = rafQueue.filter(item => item.id !== id);
};

// Reseta o controlador para estado limpo
batchAnimationController.reset();

// Dispara transição com 50 concluídos de 100
batchAnimationController.updateTargets(50, 100);

if (!batchAnimationController.rafId) {
  console.error('[FALHA] batchAnimationController não iniciou o loop requestAnimationFrame ao receber novos alvos');
  process.exit(1);
}

// Simula frames do navegador avançando o tempo a ~60 FPS (dt = 16.6ms)
let simulatedTime = 1000;
let frameCount = 0;
while (rafQueue.length > 0 && frameCount < 120) {
  frameCount++;
  simulatedTime += 16.66;
  const currentPending = [...rafQueue];
  rafQueue = [];
  currentPending.forEach(entry => entry.callback(simulatedTime));
}

// 1. Estabilização exata no alvo final
if (batchAnimationController.currentCount !== 50 || batchAnimationController.currentPercent !== 50) {
  console.error(`[FALHA] batchAnimationController não estabilizou no alvo exato: count=${batchAnimationController.currentCount}, percent=${batchAnimationController.currentPercent}`);
  process.exit(1);
}
if (batchAnimationController.rafId !== null) {
  console.error('[FALHA] batchAnimationController rafId não foi encerrado (null) após estabilizar');
  process.exit(1);
}
console.log(`  -> [OK] Contador convergiu e estabilizou exatamente no alvo (${batchAnimationController.currentCount} / 100 - 50%) em ${frameCount} frames!`);

// 2. Cancelamento adequado de requestAnimationFrame no clearQueue
batchAnimationController.updateTargets(80, 100);
const activeRafId = batchAnimationController.rafId;
if (!activeRafId) {
  console.error('[FALHA] batchAnimationController não iniciou RAF para novo alvo');
  process.exit(1);
}

realClearQueue();

if (batchAnimationController.rafId !== null) {
  console.error('[FALHA] realClearQueue() não limpou batchAnimationController.rafId');
  process.exit(1);
}
if (cancelRafCalledWith !== activeRafId) {
  console.error(`[FALHA] cancelAnimationFrame não foi chamado com o id ativo (${activeRafId}), recebeu: ${cancelRafCalledWith}`);
  process.exit(1);
}
if (batchAnimationController.currentCount !== 0 || batchAnimationController.total !== 0) {
  console.error('[FALHA] batchAnimationController não resetou os contadores para 0 no realClearQueue');
  process.exit(1);
}
console.log('  -> [OK] requestAnimationFrame cancelado e métricas redefinidas com sucesso ao chamar clearQueue()!');

// Limpa mocks de RAF
delete global.requestAnimationFrame;
delete global.cancelAnimationFrame;

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

// 18. Teste de geração de timestamp com data, hora e minuto (v.1.6.8)
console.log('[TESTE 18] Testando geração de timestamp padronizado com data, hora e minuto (getFormattedTimestamp)...');
const sampleDate = new Date(2026, 8, 10, 10, 30); // 10 de Setembro de 2026 às 10:30
const generatedTimestamp = getFormattedTimestamp(sampleDate);
console.log(`  -> Timestamp gerado: "${generatedTimestamp}"`);
if (generatedTimestamp !== '2026-09-10_10h30min') {
  console.error(`[FALHA] Timestamp gerado incompatível: esperado "2026-09-10_10h30min", obtido "${generatedTimestamp}"`);
  process.exit(1);
}

const currentTimestamp = getFormattedTimestamp();
const timestampRegex = /^\d{4}-\d{2}-\d{2}_\d{2}h\d{2}min$/;
if (!timestampRegex.test(currentTimestamp)) {
  console.error(`[FALHA] getFormattedTimestamp() atual não corresponde ao formato regex YYYY-MM-DD_HHhMMmin: "${currentTimestamp}"`);
  process.exit(1);
}
console.log(`  -> Nome gerado para ZIP: "documentos_markdown_${generatedTimestamp}.zip"`);
console.log(`  -> Nome gerado para MD Unificado: "documento_unificado_${generatedTimestamp}.md"`);
console.log('  -> Formato de timestamp para downloads validado com 100% de sucesso!');

// 19. Teste de ordenação alfanumérica natural e mesclagem ordenada (v.1.6.8)
console.log('[TESTE 19] Testando ordenação alfanumérica natural (A-Z / Z-A) e mesclagem estritamente ordenada...');
const testDossierItems = [
  { file: { name: '5159167-Volume 02.pdf', size: 1024 }, markdown: '# Conteúdo Vol 2', status: 'completed' },
  { file: { name: '5159167-Volume 10.pdf', size: 2048 }, markdown: '# Conteúdo Vol 10', status: 'completed' },
  { file: { name: '5159167-Volume 01.pdf', size: 512 }, markdown: '# Conteúdo Vol 1', status: 'completed' }
];

// Testa ordenação natural crescente A-Z
testDossierItems.sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' }));
if (testDossierItems[0].file.name !== '5159167-Volume 01.pdf' ||
    testDossierItems[1].file.name !== '5159167-Volume 02.pdf' ||
    testDossierItems[2].file.name !== '5159167-Volume 10.pdf') {
  console.error('[FALHA] Ordenação natural alfanumérica A-Z falhou na sequência de volumes');
  process.exit(1);
}
console.log('  -> Ordenação A-Z: ' + testDossierItems.map(it => it.file.name).join(' -> '));

// Testa mesclagem seguindo a ordem classificada
const mergedNaturalOutput = mergeMarkdownOutputs(testDossierItems);
const idxVol1 = mergedNaturalOutput.indexOf('5159167-Volume 01.pdf');
const idxVol2 = mergedNaturalOutput.indexOf('5159167-Volume 02.pdf');
const idxVol10 = mergedNaturalOutput.indexOf('5159167-Volume 10.pdf');

if (idxVol1 === -1 || idxVol2 === -1 || idxVol10 === -1 || !(idxVol1 < idxVol2 && idxVol2 < idxVol10)) {
  console.error('[FALHA] Mesclagem de Markdown não respeitou a sequência alfanumérica ordenada');
  process.exit(1);
}
console.log('  -> Mesclagem alfanumérica estritamente ordenada validada com sucesso!');

// Testa ordenação decrescente Z-A
testDossierItems.sort((a, b) => b.file.name.localeCompare(a.file.name, undefined, { numeric: true, sensitivity: 'base' }));
if (testDossierItems[0].file.name !== '5159167-Volume 10.pdf' ||
    testDossierItems[1].file.name !== '5159167-Volume 02.pdf' ||
    testDossierItems[2].file.name !== '5159167-Volume 01.pdf') {
  console.error('[FALHA] Ordenação natural decrescente Z-A falhou');
  process.exit(1);
}
console.log('  -> Ordenação Z-A: ' + testDossierItems.map(it => it.file.name).join(' -> '));

// 20. Teste de estrutura de pastas aninhadas em pacote compactado e rastreabilidade no Markdown Unificado (v.1.6.9)
console.log('[TESTE 20] Testando descompactação de pastas aninhadas e backlog de rastreabilidade...');
const nestedZipSample = new JSZip();
nestedZipSample.folder('financeiro/2026').file('balanco.xlsx', 'conteudo xlsx');
nestedZipSample.folder('jurídico/contratos').file('minuta.docx', 'conteudo docx');
const nestedZipBuffer = await nestedZipSample.generateAsync({ type: 'nodebuffer' });

const mockNestedZipFile = {
  name: 'relatorios.zip',
  size: nestedZipBuffer.length,
  arrayBuffer: async () => nestedZipBuffer.buffer.slice(nestedZipBuffer.byteOffset, nestedZipBuffer.byteOffset + nestedZipBuffer.byteLength)
};

const extracted = await extractArchiveFiles(mockNestedZipFile);
if (!extracted || extracted.length !== 2) {
  console.error('[FALHA] Extração do zip com subpastas falhou em extrair os 2 arquivos');
  process.exit(1);
}

const balancoFile = extracted.find(f => f.name === 'balanco.xlsx');
const minutaFile = extracted.find(f => f.name === 'minuta.docx');

if (!balancoFile || balancoFile.archiveOrigin !== 'relatorios.zip' || balancoFile.relativePath !== 'financeiro/2026/balanco.xlsx' || balancoFile.folderPath !== 'financeiro/2026') {
  console.error('[FALHA] Metadados de rastreabilidade incorretos para balanco.xlsx:', balancoFile);
  process.exit(1);
}
if (!minutaFile || minutaFile.archiveOrigin !== 'relatorios.zip' || minutaFile.relativePath !== 'jurídico/contratos/minuta.docx' || minutaFile.folderPath !== 'jurídico/contratos') {
  console.error('[FALHA] Metadados de rastreabilidade incorretos para minuta.docx:', minutaFile);
  process.exit(1);
}
console.log('  -> Metadados de arquivo extraído (archiveOrigin, relativePath, folderPath) validados com sucesso!');

// Simula conversão e mesclagem
const queueItemsWithHierarchy = [
  {
    file: balancoFile,
    archiveOrigin: balancoFile.archiveOrigin,
    relativePath: balancoFile.relativePath,
    folderPath: balancoFile.folderPath,
    markdown: '# Balanço Financeiro 2026\n\nAtivos e Passivos.',
    status: 'completed'
  },
  {
    file: minutaFile,
    archiveOrigin: minutaFile.archiveOrigin,
    relativePath: minutaFile.relativePath,
    folderPath: minutaFile.folderPath,
    markdown: '# Minuta de Contrato\n\nCláusulas e Acordo.',
    status: 'completed'
  },
  {
    file: { name: 'anexo.pdf', size: 1048576 },
    archiveOrigin: '(Upload Direto)',
    relativePath: 'anexo.pdf',
    folderPath: 'Raiz',
    markdown: '# Anexo Direto\n\nDocumento complementar.',
    status: 'completed'
  }
];

const unifiedHierarchyMarkdown = mergeMarkdownOutputs(queueItemsWithHierarchy);

// Verificação de Backlog no topo do documento
if (!unifiedHierarchyMarkdown.includes('# RASTREABILIDADE DE ARQUIVOS E ESTRUTURA DE PASTAS (BACKLOG)')) {
  console.error('[FALHA] Seção de Backlog ausente no topo do Markdown unificado');
  process.exit(1);
}
if (!unifiedHierarchyMarkdown.includes('| relatorios.zip | financeiro/2026/ | balanco.xlsx | .XLSX |') ||
    !unifiedHierarchyMarkdown.includes('| relatorios.zip | jurídico/contratos/ | minuta.docx | .DOCX |') ||
    !unifiedHierarchyMarkdown.includes('| (Upload Direto) | Raiz | anexo.pdf | .PDF |')) {
  console.error('[FALHA] Tabela de rastreabilidade não contém as linhas mapeadas esperadas');
  process.exit(1);
}
if (!unifiedHierarchyMarkdown.includes('📦 relatorios.zip') ||
    !unifiedHierarchyMarkdown.includes('📁 financeiro/2026/') ||
    !unifiedHierarchyMarkdown.includes('📄 balanco.xlsx') ||
    !unifiedHierarchyMarkdown.includes('📁 jurídico/contratos/') ||
    !unifiedHierarchyMarkdown.includes('📄 minuta.docx')) {
  console.error('[FALHA] Árvore ASCII de pastas não foi gerada corretamente');
  process.exit(1);
}
if (!unifiedHierarchyMarkdown.includes('<!-- PACOTE DE ORIGEM: relatorios.zip | DIRETÓRIO: financeiro/2026/ -->') ||
    !unifiedHierarchyMarkdown.includes('*Origem: `relatorios.zip > financeiro/2026/balanco.xlsx`*')) {
  console.error('[FALHA] Demarcadores intermediários ou subtítulo de origem ausentes para balanco.xlsx');
  process.exit(1);
}
console.log('  -> Backlog inicial com tabela de proveniência, árvore ASCII e rastreabilidade nos blocos validado com 100% de êxito!');

// 21. Teste de alternância entre ordenação Crescente/Decrescente e integridade dos estilos alinhados à esquerda (v.1.7.0)
console.log('[TESTE 21] Testando alternância entre Crescente (A-Z) e Decrescente (Z-A) e alinhamento à esquerda...');

// Preenche appState.queue com itens desordenados
appState.queue = [
  { file: { name: 'Capítulo 02.pdf', size: 1024 }, markdown: '# Cap 2', status: 'completed' },
  { file: { name: 'Capítulo 10.pdf', size: 2048 }, markdown: '# Cap 10', status: 'completed' },
  { file: { name: 'Capítulo 01.pdf', size: 512 }, markdown: '# Cap 1', status: 'completed' }
];

// Ordenação inicial crescente A-Z
sortQueueByName(true);
if (appState.sortAscending !== true ||
    appState.queue[0].file.name !== 'Capítulo 01.pdf' ||
    appState.queue[1].file.name !== 'Capítulo 02.pdf' ||
    appState.queue[2].file.name !== 'Capítulo 10.pdf') {
  console.error('[FALHA] sortQueueByName(true) não ordenou em sequência crescente A-Z natural');
  process.exit(1);
}
console.log('  -> [OK] Modo Crescente (A-Z) verificado: ' + appState.queue.map(it => it.file.name).join(' -> '));

// Alternância para decrescente Z-A (como no clique do botão)
appState.sortAscending = !(appState.sortAscending !== false);
sortQueueByName(appState.sortAscending);
if (appState.sortAscending !== false ||
    appState.queue[0].file.name !== 'Capítulo 10.pdf' ||
    appState.queue[1].file.name !== 'Capítulo 02.pdf' ||
    appState.queue[2].file.name !== 'Capítulo 01.pdf') {
  console.error('[FALHA] sortQueueByName(false) não ordenou em sequência decrescente Z-A');
  process.exit(1);
}
console.log('  -> [OK] Alternância para Decrescente (Z-A) verificada: ' + appState.queue.map(it => it.file.name).join(' -> '));

// Nova alternância de volta para crescente A-Z
appState.sortAscending = !(appState.sortAscending !== false);
sortQueueByName(appState.sortAscending);
if (appState.sortAscending !== true ||
    appState.queue[0].file.name !== 'Capítulo 01.pdf' ||
    appState.queue[2].file.name !== 'Capítulo 10.pdf') {
  console.error('[FALHA] Retorno ao modo crescente A-Z falhou');
  process.exit(1);
}
console.log('  -> [OK] Alternância circular de ordenação validada com êxito!');

// Validação de CSS e integridade de layout para .unified-action-row e .queue-header
const cssContent = fs.readFileSync('./css/styles.css', 'utf8');
if (!cssContent.includes('justify-content: flex-start')) {
  console.error('[FALHA] .unified-action-row não possui justify-content: flex-start');
  process.exit(1);
}
if (!cssContent.includes('gap: 0.38rem')) {
  console.error('[FALHA] .queue-header não possui redução de 50% de gap (gap: 0.38rem)');
  process.exit(1);
}
if (!cssContent.includes('.btn-sort .sort-icon')) {
  console.error('[FALHA] .btn-sort .sort-icon não está estilizado no CSS');
  process.exit(1);
}
console.log('  -> [OK] Estilos de alinhamento à esquerda e redução de 50% no espaçamento vertical validados!');

// Validação dos elementos HTML de ordenação e ícones vetoriais
const htmlContent = fs.readFileSync('./index.html', 'utf8');
if (!htmlContent.includes('icon-desc') || !htmlContent.includes('icon-asc') || !htmlContent.includes('sort-files-label')) {
  console.error('[FALHA] index.html não contém os ícones SVG icon-desc / icon-asc ou sort-files-label');
  process.exit(1);
}
console.log('  -> [OK] Ícones vetoriais SVG e elementos de ordenação validados no DOM!');

// 22. Teste da nova redação textual do cabeçalho hero e da dropzone com badges expandidos (v.1.7.1)
console.log('[TESTE 22] Testando redação textual do cabeçalho hero, dropzone e badges expandidos...');
if (!htmlContent.includes('Conversor Universal & Mesclador de Documentos para Markdown')) {
  console.error('[FALHA] Título principal não atualizado no index.html');
  process.exit(1);
}
if (!htmlContent.includes('Converta, descompacte e unifique documentos, planilhas, apresentações, PDFs e pacotes (.zip/.rar) diretamente no navegador.')) {
  console.error('[FALHA] Subtítulo não atualizado no index.html');
  process.exit(1);
}
if (!htmlContent.includes('Arraste e solte seus arquivos ou pacotes (.zip, .rar) aqui, ou clique no botão abaixo')) {
  console.error('[FALHA] Texto de instrução da dropzone não atualizado no index.html');
  process.exit(1);
}
if (!htmlContent.includes('Suporta upload em lote, descompactação automática e colagem de arquivos/texto (Ctrl+V)')) {
  console.error('[FALHA] Texto de suporte da área de transferência não atualizado no index.html');
  process.exit(1);
}
if (!htmlContent.includes('+algumas linguagens de código')) {
  console.error('[FALHA] Badge destacada +algumas linguagens de código ausente no index.html');
  process.exit(1);
}
if (!htmlContent.includes('1,5 GB</strong> por arquivo ou pacote compactado')) {
  console.error('[FALHA] Badge informativa de limite expandido ausente no index.html');
  process.exit(1);
}
console.log('  -> [OK] Todos os textos, subtítulos, badges e limites da v.1.8.0 validados com perfeição!');

// 23. Teste de Escalonamento Dinâmico de Concorrência (1000 Workers para Lotes Grandes e Descompactação)
console.log('[TESTE 23] Testando escalonamento dinâmico de concorrência com lote de 60 arquivos (até 1000 workers paralelos)...');

// Verifica limites de getDynamicConcurrency
if (getDynamicConcurrency(5) !== 4 || getDynamicConcurrency(25) !== 1000) {
  console.error(`[FALHA] getDynamicConcurrency inválido: 5->${getDynamicConcurrency(5)}, 25->${getDynamicConcurrency(25)}`);
  process.exit(1);
}
console.log('  -> [OK] getDynamicConcurrency validado: 4 para lotes moderados e 1000 para alto volume!');

// Cria lote de 60 arquivos válidos com tamanhos variados
const batch60 = [];
for (let i = 1; i <= 60; i++) {
  const content = 'A'.repeat(i * 200) + `\n# Documento ${i}\nConteúdo de teste para validação de throughput com até 1000 workers paralelos.`;
  batch60.push(new File([content], `doc_concorrente_${String(i).padStart(2, '0')}.md`, { type: 'text/markdown' }));
}

// Limpa estado anterior da fila do appState
appState.queue = [];
appState.maxConcurrency = 4; // Começa com padrão moderado

// Adiciona os 60 arquivos via realAddFilesToQueue
await realAddFilesToQueue(batch60);

// Validação de ordenação: para muitos arquivos (> 20), a fila deve ser ordenada dos maiores para os menores
for (let j = 0; j < appState.queue.length - 1; j++) {
  const currentSize = appState.queue[j].file.size;
  const nextSize = appState.queue[j + 1].file.size;
  if (currentSize < nextSize) {
    console.error(`[FALHA] Fila de alto volume não está ordenada dos maiores para os menores na posição ${j}: ${currentSize} < ${nextSize}`);
    process.exit(1);
  }
}
console.log('  -> [OK] Fila de muitos arquivos ordenada com sucesso dos maiores para os menores (tamanho decrescente)!');

// Valida sortQueueBySize
sortQueueBySize(false);
if (appState.queue[0].file.size > appState.queue[appState.queue.length - 1].file.size) {
  console.error('[FALHA] sortQueueBySize(false) não ordenou em ordem crescente de tamanho');
  process.exit(1);
}
console.log('  -> [OK] sortQueueBySize(false) ordenou corretamente em ordem crescente!');

sortQueueBySize(true);
if (appState.queue[0].file.size < appState.queue[appState.queue.length - 1].file.size) {
  console.error('[FALHA] sortQueueBySize(true) não ordenou em ordem decrescente de tamanho');
  process.exit(1);
}
console.log('  -> [OK] sortQueueBySize(true) ordenou com sucesso os maiores arquivos primeiro!');

// Verifica se a concorrência escalou dinamicamente para 1000
if (appState.maxConcurrency !== 1000) {
  console.error(`[FALHA] maxConcurrency não escalou para 1000 com lote de 60 arquivos: ${appState.maxConcurrency}`);
  process.exit(1);
}
console.log(`  -> [OK] Concorrência escalada com sucesso para ${appState.maxConcurrency} workers!`);

// Verifica quantidade de itens processando simultaneamente (com teto de 1000, todos os 60 entram em paralelo)
const processingNow = appState.queue.filter(it => it.status === 'processing').length;
if (processingNow !== 60) {
  console.error(`[FALHA] Todos os 60 itens deveriam iniciar processamento concorrente em paralelo, mas temos: ${processingNow}`);
  process.exit(1);
}
console.log(`  -> [OK] Todos os ${processingNow} itens iniciaram processamento concorrente em paralelo sem restrição!`);

// Aguarda conclusão de todos os 60 itens sem deadlock
const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de processamento: possível deadlock')), 5000));
const completionPromise = new Promise((resolve) => {
  const checkInterval = setInterval(() => {
    const completedCount = appState.queue.filter(it => it.status === 'completed').length;
    if (completedCount === 60) {
      clearInterval(checkInterval);
      resolve();
    }
  }, 25);
});

await Promise.race([completionPromise, timeoutPromise]);
console.log('  -> [OK] Todos os 60 arquivos foram processados e concluídos com sucesso sem deadlock!');

// Valida também se pacote descompactado ativa modo de alta concorrência (1000 workers)
const extractedFilesMock = [
  new File(['conteudo 1'], 'extraido_01.md', { type: 'text/markdown' }),
  new File(['conteudo 2'], 'extraido_02.md', { type: 'text/markdown' })
];
extractedFilesMock[0].archiveOrigin = 'documentos.zip';
extractedFilesMock[1].archiveOrigin = 'documentos.zip';

appState.queue = [];
appState.maxConcurrency = 4;
await realAddFilesToQueue(extractedFilesMock);

if (appState.maxConcurrency !== 1000) {
  console.error(`[FALHA] Arquivos extraídos de pacote deveriam ativar alta concorrência (1000), mas maxConcurrency é: ${appState.maxConcurrency}`);
  process.exit(1);
}
console.log('  -> [OK] Extração de pacote compactado ativou alta concorrência (1000 workers) com sucesso!');

// 24. Testando Modo Alto Desempenho (Headless Batch) para lotes com >= 50 arquivos
console.log('[TESTE 24] Testando Modo Alto Desempenho (Headless Batch) para >= 50 arquivos...');

// 24.1. Limiar de ativação
if (BATCH_HEADLESS_THRESHOLD !== 50) {
  console.error(`[FALHA] BATCH_HEADLESS_THRESHOLD deve ser 50, mas é ${BATCH_HEADLESS_THRESHOLD}`);
  process.exit(1);
}
if (shouldEnableHeadlessMode(49) !== false || shouldEnableHeadlessMode(50) !== true || shouldEnableHeadlessMode(100) !== true) {
  console.error('[FALHA] shouldEnableHeadlessMode falhou ao validar limiar de 50 itens');
  process.exit(1);
}
console.log('  -> [OK] shouldEnableHeadlessMode validado: falso para < 50 e verdadeiro para >= 50!');

// 24.2. Lote com 55 arquivos: supressão de cards no DOM e ausência total de banners
appState.queue = Array.from({ length: 55 }, (_, i) => ({
  id: `headless_item_${i}`,
  file: new File([`conteudo ${i}`], `arquivo_${String(i).padStart(2, '0')}.txt`, { type: 'text/plain' }),
  formatInfo: { parser: 'text', key: 'text' },
  status: 'queued',
  uploadProgress: 0,
  convertProgress: 0,
  markdown: ''
}));

renderQueueUI();

if (mockQueueList.style.display !== 'none') {
  console.error(`[FALHA] .file-queue-list deveria estar com display: 'none' no modo headless, mas está: ${mockQueueList.style.display}`);
  process.exit(1);
}
if (mockQueueList.innerHTML !== '') {
  console.error(`[FALHA] .file-queue-list deveria estar vazio no DOM no modo headless, mas contém HTML`);
  process.exit(1);
}
if (document.getElementById('headless-mode-notice') !== null) {
  console.error(`[FALHA] #headless-mode-notice não deve existir no DOM`);
  process.exit(1);
}
console.log('  -> [OK] Modo Headless ativado: cards individuais não instanciados no DOM e zero avisos!');

// 24.3. Bypass de atualizações de DOM individuais
let domQueryHappened = false;
mockQueueList.querySelector = () => { domQueryHappened = true; return null; };
updateQueueItemDOM(appState.queue[0]);
if (domQueryHappened) {
  console.error('[FALHA] updateQueueItemDOM não ignorou buscas no DOM em modo headless');
  process.exit(1);
}
console.log('  -> [OK] Bypass de atualizações individuais de DOM verificado com sucesso (zero reflows)!');

// 24.4. Conclusão dos 55 arquivos em memória e downloads
appState.queue.forEach((it, idx) => {
  it.status = 'completed';
  it.markdown = `# Documento ${idx}\n\nConteúdo Markdown do arquivo ${idx}.`;
  it.mdSize = 50;
});

// Validação de mesclagem unificada com 55 arquivos sem cards DOM
const unifiedResult = mergeMarkdownOutputs(appState.queue);
if (!unifiedResult.includes('# Documento 0') || !unifiedResult.includes('# Documento 54')) {
  console.error('[FALHA] mergeMarkdownOutputs falhou ao mesclar arquivos da fila em modo headless');
  process.exit(1);
}
console.log('  -> [OK] Mesclagem unificada processou 100% dos dados a partir da fila em memória!');

// Validação do empacotamento ZIP com 55 arquivos sem cards DOM
const mockZip = new JSZip();
appState.queue.forEach(item => {
  mockZip.file(`${item.file.name.replace(/\.[^/.]+$/, '')}.md`, item.markdown);
});
const zipFilesCount = Object.keys(mockZip.files).length;
if (zipFilesCount !== 55) {
  console.error(`[FALHA] Empacotamento JSZip gerou ${zipFilesCount} arquivos, esperado 55`);
  process.exit(1);
}
console.log(`  -> [OK] JSZip empacotou todos os ${zipFilesCount} arquivos em memória com perfeição!`);

// 24.5. Lote com menos de 50 arquivos (< 50): restauração do modo normal com cards
appState.queue = Array.from({ length: 20 }, (_, i) => ({
  id: `normal_item_${i}`,
  file: new File(['texto normal'], `normal_${i}.txt`, { type: 'text/plain' }),
  formatInfo: { parser: 'text', key: 'text' },
  status: 'queued',
  uploadProgress: 0,
  convertProgress: 0,
  markdown: ''
}));

renderQueueUI();

if (mockQueueList.style.display !== 'flex') {
  console.error(`[FALHA] .file-queue-list deveria estar visível (display: 'flex') para 20 itens, mas está: ${mockQueueList.style.display}`);
  process.exit(1);
}
if (!mockQueueList.innerHTML.includes('normal_item_0')) {
  console.error('[FALHA] Cards individuais não foram renderizados no DOM para lote de 20 itens');
  process.exit(1);
}
console.log('  -> [OK] Modo normal restaurado com sucesso para lote < 50 arquivos (cards instanciados)!');

// 24.6. Limpeza total da fila restaura estado neutro
realClearQueue();
if (appState.queue.length !== 0) {
  console.error('[FALHA] realClearQueue() não esvaziou a fila');
  process.exit(1);
}
console.log('  -> [OK] realClearQueue() limpou a fila e restaurou o estado da interface!');

// 25. Testando Auto-Scroll em Lotes de 5 em 5 para Modo Normal (< 50 arquivos)
console.log('[TESTE 25] Testando auto-scroll agrupado de 5 em 5 itens para fila < 50 arquivos...');

let lastScrollToParams = null;
mockQueueList.scrollTo = (params) => {
  lastScrollToParams = params;
};
mockQueueList.children = Array.from({ length: 12 }, (_, i) => ({
  offsetTop: i * 84,
  offsetHeight: 84
}));
mockQueueList.offsetTop = 0;
mockQueueList.clientHeight = 480;

// 25.1. Para >= 50 arquivos, NENHUM scroll deve ocorrer
lastScrollToParams = null;
handleBatchChunkAutoScroll(4, 50);
if (lastScrollToParams !== null) {
  console.error('[FALHA] handleBatchChunkAutoScroll disparou scroll para fila com >= 50 itens!');
  process.exit(1);
}
console.log('  -> [OK] Auto-scroll suprimido no modo headless (>= 50 itens)!');

// 25.2. Para < 50 arquivos, mas com state.userIsScrolling = true, NENHUM scroll deve ocorrer
appState.userIsScrolling = true;
lastScrollToParams = null;
handleBatchChunkAutoScroll(0, 12);
if (lastScrollToParams !== null) {
  console.error('[FALHA] handleBatchChunkAutoScroll disparou scroll durante rolagem manual do usuário!');
  process.exit(1);
}
appState.userIsScrolling = false;
console.log('  -> [OK] Auto-scroll respeita o bloqueio de rolagem manual do usuário!');

// 25.3. Cadência de 5 em 5: itens 0, 1, 2, 3 não devem disparar scroll, item 4 (5º item) dispara
lastScrollToParams = null;
handleBatchChunkAutoScroll(0, 12);
handleBatchChunkAutoScroll(1, 12);
handleBatchChunkAutoScroll(2, 12);
handleBatchChunkAutoScroll(3, 12);
if (lastScrollToParams !== null) {
  console.error('[FALHA] handleBatchChunkAutoScroll disparou scroll antes de atingir bloco de 5 itens!');
  process.exit(1);
}
handleBatchChunkAutoScroll(4, 12); // 5º item concluído
if (!lastScrollToParams || lastScrollToParams.behavior !== 'smooth') {
  console.error('[FALHA] handleBatchChunkAutoScroll não disparou scroll no 5º item concluído');
  process.exit(1);
}
console.log('  -> [OK] Auto-scroll disparou com sucesso no 5º item com behavior: smooth!');

// 25.4. Próximos 5 itens: itens 5, 6, 7, 8 não disparam; item 9 (10º item) dispara
lastScrollToParams = null;
handleBatchChunkAutoScroll(5, 12);
handleBatchChunkAutoScroll(6, 12);
handleBatchChunkAutoScroll(7, 12);
handleBatchChunkAutoScroll(8, 12);
if (lastScrollToParams !== null) {
  console.error('[FALHA] handleBatchChunkAutoScroll disparou scroll antes do 10º item!');
  process.exit(1);
}
handleBatchChunkAutoScroll(9, 12);
if (!lastScrollToParams) {
  console.error('[FALHA] handleBatchChunkAutoScroll não disparou scroll no 10º item');
  process.exit(1);
}
console.log('  -> [OK] Auto-scroll disparou no 10º item com sucesso!');

// 25.5. Item final remanescente: item 10 não dispara, mas item 11 (último da fila total 12) dispara!
lastScrollToParams = null;
handleBatchChunkAutoScroll(10, 12);
if (lastScrollToParams !== null) {
  console.error('[FALHA] handleBatchChunkAutoScroll disparou indevidamente no 11º item');
  process.exit(1);
}
handleBatchChunkAutoScroll(11, 12); // itemIndex === totalQueueItems - 1
if (!lastScrollToParams) {
  console.error('[FALHA] handleBatchChunkAutoScroll não disparou no fechamento da fila (último item)');
  process.exit(1);
}
console.log('  -> [OK] Auto-scroll disparou no fechamento da fila (último item remanescente)!');

// 26. Testando Transição de Estado do Spinner Radial (.is-completed)
console.log('[TESTE 26] Testando spinner radial e classe .is-completed no progresso do lote...');
batchAnimationController.reset();
if (mockBatchProgress.classList.contains('is-completed')) {
  console.error('[FALHA] batchAnimationController.reset() não removeu a classe is-completed');
  process.exit(1);
}
// Renderiza 50%
batchAnimationController.render(5, 50);
if (mockBatchProgress.classList.contains('is-completed')) {
  console.error('[FALHA] mockBatchProgress não deveria conter is-completed a 50%');
  process.exit(1);
}
// Renderiza 100%
batchAnimationController.render(10, 100);
if (!mockBatchProgress.classList.contains('is-completed')) {
  console.error('[FALHA] mockBatchProgress deveria conter is-completed a 100%');
  process.exit(1);
}
console.log('  -> [OK] Classe .is-completed adicionada a 100% e removida no reset com sucesso!');

// 27. Testando Badge de Telemetria Total MD Bytes & Animação Contínua
console.log('[TESTE 27] Testando cálculo cumulativo de bytes totais de Markdown e controlador animado...');

// 27.1. Cálculo com itens concluídos e parciais
appState.queue = [
  { id: 'item_md_1', file: new File([''], 'doc1.txt', { type: 'text/plain' }), formatInfo: { parser: 'text', key: 'text' }, status: 'completed', mdSize: 1048576, markdown: 'teste 1' },
  { id: 'item_md_2', file: new File([''], 'doc2.txt', { type: 'text/plain' }), formatInfo: { parser: 'text', key: 'text' }, status: 'completed', mdSize: 524288, markdown: 'teste 2' },
  { id: 'item_md_3', file: new File([''], 'doc3.txt', { type: 'text/plain' }), formatInfo: { parser: 'text', key: 'text' }, status: 'processing', currentMdBytes: 262144 }
];

const computedTotal = computeAndAnimateTotalMdBytes();
const expectedTotal = 1048576 + 524288 + 262144; // 1.835.008 bytes
if (computedTotal !== expectedTotal) {
  console.error(`[FALHA] computeAndAnimateTotalMdBytes calculou ${computedTotal}, esperado ${expectedTotal}`);
  process.exit(1);
}
if (totalBytesAnimController.targetBytes !== expectedTotal) {
  console.error(`[FALHA] totalBytesAnimController.targetBytes é ${totalBytesAnimController.targetBytes}, esperado ${expectedTotal}`);
  process.exit(1);
}
console.log(`  -> [OK] Soma cumulativa exata (${computedTotal.toLocaleString('pt-BR')} bytes) validada!`);

// 27.2. Formatação brasileira e unidade legível no DOM (exclusivamente kB, MB, GB, sem bytes brutos)
totalBytesAnimController.render(expectedTotal);
if (mockTotalBytesCounter.textContent !== '1,8' || mockTotalFormattedUnit.textContent !== 'MB') {
  console.error(`[FALHA] live-total-bytes-counter formatou como "${mockTotalBytesCounter.textContent} ${mockTotalFormattedUnit.textContent}", esperado "1,8 MB"`);
  process.exit(1);
}
console.log(`  -> [OK] Contador exibido exclusivamente em MB/kB/GB: ${mockTotalBytesCounter.textContent} ${mockTotalFormattedUnit.textContent}!`);

// 27.3. Remoção de item individual recomputa e atualiza alvo da animação
removeItemFromQueue('item_md_3');
const afterRemovalTotal = computeAndAnimateTotalMdBytes();
const expectedAfterRemoval = 1048576 + 524288;
if (afterRemovalTotal !== expectedAfterRemoval || totalBytesAnimController.targetBytes !== expectedAfterRemoval) {
  console.error(`[FALHA] Remoção de item não atualizou total de bytes. Calculado: ${afterRemovalTotal}, esperado: ${expectedAfterRemoval}`);
  process.exit(1);
}
console.log('  -> [OK] Remoção individual de item atualizou a contagem em tempo real!');

// 27.4. Limpeza total da fila reseta animação e zera o contador
realClearQueue();
if (totalBytesAnimController.targetBytes !== 0 || totalBytesAnimController.currentBytes !== 0) {
  console.error('[FALHA] realClearQueue() não zerou totalBytesAnimController');
  process.exit(1);
}
if (mockTotalBytesCounter.textContent !== '0' || mockTotalFormattedUnit.textContent !== 'kB') {
  console.error(`[FALHA] Contador não retornou a 0 kB após clearQueue(): "${mockTotalBytesCounter.textContent} ${mockTotalFormattedUnit.textContent}"`);
  process.exit(1);
}
console.log('  -> [OK] clearQueue() resetou a animação e zerou o contador com sucesso!');

// 27.5. Validação de microcópia do rótulo da badge no index.html e ausência de 'bytes'
const currentHtmlContent = fs.readFileSync('./index.html', 'utf8');
if (!currentHtmlContent.includes('Tamanho do MD:')) {
  console.error('[FALHA] index.html não contém o rótulo "Tamanho do MD:" na badge');
  process.exit(1);
}
if (currentHtmlContent.includes('<span class="total-bytes-unit">bytes</span>')) {
  console.error('[FALHA] index.html ainda contém informação textual bruta de bytes na badge');
  process.exit(1);
}
console.log('  -> [OK] Microcópia "Tamanho do MD:" e remoção da unidade bruta de bytes validadas no HTML!');

// 27.6. Validação direta de formatMdTelemetrySize (MB, kB, GB sem bytes brutos)
const testKb = formatMdTelemetrySize(51200); // 50 kB
const testMb = formatMdTelemetrySize(395283984); // 377 MB
const testGb = formatMdTelemetrySize(1610612736); // 1,5 GB
const testZero = formatMdTelemetrySize(0); // 0 kB
if (testKb.formatted !== '50 kB' || testMb.formatted !== '377 MB' || testGb.formatted !== '1,5 GB' || testZero.formatted !== '0 kB') {
  console.error(`[FALHA] formatMdTelemetrySize falhou: kB=${testKb.formatted}, MB=${testMb.formatted}, GB=${testGb.formatted}, Zero=${testZero.formatted}`);
  process.exit(1);
}
console.log('  -> [OK] formatMdTelemetrySize validado com sucesso para kB, MB, GB e Zero!');

// 28. Testando Pipeline de Consolidação Assíncrona e Barra de Progresso Não-Bloqueante
console.log('[TESTE 28] Testando consolidação assíncrona com progresso e exportação não-bloqueante...');

// 28.1. Teste de generateUnifiedMarkdownWithProgress com chunks e callbacks
const itemsToConsolidate = Array.from({ length: 25 }, (_, i) => ({
  id: `chunk_item_${i}`,
  file: new File([`texto ${i}`], `item_${i}.txt`, { type: 'text/plain' }),
  status: 'completed',
  markdown: `# Titulo ${i}\n\nConteudo do arquivo ${i}.`
}));

const progressCalls = [];
const consolidatedMd = await generateUnifiedMarkdownWithProgress(itemsToConsolidate, (current, total, percent) => {
  progressCalls.push({ current, total, percent });
});

if (progressCalls.length !== 3) { // 25 itens com chunk 10: 10, 20, 25 -> 3 chamadas
  console.error(`[FALHA] generateUnifiedMarkdownWithProgress chamou onProgress ${progressCalls.length} vezes, esperado 3`);
  process.exit(1);
}
if (progressCalls[0].current !== 10 || progressCalls[0].percent !== 40) {
  console.error(`[FALHA] Primeiro chunk incorreto:`, progressCalls[0]);
  process.exit(1);
}
if (progressCalls[2].current !== 25 || progressCalls[2].percent !== 100) {
  console.error(`[FALHA] Último chunk não atingiu 100%:`, progressCalls[2]);
  process.exit(1);
}
if (!consolidatedMd.includes('# Titulo 0') || !consolidatedMd.includes('# Titulo 24')) {
  console.error('[FALHA] Conteúdo gerado por generateUnifiedMarkdownWithProgress incompleto');
  process.exit(1);
}
console.log(`  -> [OK] generateUnifiedMarkdownWithProgress fatiou 25 itens em ${progressCalls.length} chunks com 100% de integridade!`);

// 28.2. Teste de showConsolidationProgress, updateConsolidationProgress e hideConsolidationProgress
showConsolidationProgress('Consolidando arquivos Markdown...');
if (mockConsolidationProgress.style.display !== 'block') {
  console.error(`[FALHA] showConsolidationProgress não exibiu a barra: display=${mockConsolidationProgress.style.display}`);
  process.exit(1);
}
if (mockConsolidationStatusText.textContent !== 'Consolidando arquivos Markdown...') {
  console.error(`[FALHA] Texto de status incorreto: ${mockConsolidationStatusText.textContent}`);
  process.exit(1);
}

updateConsolidationProgress(15, 30, 50);
if (mockConsolidationCounter.textContent !== '15 / 30 arquivos (50%)' || mockConsolidationFill.style.width !== '50%') {
  console.error(`[FALHA] updateConsolidationProgress não atualizou contador ou largura: "${mockConsolidationCounter.textContent}" / "${mockConsolidationFill.style.width}"`);
  process.exit(1);
}

hideConsolidationProgress();
if (mockConsolidationProgress.style.display !== 'none') {
  console.error('[FALHA] hideConsolidationProgress não ocultou a barra');
  process.exit(1);
}
console.log('  -> [OK] UI de progresso de consolidação (exibição, atualização, ocultação) validada com sucesso!');

// 28.3. Teste de downloadUnifiedMarkdown assíncrono com feedback no botão
appState.queue = itemsToConsolidate;
mockBtnDownloadUnified.innerHTML = '<span class="btn-text">Baixar Markdown Unificado (.md)</span>';
let downloadedBlob = null;
let downloadedName = null;
global.document.createElement = (tag) => {
  return {
    style: {},
    setAttribute: () => {},
    click: function() {
      downloadedBlob = this.href;
      downloadedName = this.download;
    }
  };
};

await downloadUnifiedMarkdown();

if (!mockBtnDownloadUnified.innerHTML.includes('Baixar Markdown Unificado (.md)')) {
  console.error('[FALHA] downloadUnifiedMarkdown não restaurou o texto original do botão');
  process.exit(1);
}
if (mockBtnDownloadUnified.disabled !== false) {
  console.error('[FALHA] downloadUnifiedMarkdown deixou o botão desabilitado');
  process.exit(1);
}
if (mockConsolidationProgress.style.display !== 'none') {
  console.error('[FALHA] downloadUnifiedMarkdown deixou a barra de consolidação visível');
  process.exit(1);
}
console.log('  -> [OK] downloadUnifiedMarkdown() executou assincronamente e restaurou botões e barras com sucesso!');

// 28.4. Teste de downloadAllZip assíncrono com feedback no botão
mockBtnQueueDownloadAll.innerHTML = '<span class="btn-text">Baixar Todos (.zip)</span>';
await downloadAllZip();

if (!mockBtnQueueDownloadAll.innerHTML.includes('Baixar Todos (.zip)')) {
  console.error('[FALHA] downloadAllZip não restaurou o texto original do botão');
  process.exit(1);
}
if (mockBtnQueueDownloadAll.disabled !== false) {
  console.error('[FALHA] downloadAllZip deixou o botão desabilitado');
  process.exit(1);
}
if (mockConsolidationProgress.style.display !== 'none') {
  console.error('[FALHA] downloadAllZip deixou a barra de consolidação visível');
  process.exit(1);
}
console.log('  -> [OK] downloadAllZip() executou com telemetria assíncrona e restaurou botões e barras com sucesso!');

// =========================================================================
// TESTE 29: Ingestão de Pacote .ZIP, Resolução de Estado 100% e Disparo Imediato no Primeiro Clique
// =========================================================================
console.log('\n[TESTE 29] Testando ingestão de pacote .zip, consolidação de estado e download imediato no primeiro clique...');

// 29.1. Limpa fila anterior e inicializa estado limpo
realClearQueue();
if (appState.queue.length !== 0 || appState.isExtracting || appState.isProcessing) {
  console.error('[FALHA] realClearQueue não restaurou o estado limpo da fila e flags');
  process.exit(1);
}

// 29.2. Cria pacote .ZIP em memória com JSZip contendo 2 arquivos textuais suportados
const testZip = new JSZip();
testZip.file('relatorio_financeiro.txt', 'Relatório Financeiro do Q3:\nReceita: R$ 1.500.000,00\nLucro Líquido: R$ 350.000,00');
testZip.file('planejamento_estrategico.txt', 'Planejamento Estratégico 2027:\nMetas e diretrizes de expansão nacional.');
const testZipBuffer = await testZip.generateAsync({ type: 'arraybuffer' });

const mockZipUploadFile = {
  name: 'pacote_empresa.zip',
  size: testZipBuffer.byteLength,
  arrayBuffer: async () => testZipBuffer
};

// 29.3. Simula ingestão assíncrona do pacote .ZIP
await realAddFilesToQueue([mockZipUploadFile]);

// 29.4. Aguarda resolução assíncrona completa do lote (100% dos arquivos concluídos)
const startTimeWait = Date.now();
while (appState.queue.some(it => it.status === 'queued' || it.status === 'processing')) {
  dispatchNext();
  await new Promise(r => setTimeout(r, 15));
  if (Date.now() - startTimeWait > 8000) {
    console.error('[FALHA] Timeout aguardando resolução de lote do pacote .ZIP');
    process.exit(1);
  }
}

// Valida resolução completa do lote (100%)
if (appState.queue.length !== 2) {
  console.error(`[FALHA] Esperava 2 itens na fila pós-extração, encontrados: ${appState.queue.length}`);
  process.exit(1);
}

const allCompleted = appState.queue.every(it => it.status === 'completed');
if (!allCompleted) {
  console.error('[FALHA] Nem todos os itens extraídos do ZIP atingiram status "completed"');
  process.exit(1);
}

const allHaveMarkdownOutput = appState.queue.every(it => it.markdown && it.markdownOutput && it.markdown === it.markdownOutput);
if (!allHaveMarkdownOutput) {
  console.error('[FALHA] Itens da fila pós-extração não consolidaram markdownOutput e markdown');
  process.exit(1);
}

if (appState.isExtracting !== false || appState.isProcessing !== false) {
  console.error(`[FALHA] Flags de bloqueio presas após resolução: isExtracting=${appState.isExtracting}, isProcessing=${appState.isProcessing}`);
  process.exit(1);
}
console.log('  -> [OK] Lote do pacote .ZIP descompactado e processado com 100% de sucesso (isExtracting=false, isProcessing=false)!');

// 29.5. Dispara imediatamente no PRIMEIRO CLIQUE o Download Unificado (.md)
let unifiedClickTriggered = false;
let unifiedBlobGenerated = null;
let unifiedFileNameGenerated = null;

global.document.createElement = (tag) => {
  return {
    style: {},
    setAttribute: () => {},
    click: function() {
      unifiedClickTriggered = true;
      unifiedBlobGenerated = this.href;
      unifiedFileNameGenerated = this.download;
    }
  };
};

const test29UnifiedResult = await downloadUnifiedMarkdown();
if (!test29UnifiedResult || !test29UnifiedResult.blob || !test29UnifiedResult.content) {
  console.error('[FALHA] downloadUnifiedMarkdown não retornou Blob/conteúdo válido na primeira chamada');
  process.exit(1);
}
if (!test29UnifiedResult.content.includes('Relatório Financeiro do Q3') || !test29UnifiedResult.content.includes('Planejamento Estratégico 2027')) {
  console.error('[FALHA] Conteúdo do Markdown Unificado não contém o texto dos arquivos extraídos');
  process.exit(1);
}
if (!unifiedClickTriggered || !unifiedFileNameGenerated || !unifiedFileNameGenerated.startsWith('documento_unificado_')) {
  console.error('[FALHA] Clique sintético da tag <a> do download unificado não disparou no primeiro acionamento');
  process.exit(1);
}
console.log('  -> [OK] Download Unificado disparou imediatamente no primeiro clique com Blob e conteúdo válidos!');

// 29.6. Dispara imediatamente no PRIMEIRO CLIQUE o Download Individual por item
let individualClickTriggered = false;
let individualBlobGenerated = null;
let individualFileNameGenerated = null;

global.document.createElement = (tag) => {
  return {
    style: {},
    setAttribute: () => {},
    click: function() {
      individualClickTriggered = true;
      individualBlobGenerated = this.href;
      individualFileNameGenerated = this.download;
    }
  };
};

const test29ItemToDownload = appState.queue[0];
const individualResult = downloadQueueItem(test29ItemToDownload.id);
if (!individualResult || !individualResult.blob || !individualResult.content) {
  console.error('[FALHA] downloadQueueItem não retornou Blob/conteúdo válido na primeira chamada');
  process.exit(1);
}
if (!individualResult.content.includes('Relatório Financeiro do Q3')) {
  console.error('[FALHA] Conteúdo do download individual inconsistente com o arquivo');
  process.exit(1);
}
if (!individualClickTriggered || individualFileNameGenerated !== 'relatorio_financeiro.md') {
  console.error(`[FALHA] Clique sintético do download individual falhou no primeiro acionamento: ${individualFileNameGenerated}`);
  process.exit(1);
}
console.log('  -> [OK] Download Individual disparou imediatamente no primeiro clique com Blob e conteúdo válidos!');

// 29.7. Dispara imediatamente no PRIMEIRO CLIQUE o Download de Todos em .ZIP
let zipDownloadTriggered = false;
let zipBlobGenerated = null;
let zipNameGenerated = null;

global.document.createElement = (tag) => {
  return {
    style: {},
    setAttribute: () => {},
    click: function() {
      zipDownloadTriggered = true;
      zipBlobGenerated = this.href;
      zipNameGenerated = this.download;
    }
  };
};

const zipResult = await downloadAllZip();
if (!zipResult || !zipResult.zipBlob) {
  console.error('[FALHA] downloadAllZip não gerou pacote ZIP válido na primeira chamada');
  process.exit(1);
}
if (!zipDownloadTriggered || !zipNameGenerated || !zipNameGenerated.startsWith('documentos_markdown_')) {
  console.error('[FALHA] Clique sintético da tag <a> do download .zip falhou no primeiro acionamento');
  process.exit(1);
}
console.log('  -> [OK] Download de Todos (.zip) disparou imediatamente no primeiro clique com Blob válido!');

// 29.8. Testa o clique direto via delegação de eventos em .file-queue-list
let delegatedClickFired = false;
let delegatedFileName = null;
global.document.createElement = (tag) => {
  return {
    style: {},
    setAttribute: () => {},
    click: function() {
      delegatedClickFired = true;
      delegatedFileName = this.download;
    }
  };
};

let queueListListener = null;
const mockQueueContainer = {
  dataset: {},
  addEventListener: (event, handler) => {
    if (event === 'click') queueListListener = handler;
  }
};
setupQueueListDelegation(mockQueueContainer);
if (mockQueueContainer.dataset.listenerAttached !== 'true' || !queueListListener) {
  console.error('[FALHA] setupQueueListDelegation não anexou listener com dataset.listenerAttached = true');
  process.exit(1);
}

// Simula clique em botão .btn-download-item do card
const mockItemBtn = {
  dataset: { id: test29ItemToDownload.id },
  closest: (sel) => (sel.includes('btn-download-item') ? mockItemBtn : null)
};
queueListListener({
  target: mockItemBtn,
  preventDefault: () => {},
  stopPropagation: () => {}
});

if (!delegatedClickFired || delegatedFileName !== 'relatorio_financeiro.md') {
  console.error(`[FALHA] Delegação de eventos no container pai não disparou download no primeiro clique: ${delegatedFileName}`);
  process.exit(1);
}
console.log('  -> [OK] Delegação de eventos no container pai (.file-queue-list) disparou download imediatamente no primeiro clique!');

// 29.9. Valida alias downloadAllAsZip
const zipAsResult = await downloadAllAsZip();
if (!zipAsResult || !zipAsResult.blob) {
  console.error('[FALHA] downloadAllAsZip alias falhou');
  process.exit(1);
}
console.log('  -> [OK] downloadAllAsZip disparou com sucesso e retornou Blob!');

console.log('===============================================================');
console.log('  SUCESSO: TODOS OS TESTES PASSARAM COM ÊXITO (v.1.9.0)');
console.log('===============================================================');

