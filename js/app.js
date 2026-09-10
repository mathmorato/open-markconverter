/**
 * Universal MarkConverter (doc2md)
 * Controlador Principal da Aplicação
 * @version v.1.4.4
 */

// Telemetria Global de Erros de Runtime e Falhas de Carregamento de CDN
if (typeof window !== 'undefined') {
  window.onerror = function(message, source, lineno, colno, error) {
    const debugEl = typeof document !== 'undefined' ? document.getElementById('debug-status') : null;
    const sourceFile = source ? source.split('/').pop() : 'script';
    const errText = `[Erro Fatal/Script]: ${message} (${sourceFile}:${lineno})`;
    if (debugEl) {
      debugEl.style.display = 'block';
      debugEl.textContent = errText;
      debugEl.className = 'debug-status error';
    }
    console.error('[doc2md Runtime Error]', { message, source, lineno, colno, error });
    return false;
  };

  window.onunhandledrejection = function(event) {
    const debugEl = typeof document !== 'undefined' ? document.getElementById('debug-status') : null;
    const reason = event.reason ? (event.reason.message || String(event.reason)) : 'Falha assíncrona';
    const errText = `[Erro Assíncrono/CDN]: ${reason}`;
    if (debugEl) {
      debugEl.style.display = 'block';
      debugEl.textContent = errText;
      debugEl.className = 'debug-status error';
    }
    console.error('[doc2md Unhandled Rejection]', event.reason);
  };
}

import { APP_CONFIG, loadScript } from './config.js';
import { parseDocx } from './parsers/docx-parser.js';
import { parseSpreadsheet } from './parsers/xlsx-parser.js';
import { parsePptx } from './parsers/pptx-parser.js';
import { parsePdf } from './parsers/pdf-parser.js';
import { parseText } from './parsers/text-parser.js';

// Estado global da sessão local com suporte a fila em lote
const state = {
  theme: 'system',
  queue: [],
  maxConcurrency: 2
};

