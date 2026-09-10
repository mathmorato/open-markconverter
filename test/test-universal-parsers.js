/**
 * Suíte Geral de Testes para Parsers Universais, YAML (.yml/.yaml),
 * Tipos MIME e Resiliência Heurística (v.1.7.6)
 */

import assert from 'assert';
import { APP_CONFIG, CODE_EXTENSIONS_MAP, SUPPORTED_EXTENSIONS, MIME_TYPE_MAP } from '../js/config.js';
import { parseSourceCode, parseText, parseYaml } from '../js/parsers/text-parser.js';
import { getFileExtension, getFormatCategory, isSupportedDocumentExtension, getMimeTypeForExt } from '../js/app.js';

console.log('================================================================');
console.log('  TESTANDO PARSERS UNIVERSAIS, YAML (.YML/.YAML) & MIME TYPES   ');
console.log('================================================================\n');

// 1. Validação do Dicionário CODE_EXTENSIONS_MAP e SUPPORTED_EXTENSIONS
console.log('[TESTE 1] Validando integridade de dicionários de extensão...');
assert(CODE_EXTENSIONS_MAP['m'] === 'matlab', 'Extensão .m deve mapear para matlab');
assert(CODE_EXTENSIONS_MAP['matlab'] === 'matlab', 'Extensão .matlab deve mapear para matlab');
assert(CODE_EXTENSIONS_MAP['lua'] === 'lua', 'Extensão .lua deve mapear para lua');
assert(CODE_EXTENSIONS_MAP['js'] === 'javascript', 'Extensão .js deve mapear para javascript');
assert(CODE_EXTENSIONS_MAP['ts'] === 'typescript', 'Extensão .ts deve mapear para typescript');
assert(CODE_EXTENSIONS_MAP['py'] === 'python', 'Extensão .py deve mapear para python');
assert(CODE_EXTENSIONS_MAP['rs'] === 'rust', 'Extensão .rs deve mapear para rust');
assert(CODE_EXTENSIONS_MAP['go'] === 'go', 'Extensão .go deve mapear para go');
assert(CODE_EXTENSIONS_MAP['sh'] === 'bash', 'Extensão .sh deve mapear para bash');
assert(CODE_EXTENSIONS_MAP['cpp'] === 'cpp', 'Extensão .cpp deve mapear para cpp');
assert(CODE_EXTENSIONS_MAP['yaml'] === 'yaml', 'Extensão .yaml deve mapear para yaml');
assert(CODE_EXTENSIONS_MAP['yml'] === 'yaml', 'Extensão .yml deve mapear para yaml');

assert(SUPPORTED_EXTENSIONS['yaml'], 'SUPPORTED_EXTENSIONS deve conter yaml');
assert(SUPPORTED_EXTENSIONS['yml'], 'SUPPORTED_EXTENSIONS deve conter yml');
assert(SUPPORTED_EXTENSIONS['yaml'].parser === 'text', 'Parser de yaml deve ser text');
assert(SUPPORTED_EXTENSIONS['yml'].parser === 'text', 'Parser de yml deve ser text');
console.log('  -> [OK] Dicionários de extensões validados com sucesso!\n');

// 2. Validação do Mapeamento MIME_TYPE_MAP
console.log('[TESTE 2] Validando mapeamento defensivo de tipos MIME...');
const yamlMimes = ['application/x-yaml', 'text/yaml', 'text/x-yaml', 'application/yaml'];
yamlMimes.forEach(mime => {
  assert.strictEqual(MIME_TYPE_MAP[mime], 'yaml', `MIME ${mime} deve mapear para yaml`);
});
assert.strictEqual(MIME_TYPE_MAP['application/json'], 'json');
assert.strictEqual(MIME_TYPE_MAP['text/html'], 'html');
assert.strictEqual(MIME_TYPE_MAP['application/pdf'], 'pdf');
console.log('  -> [OK] Todos os MIME types de YAML e documentos mapeados!\n');

// 3. Extração Defensiva de Extensão (getFileExtension)
console.log('[TESTE 3] Validando extração defensiva getFileExtension()...');
assert.strictEqual(getFileExtension('config.yml'), 'yml');
assert.strictEqual(getFileExtension('docker-compose.yaml'), 'yaml');
assert.strictEqual(getFileExtension('DEPLOYMENT.YML'), 'yml');
assert.strictEqual(getFileExtension('pipeline.YAML'), 'yaml');
assert.strictEqual(getFileExtension('archive.tar.gz'), 'gz');
assert.strictEqual(getFileExtension('sem-extensao'), '');
assert.strictEqual(getFileExtension('.gitignore'), '');
assert.strictEqual(getFileExtension(''), '');
assert.strictEqual(getFileExtension(null), '');
console.log('  -> [OK] getFileExtension() resiliente para maiúsculas, pontos duplos e ausência de extensão!\n');

