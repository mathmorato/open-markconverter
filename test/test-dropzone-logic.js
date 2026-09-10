/**
 * Teste unitário para a lógica de categorização, validação e rejeição de arquivos
 */

import { APP_CONFIG } from '../js/config.js';

console.log('--- Testando lógica de detecção e validações ---');

function getFormatCategory(fileName) {
  const ext = '.' + fileName.split('.').pop().toLowerCase();

  for (const [key, format] of Object.entries(APP_CONFIG.SUPPORTED_FORMATS)) {
    if (format.ext.includes(ext)) {
      return { key, ...format, ext };
    }
  }

  return {
    key: 'text',
    ext,
    name: `Arquivo (${ext})`,
    category: 'text',
    parser: 'text'
  };
}

// 1. Testa formatos aceitos
const testFiles = [
  { name: 'documento.docx', expectedParser: 'docx' },
  { name: 'planilha.xlsx', expectedParser: 'xlsx' },
  { name: 'dados.csv', expectedParser: 'xlsx' },
  { name: 'tabela.tsv', expectedParser: 'xlsx' },
  { name: 'apresentacao.pptx', expectedParser: 'pptx' },
  { name: 'manual.pdf', expectedParser: 'pdf' },
  { name: 'notas.txt', expectedParser: 'text' },
  { name: 'payload.json', expectedParser: 'text' },
  { name: 'pagina.html', expectedParser: 'text' },
  { name: 'readme.markdown', expectedParser: 'text' }
];

testFiles.forEach(({ name, expectedParser }) => {
  const res = getFormatCategory(name);
  if (res.parser !== expectedParser) {
    console.error(`[FALHA] ${name}: esperava parser ${expectedParser}, obteve ${res.parser}`);
    process.exit(1);
  }
  console.log(`[PASSOU] ${name} -> parser: ${res.parser} (${res.name})`);
});

// 2. Testa lista de binários não suportados
const unsupported = ['malware.exe', 'lib.dll', 'image.png', 'track.mp3', 'video.mp4', 'archive.zip'];
unsupported.forEach(name => {
  const ext = '.' + name.split('.').pop().toLowerCase();
  if (!APP_CONFIG.UNSUPPORTED_BINARY_EXTENSIONS.includes(ext)) {
    console.error(`[FALHA] Extensão ${ext} deveria estar na lista de rejeição rápida`);
    process.exit(1);
  }
  console.log(`[PASSOU] Rejeição identificada corretamente para: ${name}`);
});

console.log('--- Todos os testes de lógica de upload passaram com sucesso! ---');
