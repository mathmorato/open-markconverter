/**
 * Planilhas (.xlsx, .csv, .ods) Parser para Universal MarkConverter
 * Conversão matricial para tabelas Markdown nativas via SheetJS
 */

import { APP_CONFIG, loadScript } from '../config.js';

/**
 * Converte matriz 2D em tabela Markdown formatada
 */
function matrixToMarkdownTable(matrix) {
  if (!matrix || matrix.length === 0) return '*(Sem dados tabularizados)*\n';

  // Remove linhas e colunas completamente vazias
  const cleanedRows = matrix.filter(row => Array.isArray(row) && row.some(cell => cell !== '' && cell !== null && cell !== undefined));
  if (cleanedRows.length === 0) return '*(Planilha vazia)*\n';

  // Determina número máximo de colunas
  let maxCols = 0;
  cleanedRows.forEach(row => {
    if (row.length > maxCols) maxCols = row.length;
  });

  if (maxCols === 0) return '*(Planilha vazia)*\n';

  // Normaliza linhas para ter exatamente maxCols colunas
  const normalizedRows = cleanedRows.map(row => {
    const fullRow = [];
    for (let c = 0; c < maxCols; c++) {
      let val = (c < row.length && row[c] !== null && row[c] !== undefined) ? String(row[c]) : '';
      // Limpa quebras de linha dentro da célula e escapa barras verticais
      val = val.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim();
      fullRow.push(val);
    }
    return fullRow;
  });

  // Cabeçalho
  const headerRow = normalizedRows[0];
  const headerMd = '| ' + headerRow.map((cell, idx) => cell || `Coluna ${idx + 1}`).join(' | ') + ' |';
  const separatorMd = '| ' + new Array(maxCols).fill('---').join(' | ') + ' |';

  const bodyRows = normalizedRows.slice(1).map(row => {
    return '| ' + row.join(' | ') + ' |';
  });

  return [headerMd, separatorMd, ...bodyRows].join('\n') + '\n';
}

export async function parseSpreadsheet(file) {
  await loadScript(APP_CONFIG.CDN.SHEETJS);

  if (typeof window.XLSX === 'undefined') {
    throw new Error('Não foi possível carregar o motor SheetJS.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const docTitle = file.name.replace(/\.[^/.]+$/, '');
  const markdownSections = [`# ${docTitle}\n`];

  const sheetCount = workbook.SheetNames.length;

  for (let i = 0; i < sheetCount; i++) {
    const sheetName = workbook.SheetNames[i];
    const sheet = workbook.Sheets[sheetName];

    if (sheetCount > 1) {
      markdownSections.push(`## ${sheetName}\n`);
    }

    const data = window.XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false
    });

    const tableMd = matrixToMarkdownTable(data);
    markdownSections.push(tableMd);
  }

  return markdownSections.join('\n\n').trim();
}
