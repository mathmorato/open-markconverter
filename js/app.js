/**
 * Universal MarkConverter (doc2md)
 * Controlador Principal da Aplicação
 * @version v.1.1.0
 */

// Telemetria Global de Erros de Runtime e Falhas de Carregamento de CDN
window.onerror = function(message, source, lineno, colno, error) {
  const debugEl = document.getElementById('debug-status');
  const sourceFile = source ? source.split('/').pop() : 'script';
  const errText = `[Erro Fatal/Script]: ${message} (${sourceFile}:${lineno})`;
  if (debugEl) {
    debugEl.textContent = errText;
    debugEl.className = 'debug-status error';
  }
  console.error('[doc2md Runtime Error]', { message, source, lineno, colno, error });
  return false;
};

window.onunhandledrejection = function(event) {
  const debugEl = document.getElementById('debug-status');
  const reason = event.reason ? (event.reason.message || String(event.reason)) : 'Falha assíncrona';
  const errText = `[Erro Assíncrono/CDN]: ${reason}`;
  if (debugEl) {
    debugEl.textContent = errText;
    debugEl.className = 'debug-status error';
  }
  console.error('[doc2md Unhandled Rejection]', event.reason);
};

import { APP_CONFIG, loadScript } from './config.js';
import { parseDocx } from './parsers/docx-parser.js';
import { parseSpreadsheet } from './parsers/xlsx-parser.js';
import { parsePptx } from './parsers/pptx-parser.js';
import { parsePdf } from './parsers/pdf-parser.js';
import { parseText } from './parsers/text-parser.js';

// Estado global da sessão local com suporte a fila em lote
const state = {
  currentFile: null,
  currentMarkdown: '',
  theme: 'system',
  viewMode: 'split',
  isConverting: false,
  queue: [],
  activeItemId: null,
  maxConcurrency: 2
};

// Elementos DOM
const elements = {
  themeToggle: document.getElementById('theme-toggle'),
  themeIconSun: document.getElementById('theme-icon-sun'),
  themeIconMoon: document.getElementById('theme-icon-moon'),
  headerVersion: document.getElementById('header-version'),
  footerVersion: document.getElementById('footer-version'),
  
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  btnBrowse: document.getElementById('btn-browse'),
  debugStatus: document.getElementById('debug-status'),
  btnLoadSample: document.getElementById('btn-load-sample'),

  // Elementos da Fila de Arquivos em Lote
  fileQueueSection: document.getElementById('file-queue-section'),
  fileQueueList: document.getElementById('file-queue-list'),
  queueCounter: document.getElementById('queue-counter'),
  btnQueueClear: document.getElementById('btn-queue-clear'),
  btnQueueDownloadAll: document.getElementById('btn-queue-download-all'),
  
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  metricFileName: document.getElementById('metric-file-name'),
  metricFileSize: document.getElementById('metric-file-size'),
  metricFormat: document.getElementById('metric-format'),
  metricConversionTime: document.getElementById('metric-conversion-time'),
  metricWordCount: document.getElementById('metric-word-count'),
  metricLineCount: document.getElementById('metric-line-count'),
  charCounter: document.getElementById('char-counter'),

  splitGrid: document.getElementById('split-grid'),
  tabSplit: document.getElementById('tab-split'),
  tabRaw: document.getElementById('tab-raw'),
  tabPreview: document.getElementById('tab-preview'),

  rawEditor: document.getElementById('raw-markdown-editor'),
  previewContainer: document.getElementById('preview-container'),

  btnCopy: document.getElementById('btn-copy'),
  btnCopyText: document.getElementById('btn-copy-text'),
  btnDownload: document.getElementById('btn-download'),
  btnClear: document.getElementById('btn-clear'),

  toastContainer: document.getElementById('toast-container')
};

/* ==========================================================================
   SemVer & Inicialização de Metadados
   ========================================================================== */
function initVersion() {
  if (elements.headerVersion) elements.headerVersion.textContent = APP_CONFIG.VERSION;
  if (elements.footerVersion) elements.footerVersion.textContent = APP_CONFIG.VERSION;
}

