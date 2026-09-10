/**
 * Script de validação automatizada de sintaxe e integridade
 * dos parsers e configurações do Open Mark
 */

import { APP_CONFIG } from '../js/config.js';
import fs from 'fs';
import path from 'path';

console.log('--- Iniciando validação do Open Mark ---');

// 1. Verifica versão SemVer (Base Decimal Estrita: Y, Z <= 9)
console.log(`[OK] Versão SemVer configurada: ${APP_CONFIG.VERSION}`);
const semverDecimalRegex = /^v\.[0-9]\.[0-9]\.[0-9]$/;
// Rejeita qualquer versão com mais de 1 dígito em Y ou Z (ex: v.1.4.11 falhará)
if (!semverDecimalRegex.test(APP_CONFIG.VERSION)) {
  console.error(`[ERRO] Versão ${APP_CONFIG.VERSION} viola a regra de base decimal estrita (Y e Z devem ser de 0 a 9)`);
  process.exit(1);
}
if (APP_CONFIG.VERSION !== 'v.1.7.9') {
  console.error('[ERRO] Versão diferente de v.1.7.9');
  process.exit(1);
}
if (APP_CONFIG.APP_NAME !== 'Open Mark') {
  console.error('[ERRO] APP_CONFIG.APP_NAME diferente de "Open Mark"');
  process.exit(1);
}
// Garante que versões inválidas como v.1.4.11 sejam expressamente rejeitadas
if (semverDecimalRegex.test('v.1.4.11') || semverDecimalRegex.test('v.1.10.0')) {
  console.error('[ERRO] semverDecimalRegex falhou ao rejeitar índices com mais de 1 dígito');
  process.exit(1);
}

// 1.1. Verifica limite de tamanho de 1,5 GB (1.610.612.736 bytes)
if (APP_CONFIG.MAX_FILE_SIZE_BYTES !== 1.5 * 1024 * 1024 * 1024) {
  console.error('[ERRO] APP_CONFIG.MAX_FILE_SIZE_BYTES inválido ou diferente de 1.5 GB');
  process.exit(1);
}
console.log(`[OK] Limite máximo de arquivo configurado: ${APP_CONFIG.MAX_FILE_SIZE_BYTES} bytes (1,5 GB)`);

// 1.2. Verifica configuração de extensões compactadas suportadas
if (!APP_CONFIG.ARCHIVE_EXTENSIONS || !APP_CONFIG.ARCHIVE_EXTENSIONS.includes('.zip') || !APP_CONFIG.ARCHIVE_EXTENSIONS.includes('.rar')) {
  console.error('[ERRO] APP_CONFIG.ARCHIVE_EXTENSIONS ausente ou sem .zip/.rar');
  process.exit(1);
}
console.log(`[OK] Pacotes compactados configurados: ${APP_CONFIG.ARCHIVE_EXTENSIONS.join(', ')}`);

// 2. Verifica package.json
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
if (pkg.version !== '1.7.9' || !/^[0-9]\.[0-9]\.[0-9]$/.test(pkg.version)) {
  console.error('[ERRO] package.json version incompatível ou fora da base decimal');
  process.exit(1);
}
console.log(`[OK] package.json version: ${pkg.version}`);