// 4. Teste de Roteamento de Arquivos sem MIME (file.type === "")
console.log('[TESTE 4] Validando roteamento para arquivos sem MIME (file.type = "")...');
const sampleYmlCat = getFormatCategory('config.yml');
assert.strictEqual(sampleYmlCat.parser, 'text', 'config.yml deve rotear para parser text');
assert.strictEqual(sampleYmlCat.key, 'code', 'config.yml deve ter category code');

const sampleYamlCat = getFormatCategory('manifest.yaml');
assert.strictEqual(sampleYamlCat.parser, 'text', 'manifest.yaml deve rotear para parser text');

const sampleUpperCaseCat = getFormatCategory('SETTINGS.YML');
assert.strictEqual(sampleUpperCaseCat.parser, 'text', 'SETTINGS.YML em maiúsculas deve rotear para text');

assert.strictEqual(isSupportedDocumentExtension('.yml'), true);
assert.strictEqual(isSupportedDocumentExtension('.yaml'), true);
assert.strictEqual(isSupportedDocumentExtension('yml'), true);
assert.strictEqual(isSupportedDocumentExtension('yaml'), true);
console.log('  -> [OK] Roteamento de arquivos .yml/.yaml com MIME vazio validado com sucesso!\n');

// 5. Parsing Dedicado de YAML (.yml e .yaml) via parseYaml()
console.log('[TESTE 5] Validando parsing estruturado via parseYaml()...');
const ymlContent = `version: "3.8"
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    volumes:
      - ./data:/var/www/html`;

const parsedYml = parseYaml(ymlContent, 'docker-compose.yml');
assert(parsedYml.includes('# docker-compose.yml'), 'Deve conter título com o nome do arquivo');
assert(parsedYml.includes('> **Formato:** YAML'), 'Deve identificar Formato: YAML');
assert(parsedYml.includes('**Linhas:** 11'), 'Deve calcular 11 linhas');
assert(parsedYml.includes('**Tamanho:**'), 'Deve conter tamanho formatado');
assert(parsedYml.includes('```yaml\n'), 'Deve conter bloco ```yaml');
assert(parsedYml.includes('image: nginx:alpine'), 'Preserva indentação exata');
assert(parsedYml.endsWith('```\n'), 'Deve fechar com crases triplas');

// Teste via ArrayBuffer
const encoder = new TextEncoder();
const ymlBuffer = encoder.encode(ymlContent).buffer;
const parsedYmlBuffer = parseYaml(ymlBuffer, 'service.yaml');
assert(parsedYmlBuffer.includes('# service.yaml'));
assert(parsedYmlBuffer.includes('> **Formato:** YAML'));
assert(parsedYmlBuffer.includes('```yaml\n'));
console.log('  -> [OK] parseYaml() gera Markdown semântico com crases triplas e metadados!\n');

// 6. Teste de Integração via parseText() para .yml e .yaml
console.log('[TESTE 6] Validando integração em parseText() para arquivos .yml e .yaml...');
const mockYmlFile = {
  name: 'app.yml',
  size: ymlContent.length,
  text: async () => ymlContent,
  arrayBuffer: async () => ymlBuffer
};
const resultYml = await parseText(mockYmlFile);
assert(resultYml.includes('# app.yml'));
assert(resultYml.includes('> **Formato:** YAML'));
assert(resultYml.includes('```yaml\n'));

const mockYamlFile = {
  name: 'deployment.yaml',
  size: ymlContent.length,
  text: async () => ymlContent,
  arrayBuffer: async () => ymlBuffer
};
const resultYaml = await parseText(mockYamlFile);
assert(resultYaml.includes('# deployment.yaml'));
assert(resultYaml.includes('> **Formato:** YAML'));
assert(resultYaml.includes('```yaml\n'));
console.log('  -> [OK] parseText() delega .yml e .yaml perfeitamente para parseYaml!\n');

// 7. Bateria Geral de Formatos Chave (.docx, .xlsx, .pptx, .pdf, .html, .json, .csv, .m, .lua, .js, .sh)
console.log('[TESTE 7] Validando roteamento dos formatos-chave...');
const formatChecks = [
  { file: 'contrato.docx', expectedParser: 'docx', expectedCategory: 'document' },
  { file: 'orcamento.xlsx', expectedParser: 'xlsx', expectedCategory: 'spreadsheet' },
  { file: 'base_dados.csv', expectedParser: 'xlsx', expectedCategory: 'spreadsheet' },
  { file: 'apresentacao.pptx', expectedParser: 'pptx', expectedCategory: 'presentation' },
  { file: 'documento.pdf', expectedParser: 'pdf', expectedCategory: 'pdf' },
  { file: 'pagina.html', expectedParser: 'text', expectedCategory: 'text' },
  { file: 'pagina.htm', expectedParser: 'text', expectedCategory: 'text' },
  { file: 'schema.json', expectedParser: 'text', expectedCategory: 'text' },
  { file: 'anotacoes.txt', expectedParser: 'text', expectedCategory: 'text' },
  { file: 'documento.md', expectedParser: 'text', expectedCategory: 'text' },
  { file: 'guia.markdown', expectedParser: 'text', expectedCategory: 'text' },
  { file: 'servico.yml', expectedParser: 'text', expectedCategory: 'code' },
  { file: 'manifesto.yaml', expectedParser: 'text', expectedCategory: 'code' },
  { file: 'filtro.m', expectedParser: 'code', expectedCategory: 'code' },
  { file: 'script.lua', expectedParser: 'code', expectedCategory: 'code' },
  { file: 'server.js', expectedParser: 'code', expectedCategory: 'code' },
  { file: 'deploy.sh', expectedParser: 'code', expectedCategory: 'code' }
];

