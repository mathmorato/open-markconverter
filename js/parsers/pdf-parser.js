/**
 * PDF (.pdf) Parser para Universal MarkConverter
 * Extração estruturada de fluxo de texto e seções via PDF.js
 */

import { APP_CONFIG, loadScript } from '../config.js';

export async function parsePdf(file) {
  await loadScript(APP_CONFIG.CDN.PDFJS);

  const pdfjsLib = (typeof window !== 'undefined' && window.pdfjsLib) || globalThis.pdfjsLib;
  if (!pdfjsLib) {
    throw new Error('Não foi possível carregar a biblioteca PDF.js.');
  }

  // Configura worker no browser se ainda não configurado
  if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = APP_CONFIG.CDN.PDFJS_WORKER;
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const docTitle = file.name.replace(/\.pdf$/i, '');
  const pagesMarkdown = [`# ${docTitle}\n`];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    if (!textContent || textContent.items.length === 0) {
      if (pdfDoc.numPages > 1) {
        pagesMarkdown.push(`### Página ${pageNum}\n\n*(Página sem texto selecionável ou imagem escaneada)*\n`);
      }
      continue;
    }

    // Calcula altura média de fonte para identificar títulos
    let totalHeight = 0;
    let validItems = 0;
    textContent.items.forEach(item => {
      const height = Math.abs(item.transform[0]) || item.height || 0;
      if (height > 0) {
        totalHeight += height;
        validItems++;
      }
    });
    const avgHeight = validItems > 0 ? totalHeight / validItems : 12;

    // Agrupa itens em linhas com base na coordenada Y (transform[5])
    const lines = [];
    let currentLine = [];
    let lastY = null;
    let lastHeight = avgHeight;

    textContent.items.forEach(item => {
      const text = item.str;
      if (!text && !item.hasEOL) return;

      const y = Math.round(item.transform[5]);
      const height = Math.abs(item.transform[0]) || item.height || avgHeight;

      // Se a diferença em Y for significativa, inicia nova linha
      if (lastY !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.length > 0) {
          lines.push({
            text: currentLine.join(' ').replace(/\s{2,}/g, ' ').trim(),
            height: lastHeight,
            y: lastY
          });
          currentLine = [];
        }
      }

      if (text.trim()) {
        currentLine.push(text);
      }
      lastY = y;
      lastHeight = height;
    });

    if (currentLine.length > 0) {
      lines.push({
        text: currentLine.join(' ').replace(/\s{2,}/g, ' ').trim(),
        height: lastHeight,
        y: lastY
      });
    }

    // Processa linhas em parágrafos e títulos Markdown
    const pageParagraphs = [];
    if (pdfDoc.numPages > 1) {
      pageParagraphs.push(`---\n\n*Página ${pageNum} de ${pdfDoc.numPages}*\n`);
    }

    let bufferParagraph = '';

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const isHeader = line.height > (avgHeight * 1.35);

      if (isHeader) {
        if (bufferParagraph) {
          pageParagraphs.push(bufferParagraph.trim());
          bufferParagraph = '';
        }
        pageParagraphs.push(`### ${line.text}\n`);
      } else if (line.text.startsWith('•') || line.text.startsWith('- ') || line.text.startsWith('* ')) {
        if (bufferParagraph) {
          pageParagraphs.push(bufferParagraph.trim());
          bufferParagraph = '';
        }
        pageParagraphs.push(`- ${line.text.replace(/^[•\-\*]\s*/, '')}`);
      } else {
        // Verifica se a linha termina com pontuação
        const endsWithPunct = /[.:;?!]$/.test(line.text);
        if (bufferParagraph) {
          bufferParagraph += ' ' + line.text;
        } else {
          bufferParagraph = line.text;
        }

        if (endsWithPunct) {
          pageParagraphs.push(bufferParagraph.trim());
          bufferParagraph = '';
        }
      }
    }

    if (bufferParagraph) {
      pageParagraphs.push(bufferParagraph.trim());
    }

    pagesMarkdown.push(pageParagraphs.join('\n\n'));
  }

  return pagesMarkdown.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
