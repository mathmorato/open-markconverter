/**
 * Open Mark (doc2md)
 * Configuração Central & Versionamento SemVer
 * @version v.1.8.3
 */

export const CODE_EXTENSIONS_MAP = {
  // Web & Frontend
  'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
  'ts': 'typescript', 'tsx': 'tsx', 'jsx': 'jsx',
  'html': 'html', 'htm': 'html', 'xhtml': 'html',
  'css': 'css', 'scss': 'scss', 'sass': 'sass', 'less': 'less', 'styl': 'stylus',
  'vue': 'vue', 'svelte': 'svelte', 'astro': 'astro',
  
  // Computação Científica, Numérica & Estatística
  'm': 'matlab', 'matlab': 'matlab', 'octave': 'matlab',
  'r': 'r', 'rmd': 'r',
  'jl': 'julia',
  'f': 'fortran', 'for': 'fortran', 'f90': 'fortran', 'f95': 'fortran',
  'nb': 'mathematica', 'wl': 'wolfram',
  
  // Scripts, Embeds, Jogos & Automação
  'lua': 'lua',
  'py': 'python', 'pyw': 'python', 'ipynb': 'json',
  'rb': 'ruby', 'rake': 'ruby', 'gemspec': 'ruby',
  'php': 'php', 'phtml': 'php',
  'pl': 'perl', 'pm': 'perl', 't': 'perl',
  'tcl': 'tcl', 'awk': 'awk', 'sed': 'sed',
  
  // Sistemas, Baixo Nível & Alta Performance
  'c': 'c', 'h': 'c',
  'cpp': 'cpp', 'hpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp', 'hxx': 'cpp',
  'rs': 'rust',
  'go': 'go',
  'zig': 'zig',
  'nim': 'nim',
  'd': 'd',
  'pas': 'pascal', 'pp': 'pascal', 'inc': 'pascal',
  'ada': 'ada', 'adb': 'ada', 'ads': 'ada',
  'asm': 'assembly', 's': 'assembly', 'nasm': 'assembly',
  
  // JVM & .NET
  'java': 'java', 'class': 'text',
  'kt': 'kotlin', 'kts': 'kotlin',
  'scala': 'scala', 'sc': 'scala',
  'groovy': 'groovy', 'gvy': 'groovy',
  'cs': 'csharp', 'csx': 'csharp',
  'fs': 'fsharp', 'fsi': 'fsharp', 'fsx': 'fsharp',
  'vb': 'vbnet', 'vbs': 'vbscript',
  
  // Funcionais, Lisp & Concorrência
  'hs': 'haskell', 'lhs': 'haskell',
  'ex': 'elixir', 'exs': 'elixir',
  'erl': 'erlang', 'hrl': 'erlang',
  'clj': 'clojure', 'cljs': 'clojure', 'edn': 'clojure',
  'ml': 'ocaml', 'mli': 'ocaml',
  'lisp': 'lisp', 'lsp': 'lisp', 'cl': 'lisp',
  'scm': 'scheme', 'ss': 'scheme',
  'rkt': 'racket',
  'elm': 'elm', 'purs': 'purescript',
  'gleam': 'gleam',
  
  // Mobile & Multiplataforma
  'swift': 'swift',
  'dart': 'dart',
  
  // Shell, DevOps, Infra & Contêineres
  'sh': 'bash', 'bash': 'bash', 'zsh': 'bash', 'fish': 'fish',
  'ps1': 'powershell', 'psm1': 'powershell',
  'bat': 'bat', 'cmd': 'bat',
  'dockerfile': 'dockerfile', 'containerfile': 'dockerfile',
  'makefile': 'makefile', 'mk': 'makefile',
  'cmake': 'cmake',
  'tf': 'terraform', 'hcl': 'hcl',
  'nix': 'nix',
  
  // Bancos de Dados & Consultas
  'sql': 'sql', 'psql': 'sql', 'plsql': 'sql', 'tsql': 'sql',
  'cql': 'cql', 'prisma': 'prisma', 'graphql': 'graphql', 'gql': 'graphql',
  
  // Hardware, Shaders & Web3
  'v': 'verilog', 'sv': 'systemverilog',
  'vhd': 'vhdl', 'vhdl': 'vhdl',
  'glsl': 'glsl', 'vert': 'glsl', 'frag': 'glsl', 'hlsl': 'hlsl', 'wgsl': 'wgsl',
  'sol': 'solidity',
  
  // Linguagens Históricas
  'cob': 'cobol', 'cbl': 'cobol',
  'fth': 'forth', 'forth': 'forth',
  'bas': 'basic',
  
  // Serialização, Configuração & Metadados
  'json': 'json', 'json5': 'json5', 'jsonc': 'jsonc',
  'yaml': 'yaml', 'yml': 'yaml',
  'toml': 'toml', 'ini': 'ini', 'cfg': 'ini', 'conf': 'ini',
  'xml': 'xml', 'xsd': 'xml', 'xsl': 'xml', 'svg': 'xml',
  'proto': 'protobuf', 'env': 'bash'
};

