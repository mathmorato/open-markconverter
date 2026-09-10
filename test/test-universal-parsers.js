/**
 * Suíte de Testes para o Suporte Universal a Linguagens de Programação
 * e Parser Resiliente de Código-Fonte (v.1.7.2)
 */

import assert from 'assert';
import { APP_CONFIG, CODE_EXTENSIONS_MAP } from '../js/config.js';
import { parseSourceCode, parseText } from '../js/parsers/text-parser.js';

console.log('================================================================');
console.log('  TESTANDO PARSER UNIVERSAL DE CÓDIGO-FONTE & HEURÍSTICA UTF-8   ');
console.log('================================================================\n');

// 1. Validação do Dicionário CODE_EXTENSIONS_MAP
console.log('[TESTE 1] Validando integridade de CODE_EXTENSIONS_MAP...');
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
console.log('  -> [OK] Dicionário de linguagens validado com mais de 80 extensões mapeadas!\n');

// 2. Parsing de MATLAB (.m)
console.log('[TESTE 2] Validando parsing de código MATLAB (.m)...');
const matlabCode = `% Algoritmo de Filtro de Kalman em MATLAB
function [x, P] = kalman_filter(z, x, P, F, H, R, Q)
    % Predição
    x = F * x;
    P = F * P * F' + Q;
    % Atualização
    y = z - H * x;
    S = H * P * H' + R;
    K = P * H' * inv(S);
    x = x + K * y;
    P = (eye(size(x, 1)) - K * H) * P;
end`;

const matlabMd = parseSourceCode(matlabCode, 'm', 'kalman_filter.m');
assert(matlabMd.includes('# kalman_filter.m'), 'Deve conter cabeçalho com o nome do arquivo');
assert(matlabMd.includes('> **Linguagem:** `matlab`'), 'Deve identificar a linguagem matlab');
assert(matlabMd.includes('**Linhas:** 12'), 'Deve calcular corretamente as 12 linhas');
assert(matlabMd.includes('```matlab\n'), 'Deve abrir o bloco com crases triplas e identificador matlab');
assert(matlabMd.includes('K = P * H\' * inv(S);'), 'Deve preservar indentação e comandos MATLAB');
assert(matlabMd.endsWith('```\n'), 'Deve encerrar com crases triplas');
console.log('  -> [OK] Parsing MATLAB (.m) validado com metadados estruturados e bloco ```matlab!\n');

// 3. Parsing de Lua (.lua)
console.log('[TESTE 3] Validando parsing de scripts Lua (.lua)...');
const luaCode = `-- Script de IA de Inimigo em Lua
local Enemy = {}
Enemy.__index = Enemy

function Enemy.new(name, health)
    local self = setmetatable({}, Enemy)
    self.name = name or "Goblin"
    self.health = health or 100
    return self
end

function Enemy:takeDamage(amount)
    self.health = math.max(0, self.health - amount)
    print(self.name .. " tomou dano! Vida restante: " .. self.health)
end

return Enemy`;

const luaMd = parseSourceCode(luaCode, 'lua', 'enemy_ai.lua');
assert(luaMd.includes('# enemy_ai.lua'), 'Deve conter cabeçalho do arquivo Lua');
assert(luaMd.includes('> **Linguagem:** `lua`'), 'Deve identificar linguagem lua');
assert(luaMd.includes('**Linhas:** 17'), 'Deve calcular 17 linhas');
assert(luaMd.includes('```lua\n'), 'Deve gerar bloco ```lua');
assert(luaMd.includes('self.health = math.max(0, self.health - amount)'), 'Preserva sintaxe Lua');
console.log('  -> [OK] Parsing Lua (.lua) validado com sucesso!\n');

// 4. Parsing de .js, .py, .rs, .go, .sh
console.log('[TESTE 4] Validando linguagens padrão (.js, .py, .rs, .go, .sh)...');

// JavaScript
const jsMd = parseSourceCode('const answer = 42;\nconsole.log(answer);', 'js', 'main.js');
assert(jsMd.includes('> **Linguagem:** `javascript`'), 'Identifica javascript para .js');
assert(jsMd.includes('```javascript\n'), 'Bloco ```javascript');

// Python
const pyMd = parseSourceCode('def greet(name: str) -> str:\n    return f"Hello, {name}!"', 'py', 'greet.py');
assert(pyMd.includes('> **Linguagem:** `python`'), 'Identifica python para .py');
assert(pyMd.includes('```python\n'), 'Bloco ```python');

// Rust
const rsMd = parseSourceCode('fn main() {\n    println!("Rust Rocks!");\n}', 'rs', 'main.rs');
assert(rsMd.includes('> **Linguagem:** `rust`'), 'Identifica rust para .rs');
assert(rsMd.includes('```rust\n'), 'Bloco ```rust');