// Elementos DOM
const elements = typeof document !== 'undefined' ? {
  themeToggle: document.getElementById('theme-toggle'),
  themeIconSun: document.getElementById('theme-icon-sun'),
  themeIconMoon: document.getElementById('theme-icon-moon'),
  headerVersion: document.getElementById('header-version'),
  footerVersion: document.getElementById('footer-version'),
  
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  btnBrowse: document.getElementById('btn-browse'),
  debugStatus: document.getElementById('debug-status'),

  // Elementos da Fila de Arquivos em Lote
  fileQueueSection: document.getElementById('file-queue-section'),
  fileQueueList: document.getElementById('file-queue-list'),
  queueCounter: document.getElementById('queue-counter'),
  btnQueueClear: document.getElementById('btn-queue-clear'),
  btnQueueDownloadAll: document.getElementById('btn-queue-download-all')
} : {};

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

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') {
      applyTheme('system');
    }
  });

  elements.themeToggle.addEventListener('click', () => {
    const currentEffective = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentEffective === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
}

/* ==========================================================================
   Helpers de Formatação e Diagnóstico
   ========================================================================== */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const formatFileSize = formatBytes;

/**
 * Formatação inteligente e condicional de tempo de execução (Xh Ymin Zs)
 * Regras:
 * - ms >= 3600000: Xh Ymin Zs (ex: 1h 12min 4s)
 * - 60000 <= ms < 3600000: Ymin Zs (ex: 2min 15s)
 * - 1000 <= ms < 60000: Zs (ex: 7.3s ou 7s)
 * - ms < 1000: ms (ex: 850ms)
 * - Omitir unidades com zero à esquerda
 */
export function formatElapsedTime(ms) {
  if (ms == null || isNaN(ms) || ms < 0) return '0ms';
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60000) {
    const sec = (ms / 1000).toFixed(1);
    return sec.endsWith('.0') ? `${Math.floor(ms / 1000)}s` : `${sec}s`;
  }
  const hours = Math.floor(ms / 3600000);
  const remMinutes = ms % 3600000;
  const minutes = Math.floor(remMinutes / 60000);
  const seconds = Math.floor((remMinutes % 60000) / 1000);

  if (hours > 0) {
    const parts = [`${hours}h`];
    if (minutes > 0) parts.push(`${minutes}min`);
    if (seconds > 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  }

  // 60000 <= ms < 3600000
  const parts = [`${minutes}min`];
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

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
  if (isError) {
    elements.debugStatus.style.display = 'block';
    elements.debugStatus.textContent = message;
    elements.debugStatus.className = 'debug-status error';
  } else {
    elements.debugStatus.style.display = 'none';
    elements.debugStatus.textContent = '';
    elements.debugStatus.className = 'debug-status';
  }
}

/**
 * Renderiza o ícone vetorial de folha com dobra e etiqueta de extensão (.XXX)
 * @param {string} extension Extensão do arquivo (ex: 'pdf', 'docx', 'xlsx', 'txt')
 */
export function renderFileBadgeIcon(extension) {
  const cleanExt = (extension || '').replace(/^\./, '').toUpperCase() || 'DOC';
  return `
    <div class="file-badge-icon file-icon queue-item-icon" aria-hidden="true" title=".${cleanExt}">
      <svg viewBox="0 0 40 48" class="file-sheet-svg" fill="none" stroke="currentColor">
        <!-- Contorno da folha com dobra superior -->
        <path d="M6 4a2 2 0 0 1 2-2h18l10 10v32a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4z" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M26 2v10h10" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>
      <!-- Etiqueta sobreposta com a extensão -->
      <span class="file-extension-tag">${cleanExt}</span>
    </div>
  `;
}

function getFormatIcon(category, fileName = '') {
  const ext = fileName ? (fileName.split('.').pop() || category) : category;
  return renderFileBadgeIcon(ext);
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
    // Ambiente sem DOM completo ou ambiente de testes Node.js
    if (typeof window === 'undefined' || (typeof FileReader === 'undefined' && typeof file.arrayBuffer === 'function')) {
      if (typeof file.arrayBuffer === 'function') {
        file.arrayBuffer().then(buf => {
          onProgress(100);
          resolve(buf);
        }).catch(reject);
        return;
      }
    }

    const reader = new FileReader();
    let currentPercent = 0;
    let targetPercent = 0;
    let isComplete = false;
    let bufferResult = null;
    let animId = null;

    const tickUI = () => {
      if (currentPercent < targetPercent) {
        const delta = targetPercent - currentPercent;
        // Interpolação macia com interpolação gradual (throttling): avança progressivamente a cada frame
        const inc = Math.max(1, Math.ceil(delta * 0.22));
        currentPercent = Math.min(targetPercent, currentPercent + inc);
        onProgress(currentPercent);
      }

      if (isComplete && currentPercent >= 100) {
        onProgress(100);
        resolve(bufferResult);
        return;
      }

      if (typeof requestAnimationFrame !== 'undefined') {
        animId = requestAnimationFrame(tickUI);
      } else {
        animId = setTimeout(tickUI, 16);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      animId = requestAnimationFrame(tickUI);
    } else {
      animId = setTimeout(tickUI, 16);
    }

    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const raw = Math.min(99, Math.round((event.loaded / event.total) * 100));
        targetPercent = Math.max(targetPercent, raw);
      } else {
        targetPercent = Math.min(90, targetPercent + 10);
      }
    };

    reader.onload = () => {
      bufferResult = reader.result;
      targetPercent = 100;
      isComplete = true;
    };

    reader.onerror = () => {
      if (animId) {
        if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(animId);
        else clearTimeout(animId);
      }
      reject(new Error(`Falha ao ler o arquivo "${file.name}"`));
    };

    reader.readAsArrayBuffer(file);
  });
}