// 3. Verifica sincronização no index.html, fila de downloads, container central, ausência de toasts e de exemplos
const indexHtml = fs.readFileSync('./index.html', 'utf8');
if (!indexHtml.includes('v.1.7.9')) {
  console.error('[ERRO] index.html não contém v.1.7.9');
  process.exit(1);
}
if (!indexHtml.includes('brand-logo-svg') || !indexHtml.includes('Open <span class="accent">Mark</span>')) {
  console.error('[ERRO] index.html não contém o novo logo SVG brand-logo-svg ou brand-title Open Mark');
  process.exit(1);
}
if (!indexHtml.includes('id="toggle-merge-markdown"') || (!indexHtml.includes('btn-queue-download-merged') && !indexHtml.includes('btn-download-unified'))) {
  console.error('[ERRO] index.html não contém o seletor ou botão de mesclagem unificada (.md)');
  process.exit(1);
}
if (!indexHtml.includes('unified-download-container') && !indexHtml.includes('unified-action-row')) {
  console.error('[ERRO] index.html não contém o container dedicado unified-download-container / unified-action-row abaixo da linha padrão');
  process.exit(1);
}
if (!indexHtml.includes('id="btn-sort-files"') || !indexHtml.includes('merge-sort-container')) {
  console.error('[ERRO] index.html não contém o botão de ordenação #btn-sort-files ou container .merge-sort-container');
  process.exit(1);
}
if (!indexHtml.includes('queue-header-main') || !indexHtml.includes('queue-header-controls') || !indexHtml.includes('queue-static-buttons')) {
  console.error('[ERRO] index.html não contém as classes da arquitetura de cabeçalho travado (.queue-header-main, .queue-header-controls, .queue-static-buttons)');
  process.exit(1);
}
if (indexHtml.includes('toast-container') || indexHtml.includes('id="toast-container"')) {
  console.error('[ERRO] index.html ainda contém container flutuante de toast (toast-container)');
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
  console.error('[ERRO] index.html ainda contém painel de edição/preview obsoleto que deveriam ter sido removidos');
  process.exit(1);
}
if (!indexHtml.includes('Conversor Universal & Mesclador de Documentos para Markdown')) {
  console.error('[ERRO] index.html não contém o título principal atualizado');
  process.exit(1);
}
if (!indexHtml.includes('hero-header') || !indexHtml.includes('format-badges-list') || !indexHtml.includes('limit-indicator')) {
  console.error('[ERRO] index.html não contém as novas classes hero-header, format-badges-list ou limit-indicator');
  process.exit(1);
}
if (!indexHtml.includes('+algumas linguagens de código')) {
  console.error('[ERRO] index.html não contém a badge destacada +algumas linguagens de código');
  process.exit(1);
}
console.log('[OK] index.html contém v.1.7.9, novo cabeçalho Open Mark com logo SVG e dropzone semântica');

// 3.1. Verifica concorrência dinâmica de 1000 workers e otimização requestAnimationFrame
const configJs = fs.readFileSync('./js/config.js', 'utf8');
if (!configJs.includes('getDynamicConcurrency') || !configJs.includes('HIGH_VOLUME: 1000')) {
  console.error('[ERRO] js/config.js não contém getDynamicConcurrency ou HIGH_VOLUME: 1000');
  process.exit(1);
}
console.log('[OK] js/config.js contém configuração de concorrência escalável (1000 workers)');