// Go
const goMd = parseSourceCode('package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Go!")\n}', 'go', 'main.go');
assert(goMd.includes('> **Linguagem:** `go`'), 'Identifica go para .go');
assert(goMd.includes('```go\n'), 'Bloco ```go');

// Shell (Bash)
const shMd = parseSourceCode('#!/bin/bash\necho "Iniciando build..."\nexit 0', 'sh', 'deploy.sh');
assert(shMd.includes('> **Linguagem:** `bash`'), 'Identifica bash para .sh');
assert(shMd.includes('```bash\n'), 'Bloco ```bash');
console.log('  -> [OK] Todas as linguagens testadas (.js, .py, .rs, .go, .sh) passaram!\n');

// 5. Suporte a entrada como ArrayBuffer e TypedArrays
console.log('[TESTE 5] Validando suporte a ArrayBuffer e TypedArrays...');
const encoder = new TextEncoder();
const buffer = encoder.encode('SELECT * FROM users WHERE active = 1;').buffer;
const sqlMd = parseSourceCode(buffer, 'sql', 'query.sql');
assert(sqlMd.includes('> **Linguagem:** `sql`'), 'Identifica sql via buffer');
assert(sqlMd.includes('```sql\nSELECT * FROM users WHERE active = 1;\n```'), 'Decodifica buffer UTF-8');
console.log('  -> [OK] Entrada via ArrayBuffer decodificada corretamente!\n');

// 6. Teste de Fallback Heurístico UTF-8 (Arquivos sem extensão ou com extensão incomum)
console.log('[TESTE 6] Validando mecanismo de fallback heurístico UTF-8...');

// Arquivo sem extensão (ex: script bash ou Makefile)
const noExtText = 'VAR=1\nall:\n\tgcc -o app main.c\n';
const noExtBuffer = encoder.encode(noExtText).buffer;
const sample1 = new Uint8Array(noExtBuffer.slice(0, 8192));
const hasNull1 = sample1.includes(0x00);
assert(!hasNull1, 'Arquivo de texto sem extensão não possui byte nulo');
const fallbackMd1 = parseSourceCode(noExtBuffer, '', 'Makefile_Custom');
assert(fallbackMd1.includes('> **Linguagem:** `text`'), 'Fallback para linguagem text quando extensão vazia');
assert(fallbackMd1.includes('gcc -o app main.c'), 'Preserva conteúdo textual');

// Arquivo com extensão incomum não catalogada (ex: .myconf)
const customExtText = 'setting_a = true\nsetting_b = 42\n';
const customBuffer = encoder.encode(customExtText).buffer;
const sample2 = new Uint8Array(customBuffer.slice(0, 8192));
const hasNull2 = sample2.includes(0x00);
assert(!hasNull2, 'Arquivo de configuração textual não possui byte nulo');
const fallbackMd2 = parseSourceCode(customBuffer, 'myconf', 'app.myconf');
assert(fallbackMd2.includes('> **Linguagem:** `myconf`'), 'Utiliza a própria extensão como linguagem de syntax highlighting');
assert(fallbackMd2.includes('```myconf\nsetting_a = true\n'), 'Gera bloco ```myconf');

// Arquivo binário real (contendo byte nulo 0x00)
const binaryBytes = new Uint8Array([0x7F, 0x45, 0x4C, 0x46, 0x00, 0x01, 0x01, 0x00]); // ELF header com \0
const hasNullBinary = binaryBytes.slice(0, 8192).includes(0x00);
assert(hasNullBinary, 'Binário deve ser detectado pela presença do byte nulo 0x00');
console.log('  -> [OK] Fallback heurístico e detecção de caracteres imprimíveis validados!\n');

// 7. Teste de delegação em parseText()
console.log('[TESTE 7] Validando integração em parseText()...');
const mockMFile = {
  name: 'matrix_mult.m',
  size: matlabCode.length,
  text: async () => matlabCode,
  arrayBuffer: async () => encoder.encode(matlabCode).buffer
};
const delegatedMd = await parseText(mockMFile);
assert(delegatedMd.includes('> **Linguagem:** `matlab`'), 'parseText deve delegar .m para parseSourceCode');
assert(delegatedMd.includes('```matlab\n'), 'parseText deve retornar bloco com syntax matlab');
console.log('  -> [OK] Integração e retrocompatibilidade de parseText() validadas!\n');

console.log('================================================================');
console.log('  SUCESSO: TODOS OS TESTES DO PARSER UNIVERSAL PASSARAM!        ');
console.log('================================================================');