/* ==========================================================================
   Gerenciamento de Temas (Dark / Light / System)
   ========================================================================== */
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  state.theme = theme;
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
  
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  localStorage.setItem(APP_CONFIG.STORAGE_KEYS.THEME, theme);

  if (effectiveTheme === 'dark') {
    elements.themeIconSun.style.display = 'none';
    elements.themeIconMoon.style.display = 'block';
  } else {
    elements.themeIconSun.style.display = 'block';
    elements.themeIconMoon.style.display = 'none';
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.THEME) || 'system';
  applyTheme(savedTheme);

  // Escuta mudanças de preferência do sistema operacional
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') {
      applyTheme('system');
    }
  });

  elements.themeToggle.addEventListener('click', () => {
    const currentEffective = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentEffective === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    showToast(`Tema alterado para ${nextTheme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}`);
  });
}

/* ==========================================================================
   Gerenciamento de Modos de Exibição (Split / Raw / Preview)
   ========================================================================== */
function applyViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem(APP_CONFIG.STORAGE_KEYS.VIEW_MODE, mode);

  elements.tabSplit.classList.toggle('active', mode === 'split');
  elements.tabRaw.classList.toggle('active', mode === 'raw');
  elements.tabPreview.classList.toggle('active', mode === 'preview');

  elements.splitGrid.classList.remove('view-raw-only', 'view-preview-only');
  if (mode === 'raw') {
    elements.splitGrid.classList.add('view-raw-only');
  } else if (mode === 'preview') {
    elements.splitGrid.classList.add('view-preview-only');
  }
}

function initViewMode() {
  const savedMode = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.VIEW_MODE) || 'split';
  applyViewMode(savedMode);

  elements.tabSplit.addEventListener('click', () => applyViewMode('split'));
  elements.tabRaw.addEventListener('click', () => applyViewMode('raw'));
  elements.tabPreview.addEventListener('click', () => applyViewMode('preview'));
}

/* ==========================================================================
   Renderização Markdown com Sanitização e Fallback
   ========================================================================== */
async function renderMarkdown(markdown) {
  if (!markdown || !markdown.trim()) {
    elements.previewContainer.innerHTML = '';
    return;
  }

  try {
    await Promise.all([
      loadScript(APP_CONFIG.CDN.MARKED),
      loadScript(APP_CONFIG.CDN.DOMPURIFY)
    ]);

    if (typeof window.marked !== 'undefined') {
      window.marked.setOptions({
        gfm: true,
        breaks: true
      });

      const rawHtml = window.marked.parse(markdown);
      const cleanHtml = typeof window.DOMPurify !== 'undefined'
        ? window.DOMPurify.sanitize(rawHtml)
        : rawHtml;

      elements.previewContainer.innerHTML = cleanHtml;
      return;
    }
  } catch (err) {
    console.warn('Erro ao carregar renderizador marked/purify:', err);
  }

  // Fallback seguro simples se biblioteca CDN não carregar
  elements.previewContainer.textContent = markdown;
}

/* ==========================================================================
   Cálculo e Atualização de Métricas
   ========================================================================== */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function updateEditorMetrics(text) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split('\n').length : 0;

  elements.metricWordCount.textContent = words.toLocaleString('pt-BR');
  elements.metricLineCount.textContent = lines.toLocaleString('pt-BR');
  elements.charCounter.textContent = `${chars.toLocaleString('pt-BR')} caracteres`;
}

function updateStatus(type, message) {
  elements.statusDot.className = 'status-dot ' + type;
  elements.statusText.textContent = message;
}

/* ==========================================================================
   Roteamento de Conversão por Formato
   ========================================================================== */
function getFormatCategory(fileName) {
  const ext = '.' + fileName.split('.').pop().toLowerCase();

  for (const [key, format] of Object.entries(APP_CONFIG.SUPPORTED_FORMATS)) {
    if (format.ext.includes(ext)) {
      return { key, ...format, ext };
    }
  }

  return {
    key: 'text',
    ext,
    name: `Arquivo (${ext})`,
    category: 'text',
    parser: 'text'
  };
}

function updateDebugStatus(message, isError = false) {
  if (!elements.debugStatus) return;
  elements.debugStatus.textContent = message;
  elements.debugStatus.className = `debug-status ${isError ? 'error' : 'active'}`;
}

/* ==========================================================================
   Helpers de Formato, Download e Leitura Progressiva
   ========================================================================== */
function getFormatIcon(category) {
  switch (category) {
    case 'docx':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    case 'xlsx':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 12v5"/><path d="M12 9v8"/><path d="M17 6v11"/></svg>`;
    case 'pptx':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="3" rx="2"/><path d="M7 21h10"/><path d="M12 17v4"/></svg>`;
    case 'pdf':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-6h2a2 2 0 0 1 0 4H9"/></svg>`;
    case 'text':
    default:
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  }
}