/**
 * Catálogo Unificado de Extensões Suportadas & Metadados de Roteamento
 */
export const SUPPORTED_EXTENSIONS = {
  // Documentos
  'docx': { category: 'document', label: 'Word (.docx)', parser: 'docx' },
  'odt': { category: 'document', label: 'OpenDocument (.odt)', parser: 'docx' },
  'rtf': { category: 'text', label: 'Rich Text (.rtf)', parser: 'text', lang: 'plaintext' },
  
  // Planilhas & Matrizes
  'xlsx': { category: 'spreadsheet', label: 'Excel (.xlsx)', parser: 'xlsx' },
  'xls': { category: 'spreadsheet', label: 'Excel 97-2004 (.xls)', parser: 'xlsx' },
  'csv': { category: 'spreadsheet', label: 'CSV (.csv)', parser: 'xlsx' },
  'tsv': { category: 'spreadsheet', label: 'TSV (.tsv)', parser: 'xlsx' },
  'ods': { category: 'spreadsheet', label: 'OpenDocument (.ods)', parser: 'xlsx' },
  
  // Apresentações
  'pptx': { category: 'presentation', label: 'PowerPoint (.pptx)', parser: 'pptx' },
  'odp': { category: 'presentation', label: 'OpenDocument (.odp)', parser: 'pptx' },
  
  // Documentos Fechados
  'pdf': { category: 'pdf', label: 'PDF (.pdf)', parser: 'pdf' },
  
  // Serialização, Configuração & Dados
  'yaml': { category: 'code', label: 'YAML', parser: 'text', lang: 'yaml' },
  'yml':  { category: 'code', label: 'YAML', parser: 'text', lang: 'yaml' },
  'json': { category: 'text', label: 'JSON', parser: 'text', lang: 'json' },
  'json5': { category: 'text', label: 'JSON5', parser: 'text', lang: 'json' },
  'jsonc': { category: 'text', label: 'JSON with Comments', parser: 'text', lang: 'json' },
  'xml': { category: 'text', label: 'XML', parser: 'text', lang: 'xml' },
  'toml': { category: 'code', label: 'TOML', parser: 'code', lang: 'toml' },
  'ini': { category: 'code', label: 'INI', parser: 'code', lang: 'ini' },
  'cfg': { category: 'code', label: 'Config', parser: 'code', lang: 'ini' },
  'conf': { category: 'code', label: 'Config', parser: 'code', lang: 'ini' },
  
  // Texto & Marcação
  'html': { category: 'text', label: 'HTML', parser: 'text', lang: 'html' },
  'htm': { category: 'text', label: 'HTML', parser: 'text', lang: 'html' },
  'xhtml': { category: 'text', label: 'XHTML', parser: 'text', lang: 'html' },
  'md': { category: 'text', label: 'Markdown', parser: 'text', lang: 'markdown' },
  'markdown': { category: 'text', label: 'Markdown', parser: 'text', lang: 'markdown' },
  'txt': { category: 'text', label: 'Texto Puro', parser: 'text', lang: 'plaintext' },
  'log': { category: 'text', label: 'Log', parser: 'text', lang: 'plaintext' }
};

/**
 * Mapeamento defensivo de tipos MIME para extensões canônicas
 */
export const MIME_TYPE_MAP = {
  'application/x-yaml': 'yaml',
  'text/yaml': 'yaml',
  'text/x-yaml': 'yaml',
  'application/yaml': 'yaml',
  'application/json': 'json',
  'text/html': 'html',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
  'text/xml': 'xml',
  'application/xml': 'xml',
  'application/rtf': 'rtf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
  'text/tab-separated-values': 'tsv',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/pdf': 'pdf',
  'application/javascript': 'js',
  'text/javascript': 'js',
  'application/typescript': 'ts',
  'text/x-python': 'py',
  'text/x-c': 'c',
  'text/x-c++': 'cpp',
  'text/x-shellscript': 'sh',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/x-rar-compressed': 'rar'
};

