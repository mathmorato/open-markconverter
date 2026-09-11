/**
 * Open Mark (doc2md)
 * Controlador Principal da Aplicação
 * @version v.1.8.1
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

import { APP_CONFIG, loadScript, ERROR_CATALOG, CODE_EXTENSIONS_MAP, SUPPORTED_EXTENSIONS, MIME_TYPE_MAP, getDynamicConcurrency } from './config.js';
import { parseDocx } from './parsers/docx-parser.js';
import { parseSpreadsheet } from './parsers/xlsx-parser.js';
import { parsePptx } from './parsers/pptx-parser.js';
import { parsePdf } from './parsers/pdf-parser.js';
import { parseText, parseSourceCode, parseYaml } from './parsers/text-parser.js';

// Estado global da sessão local com suporte a fila em lote e concorrência dinâmica
export const state = {
  theme: 'system',
  queue: [],
  maxConcurrency: 4,
  userIsScrolling: false,
  isMergeEnabled: false,
  sortAscending: true
};

/**
 * Escala dinamicamente o teto de concorrência conforme o volume da fila ou pacotes descompactados
 * @param {boolean} forceHighConcurrency - Força modo agressivo (1000 workers)
 * @returns {number} Concorrência ativa configurada
 */
export function updateDynamicConcurrency(forceHighConcurrency = false) {
  if (forceHighConcurrency) {
    state.maxConcurrency = (APP_CONFIG.CONCURRENCY && APP_CONFIG.CONCURRENCY.HIGH_VOLUME) || 1000;
    return state.maxConcurrency;
  }
  const hasExtractedOrigin = state.queue && state.queue.some(it => it.archiveOrigin && it.archiveOrigin !== '(Upload Direto)');
  if (hasExtractedOrigin) {
    state.maxConcurrency = (APP_CONFIG.CONCURRENCY && APP_CONFIG.CONCURRENCY.HIGH_VOLUME) || 1000;
    return state.maxConcurrency;
  }
  const totalItems = state.queue ? state.queue.length : 0;
  const pendingItems = state.queue ? state.queue.filter(it => it.status === 'queued' || it.status === 'processing').length : 0;
  const count = Math.max(totalItems, pendingItems);
  state.maxConcurrency = getDynamicConcurrency(count);
  return state.maxConcurrency;
}

export { getDynamicConcurrency };

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
  btnQueueDownloadAll: document.getElementById('btn-queue-download-all'),
  toggleMergeMarkdown: document.getElementById('toggle-merge-markdown'),
  btnSortFiles: document.getElementById('btn-sort-files'),
  sortFilesLabel: document.getElementById('sort-files-label'),
  btnQueueDownloadMerged: document.getElementById('btn-download-unified') || document.getElementById('btn-queue-download-merged'),
  btnDownloadUnified: document.getElementById('btn-download-unified') || document.getElementById('btn-queue-download-merged'),
  unifiedActionRow: document.getElementById('unified-action-row') || document.getElementById('unified-download-container'),
  unifiedDownloadContainer: document.getElementById('unified-action-row') || document.getElementById('unified-download-container'),
  batchGlobalProgress: document.getElementById('batch-global-progress'),
  globalProgressCounter: document.getElementById('global-progress-counter'),
  globalProgressFill: document.getElementById('global-progress-fill')
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

/**
 * Extrai a extensão do arquivo de forma defensiva e canônica
 * @param {string} filename Nome do arquivo (ex: 'config.yml', 'DOCUMENTO.YAML')
 * @returns {string} Extensão em minúsculas sem ponto (ex: 'yml', 'yaml')
 */
export function getFileExtension(filename) {
  if (!filename || !filename.includes('.')) return '';
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase().trim();
}