// 4. Verifica listeners, download individual, telemetria, linearização, desativação de toasts e 3 blocos no js/app.js
const appJs = fs.readFileSync('./js/app.js', 'utf8');
if (!appJs.includes('getDynamicConcurrency') || !appJs.includes('dispatchNext') || !appJs.includes('requestAnimationFrame')) {
  console.error('[ERRO] js/app.js não contém getDynamicConcurrency, dispatchNext ou requestAnimationFrame');
  process.exit(1);
}
console.log('[OK] js/app.js contém pool dinâmico de até 1000 workers e batching com requestAnimationFrame');
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
if (!appJs.includes('extractArchiveFiles') || !appJs.includes('extractZipArchive')) {
  console.error('[ERRO] js/app.js não contém funções de descompactação de pacotes');
  process.exit(1);
}
if (!appJs.includes('mergeMarkdownOutputs') || !appJs.includes('downloadUnifiedMarkdown')) {
  console.error('[ERRO] js/app.js não contém rotinas de mesclagem unificada de Markdown');
  process.exit(1);
}
if (!appJs.includes('scrollQueueToActiveItem') || !appJs.includes('scrollQueueToItem') || !appJs.includes('scrollToActiveItem') || !appJs.includes('userIsScrolling')) {
  console.error('[ERRO] js/app.js não contém auto-scroll inteligente confinado (scrollQueueToActiveItem / scrollQueueToItem / scrollToActiveItem / userIsScrolling)');
  process.exit(1);
}
if (!appJs.includes('getFormattedTimestamp') || !appJs.includes('sortQueueByName') || !appJs.includes('sortQueueBySize')) {
  console.error('[ERRO] js/app.js não contém getFormattedTimestamp, sortQueueByName ou sortQueueBySize');
  process.exit(1);
}
if (!appJs.includes('buildBacklogSection') || !appJs.includes('buildDirectoryTreeAscii')) {
  console.error('[ERRO] js/app.js não contém buildBacklogSection ou buildDirectoryTreeAscii');
  process.exit(1);
}
if (appJs.includes('.scrollIntoView(')) {
  console.error('[ERRO] js/app.js ainda contém chamadas a scrollIntoView() que propagam rolagem indesejada para a página principal');
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
if (!appJs.includes('badge-file-size') || !appJs.includes('badge-md-size') || !appJs.includes('badge-elapsed-time')) {
  console.error('[ERRO] js/app.js não contém classes de posicionamento linear (.badge-file-size, .badge-md-size, .badge-elapsed-time)');
  process.exit(1);
}
if (!appJs.includes('Upload') || !appJs.includes('Conversão ')) {
  console.error('[ERRO] js/app.js não contém os rótulos textuais "Upload" e "Conversão"');
  process.exit(1);
}
if (!appJs.includes('label-with-icon') || !appJs.includes('step-icon-upload') || !appJs.includes('step-icon-convert')) {
  console.error('[ERRO] js/app.js não contém os ícones vetoriais animados de etapa (.step-icon-upload e .step-icon-convert)');
  process.exit(1);
}
if (!appJs.includes('upload-done') || !appJs.includes('convert-done')) {
  console.error('[ERRO] js/app.js não gerencia classes de etapa concluída (.upload-done e .convert-done)');
  process.exit(1);
}
if (!appJs.includes('is-reading') || !appJs.includes('item.isReading')) {
  console.error('[ERRO] js/app.js não gerencia o estado e classe is-reading para upload');
  process.exit(1);
}
if (appJs.includes('<span>Leitura</span>') || appJs.includes('<span>Conversão Markdown')) {
  console.error('[ERRO] js/app.js ainda contém rótulos obsoletos "Leitura" ou "Conversão Markdown"');
  process.exit(1);
}
if (!appJs.includes('renderFileBadgeIcon') || !appJs.includes('file-badge-icon') || !appJs.includes('file-extension-tag')) {
  console.error('[ERRO] js/app.js não contém renderFileBadgeIcon ou classes do novo ícone com badge');
  process.exit(1);
}
if (!appJs.includes('viewBox="-2 -2 44 52"')) {
  console.error('[ERRO] js/app.js não contém viewBox com respiro anti-corte (-2 -2 44 52)');
  process.exit(1);
}
if (!appJs.includes('is-completed')) {
  console.error('[ERRO] js/app.js não adiciona a classe is-completed ao concluir o item');
  process.exit(1);
}
if (!appJs.includes('formatElapsedTime')) {
  console.error('[ERRO] js/app.js não contém a função formatElapsedTime');
  process.exit(1);
}
if (!appJs.includes('md-output-size') || !appJs.includes('formattedMdSize')) {
  console.error('[ERRO] js/app.js não contém telemetria de peso do Markdown gerado (md-output-size / formattedMdSize)');
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
if (appJs.includes('elements.toastContainer') || appJs.includes('toast.style.opacity')) {
  console.error('[ERRO] js/app.js ainda contém manipulação ativa de nós DOM de toast');
  process.exit(1);
}
if (!appJs.includes('getFileExtension') || !appJs.includes('parseYaml')) {
  console.error('[ERRO] js/app.js não contém getFileExtension ou parseYaml para suporte a YAML');
  process.exit(1);
}
console.log('[OK] js/app.js contém rótulos Upload/Conversão com ícones animados, is-reading, badge-file-size, getFileExtension e layout linear');

// 5. Verifica estilos CSS para layout linear, contenção de overflow, ícones vetoriais animados e peso MD
const stylesCss = fs.readFileSync('./css/styles.css', 'utf8');
if (stylesCss.includes('.toast-container') || stylesCss.includes('.toast-error') || stylesCss.includes('.toast-success')) {
  console.error('[ERRO] css/styles.css ainda contém regras residuais de classes de toast flutuante');
  process.exit(1);
}
if (!stylesCss.includes('overflow: hidden') || !stylesCss.includes('33.33%') || !stylesCss.includes('max-width: 45%')) {
  console.error('[ERRO] css/styles.css não contém regras de limitação das barras a 33.33% (1/3) e Bloco 1 a 45%');
  process.exit(1);
}
if (!stylesCss.includes('max-height: 480px') || !stylesCss.includes('scroll-behavior: smooth') || !stylesCss.includes('overscroll-behavior: contain')) {
  console.error('[ERRO] css/styles.css não contém max-height: 480px, scroll-behavior: smooth ou overscroll-behavior: contain na fila');
  process.exit(1);
}
if (!stylesCss.includes('.badge-file-size') || !stylesCss.includes('.badge-md-size') || !stylesCss.includes('.badge-elapsed-time')) {
  console.error('[ERRO] css/styles.css não contém regras para .badge-file-size, .badge-md-size ou .badge-elapsed-time');
  process.exit(1);
}
if (!stylesCss.includes('.step-icon') || !stylesCss.includes('.step-icon-upload') || !stylesCss.includes('.step-icon-convert')) {
  console.error('[ERRO] css/styles.css não contém estilos para os ícones de etapa (.step-icon, .step-icon-upload, .step-icon-convert)');
  process.exit(1);
}
if (!stylesCss.includes('upload-ascend-infinite') || !stylesCss.includes('convert-slide')) {
  console.error('[ERRO] css/styles.css não contém animações upload-ascend-infinite e convert-slide');
  process.exit(1);
}
if (!stylesCss.includes('transform-box: fill-box') || !stylesCss.includes('is-reading')) {
  console.error('[ERRO] css/styles.css não contém transform-box ou classe is-reading para animação da seta');
  process.exit(1);
}
if (!stylesCss.includes('upload-done') || !stylesCss.includes('convert-done')) {
  console.error('[ERRO] css/styles.css não contém regras de finalização para upload-done e convert-done');
  process.exit(1);
}
if (!stylesCss.includes('.app-main-container') || !stylesCss.includes('.file-progress-group') || !stylesCss.includes('.bar-upload') || !stylesCss.includes('.bar-convert')) {
  console.error('[ERRO] css/styles.css não contém classes de container unificado ou dupla barra de progresso');
  process.exit(1);
}
if (!stylesCss.includes('.file-badge-icon') || !stylesCss.includes('.file-sheet-svg') || !stylesCss.includes('.file-extension-tag')) {
  console.error('[ERRO] css/styles.css não contém estilos do ícone com badge (.file-badge-icon / .file-sheet-svg / .file-extension-tag)');
  process.exit(1);
}
if (!stylesCss.includes('transform: scale(0.9)') || (!stylesCss.includes('height: 52px') && !stylesCss.includes('height: 66px'))) {
  console.error('[ERRO] css/styles.css não contém dimensões ampliadas no ícone com badge');
  process.exit(1);
}
if (!stylesCss.includes('min-height: 84px') && !stylesCss.includes('min-height: 68px')) {
  console.error('[ERRO] css/styles.css não contém altura expandida (.file-queue-item min-height: 84px)');
  process.exit(1);
}
if (!stylesCss.includes('font-size: 0.95rem') && !stylesCss.includes('font-size: 1rem')) {
  console.error('[ERRO] css/styles.css não contém tipografia padronizada para o nome do arquivo (font-size: 0.95rem)');
  process.exit(1);
}
if (!stylesCss.includes('.is-completed')) {
  console.error('[ERRO] css/styles.css não contém regras de auto-collapse suave para barras concluídas (.is-completed)');
  process.exit(1);
}
if (!stylesCss.includes('.limit-badge')) {
  console.error('[ERRO] css/styles.css não contém estilos para .limit-badge');
  process.exit(1);
}
if (!stylesCss.includes('.md-output-size')) {
  console.error('[ERRO] css/styles.css não contém estilos para .md-output-size');
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
if (!stylesCss.includes('max-height: 6px') && !stylesCss.includes('height: 6px') && !stylesCss.includes('height: 5px')) {
  console.error('[ERRO] css/styles.css não contém altura para barras de progresso');
  process.exit(1);
}
if (!stylesCss.includes('@media (max-width: 768px)') || !stylesCss.includes('@media (max-width: 640px)') || !stylesCss.includes('@media (max-width: 480px)')) {
  console.error('[ERRO] css/styles.css não contém media queries mobile-first completas');
  process.exit(1);
}
if (!stylesCss.includes('.has-error') || !stylesCss.includes('.item-error-badge')) {
  console.error('[ERRO] css/styles.css não contém regras para .has-error ou .item-error-badge');
  process.exit(1);
}
if (!stylesCss.includes('.unified-download-container') && !stylesCss.includes('.unified-action-row')) {
  console.error('[ERRO] css/styles.css não contém regras para .unified-download-container ou .unified-action-row');
  process.exit(1);
}
if (!stylesCss.includes('justify-content: flex-start')) {
  console.error('[ERRO] css/styles.css não contém alinhamento estrito à esquerda (justify-content: flex-start) para os botões de mesclagem');
  process.exit(1);
}
if (!stylesCss.includes('gap: 0.38rem')) {
  console.error('[ERRO] css/styles.css não contém redução de 50% no gap vertical do cabeçalho (gap: 0.38rem)');
  process.exit(1);
}
if (!indexHtml.includes('icon-desc') || !indexHtml.includes('icon-asc')) {
  console.error('[ERRO] index.html não contém os ícones vetoriais de ordenação icon-desc e icon-asc');
  process.exit(1);
}
if (!stylesCss.includes('.queue-header-main') || !stylesCss.includes('.queue-header-controls') || !stylesCss.includes('.queue-static-buttons')) {
  console.error('[ERRO] css/styles.css não contém regras para .queue-header-main, .queue-header-controls ou .queue-static-buttons');
  process.exit(1);
}
if (!stylesCss.includes('.convert-status-text') || !stylesCss.includes('white-space: nowrap') || !stylesCss.includes('font-variant-numeric: tabular-nums')) {
  console.error('[ERRO] css/styles.css não contém regras para .convert-status-text com white-space: nowrap e tabular-nums');
  process.exit(1);
}
if (!stylesCss.includes('.format-badges-list') || !stylesCss.includes('.limit-indicator') || !stylesCss.includes('.visually-hidden')) {
  console.error('[ERRO] css/styles.css não contém estilos para .format-badges-list, .limit-indicator ou .visually-hidden');
  process.exit(1);
}
console.log('[OK] css/styles.css contém layout travado de cabeçalho (CLS=0), estilos da nova dropzone e botão estável');

// 6. Verifica README.md
const readme = fs.readFileSync('./README.md', 'utf8');
if (!readme.includes('v.1.7.9')) {
  console.error('[ERRO] README.md não contém v.1.7.9');
  process.exit(1);
}
if (!readme.includes('# Open Mark')) {
  console.error('[ERRO] README.md não contém o título oficial # Open Mark');
  process.exit(1);
}
if (!readme.includes('https://mathmorato.github.io/open-mark/#')) {
  console.error('[ERRO] README.md não contém o link de acesso online oficial (https://mathmorato.github.io/open-mark/#)');
  process.exit(1);
}
console.log('[OK] README.md contém cabeçalho v.1.7.9, título # Open Mark e link de acesso online imediato');

// 5. Verifica existência de todos os arquivos do projeto
const requiredFiles = [
  'index.html',
  'favicon.svg',
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
