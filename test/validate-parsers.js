/**
 * Script de validação automatizada de sintaxe e integridade
 * dos parsers e configurações do Universal MarkConverter
 */

import { APP_CONFIG } from '../js/config.js';
import fs from 'fs';
import path from 'path';

console.log('--- Iniciando validação do Universal MarkConverter ---');

// 1. Verifica versão SemVer
console.log(`[OK] Versão SemVer configurada: ${APP_CONFIG.VERSION}`);
if (APP_CONFIG.VERSION !== 'v.1.2.0') {
  console.error('[ERRO] Versão diferente de v.1.2.0');
  process.exit(1);
}

// 2. Verifica package.json
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
if (pkg.version !== '1.2.0') {
  console.error('[ERRO] package.json version incompatível');
  process.exit(1);
}
console.log(`[OK] package.json version: ${pkg.version}`);

// 3. Verifica sincronização no index.html, fila de downloads e remoção do editor antigo
const indexHtml = fs.readFileSync('./index.html', 'utf8');
if (!indexHtml.includes('v.1.2.0')) {
  console.error('[ERRO] index.html não contém v.1.2.0');
  process.exit(1);
}
if (!indexHtml.includes('id="btn-browse"')) {
  console.error('[ERRO] index.html não contém botão explícito #btn-browse');
  process.exit(1);
}
if (!indexHtml.includes('id="debug-status"')) {
  console.error('[ERRO] index.html não contém barra técnica #debug-status');
  process.exit(1);
}
if (!indexHtml.includes('quick-examples-section') || !indexHtml.includes('btn-quick-example')) {
  console.error('[ERRO] index.html não contém seção de exemplos rápidos quick-examples-section');
  process.exit(1);
}
if (!indexHtml.includes('left: -9999px')) {
  console.error('[ERRO] index.html não contém posicionamento neutro do file-input');
  process.exit(1);
}
if (!indexHtml.includes('multiple')) {
  console.error('[ERRO] index.html não contém atributo multiple no file-input');
  process.exit(1);
}
if (!indexHtml.includes('id="file-queue-section"') || !indexHtml.includes('id="btn-queue-download-all"') || !indexHtml.includes('id="btn-queue-clear"')) {
  console.error('[ERRO] index.html não contém os elementos da fila de processamento em lote');
  process.exit(1);
}
if (indexHtml.includes('id="raw-markdown-editor"') || indexHtml.includes('id="preview-container"') || indexHtml.includes('id="metrics-bar"')) {
  console.error('[ERRO] index.html ainda contém painel de edição/preview obsoleto que deveria ter sido removido');
  process.exit(1);
}
console.log('[OK] index.html contém v.1.2.0, fila de arquivos e remoção completa do editor obsoleto');

// 4. Verifica listeners, download individual e telemetria no js/app.js
const appJs = fs.readFileSync('./js/app.js', 'utf8');
if (!appJs.includes("window.addEventListener('paste'")) {
  console.error('[ERRO] js/app.js não contém listener de paste');
  process.exit(1);
}
if (!appJs.includes('window.onerror') || !appJs.includes('window.onunhandledrejection')) {
  console.error('[ERRO] js/app.js não contém telemetria de erros globais');
  process.exit(1);
}
if (!appJs.includes('addFilesToQueue') || !appJs.includes('downloadQueueItem') || !appJs.includes('btn-queue-item-download')) {
  console.error('[ERRO] js/app.js não contém rotinas de download individual ou fila de lote');
  process.exit(1);
}
console.log('[OK] js/app.js contém listener de paste, telemetria global, addFilesToQueue e downloadQueueItem');

// 5. Verifica README.md
const readme = fs.readFileSync('./README.md', 'utf8');
if (!readme.includes('v.1.2.0')) {
  console.error('[ERRO] README.md não contém v.1.2.0');
  process.exit(1);
}
console.log('[OK] README.md contém cabeçalho v.1.2.0');

// 5. Verifica existência de todos os arquivos do projeto
const requiredFiles = [
  'index.html',
  'css/styles.css',
  'js/config.js',
  'js/app.js',
  'js/parsers/docx-parser.js',
  'js/parsers/xlsx-parser.js',
  'js/parsers/pptx-parser.js',
  'js/parsers/pdf-parser.js',
  'js/parsers/text-parser.js',
  'js/workers/converter-worker.js',
  'README.md',
  'package.json'
];

requiredFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.error(`[ERRO] Arquivo obrigatório ausente: ${file}`);
    process.exit(1);
  }
});
console.log(`[OK] Todos os ${requiredFiles.length} arquivos obrigatórios existem e estão no lugar!`);

console.log('--- Validação concluída com 100% de sucesso! ---');
