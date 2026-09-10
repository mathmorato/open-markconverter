/**
 * Word (.docx) Parser para Universal MarkConverter
 * Utiliza Mammoth.js para conversão semântica HTML e Turndown para Markdown
 */

import { APP_CONFIG, loadScript } from '../config.js';

let turndownServiceInstance = null;

function getTurndownService() {
  if (turndownServiceInstance) return turndownServiceInstance;

  const TurndownClass = (typeof window !== 'undefined' && window.TurndownService) || globalThis.TurndownService;
  if (!TurndownClass) {
    throw new Error('TurndownService não carregado.');
  }

  const service = new TurndownClass({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  });

  const gfmPlugin = (typeof window !== 'undefined' && window.turndownPluginGfm) || globalThis.turndownPluginGfm;
  if (gfmPlugin) {
    service.use(gfmPlugin.gfm);
    service.use(gfmPlugin.tables);
  }

  turndownServiceInstance = service;
  return service;
}

export async function parseDocx(file) {
  // Carrega bibliotecas sob demanda
  await Promise.all([
    loadScript(APP_CONFIG.CDN.MAMMOTH),
    loadScript(APP_CONFIG.CDN.TURNDOWN),
    loadScript(APP_CONFIG.CDN.TURNDOWN_GFM).catch(() => console.warn('GFM plugin fallback'))
  ]);

  const Mammoth = (typeof window !== 'undefined' && window.mammoth) || globalThis.mammoth;
  if (!Mammoth) {
    throw new Error('Não foi possível inicializar Mammoth.js para documentos Word.');
  }

  const arrayBuffer = await file.arrayBuffer();

  const options = {
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Subtitle'] => p > em:fresh"
    ]
  };

  const input = {
    arrayBuffer,
    buffer: typeof Buffer !== 'undefined' ? Buffer.from(arrayBuffer) : (typeof Uint8Array !== 'undefined' ? new Uint8Array(arrayBuffer) : arrayBuffer)
  };

  const result = await Mammoth.convertToHtml(input, options);
  const rawHtml = result.value;

  if (!rawHtml || !rawHtml.trim()) {
    return `# ${file.name.replace(/\.docx$/i, '')}\n\n*(Documento vazio ou sem conteúdo textual detectável)*\n`;
  }

  const turndown = getTurndownService();
  let markdown = turndown.turndown(rawHtml);

  // Pós-processamento de limpeza de espaçamentos
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Adiciona título principal se não houver cabeçalho no início
  if (!markdown.startsWith('#')) {
    const docTitle = file.name.replace(/\.docx$/i, '');
    markdown = `# ${docTitle}\n\n${markdown}`;
  }

  return markdown;
}