/* ==========================================================================
   Pipeline de Fila em Lote e Central de Documentos (v.1.3.0)
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
      convertText = 'Erro: Arquivo vazio';
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
      convertText = 'Erro: Formato não suportado';
      progress = 100;
      errorMessage = `Extensão "${ext}" não suportada`;
    }

    const queueItem = {
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
      mdSize: 0,
      formattedMdSize: '',
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
    const ext = item.file.name.split('.').pop() || item.formatInfo.parser;
    const formatIcon = renderFileBadgeIcon(ext);
    const statusClass = item.status;
    const badgeErrorClass = item.status === 'error' ? 'badge-error' : '';
    const timeText = item.durationMs ? formatElapsedTime(item.durationMs) : '';
    const isProcessing = item.status === 'processing';
    const isCompleted = item.status === 'completed';
    const isError = item.status === 'error';
    const baseName = item.file.name.replace(/\.[^/.]+$/, '');
    const mdSizeText = (isCompleted && item.formattedMdSize) ? `(MD: ${item.formattedMdSize})` : '';
    const completedClass = isCompleted ? 'completed is-completed' : '';

    return `
      <div class="file-queue-item queue-item ${statusClass} ${completedClass}" data-id="${item.id}" role="listitem" aria-label="${item.file.name}">
        <!-- BLOCO 1: IDENTIFICAÇÃO DO ARQUIVO (Ícone + Nome + Peso Original) -->
        <div class="item-block item-info queue-item-info">
          ${formatIcon}
          <span class="file-name queue-item-name" title="${item.file.name}">${item.file.name}</span>
          <span class="badge-file-size queue-item-size file-meta queue-item-meta">${formatBytes(item.file.size)}</span>
        </div>

        <!-- BLOCO 2: BARRAS DE CARREGAMENTO / PROGRESSO (Visíveis apenas durante processamento) -->
        <div class="item-block item-progress queue-item-progress file-progress-group">
          <div class="mini-progress-wrapper progress-sub-step">
            <div class="mini-progress-label progress-label">
              <span>Upload</span>
              <span class="read-percent upload-percent">${item.uploadText || `${item.uploadProgress}%`}</span>
            </div>
            <div class="mini-progress-track progress-bar-container">
              <div class="mini-progress-fill progress-bar-fill bar-read bar-upload" style="width: ${item.uploadProgress}%;"></div>
            </div>
          </div>
          <div class="mini-progress-wrapper progress-sub-step">
            <div class="mini-progress-label progress-label">
              <span>Conversão <strong class="md-output-size">${mdSizeText}</strong></span>
              <span class="convert-percent">${item.convertText || `${item.convertProgress}%`}</span>
            </div>
            <div class="mini-progress-track progress-bar-container">
              <div class="mini-progress-fill progress-bar-fill bar-convert ${isCompleted ? 'completed' : (isError ? 'error' : '')}" style="width: ${item.convertProgress}%;"></div>
            </div>
          </div>
        </div>

        <!-- BLOCO 3: STATUS ANIMADO & BOTÕES (Tempo + Peso MD + Check + Ações) -->
        <div class="item-block item-actions queue-item-actions queue-item-right">
          <!-- Tempo de conversão formatado (h min s) -->
          <span class="badge-elapsed-time queue-item-time" style="${(isCompleted && timeText) ? 'display: inline-flex;' : 'display: none;'}">${timeText}</span>
          <!-- Tamanho do Markdown à esquerda do certinho -->
          <span class="badge-md-size queue-item-md-size md-output-size" style="${(isCompleted && item.formattedMdSize) ? 'display: inline-flex;' : 'display: none;'}">${mdSizeText}</span>

          <div class="status-indicator">
            <!-- Estado Convertendo: Ampulheta girando -->
            <span class="status-icon icon-hourglass ${isProcessing ? 'spinning' : ''}" title="Convertendo Markdown..." style="${isProcessing ? 'display: inline-flex;' : 'display: none;'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 22h14"/>
                <path d="M5 2h14"/>
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
              </svg>
            </span>
            <!-- Estado Concluído: Certinho verde -->
            <span class="status-icon icon-check ${isCompleted ? 'success' : ''}" title="Concluído" style="${isCompleted ? 'display: inline-flex;' : 'display: none;'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </span>
            <!-- Estado Erro -->
            <span class="status-icon icon-error" title="${item.errorMessage || item.statusText || 'Erro'}" style="${isError ? 'display: inline-flex;' : 'display: none;'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </span>
            <!-- Estado Na Fila -->
            <span class="status-icon icon-queued" title="Na fila" style="${(!isProcessing && !isCompleted && !isError) ? 'display: inline-flex;' : 'display: none;'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </span>
          </div>

          <span class="queue-item-status ${statusClass} ${badgeErrorClass}" id="status-badge-${item.id}" style="display: none;">${item.statusText}</span>

          <button type="button" class="btn-item-action btn-download btn-queue-item-download" data-id="${item.id}" ${isCompleted ? '' : 'disabled'} title="Baixar ${baseName}.md" aria-label="Baixar ${baseName}.md">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button type="button" class="btn-item-action btn-remove btn-queue-item-remove" data-id="${item.id}" title="Remover ${item.file.name}" aria-label="Remover item">
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
    `;
  }).join('');

  // Eventos de clique para download individual e remoção
  elements.fileQueueList.querySelectorAll('.btn-queue-item-download').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      downloadQueueItem(id);
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

  itemEl.className = `file-queue-item queue-item ${item.status} ${item.status === 'completed' ? 'is-completed' : ''}`.trim();
  
  const statusBadge = itemEl.querySelector(`#status-badge-${item.id}`);
  if (statusBadge) {
    const badgeErrorClass = item.status === 'error' ? 'badge-error' : '';
    statusBadge.className = `queue-item-status ${item.status} ${badgeErrorClass}`.trim();
    statusBadge.textContent = item.statusText;
  }

  // Atualiza os ícones do Bloco 3
  const isProcessing = item.status === 'processing';
  const isCompleted = item.status === 'completed';
  const isError = item.status === 'error';
  const isQueued = !isProcessing && !isCompleted && !isError;

  const hourglassIcon = itemEl.querySelector('.icon-hourglass');
  const checkIcon = itemEl.querySelector('.icon-check');
  const errorIcon = itemEl.querySelector('.icon-error');
  const queuedIcon = itemEl.querySelector('.icon-queued');

  if (hourglassIcon) {
    if (isProcessing) {
      hourglassIcon.style.display = 'inline-flex';
      hourglassIcon.classList.add('spinning');
    } else {
      hourglassIcon.style.display = 'none';
      hourglassIcon.classList.remove('spinning');
    }
  }

  if (checkIcon) {
    if (isCompleted) {
      checkIcon.style.display = 'inline-flex';
      checkIcon.classList.add('success');
    } else {
      checkIcon.style.display = 'none';
      checkIcon.classList.remove('success');
    }
  }

  if (errorIcon) {
    errorIcon.style.display = isError ? 'inline-flex' : 'none';
    if (item.errorMessage || item.statusText) {
      errorIcon.setAttribute('title', item.errorMessage || item.statusText);
    }
  }

  if (queuedIcon) {
    queuedIcon.style.display = isQueued ? 'inline-flex' : 'none';
  }

  // Barra 1: Leitura do Arquivo
  const uploadBar = itemEl.querySelector(`.bar-read, .bar-upload`);
  const uploadPercent = itemEl.querySelector(`.read-percent, .upload-percent`);
  if (uploadBar) {
    uploadBar.style.width = `${item.uploadProgress}%`;
  }
  if (uploadPercent) {
    uploadPercent.textContent = item.uploadText || `${item.uploadProgress}%`;
  }

  // Barra 2: Conversão para Markdown
  const convertBar = itemEl.querySelector(`.bar-convert`);
  const convertPercent = itemEl.querySelector(`.convert-percent`);
  if (convertBar) {
    convertBar.style.width = `${item.convertProgress}%`;
    if (item.status === 'completed') {
      convertBar.classList.add('completed');
      convertBar.classList.remove('error');
    } else if (item.status === 'error') {
      convertBar.classList.add('error');
      convertBar.classList.remove('completed');
    } else {
      convertBar.classList.remove('completed', 'error');
    }
  }
  if (convertPercent) {
    convertPercent.textContent = item.convertText || `${item.convertProgress}%`;
  }

  // Telemetria do tamanho do Markdown gerado (no rótulo da barra se houver)
  const mdSizeEl = itemEl.querySelector('.mini-progress-label .md-output-size');
  if (mdSizeEl) {
    mdSizeEl.textContent = (item.status === 'completed' && item.formattedMdSize) ? `(MD: ${item.formattedMdSize})` : '';
  }

  // Telemetria de tamanho do Markdown posicionado à esquerda do certinho no Bloco 3
  const actionsMdSizeEl = itemEl.querySelector('.badge-md-size, .queue-item-md-size');
  if (actionsMdSizeEl) {
    if (item.status === 'completed' && item.formattedMdSize) {
      actionsMdSizeEl.textContent = `(MD: ${item.formattedMdSize})`;
      actionsMdSizeEl.style.display = 'inline-flex';
    } else {
      actionsMdSizeEl.textContent = '';
      actionsMdSizeEl.style.display = 'none';
    }
  }

  // Telemetria de tempo inteligente formatado (h min s) no Bloco 3
  const elapsedTimeEl = itemEl.querySelector('.badge-elapsed-time, .queue-item-time');
  if (elapsedTimeEl) {
    if (item.status === 'completed' && item.durationMs) {
      elapsedTimeEl.textContent = formatElapsedTime(item.durationMs);
      elapsedTimeEl.style.display = 'inline-flex';
    } else {
      elapsedTimeEl.textContent = '';
      elapsedTimeEl.style.display = 'none';
    }
  }

  const downloadBtn = itemEl.querySelector(`.btn-download, .btn-queue-item-download`);
  if (downloadBtn) {
    if (item.status === 'completed') {
      downloadBtn.removeAttribute('disabled');
    } else {
      downloadBtn.setAttribute('disabled', '');
    }
  }
}

function downloadQueueItem(itemId) {
  const item = state.queue.find(it => it.id === itemId);
  if (!item || item.status !== 'completed' || !item.markdown) {
    return;
  }

  const baseName = item.file.name.replace(/\.[^/.]+$/, '');
  downloadMarkdownFile(baseName, item.markdown);
}

function removeQueueItem(itemId) {
  const itemIndex = state.queue.findIndex(it => it.id === itemId);
  if (itemIndex === -1) return;

  const item = state.queue[itemIndex];
  item.cancelled = true;
  state.queue.splice(itemIndex, 1);

  renderQueue();
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

  if (item.file.size > APP_CONFIG.MAX_FILE_SIZE_BYTES) {
    item.status = 'error';
    item.statusText = 'Erro: Excede 1,5 GB';
    item.uploadProgress = 0;
    item.uploadText = '0%';
    item.convertProgress = 100;
    item.convertText = 'Erro: Limite excedido';
    item.progress = 100;
    item.errorMessage = 'Arquivo excede o limite máximo permitido de 1,5 GB.';
    updateQueueItemDOM(item);
    return;
  }

  item.status = 'processing';
  item.statusText = 'Lendo arquivo... (0%)';
  item.uploadProgress = 0;
  item.uploadText = '0%';
  item.convertProgress = 0;
  item.convertText = 'Aguardando...';
  item.progress = 0;
  updateQueueItemDOM(item);

  const startTime = performance.now();
  updateDebugStatus(`[Processando]: ${item.file.name} (${formatBytes(item.file.size)})`);

  try {
    const arrayBuffer = await readFileWithProgress(item.file, (readPercent) => {
      if (item.cancelled) return;
      item.uploadProgress = readPercent;
      item.uploadText = `${readPercent}%`;
      item.convertProgress = 0;
      item.convertText = 'Aguardando...';
      item.statusText = `Upload... (${readPercent}%)`;
      updateQueueItemDOM(item);
    });

    if (item.cancelled) return;

    // Conclusão da etapa 1: Upload 100%
    item.uploadProgress = 100;
    item.uploadText = '100%';
    item.convertProgress = 20;
    item.convertText = '20% (Iniciando parser...)';
    item.statusText = 'Iniciando conversão... (20%)';
    updateQueueItemDOM(item);

    item.file.arrayBuffer = () => Promise.resolve(arrayBuffer);

    // Etapa 2: Progressão Linear Adaptativa (eliminação do travamento em 60%)
    let currentConvert = 20;
    let targetConvert = 20;
    let currentDetail = 'Carregando parser...';

    // Sub-progresso real propagado pelos parsers estruturados
    const onParserSubProgress = (subPercent, subDetail) => {
      if (item.cancelled || item.status === 'completed' || item.status === 'error') return;
      // Mapeia 0-100% do parser para o intervalo visual de 25% a 92%
      const mapped = Math.round(25 + (subPercent * 0.67));
      targetConvert = Math.max(targetConvert, Math.min(92, mapped));
      if (subDetail) currentDetail = subDetail;
    };

    // Ticker / Emulação linear adaptativa com desaceleração logarítmica (easing out)
    const tickerInterval = setInterval(() => {
      if (item.cancelled || item.status === 'completed' || item.status === 'error') {
        clearInterval(tickerInterval);
        return;
      }

      // Se não houver sub-progresso explícito, avança gradualmente com desaceleração suave até 90%
      if (targetConvert <= currentConvert && currentConvert < 90) {
        const remaining = 90 - currentConvert;
        const inc = Math.max(0.25, remaining * 0.04);
        targetConvert = Math.min(90, currentConvert + inc);
      }

      if (currentConvert < targetConvert) {
        const step = (targetConvert - currentConvert) * 0.28;
        currentConvert = Math.min(targetConvert, currentConvert + Math.max(0.4, step));
        const displayVal = Math.round(currentConvert);
        item.convertProgress = displayVal;
        item.convertText = `${displayVal}% (${currentDetail})`;
        item.statusText = `Convertendo... (${displayVal}%)`;
        updateQueueItemDOM(item);
      }
    }, 120);

    let markdown = '';
    try {
      switch (item.formatInfo.parser) {
        case 'docx':
          markdown = await parseDocx(item.file, onParserSubProgress);
          break;
        case 'xlsx':
          markdown = await parseSpreadsheet(item.file, onParserSubProgress);
          break;
        case 'pptx':
          markdown = await parsePptx(item.file, onParserSubProgress);
          break;
        case 'pdf':
          markdown = await parsePdf(item.file, onParserSubProgress);
          break;
        case 'text':
        default:
          markdown = await parseText(item.file, onParserSubProgress);
          break;
      }
    } finally {
      clearInterval(tickerInterval);
    }

    if (item.cancelled) return;

    // Calcula tamanho do Markdown gerado via Blob local UTF-8
    const mdSizeInBytes = new Blob([markdown], { type: 'text/markdown;charset=utf-8' }).size;
    const formattedMdSize = formatBytes(mdSizeInBytes);

    const duration = Math.round(performance.now() - startTime);
    item.status = 'completed';
    item.uploadProgress = 100;
    item.uploadText = '100%';
    item.convertProgress = 100;
    item.convertText = '100%';
    item.progress = 100;
    item.statusText = 'Concluído';
    item.markdown = markdown;
    item.durationMs = duration;
    item.mdSize = mdSizeInBytes;
    item.formattedMdSize = formattedMdSize;
    updateQueueItemDOM(item);

    const formattedDuration = formatElapsedTime(duration);
    updateDebugStatus(`[Concluído]: ${item.file.name} em ${formattedDuration} (MD: ${formattedMdSize})`);
  } catch (error) {
    if (item.cancelled) return;
    const duration = Math.round(performance.now() - startTime);
    item.status = 'error';
    item.convertProgress = 100;
    item.convertText = 'Erro';
    item.progress = 100;
    item.statusText = 'Erro';
    item.errorMessage = error.message || 'Falha durante o processamento';
    item.durationMs = duration;
    updateQueueItemDOM(item);

    const formattedDuration = formatElapsedTime(duration);
    updateDebugStatus(`[Falha]: ${item.file.name} - ${item.errorMessage} (${formattedDuration})`, true);
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
    return;
  }

  if (completed.length === 1) {
    const item = completed[0];
    const baseName = item.file.name.replace(/\.[^/.]+$/, '');
    downloadMarkdownFile(baseName, item.markdown);
    return;
  }

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
  } catch (err) {
    console.error('[doc2md] Erro ao gerar pacote ZIP:', err);
  }
}

function initQueueEvents() {
  if (elements.btnQueueClear) {
    elements.btnQueueClear.addEventListener('click', () => {
      if (state.queue.length === 0) return;
      state.queue.forEach(it => { it.cancelled = true; });
      state.queue = [];
      renderQueue();
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
   Desativação Global de Toasts (Zero Popups Flutuantes)
   ========================================================================== */
export function showToast() {
  // Desativado intencionalmente para erradicar popups e toasts flutuantes da interface.
  // Todo feedback de status permanece estritamente integrado aos cards da fila e à dropzone.
}

/* ==========================================================================
   Inicialização Global do App
   ========================================================================== */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initVersion();
    initTheme();
    initDropzone();
    initQueueEvents();
  });
}
