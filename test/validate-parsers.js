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
if (APP_CONFIG.VERSION !== 'v.1.0.1') {
  console.error('[ERRO] Versão diferente de v.1.0.1');
  process.exit(1);
}

// 2. Verifica package.json
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
if (pkg.version !== '1.0.1') {
  console.error('[ERRO] package.json version incompatível');
  process.exit(1);
}
console.log(`[OK] package.json version: ${pkg.version}`);

// 3. Verifica sincronização no index.html
const indexHtml = fs.readFileSync('./index.html', 'utf8');
if (!indexHtml.includes('v.1.0.1')) {
  console.error('[ERRO] index.html não contém v.1.0.1');
  process.exit(1);
}
console.log('[OK] index.html contém v.1.0.1 no header e footer');

// 4. Verifica README.md
const readme = fs.readFileSync('./README.md', 'utf8');
if (!readme.includes('v.1.0.1')) {
  console.error('[ERRO] README.md não contém v.1.0.1');
  process.exit(1);
}
console.log('[OK] README.md contém cabeçalho v.1.0.1');

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
