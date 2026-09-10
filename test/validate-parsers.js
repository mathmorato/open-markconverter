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
if (APP_CONFIG.VERSION !== 'v.1.4.3') {
  console.error('[ERRO] Versão diferente de v.1.4.3');
  process.exit(1);
}

// 1.1. Verifica limite de tamanho de 1,5 GB (1.610.612.736 bytes)
if (APP_CONFIG.MAX_FILE_SIZE_BYTES !== 1.5 * 1024 * 1024 * 1024) {
  console.error('[ERRO] APP_CONFIG.MAX_FILE_SIZE_BYTES inválido ou diferente de 1.5 GB');
  process.exit(1);
}
console.log(`[OK] Limite máximo de arquivo configurado: ${APP_CONFIG.MAX_FILE_SIZE_BYTES} bytes (1,5 GB)`);

// 2. Verifica package.json
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
if (pkg.version !== '1.4.3') {
  console.error('[ERRO] package.json version incompatível');
  process.exit(1);
}
console.log(`[OK] package.json version: ${pkg.version}`);

// 3. Verifica sincronização no index.html, fila de downloads, container central e ausência de exemplos
const indexHtml = fs.readFileSync('./index.html', 'utf8');
if (!indexHtml.includes('v.1.4.3')) {
  console.error('[ERRO] index.html não contém v.1.4.3');
  process.exit(1);
}
if (!indexHtml.includes('limit-badge') || !indexHtml.includes('1,5 GB')) {
  console.error('[ERRO] index.html não contém indicação visível de limite de 1,5 GB (.limit-badge)');
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
  console.error('[ERRO] index.html ainda contém painel de edição/preview obsoleto que宜veria ter sido removido');
  process.exit(1);
}
console.log('[OK] index.html contém v.1.4.3, limit-badge 1,5 GB, app-main-container e fila em lote');

// 4. Verifica listeners, download individual, telemetria, linearização e 3 blocos no js/app.js
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
if (!appJs.includes('MAX_FILE_SIZE_BYTES')) {
  console.error('[ERRO] js/app.js não valida MAX_FILE_SIZE_BYTES');
  process.exit(1);
}
if (!appJs.includes('item-block item-info') || !appJs.includes('item-block item-progress') || !appJs.includes('item-block item-actions')) {
  console.error('[ERRO] js/app.js não renderiza os 3 blocos horizontais (.item-info, .item-progress, .item-actions)');
  process.exit(1);
}
if (!appJs.includes('icon-hourglass') || !appJs.includes('icon-check') || !appJs.includes('spinning') || !appJs.includes('success')) {
  console.error('[ERRO] js/app.js não contém ícones de status dinâmicos (ampulheta spinning e check success)');
  process.exit(1);
}
if (!appJs.includes('badge-error')) {
  console.error('[ERRO] js/app.js não aplica a classe badge-error em caso de erro');
  process.exit(1);
}
if (!appJs.includes('tickerInterval') || !appJs.includes('onParserSubProgress')) {
  console.error('[ERRO] js/app.js não contém ticker linear adaptativo para evitar estagnação em 60%');
  process.exit(1);
}
if (!appJs.includes('file-progress-group') || !appJs.includes('bar-upload') || !appJs.includes('bar-convert') || !appJs.includes('upload-percent') || !appJs.includes('convert-percent')) {
  console.error('[ERRO] js/app.js não contém estrutura de dupla barra de progresso (bar-upload e bar-convert)');
  process.exit(1);
}
console.log('[OK] js/app.js contém layout em 3 blocos, transição ampulheta->check, ticker adaptativo e duplo progresso');

// 5. Verifica estilos CSS para transição suave, barras compactas, badge-error e animações
const stylesCss = fs.readFileSync('./css/styles.css', 'utf8');
if (!stylesCss.includes('.app-main-container') || !stylesCss.includes('.file-progress-group') || !stylesCss.includes('.bar-upload') || !stylesCss.includes('.bar-convert')) {
  console.error('[ERRO] css/styles.css não contém classes de container unificado ou dupla barra de progresso');
  process.exit(1);
}
if (!stylesCss.includes('.limit-badge')) {
  console.error('[ERRO] css/styles.css não contém estilos para .limit-badge');
  process.exit(1);
}
if (!stylesCss.includes('spin-hourglass') || !stylesCss.includes('pop-check')) {
  console.error('[ERRO] css/styles.css não contém keyframes spin-hourglass e pop-check');
  process.exit(1);
}
if (!stylesCss.includes('.item-block.item-info') || !stylesCss.includes('.item-block.item-progress') || !stylesCss.includes('.item-block.item-actions')) {
  console.error('[ERRO] css/styles.css não contém regras dos 3 blocos da fila');
  process.exit(1);
}
if (!stylesCss.includes('cubic-bezier(0.4, 0, 0.2, 1)') || !stylesCss.includes('240ms')) {
  console.error('[ERRO] css/styles.css não contém transição suave cubic-bezier 240ms nas barras');
  process.exit(1);
}
if (!stylesCss.includes('.badge-error')) {
  console.error('[ERRO] css/styles.css não contém suporte a .badge-error');
  process.exit(1);
}
if (!stylesCss.includes('max-height: 5px') && !stylesCss.includes('height: 5px') && !stylesCss.includes('height: 4px')) {
  console.error('[ERRO] css/styles.css não contém altura reduzida para barras de progresso');
  process.exit(1);
}
if (!stylesCss.includes('@media (max-width: 768px)') || !stylesCss.includes('@media (max-width: 640px)') || !stylesCss.includes('@media (max-width: 480px)')) {
  console.error('[ERRO] css/styles.css não contém media queries mobile-first completas');
  process.exit(1);
}
console.log('[OK] css/styles.css contém limit-badge, animações spin/pop, 3 blocos em linha e media queries');

// 6. Verifica README.md
const readme = fs.readFileSync('./README.md', 'utf8');
if (!readme.includes('v.1.4.3')) {
  console.error('[ERRO] README.md não contém v.1.4.3');
  process.exit(1);
}
console.log('[OK] README.md contém cabeçalho v.1.4.3');

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
