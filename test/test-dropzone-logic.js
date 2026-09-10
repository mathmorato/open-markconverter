/**
 * Teste unitário para a lógica de categorização, validação e rejeição de arquivos
 */

import { APP_CONFIG } from '../js/config.js';
import { getFormatCategory, getFileExtension, isSupportedDocumentExtension } from '../js/app.js';

console.log('--- Testando lógica de detecção e validações (v.1.7.4) ---');

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
  { name: 'readme.markdown', expectedParser: 'text' },
  { name: 'config.yml', expectedParser: 'text' },
  { name: 'docker-compose.yaml', expectedParser: 'text' },
  { name: 'APPLICATION.YML', expectedParser: 'text' },
  { name: 'ci.YAML', expectedParser: 'text' },
  { name: 'algoritmo.m', expectedParser: 'code' },
  { name: 'script.lua', expectedParser: 'code' },
  { name: 'app.js', expectedParser: 'code' },
  { name: 'process.py', expectedParser: 'code' },
  { name: 'engine.rs', expectedParser: 'code' },
  { name: 'deploy.sh', expectedParser: 'code' }
];

testFiles.forEach(({ name, expectedParser }) => {
  const res = getFormatCategory(name);
  if (res.parser !== expectedParser) {
    console.error(`[FALHA] ${name}: esperava parser ${expectedParser}, obteve ${res.parser}`);
    process.exit(1);
  }
  console.log(`[PASSOU] ${name} -> parser: ${res.parser} (${res.name})`);
});

// 2. Testa lista de binários não suportados (excluindo arquivos compactados suportados)
const unsupported = ['malware.exe', 'lib.dll', 'image.png', 'track.mp3', 'video.mp4', 'installer.msi', 'disk.iso'];
unsupported.forEach(name => {
  const ext = '.' + name.split('.').pop().toLowerCase();
  if (!APP_CONFIG.UNSUPPORTED_BINARY_EXTENSIONS.includes(ext)) {
    console.error(`[FALHA] Extensão ${ext} deveria estar na lista de rejeição rápida`);
    process.exit(1);
  }
  console.log(`[PASSOU] Rejeição identificada corretamente para: ${name}`);
});

// 3. Testa lista de pacotes compactados suportados para auto-extração
const archives = ['pacote.zip', 'documentos.rar', 'backup.7z', 'dados.tar', 'logs.gz'];
archives.forEach(name => {
  const ext = '.' + name.split('.').pop().toLowerCase();
  if (!APP_CONFIG.ARCHIVE_EXTENSIONS.includes(ext)) {
    console.error(`[FALHA] Extensão compactada ${ext} deveria estar em APP_CONFIG.ARCHIVE_EXTENSIONS`);
    process.exit(1);
  }
  console.log(`[PASSOU] Pacote compactado identificado corretamente: ${name} (${ext})`);
});

// 4. Testa suporte documental direto
const extensionsToCheck = ['.yml', '.yaml', 'yml', 'yaml', '.docx', '.json', '.m', '.lua'];
extensionsToCheck.forEach(ext => {
  if (!isSupportedDocumentExtension(ext)) {
    console.error(`[FALHA] isSupportedDocumentExtension falhou para ${ext}`);
    process.exit(1);
  }
  console.log(`[PASSOU] isSupportedDocumentExtension: ${ext} -> suportado`);
});

console.log('--- Todos os testes de lógica de upload passaram com sucesso! ---');
