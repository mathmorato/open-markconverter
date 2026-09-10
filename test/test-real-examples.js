/**
 * Suíte de Testes com Exemplos Reais e Validação de Suavização & Progressão Linear
 * Universal MarkConverter (doc2md) - v.1.4.3
 */

import JSZip from 'jszip';
import XLSX from 'xlsx';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs';

// Polyfills para execução em ambiente Node.js
globalThis.JSZip = JSZip;
globalThis.XLSX = XLSX;
globalThis.mammoth = mammoth;
globalThis.TurndownService = TurndownService;
globalThis.DOMParser = DOMParser;

import { parsePptx } from '../js/parsers/pptx-parser.js';
import { parseSpreadsheet } from '../js/parsers/xlsx-parser.js';
import { parseDocx } from '../js/parsers/docx-parser.js';
import { parseText } from '../js/parsers/text-parser.js';

console.log('===============================================================');
console.log('  SUÍTE DE PARSERS REAIS, SUAVIZAÇÃO & PROGRESSO LINEAR (v.1.4.3)');
console.log('===============================================================\n');

let passed = 0;
let failed = 0;

// --------------------------------------------------------------------------
// TESTE 1: Planilha Real em Memória (SheetJS) com Múltiplas Abas & onProgress
// --------------------------------------------------------------------------
try {
  console.log('[TESTE 1/4] Gerando planilha XLSX com 3 abas e validando sub-progresso...');
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet([['ID', 'Nome', 'Valor'], [1, 'Alpha', 100], [2, 'Beta', 200]]);
  const ws2 = XLSX.utils.aoa_to_sheet([['Métrica', 'Q1', 'Q2'], ['Vendas', 1500, 2300]]);
  const ws3 = XLSX.utils.aoa_to_sheet([['Status', 'Total'], ['Ativo', 42]]);
  XLSX.utils.book_append_sheet(wb, ws1, 'Relatório');
  XLSX.utils.book_append_sheet(wb, ws2, 'Métricas');
  XLSX.utils.book_append_sheet(wb, ws3, 'Sumário');

  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const mockFile = {
    name: 'planilha_teste.xlsx',
    size: xlsxBuffer.length,
    arrayBuffer: async () => xlsxBuffer.buffer.slice(xlsxBuffer.byteOffset, xlsxBuffer.byteOffset + xlsxBuffer.byteLength)
  };

  const progressEvents = [];
  const md = await parseSpreadsheet(mockFile, (percent, detail) => {
    progressEvents.push({ percent, detail });
  });

  if (!md.includes('| ID | Nome | Valor |') || !md.includes('## Relatório') || !md.includes('## Métricas')) {
    throw new Error('Saída da planilha não contém as tabelas esperadas.');
  }

  if (progressEvents.length < 3) {
    throw new Error(`Esperava no mínimo 3 eventos de sub-progresso para 3 abas, recebeu ${progressEvents.length}`);
  }

  console.log(`  -> Sucesso! 3 abas convertidas em tabela Markdown com ${progressEvents.length} eventos de progresso.`);
  passed++;
} catch (err) {
  console.error('  [FALHA TESTE 1]:', err.message);
  failed++;
}

// --------------------------------------------------------------------------
// TESTE 2: Apresentação PPTX Real em Memória (JSZip) com Slides & onProgress
// --------------------------------------------------------------------------
try {
  console.log('\n[TESTE 2/4] Gerando apresentação PPTX com 3 slides e validando sub-progresso...');
  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide 1: Introdução ao Projeto</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
    </p:sld>`);
  zip.file('ppt/slides/slide2.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide 2: Metodologia e Arquitetura</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
    </p:sld>`);
  zip.file('ppt/slides/slide3.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide 3: Resultados e Conclusão</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
    </p:sld>`);

  const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const mockPptx = {
    name: 'apresentacao_projeto.pptx',
    size: pptxBuffer.length,
    arrayBuffer: async () => pptxBuffer.buffer.slice(pptxBuffer.byteOffset, pptxBuffer.byteOffset + pptxBuffer.byteLength)
  };

  const pptxProgress = [];
  const pptxMd = await parsePptx(mockPptx, (percent, detail) => {
    pptxProgress.push({ percent, detail });
  });

  if (!pptxMd.includes('## Slide 1') || !pptxMd.includes('## Slide 2') || !pptxMd.includes('Introdução ao Projeto')) {
    throw new Error('Markdown do PPTX não contém a estrutura hierárquica dos slides.');
  }

  if (pptxProgress.length !== 3) {
    throw new Error(`Esperava 3 eventos de progresso (1 por slide), obteve ${pptxProgress.length}`);
  }

  console.log(`  -> Sucesso! 3 slides processados com linearização granular (${pptxProgress.map(p => p.percent + '%').join(' -> ')}).`);
  passed++;
} catch (err) {
  console.error('  [FALHA TESTE 2]:', err.message);
  failed++;
}

// --------------------------------------------------------------------------
// TESTE 3: Parser de Texto Puro, JSON e Markdown com onProgress
// --------------------------------------------------------------------------
try {
  console.log('\n[TESTE 3/4] Validando parser de texto estruturado e JSON...');
  const jsonFile = {
    name: 'config.json',
    text: async () => JSON.stringify({ app: 'MarkConverter', version: '1.4.2', features: ['smoothing', 'linear'] })
  };

  let textProgressCalled = false;
  const jsonMd = await parseText(jsonFile, (pct, detail) => {
    textProgressCalled = true;
  });

  if (!jsonMd.includes('```json') || !jsonMd.includes('MarkConverter')) {
    throw new Error('Falha na conversão de JSON para bloco Markdown cercado.');
  }

  if (!textProgressCalled) {
    throw new Error('Callback onProgress não foi acionado no parser de texto.');
  }

  console.log('  -> Sucesso! Formatação JSON com syntax-highlighting e progresso reportado.');
  passed++;
} catch (err) {
  console.error('  [FALHA TESTE 3]:', err.message);
  failed++;
}

// --------------------------------------------------------------------------
// TESTE 4: Verificação da Suavização CSS (cubic-bezier 240ms) e Ticker Linear
// --------------------------------------------------------------------------
try {
  console.log('\n[TESTE 4/4] Validando conformidade dos estilos de suavização CSS...');
  const css = fs.readFileSync('./css/styles.css', 'utf8');

  if (!css.includes('240ms cubic-bezier(0.4, 0, 0.2, 1)')) {
    throw new Error('css/styles.css não possui a transição especificada de 240ms cubic-bezier(0.4, 0, 0.2, 1).');
  }

  const appJs = fs.readFileSync('./js/app.js', 'utf8');
  if (appJs.includes('item.convertProgress = 60;')) {
    throw new Error('js/app.js ainda contém a marca estática e travada de 60%.');
  }

  if (!appJs.includes('tickerInterval') || !appJs.includes('onParserSubProgress')) {
    throw new Error('js/app.js não possui o ticker dinâmico de conversão linear.');
  }

  console.log('  -> Sucesso! Estilos de suavização e ausência da estagnação em 60% validados.');
  passed++;
} catch (err) {
  console.error('  [FALHA TESTE 4]:', err.message);
  failed++;
}

console.log('\n===============================================================');
console.log(`  RESULTADO FINAL: ${passed} PASSARAM | ${failed} FALHARAM`);
console.log('===============================================================');

if (failed > 0) {
  process.exit(1);
}