export const APP_CONFIG = {
  VERSION: 'v.1.8.3',
  APP_NAME: 'Open Mark',
  TAGLINE: 'Open Mark • Conversor Universal 100% Client-Side',
  REPO_URL: 'https://github.com/mathmorato/open-mark',
  
  // Limite máximo rígido de tamanho por arquivo (1,5 GB = 1.610.612.736 bytes)
  MAX_FILE_SIZE_BYTES: 1.5 * 1024 * 1024 * 1024, // 1.5 GB = 1.610.612.736 bytes

  // Configurações de Concorrência do Pipeline de Lote
  CONCURRENCY: {
    DEFAULT: 4,               // Pool moderado para poucos arquivos (<= 20)
    HIGH_VOLUME_THRESHOLD: 20, // Ponto de corte para escalonamento automático
    HIGH_VOLUME: 1000         // Pool agressivo para alto volume e descompactação (até 1000 simultâneos)
  },
  
  // Chaves de persistência no LocalStorage
  STORAGE_KEYS: {
    THEME: 'doc2md_theme', // 'dark' | 'light' | 'system'
    VIEW_MODE: 'doc2md_view_mode', // 'split' | 'raw' | 'preview'
    LINE_WRAPPING: 'doc2md_line_wrapping', // true | false
    PRESERVE_HEADING_IDS: 'doc2md_preserve_headings',
    MERGE_MARKDOWN: 'doc2md_merge_markdown'
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

  // Pacotes compactados suportados para extração automática client-side em memória
  ARCHIVE_EXTENSIONS: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],

  // Formatos binários conhecidamente não suportados (rejeição rápida com orientação clara)
  UNSUPPORTED_BINARY_EXTENSIONS: [
    '.exe', '.bin', '.dll', '.iso', '.dmg', '.apk', '.app', '.msi',
    '.mp3', '.wav', '.ogg', '.flac', '.mp4', '.avi', '.mov', '.mkv',
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.psd'
  ],

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
      ext: ['.xlsx', '.xls', '.csv', '.tsv', '.ods'],
      mime: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/tab-separated-values',
        'application/vnd.oasis.opendocument.spreadsheet'
      ],
      name: 'Planilhas (.xlsx, .csv, .tsv, .ods)',
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
      ext: ['.txt', '.json', '.html', '.htm', '.rtf', '.xml', '.md', '.markdown', '.log', '.yaml', '.yml'],
      mime: [
        'text/plain', 'application/json', 'text/html', 'application/rtf', 'text/xml', 'text/markdown',
        'application/x-yaml', 'text/yaml', 'text/x-yaml', 'application/yaml'
      ],
      name: 'Texto / YAML / Dados (.txt, .json, .html, .rtf, .md, .yaml, .yml)',
      category: 'text',
      parser: 'text'
    },
    code: {
      ext: Object.keys(CODE_EXTENSIONS_MAP).map(ext => '.' + ext),
      name: 'Código-Fonte / Scripts',
      category: 'code',
      parser: 'code'
    }
  }
};

/**
 * Utilitário para injeção dinâmica de scripts com caching de promessa
 */
const loadedScripts = new Map();

export function loadScript(src) {
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }

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

/**
 * Catálogo Padronizado e Tipado de Erros do Pipeline (doc2md)
 */
export const ERROR_CATALOG = {
  FILE_TOO_LARGE: 'Arquivo excede o limite máximo permitido de 1,5 GB.',
  EMPTY_FILE: 'Arquivo vazio (0 bytes).',
  PARSER_NOT_FOUND: 'Formato não suportado ou parser indisponível.',
  PARSING_FAILED: 'Erro de conversão: falha na extração de dados do documento.',
  CORRUPTED_ARCHIVE: 'Pacote compactado corrompido ou protegido por senha.',
  TIMEOUT: 'Tempo de processamento excedido.',
  UNKNOWN: 'Erro de conversão inesperado.'
};

/**
 * Determina a concorrência dinâmica com base no volume da fila ou pacote
 * @param {number|Array} queueOrLength - Tamanho da fila ou array de arquivos
 * @returns {number} 4 para lotes moderados (<= 20) ou 1000 para alto volume / descompactação (> 20)
 */
export function getDynamicConcurrency(queueOrLength) {
  const count = typeof queueOrLength === 'number'
    ? queueOrLength
    : (Array.isArray(queueOrLength) ? queueOrLength.length : 0);
  if (count > (APP_CONFIG.CONCURRENCY?.HIGH_VOLUME_THRESHOLD || 20)) {
    return APP_CONFIG.CONCURRENCY?.HIGH_VOLUME || 1000; // Ativa pool agressivo para alto volume (1000 workers)
  }
  return APP_CONFIG.CONCURRENCY?.DEFAULT || 4; // Padrão leve para poucos arquivos
}

