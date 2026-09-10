/**
 * Plain Text / Code / HTML Parser para Universal MarkConverter
 * Suporte a .txt, .json, .html, .rtf, .md, .xml, .yaml
 */

import { APP_CONFIG, loadScript, CODE_EXTENSIONS_MAP } from '../config.js';

/**
 * Converte documento ou string HTML para Markdown estruturado usando DOMParser nativo (ou regex)
 * @param {string} htmlContent Conteúdo HTML bruto
 * @param {string} docTitle Título do documento
 * @returns {string} Markdown gerado
 */
export function convertHtmlToMarkdown(htmlContent, docTitle = 'Documento') {
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      // Remove scripts, estilos e elementos não textuais
      doc.querySelectorAll('script, style, noscript, svg, iframe').forEach(el => el.remove());

      function walk(node) {
        if (!node) return '';
        if (node.nodeType === 3) { // TEXT_NODE
          return node.nodeValue;
        }
        if (node.nodeType !== 1) { // ELEMENT_NODE
          return '';
        }

        const tag = node.tagName.toLowerCase();
        let inner = Array.from(node.childNodes).map(walk).join('');

        switch (tag) {
          case 'h1': return `\n\n# ${inner.trim()}\n\n`;
          case 'h2': return `\n\n## ${inner.trim()}\n\n`;
          case 'h3': return `\n\n### ${inner.trim()}\n\n`;
          case 'h4': return `\n\n#### ${inner.trim()}\n\n`;
          case 'h5': return `\n\n##### ${inner.trim()}\n\n`;
          case 'h6': return `\n\n###### ${inner.trim()}\n\n`;
          case 'p': return `\n\n${inner.trim()}\n\n`;
          case 'br': return '\n';
          case 'hr': return '\n\n---\n\n';
          case 'strong':
          case 'b': return `**${inner.trim()}**`;
          case 'em':
          case 'i': return `*${inner.trim()}*`;
          case 'code': {
            if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') {
              return inner;
            }
            return `\`${inner}\``;
          }
          case 'pre': {
            const codeEl = node.querySelector('code');
            const codeText = codeEl ? codeEl.textContent : inner;
            return `\n\n\`\`\`\n${codeText.trim()}\n\`\`\`\n\n`;
          }
          case 'blockquote': return `\n\n> ${inner.trim().replace(/\n/g, '\n> ')}\n\n`;
          case 'a': {
            const href = node.getAttribute('href') || '';
            const text = inner.trim() || href;
            return href ? `[${text}](${href})` : text;
          }
          case 'img': {
            const src = node.getAttribute('src') || '';
            const alt = node.getAttribute('alt') || 'imagem';
            return src ? `![${alt}](${src})` : '';
          }
          case 'ul': {
            const items = Array.from(node.children)
              .filter(child => child.tagName.toLowerCase() === 'li')
              .map(li => `- ${Array.from(li.childNodes).map(walk).join('').trim()}`)
              .join('\n');
            return `\n\n${items}\n\n`;
          }
          case 'ol': {
            let count = 1;
            const items = Array.from(node.children)
              .filter(child => child.tagName.toLowerCase() === 'li')
              .map(li => `${count++}. ${Array.from(li.childNodes).map(walk).join('').trim()}`)
              .join('\n');
            return `\n\n${items}\n\n`;
          }
          case 'li': {
            return `- ${inner.trim()}`;
          }
          case 'table': {
            const rows = Array.from(node.querySelectorAll('tr'));
            if (rows.length === 0) return '';
            let tableMd = '\n\n';
            rows.forEach((row, rIndex) => {
              const cells = Array.from(row.querySelectorAll('th, td'));
              const rowText = '| ' + cells.map(c => Array.from(c.childNodes).map(walk).join('').trim().replace(/\|/g, '\\|')).join(' | ') + ' |';
              tableMd += rowText + '\n';
              if (rIndex === 0) {
                const sep = '| ' + cells.map(() => '---').join(' | ') + ' |';
                tableMd += sep + '\n';
              }
            });
            return tableMd + '\n\n';
          }
          default:
            return inner;
        }
      }

      const body = doc.body || doc;
      let md = walk(body);
      md = md.replace(/\n{3,}/g, '\n\n').trim();
      if (!md) {
        md = body.textContent ? body.textContent.trim() : '';
      }
      return md ? `# ${docTitle}\n\n${md}` : `# ${docTitle}\n\n*Documento HTML sem conteúdo legível.*`;
    } catch (domErr) {
      console.warn('[doc2md] Fallback DOMParser falhou, aplicando extração de texto:', domErr);
    }
  }

  // Fallback nativo universal (Node.js ou navegadores sem DOMParser)
  const stripped = htmlContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<h[4-6][^>]*>(.*?)<\/h[4-6]>/gi, '\n\n#### $1\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<hr\s*[\/]?>/gi, '\n\n---\n\n')
    .replace(/<strong>(.*?)<\/strong>|<b>(.*?)<\/b>/gi, '**$1$2**')
    .replace(/<em>(.*?)<\/em>|<i>(.*?)<\/i>/gi, '*$1$2*')
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return `# ${docTitle}\n\n${stripped || '*Documento HTML sem conteúdo*'}`;
}

/**
 * Processa qualquer arquivo de programação ou script gerando Markdown estruturado
 * com cabeçalho semântico, metadados e código com indentação preservada.
 * @param {string|ArrayBuffer|Uint8Array} input Conteúdo do código ou buffer
 * @param {string} extension Extensão do arquivo (ex: 'js', 'm', 'lua')
 * @param {string} fileName Nome do arquivo
 * @returns {string} Markdown estruturado
 */