export function getFormatCategory(fileName) {
  const cleanExt = getFileExtension(fileName);
  const ext = cleanExt ? `.${cleanExt}` : '';

  // 1. Mapeamento Unificado de Extensões (SUPPORTED_EXTENSIONS)
  if (cleanExt && SUPPORTED_EXTENSIONS && SUPPORTED_EXTENSIONS[cleanExt]) {
    const item = SUPPORTED_EXTENSIONS[cleanExt];
    return {
      key: item.category,
      ext,
      name: item.label || `Arquivo (${ext})`,
      category: item.category,
      parser: item.parser,
      lang: item.lang
    };
  }

  // 2. Mapeamento Geral por Grupo (APP_CONFIG.SUPPORTED_FORMATS)
  for (const [key, format] of Object.entries(APP_CONFIG.SUPPORTED_FORMATS)) {
    if (format.ext.includes(ext)) {
      return { key, ...format, ext };
    }
  }

  // 3. Matriz Universal de Linguagens de Código-Fonte (CODE_EXTENSIONS_MAP)
  if (cleanExt && CODE_EXTENSIONS_MAP[cleanExt]) {
    return {
      key: 'code',
      ext,
      name: `Código (${CODE_EXTENSIONS_MAP[cleanExt]})`,
      category: 'code',
      parser: 'code'
    };
  }

  return {
    key: 'text',
    ext,
    name: `Arquivo (${ext || 'texto'})`,
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
      <svg viewBox="-2 -2 44 52" class="file-sheet-svg" fill="none" stroke="currentColor">
        <!-- Contorno da folha com dobra superior -->
        <path d="M6 4a2 2 0 0 1 2-2h18l10 10v32a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4z" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M26 2v10h10" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>
      <!-- Etiqueta sobreposta com a extensão -->
      <span class="file-extension-tag">${cleanExt}</span>
    </div>
  `;
}

/**
 * Renderiza o ícone vetorial animado da etapa de Upload
 */
export function renderUploadStepIcon() {
  return `
    <span class="step-icon step-icon-upload" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <!-- Bandeja / Base de apoio -->
        <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        <!-- Seta com haste móvel -->
        <g class="arrow-up-group">
          <polyline points="16 8 12 4 8 8" />
          <line x1="12" y1="4" x2="12" y2="16" />
        </g>
      </svg>
    </span>
  `.trim();
}

/**
 * Renderiza o ícone vetorial animado da etapa de Conversão
 */
export function renderConvertStepIcon() {
  return `
    <span class="step-icon step-icon-convert" aria-hidden="true">
      <svg viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <!-- Folha de origem (esquerda) -->
        <path d="M4 3h7l4 4v14H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <!-- Folha de destino (direita) -->
        <path d="M17 3h7l4 4v14h-11" />
        <!-- Seta de transição central -->
        <g class="arrow-convert-group">
          <line x1="10" y1="12" x2="20" y2="12" />
          <polyline points="17 9 20 12 17 15" />
        </g>
      </svg>
    </span>
  `.trim();
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
  a.download = baseName.endsWith('.md') ? baseName : `${baseName}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Gera timestamp padronizado com data, hora e minuto para nomenclatura de downloads.
 * Formato padrão: YYYY-MM-DD_HHhMMmin (ex.: 2026-09-10_10h30min)
 * @param {Date} [date] Instância de data opcional
 * @returns {string} Timestamp formatado
 */
export function getFormattedTimestamp(date = new Date()) {
  const now = date instanceof Date && !isNaN(date) ? date : new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  // Retorna ex: 2026-09-10_10h30min
  return `${year}-${month}-${day}_${hours}h${minutes}min`;
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
   Descompactação de Pacotes em Memória (.zip, .rar, etc.)
   ========================================================================== */
export function isArchiveExtension(ext) {
  if (!ext) return false;
  const clean = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return APP_CONFIG.ARCHIVE_EXTENSIONS && APP_CONFIG.ARCHIVE_EXTENSIONS.includes(clean);
}

export function isSupportedDocumentExtension(ext) {
  if (!ext) return false;
  const raw = ext.toLowerCase().replace(/^\./, '');
  const dotted = `.${raw}`;
  if (SUPPORTED_EXTENSIONS && SUPPORTED_EXTENSIONS[raw]) return true;
  for (const format of Object.values(APP_CONFIG.SUPPORTED_FORMATS)) {
    if (format.ext.includes(dotted)) return true;
  }
  if (CODE_EXTENSIONS_MAP && CODE_EXTENSIONS_MAP[raw]) return true;
  return false;
}

export function getMimeTypeForExt(ext) {
  const raw = (ext || '').toLowerCase().replace(/^\./, '');
  const dotted = `.${raw}`;
  if (MIME_TYPE_MAP) {
    for (const [mime, targetExt] of Object.entries(MIME_TYPE_MAP)) {
      if (targetExt === raw) return mime;
    }
  }
  for (const format of Object.values(APP_CONFIG.SUPPORTED_FORMATS)) {
    if (format.ext.includes(dotted) && format.mime && format.mime[0]) {
      return format.mime[0];
    }
  }
  return 'text/plain';
}

export async function extractArchiveFiles(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (file.size > APP_CONFIG.MAX_FILE_SIZE_BYTES) {
    throw new Error('Arquivo compactado excede o limite máximo permitido de 1,5 GB.');
  }

  if (ext === '.zip') {
    return await extractZipArchive(file);
  } else {
    // .rar, .7z, .tar, .gz, .bz2
    return await extractRarOrOtherArchive(file, ext);
  }
}

export async function extractZipArchive(file) {
  let JSZipClass = (typeof window !== 'undefined' && window.JSZip) || globalThis.JSZip;

  if (!JSZipClass && typeof window !== 'undefined') {
    await loadScript(APP_CONFIG.CDN.JSZIP);
    JSZipClass = window.JSZip || globalThis.JSZip;
  }

  if (!JSZipClass && typeof process !== 'undefined') {
    try {
      const jszipMod = await import('jszip');
      JSZipClass = jszipMod.default || jszipMod;
    } catch (_) {}
  }

  if (!JSZipClass) {
    throw new Error('Biblioteca JSZip indisponível para descompactação.');
  }

  let buffer;
  if (typeof file.arrayBuffer === 'function') {
    buffer = await file.arrayBuffer();
  } else if (file instanceof ArrayBuffer) {
    buffer = file;
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(file)) {
    buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  } else {
    buffer = await new Promise((resolve, reject) => {
      if (typeof FileReader === 'undefined') {
        return reject(new Error('FileReader indisponível e file.arrayBuffer ausente.'));
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler dados binários do pacote ZIP'));
      reader.readAsArrayBuffer(file);
    });
  }

  const zip = await JSZipClass.loadAsync(buffer);
  const entriesToExtract = [];

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;

    // Ignora pastas vazias, arquivos ocultos e metadados de sistema (__MACOSX, .DS_Store, Thumbs.db, etc.)
    if (
      relativePath.includes('__MACOSX') || 
      relativePath.includes('.DS_Store') || 
      relativePath.includes('Thumbs.db') ||
      relativePath.startsWith('.') || 
      relativePath.includes('/.')
    ) {
      return;
    }

    const fileName = relativePath.split('/').pop();
    if (!fileName || fileName.startsWith('.')) return;

    const entryExt = '.' + fileName.split('.').pop().toLowerCase();
    if (!isSupportedDocumentExtension(entryExt)) {
      return;
    }

    entriesToExtract.push({ fileName, relativePath, entry, entryExt });
  });

  if (entriesToExtract.length === 0) {
    throw new Error('Nenhum documento compatível encontrado dentro do pacote ZIP.');
  }

  const extractedFiles = [];
  for (const item of entriesToExtract) {
    const fileBuffer = await item.entry.async('arraybuffer');
    const mimeType = getMimeTypeForExt(item.entryExt);
    const folderPath = item.relativePath.includes('/')
      ? item.relativePath.substring(0, item.relativePath.lastIndexOf('/'))
      : 'Raiz do Pacote';

    const nativeFile = (typeof File !== 'undefined')
      ? new File([fileBuffer], item.fileName, {
          type: mimeType,
          lastModified: item.entry.date ? item.entry.date.getTime() : Date.now()
        })
      : {
          name: item.fileName,
          size: fileBuffer.byteLength,
          type: mimeType,
          lastModified: item.entry.date ? item.entry.date.getTime() : Date.now(),
          arrayBuffer: async () => fileBuffer
        };

    nativeFile.archiveOrigin = file.name;
    nativeFile.relativePath = item.relativePath;
    nativeFile.folderPath = folderPath;

    extractedFiles.push(nativeFile);
  }

  return extractedFiles;
}

export async function extractRarOrOtherArchive(file, ext) {
  // Tratamento resiliente para formatos RAR / 7Z / TAR:
  // Isola erro caso protegido por senha ou sem decodificador estático Wasm carregado
  throw new Error(`Pacote ${ext.toUpperCase()} com senha ou formato não descompactável em memória.`);
}

/* ==========================================================================
   Pipeline de Fila em Lote e Central de Documentos (v.1.6.0)
   ========================================================================== */
export async function addFilesToQueue(files) {
  if (!files || files.length === 0) return;

  const fileList = Array.from(files);
  const queueCandidates = [];
  let isArchiveExtraction = false;

  for (const file of fileList) {
    const cleanExt = getFileExtension(file.name);
    const ext = cleanExt ? `.${cleanExt}` : '';
    if (isArchiveExtension(ext)) {
      if (file.size > APP_CONFIG.MAX_FILE_SIZE_BYTES) {
        queueCandidates.push({
          file,
          isArchiveError: true,
          errorMessage: 'Arquivo compactado excede o limite máximo permitido de 1,5 GB.'
        });
        continue;
      }

      updateDebugStatus(`[Descompactando]: ${file.name}...`);
      try {
        const extracted = await extractArchiveFiles(file);
        if (extracted && extracted.length > 0) {
          isArchiveExtraction = true;
          extracted.forEach(f => queueCandidates.push({
            file: f,
            archiveOrigin: f.archiveOrigin || file.name,
            relativePath: f.relativePath || f.name,
            folderPath: f.folderPath || (f.relativePath && f.relativePath.includes('/') ? f.relativePath.substring(0, f.relativePath.lastIndexOf('/')) : 'Raiz do Pacote')
          }));
        } else {
          throw new Error('Nenhum documento compatível encontrado no pacote compactado.');
        }
      } catch (err) {
        console.error(`[doc2md] Falha na extração de ${file.name}:`, err);
        queueCandidates.push({
          file,
          isArchiveError: true,
          errorMessage: err.message || 'Falha ao descompactar pacote (arquivo corrompido ou com senha)',
          archiveOrigin: file.name,
          relativePath: file.name,
          folderPath: 'Raiz do Pacote'
        });
      }
    } else {
      queueCandidates.push({
        file,
        archiveOrigin: file.archiveOrigin || '(Upload Direto)',
        relativePath: file.relativePath || file.name,
        folderPath: file.folderPath || 'Raiz'
      });
    }
  }

  const newItems = [];
  queueCandidates.forEach(({ file, isArchiveError, errorMessage: archiveErrMsg, archiveOrigin, relativePath, folderPath }) => {
    const cleanExt = getFileExtension(file.name);
    const ext = cleanExt ? `.${cleanExt}` : '';
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

    if (isArchiveError) {
      status = 'error';
      statusText = 'Erro de conversão';
      uploadProgress = 0;
      uploadText = '0%';
      convertProgress = 0;
      convertText = 'Erro';
      progress = 0;
      errorMessage = archiveErrMsg || ERROR_CATALOG.CORRUPTED_ARCHIVE;
    } else if (file.size === 0) {
      status = 'error';
      statusText = 'Erro de conversão';
      uploadProgress = 0;
      uploadText = '0%';
      convertProgress = 0;
      convertText = 'Erro';
      progress = 0;
      errorMessage = ERROR_CATALOG.EMPTY_FILE;
    } else if (file.size > APP_CONFIG.MAX_FILE_SIZE_BYTES) {
      status = 'error';
      statusText = 'Erro de conversão';
      uploadProgress = 0;
      uploadText = '0%';
      convertProgress = 0;
      convertText = 'Erro';
      progress = 0;
      errorMessage = ERROR_CATALOG.FILE_TOO_LARGE;
    } else if (APP_CONFIG.UNSUPPORTED_BINARY_EXTENSIONS && APP_CONFIG.UNSUPPORTED_BINARY_EXTENSIONS.includes(ext)) {
      status = 'error';
      statusText = 'Erro de conversão';
      uploadProgress = 0;
      uploadText = '0%';
      convertProgress = 0;
      convertText = 'Erro';
      progress = 0;
      errorMessage = `${ERROR_CATALOG.PARSER_NOT_FOUND} (Extensão "${ext}")`;
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
      cancelled: false,
      archiveOrigin: archiveOrigin || file.archiveOrigin || '(Upload Direto)',
      relativePath: relativePath || file.relativePath || file.name,
      folderPath: folderPath || file.folderPath || (file.relativePath && file.relativePath.includes('/') ? file.relativePath.substring(0, file.relativePath.lastIndexOf('/')) : 'Raiz')
    };

    newItems.push(queueItem);
  });

  // Se houver muitos arquivos (lote > 20 ou total acumulado > 20), ordena dos maiores para os menores
  const isHighVolume = queueCandidates.length > 20 || (state.queue.length + newItems.length) > 20;
  if (isHighVolume) {
    newItems.sort((a, b) => {
      const sizeA = a.file ? a.file.size : (a.size || 0);
      const sizeB = b.file ? b.file.size : (b.size || 0);
      if (sizeA !== sizeB) return sizeB - sizeA;
      const nameA = a.file ? a.file.name : (a.name || '');
      const nameB = b.file ? b.file.name : (b.name || '');
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  state.queue.push(...newItems);

  // Se a fila acumulada contiver muitos arquivos (> 20), ordena os itens pendentes dos maiores para os menores
  if (state.queue.length > 20) {
    const queuedIndices = [];
    const queuedList = [];
    state.queue.forEach((item, idx) => {
      if (item.status === 'queued' && !item.cancelled) {
        queuedIndices.push(idx);
        queuedList.push(item);
      }
    });
    if (queuedList.length > 0) {
      queuedList.sort((a, b) => {
        const sizeA = a.file ? a.file.size : (a.size || 0);
        const sizeB = b.file ? b.file.size : (b.size || 0);
        if (sizeA !== sizeB) return sizeB - sizeA;
        const nameA = a.file ? a.file.name : (a.name || '');
        const nameB = b.file ? b.file.name : (b.name || '');
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });
      queuedIndices.forEach((pos, i) => {
        state.queue[pos] = queuedList[i];
      });
    }
  }

  state.userIsScrolling = false;

  // Escala dinamicamente a concorrência para até 1000 workers ao descompactar ou com lote > 20 arquivos
  const hasExtractedOrigin = fileList.some(f => f.archiveOrigin && f.archiveOrigin !== '(Upload Direto)') || isArchiveExtraction;
  if (hasExtractedOrigin || queueCandidates.length > 20 || state.queue.length > 20) {
    state.maxConcurrency = (APP_CONFIG.CONCURRENCY && APP_CONFIG.CONCURRENCY.HIGH_VOLUME) || 1000;
  } else {
    updateDynamicConcurrency();
  }

  renderQueue();
  updateGlobalBatchProgress();
  dispatchNext();
}

function renderQueue() {
  if (!elements.fileQueueSection || !elements.fileQueueList) return;

  const total = state.queue.length;
  if (total === 0) {
    elements.fileQueueSection.style.display = 'none';
    if (elements.queueCounter) elements.queueCounter.textContent = '0 arquivos';
    updateGlobalBatchProgress();
    return;
  }

  elements.fileQueueSection.style.display = 'block';
  if (elements.queueCounter) {
    elements.queueCounter.textContent = `${total} ${total === 1 ? 'arquivo' : 'arquivos'}`;
  }

  const completedCount = state.queue.filter(it => it.status === 'completed' && it.markdown).length;
  if (elements.btnQueueDownloadAll) {
    if (completedCount === 0) elements.btnQueueDownloadAll.setAttribute('disabled', '');
    else elements.btnQueueDownloadAll.removeAttribute('disabled');
  }
  if (elements.btnQueueDownloadMerged) {
    if (completedCount === 0) elements.btnQueueDownloadMerged.setAttribute('disabled', '');
    else elements.btnQueueDownloadMerged.removeAttribute('disabled');
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
    
    // Obtenção segura do tamanho do Markdown convertido (defesa contra ReferenceError)
    const mdSizeInBytes = item.mdSize 
      || (item.markdownOutput ? new Blob([item.markdownOutput], { type: 'text/markdown;charset=utf-8' }).size : 0)
      || (item.markdown ? new Blob([item.markdown], { type: 'text/markdown;charset=utf-8' }).size : 0);
    const mdSizeText = (isCompleted && (item.formattedMdSize || mdSizeInBytes > 0))
      ? `(MD: ${item.formattedMdSize || formatBytes(mdSizeInBytes)})`
      : '';

    const isReading = !!item.isReading;
    const readingClass = isReading ? 'is-reading' : '';
    const isUploadDone = (item.uploadProgress >= 100) || isCompleted;
    const isConvertDone = (item.convertProgress >= 100) || isCompleted;
    const uploadDoneClass = isUploadDone ? 'upload-done' : '';
    const convertDoneClass = isConvertDone ? 'convert-done' : '';
    const completedClass = isCompleted ? 'completed is-completed' : '';
    const hasErrorClass = isError ? 'has-error' : '';

    return `
      <div class="file-queue-item queue-item ${statusClass} ${hasErrorClass} ${completedClass} ${readingClass} ${uploadDoneClass} ${convertDoneClass}" data-id="${item.id}" role="listitem" aria-label="${item.file.name}">
        <!-- BLOCO 1: IDENTIFICAÇÃO DO ARQUIVO (Ícone + Nome + Peso Original) -->
        <div class="item-block item-info queue-item-info">
          ${formatIcon}
          <span class="file-name queue-item-name" title="${item.file.name}">${item.file.name}</span>
          <span class="badge-file-size queue-item-size file-meta queue-item-meta">${formatBytes(item.file.size)}</span>
        </div>

        <!-- BLOCO 2: BARRAS DE CARREGAMENTO / PROGRESSO (Ocultas se .has-error ou concluído) -->
        <div class="item-block item-progress queue-item-progress file-progress-group">
          <div class="mini-progress-wrapper progress-sub-step step-upload">
            <div class="mini-progress-label progress-label">
              <span class="label-with-icon">
                ${renderUploadStepIcon()}
                Upload
              </span>
              <span class="read-percent upload-percent upload-status-text">${item.uploadText || `${item.uploadProgress}%`}</span>
            </div>
            <div class="mini-progress-track progress-bar-container">
              <div class="mini-progress-fill progress-bar-fill bar-read bar-upload" style="width: ${item.uploadProgress}%;"></div>
            </div>
          </div>
          <div class="mini-progress-wrapper progress-sub-step step-conversion">
            <div class="mini-progress-label progress-label">
              <span class="label-with-icon">
                ${renderConvertStepIcon()}
                Conversão <strong class="md-output-size">${mdSizeText}</strong>
              </span>
              <span class="convert-percent convert-status-text">${item.convertText || `${item.convertProgress}%`}</span>
            </div>
            <div class="mini-progress-track progress-bar-container">
              <div class="mini-progress-fill progress-bar-fill bar-convert ${isCompleted ? 'completed' : (isError ? 'error' : '')}" style="width: ${item.convertProgress}%;"></div>
            </div>
          </div>
        </div>

        <!-- BLOCO DE ERRO: Substitui as barras em caso de falha -->
        <div class="item-block item-error-container" style="${isError ? 'display: flex;' : 'display: none;'}">
          <div class="item-error-badge" title="${item.errorMessage || 'Erro de conversão'}">
            <span class="icon-error-circle" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </span>
            <span class="error-text">Erro de conversão</span>
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
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 22h14"/>
                <path d="M5 2h14"/>
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
              </svg>
            </span>
            <!-- Estado Concluído: Certinho verde -->
            <span class="status-icon icon-check ${isCompleted ? 'success' : ''}" title="Concluído" style="${isCompleted ? 'display: inline-flex;' : 'display: none;'}">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </span>
            <!-- Estado Erro -->
            <span class="status-icon icon-error" title="${item.errorMessage || item.statusText || 'Erro'}" style="${isError ? 'display: inline-flex;' : 'display: none;'}">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </span>
            <!-- Estado Na Fila -->
            <span class="status-icon icon-queued" title="Na fila" style="${(!isProcessing && !isCompleted && !isError) ? 'display: inline-flex;' : 'display: none;'}">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </span>
          </div>

          <span class="queue-item-status ${statusClass} ${badgeErrorClass}" id="status-badge-${item.id}" style="display: none;">${item.statusText}</span>

          <button type="button" class="btn-item-action btn-download btn-queue-item-download" data-id="${item.id}" ${isCompleted ? '' : 'disabled'} title="Baixar ${baseName}.md" aria-label="Baixar ${baseName}.md">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button type="button" class="btn-item-action btn-remove btn-queue-item-remove" data-id="${item.id}" title="Remover ${item.file.name}" aria-label="Remover item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

  updateGlobalBatchProgress();
}

// Otimização de renderização concorrente via requestAnimationFrame batching
const pendingQueueDOMUpdates = new Map();
let queueRafId = null;

function flushQueueDOMUpdates() {
  queueRafId = null;
  const items = Array.from(pendingQueueDOMUpdates.values());
  pendingQueueDOMUpdates.clear();
  for (const item of items) {
    applyQueueItemDOMUpdate(item);
  }
}

/**
 * Atualiza o DOM do item da fila com throttle e batching via requestAnimationFrame
 * para garantir 60 FPS e ausência de jank com até 1000 itens simultâneos
 * @param {Object} item - Objeto do item da fila
 * @param {boolean} immediate - Se true, ignora o RAF e atualiza síncrono
 */
export function updateQueueItemDOM(item, immediate = false) {
  if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined' || immediate) {
    applyQueueItemDOMUpdate(item);
    return;
  }

  // Atualizações terminais (sucesso ou erro) descarregam de imediato para feedback instantâneo
  if (item.status === 'completed' || item.status === 'error') {
    pendingQueueDOMUpdates.delete(item.id);
    applyQueueItemDOMUpdate(item);
    return;
  }

  // Microeventos de progresso (upload e parsing): agrupa no RAF
  pendingQueueDOMUpdates.set(item.id, item);
  if (!queueRafId) {
    queueRafId = requestAnimationFrame(flushQueueDOMUpdates);
  }
}

function applyQueueItemDOMUpdate(item) {
  const itemEl = elements.fileQueueList ? elements.fileQueueList.querySelector(`.queue-item[data-id="${item.id}"]`) : null;
  if (!itemEl) return;

  const isReading = !!item.isReading;
  const readingClass = isReading ? 'is-reading' : '';
  const isUploadDone = (item.uploadProgress >= 100) || item.status === 'completed';
  const isConvertDone = (item.convertProgress >= 100) || item.status === 'completed';
  const uploadDoneClass = isUploadDone ? 'upload-done' : '';
  const convertDoneClass = isConvertDone ? 'convert-done' : '';
  const isError = item.status === 'error';
  const hasErrorClass = isError ? 'has-error' : '';

  itemEl.className = `file-queue-item queue-item ${item.status} ${hasErrorClass} ${item.status === 'completed' ? 'is-completed' : ''} ${readingClass} ${uploadDoneClass} ${convertDoneClass}`.trim();
  
  // Atualiza bloco de erro explícito em caso de falha
  const errorContainer = itemEl.querySelector('.item-error-container');
  if (errorContainer) {
    errorContainer.style.display = isError ? 'flex' : 'none';
    const badge = errorContainer.querySelector('.item-error-badge');
    if (badge) {
      badge.setAttribute('title', item.errorMessage || 'Erro de conversão');
    }
  }

  const statusBadge = itemEl.querySelector(`#status-badge-${item.id}`);
  if (statusBadge) {
    const badgeErrorClass = isError ? 'badge-error' : '';
    statusBadge.className = `queue-item-status ${item.status} ${badgeErrorClass}`.trim();
    statusBadge.textContent = item.statusText;
  }

  // Atualiza os ícones do Bloco 3
  const isProcessing = item.status === 'processing';
  const isCompleted = item.status === 'completed';
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
  const uploadPercent = itemEl.querySelector(`.upload-status-text, .read-percent, .upload-percent`);
  if (uploadBar) {
    uploadBar.style.width = `${item.uploadProgress}%`;
  }
  if (uploadPercent) {
    uploadPercent.textContent = item.uploadText || `${item.uploadProgress}%`;
  }

  // Barra 2: Conversão para Markdown (atualização seletiva sem innerHTML)
  const convertBar = itemEl.querySelector(`.bar-convert`);
  const convertPercent = itemEl.querySelector(`.convert-status-text, .convert-percent`);
  const integerConvertProgress = Math.round(Number(item.convertProgress) || 0);
  if (convertBar) {
    convertBar.style.width = `${integerConvertProgress}%`;
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
    let formattedText = item.convertText || `${integerConvertProgress}%`;
    formattedText = formattedText
      .replace(/(\d+)\.\d+%/g, '$1%')
      .replace(/Página\s+(\d+)\s*\/\s*(\d+)/gi, 'pg. $1/$2')
      .replace(/Página\s+(\d+)\s+de\s+(\d+)/gi, 'pg. $1/$2');
    convertPercent.textContent = formattedText;
  }

  // Obtenção segura do tamanho do Markdown convertido
  const mdSizeInBytes = item.mdSize 
    || (item.markdownOutput ? new Blob([item.markdownOutput], { type: 'text/markdown;charset=utf-8' }).size : 0)
    || (item.markdown ? new Blob([item.markdown], { type: 'text/markdown;charset=utf-8' }).size : 0);
  const mdSizeText = (item.status === 'completed' && (item.formattedMdSize || mdSizeInBytes > 0))
    ? `(MD: ${item.formattedMdSize || formatBytes(mdSizeInBytes)})`
    : '';

  // Telemetria do tamanho do Markdown gerado (no rótulo da barra se houver)
  const mdSizeEl = itemEl.querySelector('.mini-progress-label .md-output-size');
  if (mdSizeEl) {
    mdSizeEl.textContent = mdSizeText;
  }

  // Telemetria de tamanho do Markdown posicionado à esquerda do certinho no Bloco 3
  const actionsMdSizeEl = itemEl.querySelector('.badge-md-size, .queue-item-md-size');
  if (actionsMdSizeEl) {
    actionsMdSizeEl.textContent = mdSizeText;
    actionsMdSizeEl.style.display = mdSizeText ? 'inline-flex' : 'none';
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

  const completedCount = state.queue.filter(it => it.status === 'completed' && it.markdown).length;
  if (elements.btnQueueDownloadAll) {
    if (completedCount === 0) elements.btnQueueDownloadAll.setAttribute('disabled', '');
    else elements.btnQueueDownloadAll.removeAttribute('disabled');
  }
  if (elements.btnQueueDownloadMerged) {
    if (completedCount === 0) elements.btnQueueDownloadMerged.setAttribute('disabled', '');
    else elements.btnQueueDownloadMerged.removeAttribute('disabled');
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

/**
 * Auto-scroll desativado em definitivo para garantir estabilidade visual da fila.
 * A fila de documentos permanece 100% estática na posição definida pelo usuário,
 * sem solavancos durante a conversão concorrente.
 * Mantida como no-op para retrocompatibilidade com suítes de teste e módulos externos.
 * @param {string|HTMLElement} itemOrId
 */
export function scrollQueueToActiveItem(itemOrId) {
  // Auto-scroll desativado em definitivo (fila 100% estática)
  return;
}

/**
 * Alias de retrocompatibilidade para scrollQueueToActiveItem (no-op)
 * @param {string|HTMLElement} itemOrId
 */
export function scrollQueueToItem(itemOrId) {
  return;
}

/**
 * Alias adicional para scrollQueueToActiveItem (no-op)
 * @param {string|HTMLElement} itemIdOrElement
 */
export function scrollToActiveItem(itemIdOrElement) {
  return;
}

/**
 * Controlador de Animação com Delta-Time e Amortecimento Exponencial (Lerp)
 * Garante sincronia a 60 FPS, sem saltos bruscos ou jank visual sob alta concorrência.
 */
export const batchAnimationController = {
  currentCount: 0,
  targetCount: 0,
  currentPercent: 0,
  targetPercent: 0,
  total: 0,
  lastFrameTime: null,
  rafId: null,

  updateTargets(completed, total) {
    this.targetCount = completed;
    this.total = total;
    this.targetPercent = total > 0 ? (completed / total) * 100 : 0;

    if (typeof requestAnimationFrame === 'function') {
      if (!this.rafId) {
        this.lastFrameTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        this.rafId = requestAnimationFrame((now) => this.tick(now));
      }
    } else {
      // Fallback síncrono para ambientes sem requestAnimationFrame (ex: Node.js)
      this.currentCount = this.targetCount;
      this.currentPercent = this.targetPercent;
      this.render(this.targetCount, this.targetPercent);
    }
  },

  tick(now) {
    const perfNow = typeof now === 'number' ? now : (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    const dt = Math.min((perfNow - (this.lastFrameTime || perfNow)) / 1000, 0.1); // Trava dt máximo para evitar saltos após tab background
    this.lastFrameTime = perfNow;

    // Coeficiente de convergência ágil (ajuste fino para não arrastar nem travar)
    const smoothing = 1 - Math.exp(-12 * dt);

    const diffCount = this.targetCount - this.currentCount;
    const diffPercent = this.targetPercent - this.currentPercent;

    if (Math.abs(diffCount) > 0.08 || Math.abs(diffPercent) > 0.08) {
      this.currentCount += diffCount * smoothing;
      this.currentPercent += diffPercent * smoothing;

      this.render(Math.round(this.currentCount), this.currentPercent);
      if (typeof requestAnimationFrame === 'function') {
        this.rafId = requestAnimationFrame((n) => this.tick(n));
      } else {
        this.rafId = null;
      }
    } else {
      // Encerramento preciso no alvo
      this.currentCount = this.targetCount;
      this.currentPercent = this.targetPercent;
      this.render(this.targetCount, this.targetPercent);
      this.rafId = null;
    }
  },

  render(displayCount, displayPercent) {
    const counterEl = (elements && elements.globalProgressCounter) || (typeof document !== 'undefined' ? document.getElementById('global-progress-counter') : null);
    const fillEl = (elements && elements.globalProgressFill) || (typeof document !== 'undefined' ? document.getElementById('global-progress-fill') : null);

    if (counterEl) {
      const roundedPct = Math.min(100, Math.round(displayPercent));
      counterEl.textContent = `${displayCount.toLocaleString('pt-BR')} / ${this.total.toLocaleString('pt-BR')} arquivos processados (${roundedPct}%)`;
    }

    if (fillEl) {
      fillEl.style.width = `${displayPercent.toFixed(2)}%`;
      if (displayPercent >= 99.99) {
        fillEl.classList.add('finished');
      } else {
        fillEl.classList.remove('finished');
      }
    }
  },

  reset() {
    if (this.rafId) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId);
      }
      this.rafId = null;
    }
    this.currentCount = 0;
    this.targetCount = 0;
    this.currentPercent = 0;
    this.targetPercent = 0;
    this.total = 0;
    this.lastFrameTime = null;
    this.render(0, 0);
  }
};

/**
 * Atualiza em tempo real a barra de progresso global agregada para lotes (> 10 arquivos).
 * Para até 10 arquivos, a barra permanece estritamente oculta (display = 'none').
 */
export function updateGlobalBatchProgress() {
  const total = state && state.queue ? state.queue.length : 0;
  const globalProgressEl = (elements && elements.batchGlobalProgress) || (typeof document !== 'undefined' ? document.getElementById('batch-global-progress') : null);
  if (!globalProgressEl) return;

  if (total > 10) {
    globalProgressEl.style.display = 'block';
  } else {
    globalProgressEl.style.display = 'none';
    batchAnimationController.reset();
    return;
  }

  const completed = state.queue.filter(item => item.status === 'completed' || item.status === 'error').length;
  batchAnimationController.updateTargets(completed, total);
}

/**
 * Despacha tarefas da fila concorrente até preencher o teto de concorrência (até 1000 workers paralelos)
 */
export function dispatchNext() {
  updateDynamicConcurrency();
  let processingCount = state.queue.filter(it => it.status === 'processing' && !it.cancelled).length;

  while (processingCount < state.maxConcurrency) {
    const queuedItems = state.queue.filter(it => it.status === 'queued' && !it.cancelled);
    if (queuedItems.length === 0) {
      break;
    }

    let nextItem;
    // Para muitos arquivos (> 20 na fila), despacha primeiro os arquivos maiores para os menores
    if (state.queue.length > 20 || queuedItems.length > 20) {
      nextItem = queuedItems.reduce((max, it) => {
        const itSize = it.file ? it.file.size : (it.size || 0);
        const maxSize = max.file ? max.file.size : (max.size || 0);
        return itSize > maxSize ? it : max;
      }, queuedItems[0]);
    } else {
      nextItem = queuedItems[0];
    }

    nextItem.status = 'processing';
    processingCount++;
    processQueueItem(nextItem);
  }
}

/**
 * Processa a fila assíncrona respeitando o pool de concorrência dinâmico
 */
export async function processQueue() {
  dispatchNext();
}

async function processQueueItem(item) {
  if (item.cancelled) return;

  if (item.file.size > APP_CONFIG.MAX_FILE_SIZE_BYTES) {
    item.status = 'error';
    item.statusText = 'Erro de conversão';
    item.uploadProgress = 0;
    item.uploadText = '0%';
    item.convertProgress = 0;
    item.convertText = 'Erro';
    item.progress = 0;
    item.errorMessage = ERROR_CATALOG.FILE_TOO_LARGE;
    updateQueueItemDOM(item, true);
    dispatchNext();
    return;
  }

  item.status = 'processing';
  item.isReading = true;
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
      item.isReading = readPercent < 100;
      item.uploadProgress = readPercent;
      item.uploadText = `${readPercent}%`;
      item.convertProgress = 0;
      item.convertText = 'Aguardando...';
      item.statusText = `Upload... (${readPercent}%)`;
      updateQueueItemDOM(item);
    });

    if (item.cancelled) {
      item.isReading = false;
      return;
    }

    // Conclusão da etapa 1: Upload 100%
    item.isReading = false;
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
      // Mapeia 0-100% do parser para o intervalo visual de 25% a 95%
      const mapped = Math.round(25 + (subPercent * 0.70));
      targetConvert = Math.max(targetConvert, Math.min(95, mapped));
      if (subDetail) currentDetail = subDetail;
      currentConvert = Math.max(currentConvert, targetConvert);
      const integerPercent = Math.round(currentConvert);
      item.convertProgress = integerPercent;

      let detailClean = currentDetail || '';
      detailClean = detailClean
        .replace(/Página\s+(\d+)\s*\/\s*(\d+)/gi, 'pg. $1/$2')
        .replace(/Página\s+(\d+)\s+de\s+(\d+)/gi, 'pg. $1/$2')
        .replace(/pg\.\s*(\d+)\s*\/\s*(\d+)/gi, 'pg. $1/$2');

      const pageCounterText = detailClean ? ` (${detailClean})` : '';
      item.convertText = `${integerPercent}%${pageCounterText}`.trim();
      item.statusText = `Convertendo... (${integerPercent}%)`;
      updateQueueItemDOM(item);
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
        const integerPercent = Math.round(currentConvert);
        item.convertProgress = integerPercent;

        let detailClean = currentDetail || '';
        detailClean = detailClean
          .replace(/Página\s+(\d+)\s*\/\s*(\d+)/gi, 'pg. $1/$2')
          .replace(/Página\s+(\d+)\s+de\s+(\d+)/gi, 'pg. $1/$2')
          .replace(/pg\.\s*(\d+)\s*\/\s*(\d+)/gi, 'pg. $1/$2');

        const pageCounterText = detailClean ? ` (${detailClean})` : '';
        item.convertText = `${integerPercent}%${pageCounterText}`.trim();
        item.statusText = `Convertendo... (${integerPercent}%)`;
        updateQueueItemDOM(item);
      }
    }, 120);

    let markdown = '';
    try {
      const cleanExt = getFileExtension(item.file.name) || (item.file.name.includes('.') ? item.file.name.split('.').pop().toLowerCase() : '');

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
        case 'code':
          if (cleanExt === 'yaml' || cleanExt === 'yml') {
            markdown = parseYaml(arrayBuffer, item.file.name);
          } else {
            markdown = parseSourceCode(arrayBuffer, cleanExt, item.file.name);
          }
          break;
        case 'text':
        default: {
          if (cleanExt === 'yaml' || cleanExt === 'yml') {
            markdown = parseYaml(arrayBuffer, item.file.name);
            break;
          }

          if (CODE_EXTENSIONS_MAP[cleanExt] && !['txt', 'html', 'htm', 'rtf', 'md', 'markdown', 'log', 'yaml', 'yml'].includes(cleanExt)) {
            markdown = parseSourceCode(arrayBuffer, cleanExt, item.file.name);
            break;
          }

          if (['txt', 'json', 'html', 'htm', 'rtf', 'md', 'markdown', 'log', 'yaml', 'yml'].includes(cleanExt)) {
            markdown = await parseText(item.file, onParserSubProgress);
            break;
          }

          // Fallback heurístico UTF-8 para arquivos sem extensão ou com extensão desconhecida:
          // Inspeciona amostra dos primeiros 8 KB em memória à procura de bytes nulos (\0).
          // Se contiver apenas caracteres textuais, encaminha para parseSourceCode em vez de disparar erro.
          const sample = new Uint8Array(arrayBuffer.slice(0, 8192));
          const hasNullByte = sample.includes(0x00);
          if (!hasNullByte) {
            markdown = parseSourceCode(arrayBuffer, cleanExt || 'text', item.file.name);
          } else {
            throw new Error(`${ERROR_CATALOG.PARSER_NOT_FOUND} (Extensão "${cleanExt ? '.' + cleanExt : 'binária'}")`);
          }
          break;
        }
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
    updateGlobalBatchProgress();

    const formattedDuration = formatElapsedTime(duration);
    updateDebugStatus(`[Concluído]: ${item.file.name} em ${formattedDuration} (MD: ${formattedMdSize})`);
  } catch (error) {
    if (item.cancelled) return;
    item.isReading = false;
    const duration = Math.round(performance.now() - startTime);
    item.status = 'error';
    item.convertProgress = 0;
    item.convertText = 'Erro';
    item.progress = 0;
    item.statusText = 'Erro de conversão';

    const errMsg = error ? (error.message || '') : '';
    if (errMsg.includes('1,5 GB') || errMsg.includes('tamanho') || errMsg.includes('size')) {
      item.errorMessage = ERROR_CATALOG.FILE_TOO_LARGE;
    } else if (errMsg.includes('vazio') || errMsg.includes('0 bytes')) {
      item.errorMessage = ERROR_CATALOG.EMPTY_FILE;
    } else if (errMsg.includes('não suportad') || errMsg.includes('parser') || errMsg.includes('desconhecido')) {
      item.errorMessage = ERROR_CATALOG.PARSER_NOT_FOUND;
    } else if (errMsg.includes('senha') || errMsg.includes('corrompid') || errMsg.includes('compactad')) {
      item.errorMessage = ERROR_CATALOG.CORRUPTED_ARCHIVE;
    } else if (errMsg.includes('timeout') || errMsg.includes('tempo')) {
      item.errorMessage = ERROR_CATALOG.TIMEOUT;
    } else {
      item.errorMessage = errMsg ? `${ERROR_CATALOG.PARSING_FAILED} (${errMsg})` : ERROR_CATALOG.PARSING_FAILED;
    }

    item.durationMs = duration;
    updateQueueItemDOM(item);
    updateGlobalBatchProgress();

    const formattedDuration = formatElapsedTime(duration);
    updateDebugStatus(`[Falha]: ${item.file.name} - ${item.errorMessage} (${formattedDuration})`, true);
  } finally {
    updateGlobalBatchProgress();
    dispatchNext();
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
    a.download = `documentos_markdown_${getFormattedTimestamp()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[doc2md] Erro ao gerar pacote ZIP:', err);
  }
}

/* ==========================================================================
   Unificação de Documentos Markdown (Mesclagem, Backlog e Rastreabilidade)
   ========================================================================== */

/**
 * Constrói a representação visual da hierarquia de pastas e arquivos em ASCII limpo
 * @param {Array<Object>} items Lista de itens da fila
 * @returns {string} Diagrama em árvore
 */
export function buildDirectoryTreeAscii(items) {
  if (!items || items.length === 0) return '';

  const archives = new Map();
  for (const item of items) {
    const fileName = item.file ? item.file.name : (item.name || 'documento.md');
    const archive = item.archiveOrigin || (item.file && item.file.archiveOrigin) || '(Upload Direto)';
    let folder = item.folderPath || (item.file && item.file.folderPath);
    if (!folder) {
      if (item.relativePath && item.relativePath.includes('/')) {
        folder = item.relativePath.substring(0, item.relativePath.lastIndexOf('/'));
      } else {
        folder = archive === '(Upload Direto)' ? 'Raiz' : 'Raiz do Pacote';
      }
    }

    if (!archives.has(archive)) {
      archives.set(archive, new Map());
    }
    const folderMap = archives.get(archive);
    if (!folderMap.has(folder)) {
      folderMap.set(folder, []);
    }
    folderMap.get(folder).push(fileName);
  }

  const lines = [];
  const archiveKeys = Array.from(archives.keys());

  archiveKeys.forEach((archiveName, aIdx) => {
    lines.push(`📦 ${archiveName}`);
    const folderMap = archives.get(archiveName);
    const folderKeys = Array.from(folderMap.keys());

    folderKeys.forEach((folderName, fIdx) => {
      const isLastFolder = fIdx === folderKeys.length - 1;
      const folderBranch = isLastFolder ? '└──' : '├──';
      const fileIndent = isLastFolder ? '    ' : '│   ';
      const files = folderMap.get(folderName);

      if (folderName === 'Raiz' || folderName === 'Raiz do Pacote') {
        files.forEach((fName, fileIdx) => {
          const isLastFile = fileIdx === files.length - 1 && isLastFolder;
          const fileBranch = isLastFile ? '└──' : '├──';
          lines.push(` ${fileBranch} 📄 ${fName}`);
        });
      } else {
        const displayFolder = folderName.endsWith('/') ? folderName : folderName + '/';
        lines.push(` ${folderBranch} 📁 ${displayFolder}`);
        files.forEach((fName, fileIdx) => {
          const isLastFile = fileIdx === files.length - 1;
          const fileBranch = isLastFile ? '└──' : '├──';
          lines.push(` ${fileIndent} ${fileBranch} 📄 ${fName}`);
        });
      }
    });

    if (aIdx < archiveKeys.length - 1) {
      lines.push('');
    }
  });

  return lines.join('\n');
}

/**
 * Gera a seção inicial de Backlog com tabela de rastreabilidade e diagrama hierárquico
 * @param {Array<Object>} items Lista de itens da fila
 * @returns {string} Seção formatada em Markdown
 */
export function buildBacklogSection(items) {
  if (!items || items.length === 0) return '';

  const tableHeader = [
    '# RASTREABILIDADE DE ARQUIVOS E ESTRUTURA DE PASTAS (BACKLOG)',
    '',
    '> Este documento consolidado foi gerado a partir da extração e mesclagem de arquivos.',
    '> A tabela abaixo apresenta o mapeamento de origem das pastas e arquivos processados:',
    '',
    '| Pacote de Origem | Diretório / Pasta | Nome do Arquivo | Extensão | Tamanho Original |',
    '| :--- | :--- | :--- | :--- | :--- |'
  ];

  const tableRows = items.map(item => {
    const fileName = item.file ? item.file.name : (item.name || 'documento.md');
    const fileSize = item.file ? item.file.size : (item.size || 0);
    const sizeFormatted = formatBytes(fileSize);
    const ext = '.' + (fileName.split('.').pop() || 'TXT').toUpperCase();
    const archiveOrigin = item.archiveOrigin || (item.file && item.file.archiveOrigin) || '(Upload Direto)';
    let folderPath = item.folderPath || (item.file && item.file.folderPath);
    if (!folderPath) {
      if (item.relativePath && item.relativePath.includes('/')) {
        folderPath = item.relativePath.substring(0, item.relativePath.lastIndexOf('/'));
      } else {
        folderPath = archiveOrigin === '(Upload Direto)' ? 'Raiz' : 'Raiz do Pacote';
      }
    }
    const cleanFolder = (folderPath === 'Raiz' || folderPath === 'Raiz do Pacote')
      ? folderPath
      : (folderPath.endsWith('/') ? folderPath : folderPath + '/');
    return `| ${archiveOrigin} | ${cleanFolder} | ${fileName} | ${ext} | ${sizeFormatted} |`;
  });

  const treeAscii = buildDirectoryTreeAscii(items);

  const treeBlock = treeAscii ? [
    '',
    '```plaintext',
    treeAscii,
    '```'
  ] : [];

  return [
    ...tableHeader,
    ...tableRows,
    ...treeBlock,
    '',
    '---',
    '',
    ''
  ].join('\n');
}

export function mergeMarkdownOutputs(items) {
  if (!items || items.length === 0) return '';

  const backlog = buildBacklogSection(items);

  const mergedBody = items.map(item => {
    const fileName = item.file ? item.file.name : (item.name || 'documento.md');
    const fileSize = item.file ? item.file.size : (item.size || 0);
    const sizeFormatted = formatBytes(fileSize);
    const ext = (fileName.split('.').pop() || 'TXT').toUpperCase();
    const archiveOrigin = item.archiveOrigin || (item.file && item.file.archiveOrigin) || '(Upload Direto)';
    const relativePath = item.relativePath || (item.file && item.file.relativePath) || fileName;
    let folderPath = item.folderPath || (item.file && item.file.folderPath);
    if (!folderPath) {
      if (relativePath.includes('/')) {
        folderPath = relativePath.substring(0, relativePath.lastIndexOf('/'));
      } else {
        folderPath = archiveOrigin === '(Upload Direto)' ? 'Raiz' : 'Raiz do Pacote';
      }
    }
    const cleanFolder = (folderPath === 'Raiz' || folderPath === 'Raiz do Pacote')
      ? folderPath
      : (folderPath.endsWith('/') ? folderPath : folderPath + '/');

    let md = (item.markdown || item.markdownOutput || '').trim();

    // Prevenção de quebra de layout: fechamento seguro de blocos de código abertos
    const codeFenceCount = (md.match(/^```/gm) || []).length;
    if (codeFenceCount % 2 !== 0) {
      md += '\n```';
    }

    const headerDelimiter = [
      '<!-- ================================================================= -->',
      `<!-- INÍCIO DO ARQUIVO: ${relativePath} -->`,
      `<!-- PACOTE DE ORIGEM: ${archiveOrigin} | DIRETÓRIO: ${cleanFolder} -->`,
      `<!-- FORMATO: .${ext} | FORMATO ORIGINAL: ${ext} | TAMANHO: ${sizeFormatted} -->`,
      '<!-- ================================================================= -->'
    ].join('\n');

    const footerDelimiter = [
      '<!-- ================================================================= -->',
      `<!-- FIM DO ARQUIVO: ${relativePath} -->`,
      '<!-- ================================================================= -->'
    ].join('\n');

    return `${headerDelimiter}\n\n# ${fileName}\n*Origem: \`${archiveOrigin} > ${relativePath}\`*\n\n${md}\n\n${footerDelimiter}\n\n---`;
  }).join('\n\n') + '\n';

  return backlog + mergedBody;
}

export async function downloadUnifiedMarkdown() {
  const completed = state.queue.filter(item => item.status === 'completed' && (item.markdown || item.markdownOutput));
  if (completed.length === 0) {
    return;
  }

  // Garante que a mesclagem respeite rigorosamente a ordem alfanumérica dos itens na fila
  const orderedItems = [...completed];
  const mergedContent = mergeMarkdownOutputs(orderedItems);
  const fileName = `documento_unificado_${getFormattedTimestamp()}.md`;
  downloadMarkdownFile(fileName, mergedContent);
}

/**
 * Ordena os itens da fila de documentos por nome em ordem alfanumérica natural (A-Z / Z-A).
 * Respeita numeração de volumes e dossiers (ex.: Volume 01, Volume 02, Volume 10).
 * @param {boolean} [ascending=true] true para A-Z, false para Z-A
 */
export function sortQueueByName(ascending = true) {
  if (!state || !state.queue) return;
  state.sortAscending = ascending;
  state.queue.sort((a, b) => {
    const nameA = a.file ? a.file.name : (a.name || '');
    const nameB = b.file ? b.file.name : (b.name || '');
    const comp = nameA.localeCompare(nameB, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
    return ascending ? comp : -comp;
  });
  renderQueueUI();
  updateSortButtonUI();
}

/**
 * Ordena os itens da fila de documentos de acordo com o tamanho dos arquivos.
 * Por padrão, ordena dos maiores para os menores (decrescente).
 * @param {boolean} [descending=true] true para maiores primeiro, false para menores primeiro
 */
export function sortQueueBySize(descending = true) {
  if (!state || !state.queue) return;
  state.queue.sort((a, b) => {
    const sizeA = a.file ? a.file.size : (a.size || 0);
    const sizeB = b.file ? b.file.size : (b.size || 0);
    if (sizeA !== sizeB) {
      return descending ? (sizeB - sizeA) : (sizeA - sizeB);
    }
    const nameA = a.file ? a.file.name : (a.name || '');
    const nameB = b.file ? b.file.name : (b.name || '');
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });
  renderQueueUI();
}

/**
 * Atualiza visualmente a lista de itens da fila renderizada no DOM
 */
export function renderQueueUI() {
  renderQueue();
}

/**
 * Atualiza o texto, ícones vetoriais e título do botão de ordenação na interface
 */
export function updateSortButtonUI() {
  const btn = (elements && elements.btnSortFiles) || (typeof document !== 'undefined' ? document.getElementById('btn-sort-files') : null);
  const label = (elements && elements.sortFilesLabel) || (typeof document !== 'undefined' ? document.getElementById('sort-files-label') : null);
  if (!btn) return;

  const isAsc = state.sortAscending !== false;
  btn.title = isAsc ? 'Classificar arquivos em ordem decrescente (Z-A)' : 'Classificar arquivos em ordem crescente (A-Z)';
  if (label) {
    label.textContent = isAsc ? 'Classificar A-Z' : 'Classificar Z-A';
  }
  const iconAsc = btn.querySelector('.icon-asc');
  const iconDesc = btn.querySelector('.icon-desc');
  if (iconAsc && iconDesc) {
    iconAsc.style.display = isAsc ? 'inline-block' : 'none';
    iconDesc.style.display = isAsc ? 'none' : 'inline-block';
  }
}

function updateMergeButtonVisibility() {
  const isEnabled = elements.toggleMergeMarkdown ? elements.toggleMergeMarkdown.checked : false;
  state.isMergeEnabled = isEnabled;
  const row = elements.unifiedActionRow || elements.unifiedDownloadContainer || (typeof document !== 'undefined' ? (document.getElementById('unified-action-row') || document.getElementById('unified-download-container')) : null);
  if (row) {
    row.style.display = isEnabled ? 'flex' : 'none';
  }
  if (elements.btnDownloadUnified) {
    elements.btnDownloadUnified.style.display = isEnabled ? 'inline-flex' : 'none';
  }
  if (elements.btnQueueDownloadMerged && elements.btnQueueDownloadMerged !== elements.btnDownloadUnified) {
    elements.btnQueueDownloadMerged.style.display = isEnabled ? 'inline-flex' : 'none';
  }
}

/**
 * Limpa integralmente a fila de processamento, cancela tarefas ativas e reseta animações.
 */
export function clearQueue() {
  if (!state || !state.queue) return;
  state.queue.forEach(it => { it.cancelled = true; });
  state.queue = [];
  state.userIsScrolling = false;
  batchAnimationController.reset();
  renderQueue();
}

function initQueueEvents() {
  if (elements.btnQueueClear) {
    elements.btnQueueClear.addEventListener('click', () => {
      if (state.queue.length === 0) return;
      clearQueue();
    });
  }

  if (elements.btnQueueDownloadAll) {
    elements.btnQueueDownloadAll.addEventListener('click', () => {
      downloadAllZip();
    });
  }

  if (elements.btnSortFiles) {
    elements.btnSortFiles.addEventListener('click', () => {
      state.sortAscending = !(state.sortAscending !== false);
      sortQueueByName(state.sortAscending);
    });
  }

  if (elements.toggleMergeMarkdown) {
    const saved = (typeof localStorage !== 'undefined') ? localStorage.getItem(APP_CONFIG.STORAGE_KEYS.MERGE_MARKDOWN) : null;
    if (saved !== null) {
      elements.toggleMergeMarkdown.checked = (saved === 'true');
    }
    updateMergeButtonVisibility();
    updateSortButtonUI();

    elements.toggleMergeMarkdown.addEventListener('change', (e) => {
      state.isMergeEnabled = e.target.checked;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.MERGE_MARKDOWN, String(state.isMergeEnabled));
      }
      if (state.isMergeEnabled) {
        // Ordena automaticamente em ordem alfanumérica natural ao habilitar a mesclagem
        sortQueueByName(state.sortAscending ?? true);
      }
      const unifiedRow = elements.unifiedActionRow || elements.unifiedDownloadContainer || (typeof document !== 'undefined' ? document.getElementById('unified-action-row') : null);
      if (unifiedRow) {
        unifiedRow.style.display = state.isMergeEnabled ? 'flex' : 'none';
      }
      updateMergeButtonVisibility();
    });
  }

  if (elements.btnDownloadUnified) {
    elements.btnDownloadUnified.addEventListener('click', () => {
      downloadUnifiedMarkdown();
    });
  } else if (elements.btnQueueDownloadMerged) {
    elements.btnQueueDownloadMerged.addEventListener('click', () => {
      downloadUnifiedMarkdown();
    });
  }

  // Detecção inteligente de scroll manual para controle de auto-scroll temporizado
  if (elements.fileQueueList) {
    let scrollUserTimer = null;
    const handleUserManualScroll = () => {
      state.userIsScrolling = true;
      if (scrollUserTimer) clearTimeout(scrollUserTimer);
      // Retoma auto-scroll após 2 segundos sem interação manual do usuário
      scrollUserTimer = setTimeout(() => {
        state.userIsScrolling = false;
      }, 2000);
    };

    // Apenas eventos manuais do usuário (wheel e touchmove) ativam a pausa temporária
    // Evita escutar o evento 'scroll' genérico para não bloquear rolagens programáticas
    elements.fileQueueList.addEventListener('wheel', handleUserManualScroll, { passive: true });
    elements.fileQueueList.addEventListener('touchmove', handleUserManualScroll, { passive: true });
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
