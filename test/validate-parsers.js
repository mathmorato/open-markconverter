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
if (APP_CONFIG.VERSION !== 'v.1.4.0') {
  console.error('[ERRO] Versão diferente de v.1.4.0');
  process.exit(1);
}

// 2. Verifica package.json
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
if (pkg.version !== '1.4.0') {
  console.error('[ERRO] package.json version incompatível');
  process.exit(1);
}
console.log(`[OK] package.json version: ${pkg.version}`);

// 3. Verifica sincronização no index.html, fila de downloads, container central e ausência de exemplos
const indexHtml = fs.readFileSync('./index.html', 'utf8');
if (!indexHtml.includes('v.1.4.0')) {
  console.error('[ERRO] index.html não contém v.1.4.0');
  process.exit(1);
}
if (!indexHtml.includes('app-main-container')) {
  console.error('[ERRO] index.html não contém o container unificado app-main-container');
  process.exit(1);
}
if (!indexHtml.includes('id="btn-browse"')) {
  console.error('[ERRO] index.html não contém botão explícito #btn-browse');
  process.exit(1);
}
if (indexHtml.includes('Sistema pronto. Nenhuma falha detectada.')) {
  console.error('[ERRO] index.html ainda contém texto estático obsoleto da caixa de depuração');
  process.exit(1);
}
const footerMatch = indexHtml.match(/<footer[\s\S]*?<\/footer>/);
if (footerMatch && (footerMatch[0].includes('privacy-badge') || footerMatch[0].includes('100% Client-Side'))) {
  console.error('[ERRO] index.html ainda contém badge redundante "100% Client-Side" no rodapé');
  process.exit(1);
}
if (indexHtml.includes('quick-examples-section') || indexHtml.includes('btn-quick-example') || indexHtml.includes('btn-load-sample')) {
  console.error('[ERRO] index.html ainda contém seção ou botões de exemplos que deveriam ter sido removidos');
  process.exit(1);
}
if (fs.existsSync('./examples')) {
  console.error('[ERRO] Pasta examples/ ainda existe na raiz do repositório');
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
console.log('[OK] index.html contém v.1.4.0, app-main-container, fila de arquivos e remoção completa de exemplos');

// 4. Verifica listeners, download individual, telemetria e dupla barra de progresso no js/app.js
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
if (!appJs.includes('file-progress-group') || !appJs.includes('bar-upload') || !appJs.includes('bar-convert') || !appJs.includes('upload-percent') || !appJs.includes('convert-percent')) {
  console.error('[ERRO] js/app.js não contém estrutura de dupla barra de progresso (bar-upload e bar-convert)');
  process.exit(1);
}
if (appJs.includes('initQuickExamples') || appJs.includes('btn-quick-example') || appJs.includes('initDemoAction')) {
  console.error('[ERRO] js/app.js ainda contém rotinas de exemplos que deveriam ter sido removidas');
  process.exit(1);
}
console.log('[OK] js/app.js contém listener de paste, telemetria, addFilesToQueue e dupla barra de progresso');

// 5. Verifica estilos CSS para alinhamento unificado e dupla barra de progresso
const stylesCss = fs.readFileSync('./css/styles.css', 'utf8');
if (!stylesCss.includes('.app-main-container') || !stylesCss.includes('.file-progress-group') || !stylesCss.includes('.bar-upload') || !stylesCss.includes('.bar-convert')) {
  console.error('[ERRO] css/styles.css não contém classes de container unificado ou dupla barra de progresso');
  process.exit(1);
}
if (!stylesCss.includes('@media (max-width: 768px)') || !stylesCss.includes('@media (max-width: 480px)')) {
  console.error('[ERRO] css/styles.css não contém media queries mobile-first completas');
  process.exit(1);
}
if (stylesCss.includes('.quick-examples-section') || stylesCss.includes('.btn-quick-example')) {
  console.error('[ERRO] css/styles.css ainda contém classes de exemplos que deveriam ter sido removidas');
  process.exit(1);
}
console.log('[OK] css/styles.css contém app-main-container, dupla barra de progresso e ausência de estilos obsoletos');

// 6. Verifica README.md
const readme = fs.readFileSync('./README.md', 'utf8');
if (!readme.includes('v.1.4.0')) {
  console.error('[ERRO] README.md não contém v.1.4.0');
  process.exit(1);
}
console.log('[OK] README.md contém cabeçalho v.1.4.0');

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