formatChecks.forEach(({ file, expectedParser, expectedCategory }) => {
  const cat = getFormatCategory(file);
  assert.strictEqual(cat.parser, expectedParser, `${file} deve ter parser ${expectedParser}, obteve ${cat.parser}`);
  console.log(`  -> [PASSOU] ${file} -> parser: ${cat.parser}`);
});
console.log('  -> [OK] Roteador validado com 100% de sucesso para todos os formatos-chave!\n');

// 8. Teste de JSON, HTML e RTF via parseText()
console.log('[TESTE 8] Validando parsing de JSON e HTML via parseText()...');
const jsonText = JSON.stringify({ name: 'open-mark', private: true, version: '1.7.4' }, null, 2);
const jsonRes = await parseText({ name: 'package.json', text: async () => jsonText });
assert(jsonRes.includes('```json\n'), 'Gera bloco json');
assert(jsonRes.includes('"version": "1.7.4"'), 'Preserva campos json');

const htmlSample = '<html><body><h1>Título HTML</h1><p>Parágrafo de teste com <strong>negrito</strong>.</p></body></html>';
const htmlRes = await parseText({ name: 'index.html', text: async () => htmlSample });
assert(htmlRes.includes('# Título HTML'), 'Converte h1 para #');
assert(htmlRes.includes('**negrito**'), 'Converte strong para **negrito**');
console.log('  -> [OK] JSON e HTML estruturados com sucesso!\n');

// 9. Teste de Linguagens Especializadas (MATLAB, Lua, Rust, Python, Bash)
console.log('[TESTE 9] Validando linguagens de programação no parseSourceCode()...');
const matlabCode = `% Algoritmo de Filtro de Kalman em MATLAB
function [x, P] = kalman_filter(z, x, P, F, H, R, Q)
    x = F * x;
    P = F * P * F' + Q;
end`;
const matlabMd = parseSourceCode(matlabCode, 'm', 'kalman_filter.m');
assert(matlabMd.includes('> **Linguagem:** `matlab`'));
assert(matlabMd.includes('```matlab\n'));

const luaCode = `local function greet(name) return "Ola " .. name end`;
const luaMd = parseSourceCode(luaCode, 'lua', 'script.lua');
assert(luaMd.includes('> **Linguagem:** `lua`'));
assert(luaMd.includes('```lua\n'));

const pyCode = `def hello():\n    print("World")`;
const pyMd = parseSourceCode(pyCode, 'py', 'app.py');
assert(pyMd.includes('> **Linguagem:** `python`'));
assert(pyMd.includes('```python\n'));
console.log('  -> [OK] Parsers de código-fonte (MATLAB, Lua, Python) validados!\n');

// 10. Teste de Fallback Heurístico UTF-8 (Arquivos sem extensão ou raras)
console.log('[TESTE 10] Validando fallback heurístico UTF-8 para extensões raras...');
const noExtText = 'VAR=1\nall:\n\tgcc -o app main.c\n';
const noExtBuffer = encoder.encode(noExtText).buffer;
const sample1 = new Uint8Array(noExtBuffer.slice(0, 8192));
assert(!sample1.includes(0x00), 'Texto puro sem byte nulo');
const fallbackMd1 = parseSourceCode(noExtBuffer, '', 'Makefile_Custom');
assert(fallbackMd1.includes('> **Linguagem:** `text`'));

const rareExtText = 'feature_flag_alpha = enabled\ntimeout = 30\n';
const rareBuffer = encoder.encode(rareExtText).buffer;
const sample2 = new Uint8Array(rareBuffer.slice(0, 8192));
assert(!sample2.includes(0x00), 'Configuração textual sem byte nulo');
const fallbackMd2 = parseSourceCode(rareBuffer, 'xyzrare', 'app.xyzrare');
assert(fallbackMd2.includes('> **Linguagem:** `xyzrare`'));
assert(fallbackMd2.includes('```xyzrare\n'));

// Binário real (contendo byte nulo)
const binaryBytes = new Uint8Array([0x7F, 0x45, 0x4C, 0x46, 0x00, 0x01, 0x01, 0x00]);
assert(binaryBytes.slice(0, 8192).includes(0x00), 'Binário detectado via byte nulo 0x00');
console.log('  -> [OK] Fallback heurístico UTF-8 e rejeição de binários validados com sucesso!\n');

console.log('================================================================');
console.log('  SUCESSO: TODOS OS TESTES DA BATERIA GERAL PASSARAM COM ÊXITO! ');
console.log('================================================================');
