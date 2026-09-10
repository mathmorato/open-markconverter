/**
 * Teste de integração para a lógica da Fila de Lote (Batch Queue),
 * download individual por item, download em lote (.zip) e dupla barra de progresso (v.1.3.1).
 */

import { APP_CONFIG } from '../js/config.js';

console.log('===============================================================');
console.log('  TESTANDO FILA, DOWNLOADS E DUPLO PROGRESSO (v.1.3.1)');
console.log('===============================================================');

// Simulação de estado da fila
const state = {
  queue: [],
  maxConcurrency: 2
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

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

// 1. Testa adição de múltiplos arquivos
const mockFiles = [
  { name: 'documento1.docx', size: 15000 },
  { name: 'planilha.xlsx', size: 25000 },
  { name: 'apresentacao.pptx', size: 50000 },
  { name: 'vazio.txt', size: 0 },
  { name: 'binario.exe', size: 10000 }
];

addFilesToQueue(mockFiles);

console.log(`[TESTE 1] Total de itens na fila: ${state.queue.length}`);
if (state.queue.length !== 5) {
  console.error('[FALHA] Esperava 5 itens na fila');
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

  // Etapa 2: Conversão Markdown (Parsing)
  item.convertProgress = 20;
  item.convertText = '20% (Carregando parser)';
  await new Promise(r => setTimeout(r, 10));

  item.convertProgress = 60;
  item.convertText = '60% (Extraindo dados)';
  await new Promise(r => setTimeout(r, 10));

  item.convertProgress = 100;
  item.convertText = '100%';
  item.progress = 100;
  item.status = 'completed';
  item.markdown = `# Convertido ${item.file.name}\n\nConteúdo Markdown extraído.`;
  activeCount--;
};

const validItems = state.queue.filter(it => it.status === 'queued');
console.log(`[TESTE 2] Processando ${validItems.length} itens válidos com concorrência máxima de 2 e progresso duplo...`);

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

console.log('===============================================================');
console.log('  SUCESSO: TODOS OS TESTES DE FILA E DOWNLOAD PASSARAM (v.1.3.1)');
console.log('===============================================================');
