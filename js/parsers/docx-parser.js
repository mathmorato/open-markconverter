/**
 * Word (.docx) Parser para Universal MarkConverter
 * Utiliza Mammoth.js para conversão semântica HTML e Turndown para Markdown
 */

import { APP_CONFIG, loadScript } from '../config.js';

let turndownServiceInstance = null;

function getTurndownService() {
  if (turndownServiceInstance) return turndownServiceInstance;

  if (typeof window.TurndownService === 'undefined') {
    throw new Error('TurndownService não carregado.');
  }

  const service = new window.TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  });

  if (typeof window.turndownPluginGfm !== 'undefined') {
    service.use(window.turndownPluginGfm.gfm);
    service.use(window.turndownPluginGfm.tables);
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

  if (typeof window.mammoth === 'undefined') {
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

  const result = await window.mammoth.convertToHtml({ arrayBuffer }, options);
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
