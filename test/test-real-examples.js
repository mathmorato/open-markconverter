/**
 * Bateria de Testes Ponta a Ponta com Arquivos Reais da pasta examples/
 * Universal MarkConverter (doc2md)
 */

import fs from 'fs';
import path from 'path';

// 1. Configura ambiente de polyfill/mocks para execução em Node.js
import JSZip from 'jszip';
import XLSX from 'xlsx';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { DOMParser } from '@xmldom/xmldom';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

globalThis.JSZip = JSZip;
globalThis.XLSX = XLSX;
globalThis.mammoth = mammoth;
globalThis.TurndownService = TurndownService;
globalThis.DOMParser = DOMParser;
globalThis.pdfjsLib = pdfjsLib;

// Carrega os parsers de produção
import { parseDocx } from '../js/parsers/docx-parser.js';
import { parseSpreadsheet } from '../js/parsers/xlsx-parser.js';
import { parsePptx } from '../js/parsers/pptx-parser.js';
import { parsePdf } from '../js/parsers/pdf-parser.js';

function createMockFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  return {
    name,
    size: buffer.length,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  };
}

async function runRealExamplesSuite() {
  console.log('===============================================================');
  console.log('  UNIVERSAL MARKCONVERTER - SUÍTE E2E COM ARQUIVOS REAIS');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  // --------------------------------------------------------------------------
  // TESTE 1: Apresentação PPTX (26 MB com 45 slides)
  // --------------------------------------------------------------------------
  try {
    const pptxPath = path.resolve('examples/2025_CTE_M1_Historico(ATUALIZADO).pptx');
    console.log(`[TESTE 1/4] Processando PPTX: ${path.basename(pptxPath)} (${(fs.statSync(pptxPath).size / (1024 * 1024)).toFixed(1)} MB)...`);
    const startTime = performance.now();
    
    const file = createMockFile(pptxPath);
    const markdown = await parsePptx(file);
    const duration = Math.round(performance.now() - startTime);

    if (!markdown || typeof markdown !== 'string') {
      throw new Error('Saída vazia ou tipo incorreto retornado pelo parsePptx');
    }

    if (!markdown.includes('#') || !markdown.includes('Slide')) {
      throw new Error('Markdown gerado não possui formatação estruturada de slides (# Slide N)');
    }

    const slideCount = (markdown.match(/## Slide \d+/g) || []).length;
    console.log(`  -> Sucesso em ${duration} ms | Total de slides identificados: ${slideCount} | Caracteres gerados: ${markdown.length}`);
    passed++;
  } catch (err) {
    console.error('  [FALHA TESTE 1]:', err);
    failed++;
  }

  // --------------------------------------------------------------------------
  // TESTE 2: Documento Word DOCX (248 KB com seções e referências)
  // --------------------------------------------------------------------------
  try {
    const docxPath = path.resolve('examples/Moraes et al. 2025 - Manuscript forests.docx');
    console.log(`\n[TESTE 2/4] Processando DOCX: ${path.basename(docxPath)} (${(fs.statSync(docxPath).size / 1024).toFixed(1)} KB)...`);
    const startTime = performance.now();

    const file = createMockFile(docxPath);
    const markdown = await parseDocx(file);
    const duration = Math.round(performance.now() - startTime);

    if (!markdown || !markdown.includes('#')) {
      throw new Error('Saída do DOCX não contém estrutura hierárquica de cabeçalhos (#)');
    }

    // Verifica presença de parágrafos e termos chave do manuscrito
    if (!markdown.toLowerCase().includes('forest') && !markdown.toLowerCase().includes('moraes')) {
      throw new Error('Conteúdo textual do documento não foi extraído corretamente');
    }

    const words = markdown.trim().split(/\s+/).length;
    console.log(`  -> Sucesso em ${duration} ms | Palavras extraídas: ${words} | Caracteres gerados: ${markdown.length}`);
    passed++;
  } catch (err) {
    console.error('  [FALHA TESTE 2]:', err);
    failed++;
  }

  // --------------------------------------------------------------------------
  // TESTE 3: Planilha Financeira XLSX (92 KB com matriz de dados)
  // --------------------------------------------------------------------------
  try {
    const xlsxPath = path.resolve('examples/CONTROLE INVESTIMENTO - Diogo.xlsx');
    console.log(`\n[TESTE 3/4] Processando XLSX: ${path.basename(xlsxPath)} (${(fs.statSync(xlsxPath).size / 1024).toFixed(1)} KB)...`);
    const startTime = performance.now();

    const file = createMockFile(xlsxPath);
    const markdown = await parseSpreadsheet(file);
    const duration = Math.round(performance.now() - startTime);

    if (!markdown || !markdown.includes('|')) {
      throw new Error('Saída da planilha não contém tabela matricial Markdown (| Coluna |)');
    }

    if (!markdown.includes('---')) {
      throw new Error('Tabela Markdown não possui linha separadora de cabeçalho (| --- |)');
    }

    const tableRows = (markdown.match(/\|.*\|/g) || []).length;
    console.log(`  -> Sucesso em ${duration} ms | Linhas de tabela matricial geradas: ${tableRows}`);
    passed++;
  } catch (err) {
    console.error('  [FALHA TESTE 3]:', err);
    failed++;
  }

  // --------------------------------------------------------------------------
  // TESTE 4: Documento PDF (60 KB estruturado)
  // --------------------------------------------------------------------------
  try {
    const pdfPath = path.resolve('examples/Currículo - Marcirene.pdf');
    console.log(`\n[TESTE 4/4] Processando PDF: ${path.basename(pdfPath)} (${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB)...`);
    const startTime = performance.now();

    const file = createMockFile(pdfPath);
    const markdown = await parsePdf(file);
    const duration = Math.round(performance.now() - startTime);

    if (!markdown || markdown.trim().length === 0) {
      throw new Error('Saída do PDF retornou vazia');
    }

    // Valida integridade: sem caracteres nulos
    if (markdown.includes('\0')) {
      throw new Error('Texto extraído contém caracteres nulos');
    }

    if (!markdown.toLowerCase().includes('marcirene') && !markdown.toLowerCase().includes('currículo')) {
      throw new Error('Conteúdo textual principal do PDF não foi recuperado');
    }

    const lines = markdown.split('\n').length;
    console.log(`  -> Sucesso em ${duration} ms | Linhas de fluxo de texto extraídas: ${lines} | Caracteres: ${markdown.length}`);
    passed++;
  } catch (err) {
    console.error('  [FALHA TESTE 4]:', err);
    failed++;
  }

  console.log('\n===============================================================');
  console.log(`  RESULTADO FINAL: ${passed} PASSARAM | ${failed} FALHARAM`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRealExamplesSuite();
