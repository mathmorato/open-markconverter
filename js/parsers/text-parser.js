/**
 * Plain Text / Code / HTML Parser para Universal MarkConverter
 * Suporte a .txt, .json, .html, .rtf, .md, .xml, .yaml
 */

import { APP_CONFIG, loadScript } from '../config.js';

export async function parseText(file, onProgress = null) {
  if (typeof onProgress === 'function') {
    onProgress(50, 'Lendo conteúdo textual...');
  }
  const ext = file.name.split('.').pop().toLowerCase();
  const textContent = await file.text();
  const docTitle = file.name.replace(/\.[^/.]+$/, '');

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
      await loadScript(APP_CONFIG.CDN.TURNDOWN);
      await loadScript(APP_CONFIG.CDN.TURNDOWN_GFM).catch(() => {});

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
        return `# ${docTitle}\n\n${turndown.turndown(textContent)}`;
      }
      return `# ${docTitle}\n\n\`\`\`html\n${textContent}\n\`\`\`\n`;
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