function downloadMarkdownFile(baseName, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function readFileWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      if (typeof file.arrayBuffer === 'function') {
        file.arrayBuffer().then(buf => {
          onProgress(100);
          resolve(buf);
        }).catch(reject);
        return;
      }
    }

    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(percent);
      }
    };
    reader.onload = () => {
      onProgress(100);
      resolve(reader.result);
    };
    reader.onerror = () => {
      reject(new Error(`Falha ao ler o arquivo "${file.name}"`));
    };
    reader.readAsArrayBuffer(file);
  });
}

/* ==========================================================================
   Pipeline de Fila em Lote (Batch Queue Management)
   ========================================================================== */
function addFilesToQueue(files) {
  if (!files || files.length === 0) return;

  const fileList = Array.from(files);
  const newItems = [];

  fileList.forEach(file => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const formatInfo = getFormatCategory(file.name);
    const id = `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    let status = 'queued';
    let statusText = 'Na fila';
    let progress = 0;
    let errorMessage = '';

    if (file.size === 0) {
      status = 'error';
      statusText = 'Erro: Vazio (0 B)';
      progress = 100;
      errorMessage = 'Arquivo vazio (0 bytes)';
    } else if (APP_CONFIG.UNSUPPORTED_BINARY_EXTENSIONS && APP_CONFIG.UNSUPPORTED_BINARY_EXTENSIONS.includes(ext)) {
      status = 'error';
      statusText = 'Erro: Formato não suportado';
      progress = 100;
      errorMessage = `Extensão "${ext}" não suportada`;
    }

    const queueItem = {
      id,
      file,
      formatInfo,
      status,
      statusText,
      progress,
      markdown: '',
      durationMs: 0,
      errorMessage,
      cancelled: false
    };

    newItems.push(queueItem);
  });

  state.queue.push(...newItems);
  renderQueue();
  processQueue();
}

function renderQueue() {
  if (!elements.fileQueueSection || !elements.fileQueueList) return;

  const total = state.queue.length;
  if (total === 0) {
    elements.fileQueueSection.style.display = 'none';
    if (elements.queueCounter) elements.queueCounter.textContent = '0 arquivos';
    return;
  }

  elements.fileQueueSection.style.display = 'block';
  if (elements.queueCounter) {
    elements.queueCounter.textContent = `${total} ${total === 1 ? 'arquivo' : 'arquivos'}`;
  }

  elements.fileQueueList.innerHTML = state.queue.map(item => {
    const isActive = state.activeItemId === item.id;
    const formatIcon = getFormatIcon(item.formatInfo.parser);
    const statusClass = item.status;
    const timeText = item.durationMs ? `${item.durationMs} ms` : '';

    return `
      <div class="queue-item ${isActive ? 'active' : ''} ${statusClass}" data-id="${item.id}" role="listitem" tabindex="0" aria-label="${item.file.name}">
        <div class="queue-item-main">
          <div class="queue-item-left">
            <div class="queue-item-icon" aria-hidden="true">${formatIcon}</div>
            <div class="queue-item-info">
              <span class="queue-item-name" title="${item.file.name}">${item.file.name}</span>
              <div class="queue-item-meta">
                <span class="queue-item-size">${formatBytes(item.file.size)}</span>
                ${timeText ? `<span class="queue-item-time">• ${timeText}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="queue-item-right">
            <span class="queue-item-status ${statusClass}" id="status-badge-${item.id}">${item.statusText}</span>
            <button type="button" class="btn-queue-item-remove" data-id="${item.id}" title="Remover ${item.file.name}" aria-label="Remover item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="progress-bar-container" aria-hidden="true">
          <div class="progress-bar-fill" id="progress-${item.id}" style="width: ${item.progress}%;"></div>
        </div>
      </div>
    `;
  }).join('');

  // Listeners para clique nos itens e botões de remoção
  elements.fileQueueList.querySelectorAll('.queue-item').forEach(itemEl => {
    const id = itemEl.dataset.id;
    itemEl.addEventListener('click', (e) => {
      if (e.target.closest('.btn-queue-item-remove')) return;
      selectQueueItem(id);
    });
  });

  elements.fileQueueList.querySelectorAll('.btn-queue-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      removeQueueItem(id);
    });
  });
}

