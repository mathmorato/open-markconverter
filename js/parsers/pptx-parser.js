/**
 * Apresentações (.pptx) Parser para Universal MarkConverter
 * Extração estruturada por slides (# Slide N e tópicos) via JSZip
 */

import { APP_CONFIG, loadScript } from '../config.js';

export async function parsePptx(file) {
  await loadScript(APP_CONFIG.CDN.JSZIP);

  if (typeof window.JSZip === 'undefined') {
    throw new Error('Não foi possível carregar a biblioteca JSZip.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const zip = await window.JSZip.loadAsync(arrayBuffer);

  const docTitle = file.name.replace(/\.pptx$/i, '');
  const markdownSlides = [`# ${docTitle}\n`];

  // Encontra todos os arquivos de slides: ppt/slides/slideN.xml
  const slideEntries = [];
  zip.forEach((relativePath, zipEntry) => {
    const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      slideEntries.push({
        num: parseInt(match[1], 10),
        path: relativePath,
        entry: zipEntry
      });
    }
  });

  // Ordena por número de slide
  slideEntries.sort((a, b) => a.num - b.num);

  if (slideEntries.length === 0) {
    return `# ${docTitle}\n\n*(Nenhum slide com conteúdo detectado na apresentação)*\n`;
  }

  const domParser = new DOMParser();

  for (let i = 0; i < slideEntries.length; i++) {
    const slideInfo = slideEntries[i];
    const slideXmlText = await slideInfo.entry.async('text');
    const xmlDoc = domParser.parseFromString(slideXmlText, 'application/xml');

    // Tenta identificar o título do slide
    let slideTitle = '';
    const titleShape = xmlDoc.querySelector('sp:has(ph[type="title"]), sp:has(ph[type="ctrTitle"])') ||
                       xmlDoc.querySelector('p\\:sp:has(p\\:ph[type="title"]), p\\:sp:has(p\\:ph[type="ctrTitle"])');

    // Coleta parágrafos de texto do slide
    const paragraphs = [];
    const shapeElements = xmlDoc.querySelectorAll('sp, p\\:sp');

    shapeElements.forEach(shape => {
      // Verifica se é o placeholder de título
      const ph = shape.querySelector('ph, p\\:ph');
      const isTitlePh = ph && (ph.getAttribute('type') === 'title' || ph.getAttribute('type') === 'ctrTitle');

      const pNodes = shape.querySelectorAll('p, a\\:p');
      pNodes.forEach(p => {
        // Nível de indentação do marcador (0, 1, 2...)
        const pPr = p.querySelector('pPr, a\\:pPr');
        const level = pPr ? parseInt(pPr.getAttribute('lvl') || '0', 10) : 0;

        // Texto concatenado do parágrafo
        const tNodes = p.querySelectorAll('t, a\\:t');
        let text = '';
        tNodes.forEach(t => {
          text += t.textContent;
        });

        text = text.trim();
        if (text) {
          if (isTitlePh && !slideTitle) {
            slideTitle = text;
          } else {
            paragraphs.push({ text, level });
          }
        }
      });
    });

    // Constrói o cabeçalho do slide
    const slideHeader = slideTitle
      ? `## Slide ${slideInfo.num}: ${slideTitle}`
      : `## Slide ${slideInfo.num}`;

    let slideContent = `${slideHeader}\n\n`;

    if (paragraphs.length > 0) {
      paragraphs.forEach(p => {
        const indent = '  '.repeat(p.level);
        slideContent += `${indent}- ${p.text}\n`;
      });
    } else if (!slideTitle) {
      slideContent += `*(Slide sem texto visual)*\n`;
    }

    // Tenta carregar anotações do orador correspondentes (ppt/notesSlides/notesSlideN.xml)
    const notesPath = `ppt/notesSlides/notesSlide${slideInfo.num}.xml`;
    const notesFile = zip.file(notesPath);
    if (notesFile) {
      try {
        const notesXmlText = await notesFile.async('text');
        const notesDoc = domParser.parseFromString(notesXmlText, 'application/xml');
        const noteTexts = [];
        notesDoc.querySelectorAll('t, a\\:t').forEach(t => {
          const txt = t.textContent.trim();
          if (txt && !txt.includes('Slide ') && !/^\d+$/.test(txt)) {
            noteTexts.push(txt);
          }
        });
        if (noteTexts.length > 0) {
          slideContent += `\n> **Notas do Apresentador:** ${noteTexts.join(' ')}\n`;
        }
      } catch (err) {
        // Continua mesmo se as notas falharem
      }
    }

    markdownSlides.push(slideContent.trim());
  }

  return markdownSlides.join('\n\n---\n\n').trim();
}
