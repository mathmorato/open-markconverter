/**
 * Universal MarkConverter (doc2md)
 * Controlador Principal da Aplicação
 * @version v.1.0.3
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

// Estado global da sessão local
const state = {
  currentFile: null,
  currentMarkdown: '',
  theme: 'system',
  viewMode: 'split',
  isConverting: false
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

async function convertFile(file) {
  if (!file) return;

  const fileInfoStr = `[Recebido]: ${file.name} | Tamanho: ${file.size} bytes | MIME: ${file.type || 'desconhecido'}`;
  console.log(`[doc2md] ${fileInfoStr}`);
  updateDebugStatus(fileInfoStr);

  const ext = '.' + file.name.split('.').pop().toLowerCase();

  // Validação: Arquivo vazio
  if (file.size === 0) {
    console.warn(`[doc2md] Arquivo "${file.name}" rejeitado: 0 bytes.`);
    state.currentFile = file;
    updateStatus('error', 'Arquivo vazio (0 bytes)');
    updateDebugStatus(`[Falha]: O arquivo "${file.name}" está vazio (0 bytes)`, true);
    elements.metricFileName.textContent = file.name;
    elements.metricFileSize.textContent = '0 Bytes';
    elements.metricFormat.textContent = 'VAZIO';
    elements.metricFormat.className = 'metric-badge error';
    showToast(`O arquivo "${file.name}" está vazio (0 bytes).`, 'error', 4000);
    return;
  }

  // Validação: Formatos binários não suportados
  if (APP_CONFIG.UNSUPPORTED_BINARY_EXTENSIONS && APP_CONFIG.UNSUPPORTED_BINARY_EXTENSIONS.includes(ext)) {
    console.warn(`[doc2md] Formato binário não suportado: "${ext}"`);
    state.currentFile = file;
    updateStatus('error', 'Formato não suportado');
    updateDebugStatus(`[Rejeitado]: Formato "${ext}" não suportado para conversão`, true);
    elements.metricFileName.textContent = file.name;
    elements.metricFileSize.textContent = formatBytes(file.size);
    elements.metricFormat.textContent = ext.toUpperCase();
    elements.metricFormat.className = 'metric-badge error';
    showToast(`Formato ${ext} não suportado para conversão em Markdown. Envie .docx, planilhas, .pptx, .pdf ou textos.`, 'error', 4500);
    return;
  }

  const formatInfo = getFormatCategory(file.name);
  state.currentFile = file;

  console.log(`[doc2md] Formato detectado: ${formatInfo.name} | Parser atribuído: ${formatInfo.parser}`);

  updateStatus('processing', `Convertendo ${file.name}...`);
  elements.metricFileName.textContent = file.name;
  elements.metricFileSize.textContent = formatBytes(file.size);
  elements.metricFormat.textContent = formatInfo.ext.toUpperCase();
  elements.metricFormat.className = 'metric-badge';

  const startTime = performance.now();

  try {
    let markdown = '';

    switch (formatInfo.parser) {
      case 'docx':
        markdown = await parseDocx(file);
        break;

      case 'xlsx':
        markdown = await parseSpreadsheet(file);
        break;

      case 'pptx':
        markdown = await parsePptx(file);
        break;

      case 'pdf':
        markdown = await parsePdf(file);
        break;

      case 'text':
      default:
        markdown = await parseText(file);
        break;
    }

    const duration = Math.round(performance.now() - startTime);
    const successMsg = `[Concluído]: ${file.name} | Tempo: ${duration} ms | Formato: ${formatInfo.ext.toUpperCase()}`;
    console.log(`[doc2md] ${successMsg}`);
    updateDebugStatus(successMsg);

    state.currentMarkdown = markdown;
    elements.rawEditor.value = markdown;
    elements.metricConversionTime.textContent = `${duration} ms`;

    updateEditorMetrics(markdown);
    await renderMarkdown(markdown);

    updateStatus('success', 'Conversão concluída com sucesso!');
    showToast(`Arquivo ${file.name} convertido em ${duration} ms`, 'success');
  } catch (error) {
    const errorMsg = `[Falha]: ${file.name} - ${error.message || 'Erro durante o parsing'}`;
    console.error(`[doc2md] ${errorMsg}`, error);
    updateDebugStatus(errorMsg, true);
    updateStatus('error', 'Erro ao converter documento');
    elements.metricFormat.className = 'metric-badge error';
    showToast(`Erro ao processar ${file.name}: ${error.message || 'Falha ao processar arquivo'}`, 'error', 4500);
  }
}

/* ==========================================================================
   Eventos de Entrada de Arquivos (Botão Nativo, Drag & Drop e Paste)
   ========================================================================== */
function initDropzone() {
  const { dropzone, fileInput, btnBrowse } = elements;

  // 1. Canal Botão Nativo Explícito
  if (btnBrowse) {
    btnBrowse.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  // Clique na área da dropzone também abre o seletor (se não clicou em outro botão)
  dropzone.addEventListener('click', (e) => {
    if (e.target !== btnBrowse && !e.target.closest('button')) {
      fileInput.click();
    }
  });

  // Mudança de arquivo via input nativo
  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      console.log(`[doc2md] Arquivo capturado via seletor nativo: "${files[0].name}"`);
      convertFile(files[0]);
    }
    // Reseta input para permitir selecionar o mesmo arquivo novamente
    fileInput.value = '';
  });

  // 2. Canal Drag & Drop Blindado
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  }, false);

  window.addEventListener('drop', (e) => {
    e.preventDefault();
  }, false);

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
      console.log(`[doc2md] Arquivo recebido via Drop: "${files[0].name}"`);
      convertFile(files[0]);
    }
  });

  // 3. Canal Alternativo: Suporte a Colar (Paste / Clipboard)
  window.addEventListener('paste', async (e) => {
    // Se o usuário estiver editando o textarea de markdown diretamente, permite colagem normal
    if (document.activeElement === elements.rawEditor) {
      return;
    }

    // Se houver arquivo no clipboard
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      const file = e.clipboardData.files[0];
      console.log(`[doc2md] Arquivo recebido via Paste (Clipboard): "${file.name}"`);
      convertFile(file);
      return;
    }

    // Se houver texto puro no clipboard
    const pastedText = e.clipboardData ? e.clipboardData.getData('text') : '';
    if (pastedText && pastedText.trim()) {
      e.preventDefault();
      console.log('[doc2md] Texto puro recebido via Paste (Clipboard)');
      updateDebugStatus(`[Clipboard]: Texto recebido (${pastedText.length} caracteres)`);
      state.currentMarkdown = pastedText;
      elements.rawEditor.value = pastedText;
      updateEditorMetrics(pastedText);
      await renderMarkdown(pastedText);
      updateStatus('success', 'Texto da área de transferência carregado!');
      showToast('Texto colado carregado com sucesso!', 'success');
    }
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
  initActions();
  updateEditorMetrics('');
});