export function parseSourceCode(input, extension, fileName = 'codigo') {
  let textContent = '';
  if (typeof input === 'string') {
    textContent = input;
  } else if (input instanceof ArrayBuffer) {
    textContent = new TextDecoder('utf-8').decode(input);
  } else if (input && input.buffer instanceof ArrayBuffer) {
    textContent = new TextDecoder('utf-8').decode(input);
  } else {
    textContent = String(input || '');
  }

  const cleanExt = (extension || '').toLowerCase().replace(/^\./, '');
  const language = CODE_EXTENSIONS_MAP[cleanExt] || cleanExt || 'text';
  const lines = textContent.split(/\r\n|\r|\n/).length;
  const sizeInBytes = (typeof Blob !== 'undefined')
    ? new Blob([textContent]).size
    : Buffer.byteLength(textContent, 'utf8');
  const formattedSize = (sizeInBytes / 1024).toFixed(1) + ' KB';

  return `# ${fileName}\n\n` +
    `> **Linguagem:** \`${language}\` | **Linhas:** ${lines} | **Tamanho:** ${formattedSize}\n\n` +
    `\`\`\`${language}\n` +
    `${textContent}\n` +
    `\`\`\`\n`;
}

export async function parseText(file, onProgress = null) {
  if (typeof onProgress === 'function') {
    onProgress(50, 'Lendo conteúdo textual...');
  }
  const fileName = (file && file.name) ? file.name : 'documento.txt';
  const ext = fileName.split('.').pop().toLowerCase();
  const docTitle = fileName.replace(/\.[^/.]+$/, '');

  let textContent = '';
  if (typeof file === 'string') {
    textContent = file;
  } else if (file instanceof ArrayBuffer) {
    textContent = new TextDecoder('utf-8').decode(file);
  } else if (file && typeof file.text === 'function') {
    try {
      textContent = await file.text();
    } catch (e) {
      if (typeof file.arrayBuffer === 'function') {
        const ab = await file.arrayBuffer();
        textContent = new TextDecoder('utf-8').decode(ab);
      } else {
        throw e;
      }
    }
  } else if (file && typeof file.arrayBuffer === 'function') {
    const ab = await file.arrayBuffer();
    textContent = new TextDecoder('utf-8').decode(ab);
  } else {
    textContent = String(file || '');
  }

  const cleanExt = (ext || '').replace(/^\./, '');
  if (CODE_EXTENSIONS_MAP[cleanExt] && !['json', 'html', 'htm', 'rtf', 'md', 'markdown', 'txt', 'log'].includes(cleanExt)) {
    return parseSourceCode(textContent, cleanExt, fileName);
  }

  switch (ext) {
    case 'json': {
      try {
        const parsed = JSON.parse(textContent);
        const formatted = JSON.stringify(parsed, null, 2);
        return `# ${docTitle}\n\n\`\`\`json\n${formatted}\n\`\`\`\n`;
      } catch (err) {
        return `# ${docTitle}\n\n\`\`\`json\n${textContent}\n\`\`\`\n`;
      }
    }

    case 'html':
    case 'htm': {
      // Camada 1: TurndownService externo (se disponível ou carregável)
      try {
        if (typeof window !== 'undefined') {
          if (typeof window.TurndownService === 'undefined' && APP_CONFIG?.CDN?.TURNDOWN) {
            await loadScript(APP_CONFIG.CDN.TURNDOWN).catch(() => {});
            if (APP_CONFIG?.CDN?.TURNDOWN_GFM) {
              await loadScript(APP_CONFIG.CDN.TURNDOWN_GFM).catch(() => {});
            }
          }

          if (typeof window.TurndownService !== 'undefined') {
            const turndown = new window.TurndownService({
              headingStyle: 'atx',
              hr: '---',
              bulletListMarker: '-',
              codeBlockStyle: 'fenced'
            });
            if (typeof window.turndownPluginGfm !== 'undefined') {
              turndown.use(window.turndownPluginGfm.gfm);
            }
            const res = turndown.turndown(textContent);
            if (res && res.trim()) {
              return `# ${docTitle}\n\n${res.trim()}`;
            }
          }
        }
      } catch (err) {
        console.warn('[doc2md] Falha no TurndownService, executando fallback nativo:', err);
      }

      // Camada 2: Fallback Nativo do Navegador / DOMParser
      return convertHtmlToMarkdown(textContent, docTitle);
    }

    case 'rtf': {
      // Conversor básico e robusto de RTF para texto limpo
      const plain = textContent
        .replace(/\\par[d]?/g, '\n')
        .replace(/\\b(?:\s+([^\\]+?)\s*\\b0|(\s+[^\\]+))/g, '**$1$2**')
        .replace(/\\i(?:\s+([^\\]+?)\s*\\i0|(\s+[^\\]+))/g, '*$1$2*')
        .replace(/\{\\\*?\\[^{}]+?\}|\\(?:[a-z]{1,32}(-?\d+)? ?|[\r\n\t])/gi, '')
        .replace(/[{}]/g, '')
        .trim();
      return `# ${docTitle}\n\n${plain}\n`;
    }

    case 'md': {
      return textContent;
    }

    case 'xml':
    case 'yaml':
    case 'yml': {
      return `# ${docTitle}\n\n\`\`\`${ext}\n${textContent}\n\`\`\`\n`;
    }

    case 'txt':
    case 'log':
    default: {
      return `# ${docTitle}\n\n${textContent}\n`;
    }
  }
}
