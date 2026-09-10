/**
 * Apresentações (.pptx) Parser para Universal MarkConverter
 * Extração estruturada por slides (# Slide N e tópicos) via JSZip
 */

import { APP_CONFIG, loadScript } from '../config.js';

export async function parsePptx(file) {
  await loadScript(APP_CONFIG.CDN.JSZIP);

  const JSZip = (typeof window !== 'undefined' && window.JSZip) || globalThis.JSZip;
  if (!JSZip) {
    throw new Error('Não foi possível carregar a biblioteca JSZip.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

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

  const DOMParserClass = (typeof DOMParser !== 'undefined') ? DOMParser : globalThis.DOMParser;
  if (!DOMParserClass) {
    throw new Error('DOMParser não disponível no ambiente.');
  }
  const domParser = new DOMParserClass();

  // Helper para obter elementos por tag com ou sem namespace
  const getTags = (parent, tagName) => {
    const prefixed = parent.getElementsByTagName('p:' + tagName);
    if (prefixed && prefixed.length > 0) return Array.from(prefixed);
    const alphaPrefixed = parent.getElementsByTagName('a:' + tagName);
    if (alphaPrefixed && alphaPrefixed.length > 0) return Array.from(alphaPrefixed);
    return Array.from(parent.getElementsByTagName(tagName));
  };

  for (let i = 0; i < slideEntries.length; i++) {
    const slideInfo = slideEntries[i];
    const slideXmlText = await slideInfo.entry.async('text');
    const xmlDoc = domParser.parseFromString(slideXmlText, 'application/xml');

    let slideTitle = '';
    const paragraphs = [];

    // Coleta todas as formas de texto (sp / p:sp)
    const shapeElements = getTags(xmlDoc, 'sp');

    shapeElements.forEach(shape => {
      // Verifica se é placeholder de título
      const phs = getTags(shape, 'ph');
      const isTitleShape = phs.some(ph => {
        const type = ph.getAttribute('type');
        return type === 'title' || type === 'ctrTitle';
      });

      const pNodes = getTags(shape, 'p');
      pNodes.forEach(p => {
        const pPrs = getTags(p, 'pPr');
        const level = pPrs.length > 0 ? parseInt(pPrs[0].getAttribute('lvl') || '0', 10) : 0;

        const tNodes = getTags(p, 't');
        let text = '';
        tNodes.forEach(t => {
          text += t.textContent || '';
        });

        text = text.trim();
        if (text) {
          if (isTitleShape && !slideTitle) {
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
