/**
 * Universal MarkConverter (doc2md)
 * Configuração Central & Versionamento SemVer
 * @version v.1.0.0
 */

export const APP_CONFIG = {
  VERSION: 'v.1.0.0',
  APP_NAME: 'Universal MarkConverter',
  TAGLINE: 'doc2md • Conversor Universal 100% Client-Side',
  REPO_URL: 'https://github.com/mathmorato/open-markconverter',
  
  // Chaves de persistência no LocalStorage
  STORAGE_KEYS: {
    THEME: 'doc2md_theme', // 'dark' | 'light' | 'system'
    VIEW_MODE: 'doc2md_view_mode', // 'split' | 'raw' | 'preview'
    LINE_WRAPPING: 'doc2md_line_wrapping', // true | false
    PRESERVE_HEADING_IDS: 'doc2md_preserve_headings',
  },

  // CDN URLs para carregamento assíncrono sob demanda (Zero overhead inicial)
  CDN: {
    MAMMOTH: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js',
    TURNDOWN: 'https://cdnjs.cloudflare.com/ajax/libs/turndown/7.2.0/turndown.min.js',
    TURNDOWN_GFM: 'https://cdn.jsdelivr.net/npm/turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.min.js',
    SHEETJS: 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
    JSZIP: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    PDFJS: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    PDFJS_WORKER: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    MARKED: 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
    DOMPURIFY: 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.5/purify.min.js'
  },

  // Formatos suportados e metadados
  SUPPORTED_FORMATS: {
    docx: {
      ext: ['.docx'],
      mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      name: 'Word (.docx)',
      category: 'document',
      parser: 'docx'
    },
    sheet: {
      ext: ['.xlsx', '.xls', '.csv', '.ods'],
      mime: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/vnd.oasis.opendocument.spreadsheet'
      ],
      name: 'Planilhas (.xlsx, .csv, .ods)',
      category: 'spreadsheet',
      parser: 'xlsx'
    },
    presentation: {
      ext: ['.pptx'],
      mime: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      name: 'Apresentação (.pptx)',
      category: 'presentation',
      parser: 'pptx'
    },
    pdf: {
      ext: ['.pdf'],
      mime: ['application/pdf'],
      name: 'PDF (.pdf)',
      category: 'pdf',
      parser: 'pdf'
    },
    text: {
      ext: ['.txt', '.json', '.html', '.htm', '.rtf', '.xml', '.md', '.log', '.yaml', '.yml'],
      mime: ['text/plain', 'application/json', 'text/html', 'application/rtf', 'text/xml', 'text/markdown'],
      name: 'Texto / Código (.txt, .json, .html, .rtf)',
      category: 'text',
      parser: 'text'
    }
  }
};

/**
 * Utilitário para injeção dinâmica de scripts com caching de promessa
 */
const loadedScripts = new Map();

export function loadScript(src) {
  if (loadedScripts.has(src)) {
    return loadedScripts.get(src);
  }

  const promise = new Promise((resolve, reject) => {
    // Se já estiver na página, resolve imediatamente
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = (e) => reject(new Error(`Falha ao carregar biblioteca: ${src}`));
    document.head.appendChild(script);
  });

  loadedScripts.set(src, promise);
  return promise;
}