function updateQueueItemDOM(item) {
  const itemEl = elements.fileQueueList ? elements.fileQueueList.querySelector(`.queue-item[data-id="${item.id}"]`) : null;
  if (!itemEl) return;

  itemEl.className = `queue-item ${state.activeItemId === item.id ? 'active' : ''} ${item.status}`;
  
  const statusBadge = itemEl.querySelector(`#status-badge-${item.id}`);
  if (statusBadge) {
    statusBadge.className = `queue-item-status ${item.status}`;
    statusBadge.textContent = item.statusText;
  }

  const progressBar = itemEl.querySelector(`#progress-${item.id}`);
  if (progressBar) {
    progressBar.style.width = `${item.progress}%`;
  }

  const metaEl = itemEl.querySelector('.queue-item-meta');
  if (metaEl && item.durationMs && !metaEl.querySelector('.queue-item-time')) {
    const timeSpan = document.createElement('span');
    timeSpan.className = 'queue-item-time';
    timeSpan.textContent = `• ${item.durationMs} ms`;
    metaEl.appendChild(timeSpan);
  }
}

async function selectQueueItem(itemId) {
  const item = state.queue.find(it => it.id === itemId);
  if (!item) return;

  state.activeItemId = itemId;
  state.currentFile = item.file;
  state.currentMarkdown = item.markdown || '';

  if (elements.fileQueueList) {
    const itemsDom = elements.fileQueueList.querySelectorAll('.queue-item');
    itemsDom.forEach(el => {
      if (el.dataset.id === itemId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  elements.rawEditor.value = item.markdown || '';
  updateEditorMetrics(item.markdown || '');
  await renderMarkdown(item.markdown || '');

  elements.metricFileName.textContent = item.file.name;
  elements.metricFileSize.textContent = formatBytes(item.file.size);
  elements.metricFormat.textContent = item.formatInfo.ext.toUpperCase();
  elements.metricFormat.className = item.status === 'error' ? 'metric-badge error' : 'metric-badge';
  elements.metricConversionTime.textContent = `${item.durationMs || 0} ms`;

  if (item.status === 'completed') {
    updateStatus('success', 'Documento ativo pronto para edição/exportação');
  } else if (item.status === 'error') {
    updateStatus('error', item.errorMessage || 'Falha na conversão');
  } else if (item.status === 'processing') {
    updateStatus('processing', item.statusText || 'Processando...');
  } else {
    updateStatus('idle', 'Aguardando processamento na fila');
  }
}

function removeQueueItem(itemId) {
  const itemIndex = state.queue.findIndex(it => it.id === itemId);
  if (itemIndex === -1) return;

  const item = state.queue[itemIndex];
  item.cancelled = true;
  state.queue.splice(itemIndex, 1);

  if (state.activeItemId === itemId) {
    const nextCompleted = state.queue.find(it => it.status === 'completed');
    if (nextCompleted) {
      selectQueueItem(nextCompleted.id);
    } else {
      state.activeItemId = null;
      state.currentFile = null;
      state.currentMarkdown = '';
      elements.rawEditor.value = '';
      elements.previewContainer.innerHTML = '';
      elements.metricFileName.textContent = '-';
      elements.metricFileSize.textContent = '0 KB';
      elements.metricFormat.textContent = 'Nenhum';
      elements.metricConversionTime.textContent = '0 ms';
      updateEditorMetrics('');
      updateStatus('idle', 'Pronto para converter');
    }
  }

  renderQueue();
  showToast(`Item "${item.file.name}" removido da fila.`);
  processQueue();
}

async function processQueue() {
  const processingCount = state.queue.filter(it => it.status === 'processing' && !it.cancelled).length;
  if (processingCount >= state.maxConcurrency) {
    return;
  }

  const nextItem = state.queue.find(it => it.status === 'queued' && !it.cancelled);
  if (!nextItem) {
    return;
  }

  processQueueItem(nextItem);

  if (processingCount + 1 < state.maxConcurrency) {
    const anotherItem = state.queue.find(it => it.status === 'queued' && !it.cancelled);
    if (anotherItem) {
      processQueueItem(anotherItem);
    }
  }
}

async function processQueueItem(item) {
  if (item.cancelled) return;

  item.status = 'processing';
  item.progress = 10;
  item.statusText = 'Lendo arquivo... (10%)';
  updateQueueItemDOM(item);

  const startTime = performance.now();
  updateDebugStatus(`[Processando]: ${item.file.name} (${formatBytes(item.file.size)})`);

  try {
    const arrayBuffer = await readFileWithProgress(item.file, (readPercent) => {
      if (item.cancelled) return;
      const overall = Math.round(10 + (readPercent * 0.4));
      item.progress = overall;
      item.statusText = `Processando... (${overall}%)`;
      updateQueueItemDOM(item);
    });

    if (item.cancelled) return;

    item.progress = 60;
    item.statusText = 'Convertendo documento... (60%)';
    updateQueueItemDOM(item);

    // Armazena em cache o buffer para o parser
    item.file.arrayBuffer = () => Promise.resolve(arrayBuffer);

    let markdown = '';
    switch (item.formatInfo.parser) {
      case 'docx':
        markdown = await parseDocx(item.file);
        break;
      case 'xlsx':
        markdown = await parseSpreadsheet(item.file);
        break;
      case 'pptx':
        markdown = await parsePptx(item.file);
        break;
      case 'pdf':
        markdown = await parsePdf(item.file);
        break;
      case 'text':
      default:
        markdown = await parseText(item.file);
        break;
    }

    if (item.cancelled) return;

    const duration = Math.round(performance.now() - startTime);
    item.status = 'completed';
    item.progress = 100;
    item.statusText = 'Concluído';
    item.markdown = markdown;
    item.durationMs = duration;
    updateQueueItemDOM(item);

    updateDebugStatus(`[Concluído]: ${item.file.name} em ${duration} ms`);

    if (!state.activeItemId || state.activeItemId === item.id) {
      selectQueueItem(item.id);
    }

    showToast(`Arquivo "${item.file.name}" convertido em ${duration} ms`, 'success');
  } catch (error) {
    if (item.cancelled) return;
    const duration = Math.round(performance.now() - startTime);
    item.status = 'error';
    item.progress = 100;
    item.statusText = 'Erro';
    item.errorMessage = error.message || 'Falha durante o processamento';
    item.durationMs = duration;
    updateQueueItemDOM(item);

    updateDebugStatus(`[Falha]: ${item.file.name} - ${item.errorMessage}`, true);
    showToast(`Erro ao processar "${item.file.name}": ${item.errorMessage}`, 'error', 4500);

    if (state.activeItemId === item.id) {
      selectQueueItem(item.id);
    }
  } finally {
    processQueue();
  }
}

// Compatibilidade com chamadas diretas
async function convertFile(file) {
  if (!file) return;
  addFilesToQueue([file]);
}

/* ==========================================================================
   Ações Globais de Fila (Limpar e Download em Lote .ZIP)
   ========================================================================== */
async function downloadAllZip() {
  const completed = state.queue.filter(item => item.status === 'completed' && item.markdown);
  if (completed.length === 0) {
    showToast('Nenhum documento convertido disponível para download.', 'info');
    return;
  }

  if (completed.length === 1) {
    const item = completed[0];
    const baseName = item.file.name.replace(/\.[^/.]+$/, '');
    downloadMarkdownFile(baseName, item.markdown);
    showToast(`Arquivo ${baseName}.md baixado com sucesso.`, 'success');
    return;
  }

  showToast('Gerando pacote ZIP com os documentos...', 'info', 2000);
  try {
    await loadScript(APP_CONFIG.CDN.JSZIP);
    const JSZipClass = (typeof window !== 'undefined' && window.JSZip) || globalThis.JSZip;
    if (!JSZipClass) {
      throw new Error('Biblioteca JSZip indisponível.');
    }

    const zip = new JSZipClass();
    const usedNames = new Set();

    completed.forEach(item => {
      let baseName = item.file.name.replace(/\.[^/.]+$/, '');
      let fileName = `${baseName}.md`;
      let counter = 1;
      while (usedNames.has(fileName)) {
        fileName = `${baseName}_${counter}.md`;
        counter++;
      }
      usedNames.add(fileName);
      zip.file(fileName, item.markdown);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documentos_markdown_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Pacote ZIP com ${completed.length} documentos baixado!`, 'success');
  } catch (err) {
    console.error('[doc2md] Erro ao gerar pacote ZIP:', err);
    showToast(`Falha ao gerar ZIP: ${err.message}`, 'error');
  }
}

function initQueueEvents() {
  if (elements.btnQueueClear) {
    elements.btnQueueClear.addEventListener('click', () => {
      if (state.queue.length === 0) return;
      state.queue.forEach(it => { it.cancelled = true; });
      state.queue = [];
      state.activeItemId = null;
      state.currentFile = null;
      state.currentMarkdown = '';
      elements.rawEditor.value = '';
      elements.previewContainer.innerHTML = '';
      elements.metricFileName.textContent = '-';
      elements.metricFileSize.textContent = '0 KB';
      elements.metricFormat.textContent = 'Nenhum';
      elements.metricConversionTime.textContent = '0 ms';
      updateEditorMetrics('');
      updateStatus('idle', 'Pronto para converter');
      renderQueue();
      showToast('Fila de arquivos limpa.');
    });
  }

  if (elements.btnQueueDownloadAll) {
    elements.btnQueueDownloadAll.addEventListener('click', () => {
      downloadAllZip();
    });
  }
}

/* ==========================================================================
   Eventos de Entrada de Arquivos (Botão Nativo, Drag & Drop e Paste)
   ========================================================================== */
function initDropzone() {
  const { dropzone, fileInput, btnBrowse } = elements;

  // 1. Canal Botão Nativo Explícito
  if (btnBrowse && fileInput) {
    btnBrowse.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileInput.value = '';
      fileInput.click();
    });
  }

  // Mudança de arquivo via input nativo com suporte a múltiplos itens
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        console.log(`[doc2md] ${files.length} arquivo(s) capturado(s) via seletor nativo`);
        addFilesToQueue(files);
      }
      fileInput.value = '';
    });
  }

  // 2. Canal Drag & Drop Blindado com suporte a múltiplos arquivos
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  }, false);

  window.addEventListener('drop', (e) => {
    e.preventDefault();
  }, false);

  if (dropzone) {
    dropzone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
      const files = e.dataTransfer ? e.dataTransfer.files : null;
      if (files && files.length > 0) {
        console.log(`[doc2md] ${files.length} arquivo(s) recebido(s) via Drop`);
        addFilesToQueue(files);
      }
    });
  }

  // 3. Suporte a Colar (Paste / Clipboard) iterando todos os arquivos
  window.addEventListener('paste', async (e) => {
    if (document.activeElement === elements.rawEditor) {
      return;
    }

    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      console.log(`[doc2md] ${e.clipboardData.files.length} arquivo(s) recebido(s) via Paste (Clipboard)`);
      addFilesToQueue(e.clipboardData.files);
      return;
    }

    const pastedText = e.clipboardData ? e.clipboardData.getData('text') : '';
    if (pastedText && pastedText.trim()) {
      e.preventDefault();
      console.log('[doc2md] Texto puro recebido via Paste (Clipboard)');
      updateDebugStatus(`[Clipboard]: Texto recebido (${pastedText.length} caracteres)`);
      const mockFile = new File([pastedText], 'texto_colado.txt', { type: 'text/plain' });
      addFilesToQueue([mockFile]);
    }
  });
}

/* ==========================================================================
   Exemplos Rápidos da Interface (UI Quick-Test com pasta examples/)
   ========================================================================== */
function initQuickExamples() {
  const exampleButtons = document.querySelectorAll('.btn-quick-example');
  exampleButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const fileName = btn.dataset.file;
      if (!fileName) return;

      const infoMsg = `[Exemplo]: Carregando "${fileName}" da pasta local...`;
      console.log(`[doc2md] ${infoMsg}`);
      updateDebugStatus(infoMsg);
      showToast(`Adicionando exemplo "${fileName}" à fila...`, 'info', 2000);

      try {
        const response = await fetch(`examples/${encodeURIComponent(fileName)}`);
        if (!response.ok) {
          throw new Error(`Falha HTTP ${response.status} ao obter arquivo`);
        }
        const arrayBuf = await response.arrayBuffer();
        const file = new File([arrayBuf], fileName);
        addFilesToQueue([file]);
      } catch (err) {
        const errMsg = `Erro ao carregar exemplo "${fileName}": ${err.message}`;
        console.error(`[doc2md] ${errMsg}`, err);
        updateDebugStatus(`[Falha]: ${errMsg}`, true);
        showToast(errMsg, 'error', 4500);
      }
    });
  });
}

/* ==========================================================================
   Ações da Barra de Ferramentas (Copiar, Download, Limpar, Exemplo)
   ========================================================================== */
function initActions() {
  // Copiar Markdown
  elements.btnCopy.addEventListener('click', async () => {
    const text = elements.rawEditor.value;
    if (!text) {
      showToast('Nada para copiar.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      
      // Feedback imediato no botão
      const originalText = elements.btnCopyText.textContent;
      elements.btnCopyText.textContent = 'Copiado!';
      elements.btnCopy.classList.add('btn-success');

      setTimeout(() => {
        elements.btnCopyText.textContent = originalText;
        elements.btnCopy.classList.remove('btn-success');
      }, 2000);

      showToast('Markdown copiado para a área de transferência!');
    } catch (err) {
      // Fallback para textarea selection
      elements.rawEditor.select();
      document.execCommand('copy');
      showToast('Copiado com sucesso!');
    }
  });

  // Download do arquivo .md
  elements.btnDownload.addEventListener('click', () => {
    const text = elements.rawEditor.value;
    if (!text) {
      showToast('Nenhum conteúdo para baixar.');
      return;
    }

    const baseName = state.currentFile
      ? state.currentFile.name.replace(/\.[^/.]+$/, '')
      : 'documento';

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Arquivo ${baseName}.md baixado.`);
  });

  // Limpar Editor
  elements.btnClear.addEventListener('click', () => {
    state.currentFile = null;
    state.currentMarkdown = '';
    elements.rawEditor.value = '';
    elements.previewContainer.innerHTML = '';
    elements.metricFileName.textContent = '-';
    elements.metricFileSize.textContent = '0 KB';
    elements.metricFormat.textContent = 'Nenhum';
    elements.metricConversionTime.textContent = '0 ms';
    updateEditorMetrics('');
    updateStatus('idle', 'Pronto para converter');
    showToast('Editor limpo.');
  });

  // Carregar Documento de Demonstração
  elements.btnLoadSample.addEventListener('click', () => {
    const sampleMarkdown = `# Relatório Executivo e Técnico • Universal MarkConverter

## 1. Visão Geral
O **Universal MarkConverter (doc2md)** é uma aplicação moderna para conversão 100% *client-side* de múltiplos formatos de documento em **Markdown semântico e estruturado**.

> **Privacidade Absoluta:** O processamento ocorre integralmente no navegador do usuário, com zero requisições externas para processamento de arquivos.

---

## 2. Comparativo de Recursos

| Formato | Motor de Parsing | Extração Semântica | Status |
| :--- | :--- | :--- | :--- |
| **Word (.docx)** | Mammoth.js + Turndown | Títulos, listas, links e ênfases | Suportado |
| **Planilhas (.xlsx, .csv)** | SheetJS (xlsx) | Tabelas matriciais Markdown nativas | Suportado |
| **Apresentações (.pptx)** | JSZip + DOMParser | Estruturação por slides e tópicos | Suportado |
| **Documentos (.pdf)** | PDF.js | Fluxo contínuo e quebra de páginas | Suportado |
| **Textos / Código** | ES Modules | JSON, HTML, RTF, TXT, XML | Suportado |

---

## 3. Exemplo de Código Extraído

\`\`\`javascript
// Exemplo de integração assíncrona
import { APP_CONFIG } from './js/config.js';

console.log(\`Executando Universal MarkConverter \${APP_CONFIG.VERSION}\`);
\`\`\`

### Checklist de Recursos
- [x] Upload por Drag & Drop
- [x] Detecção automática de formatos
- [x] Visualização em Split View responsivo
- [x] Cópia instantânea e download de arquivo .md
- [x] Suporte a Dark Mode e Light Mode
`;

    const mockFile = new File([sampleMarkdown], 'demonstracao-markconverter.md', { type: 'text/markdown' });
    convertFile(mockFile);
  });

  // Atualização em tempo real quando o usuário digita no editor de Markdown
  let debounceTimeout = null;
  elements.rawEditor.addEventListener('input', () => {
    const text = elements.rawEditor.value;
    state.currentMarkdown = text;
    updateEditorMetrics(text);

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      renderMarkdown(text);
    }, 200);
  });
}

/* ==========================================================================
   Sistema de Toasts
   ========================================================================== */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`.trim();

  let iconSvg = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>`;

  if (type === 'error') {
    iconSvg = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>`;
  } else if (type === 'success') {
    iconSvg = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>`;
  }

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ==========================================================================
   Inicialização Global do App
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initVersion();
  initTheme();
  initViewMode();
  initDropzone();
  initQueueEvents();
  initQuickExamples();
  initActions();
  updateEditorMetrics('');
});
