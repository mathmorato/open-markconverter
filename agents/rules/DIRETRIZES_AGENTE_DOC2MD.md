# Diretrizes e Regras do Agente - Plataforma Open Mark (doc2md)

Estas diretrizes constituem autorização prévia para realizar todas as modificações necessárias no projeto, desde que estejam alinhadas ao contexto de um conversor universal de documentos para Markdown (100% client-side/local e compatível com GitHub Pages) e respeitem integralmente este documento.

---

## 1. Regra geral de execução

### 1.1 Execução autônoma
- Executar diretamente as alterações necessárias sem solicitar autorização prévia.
- Não interromper o fluxo para confirmar criação, edição ou deleção de arquivos tecnicamente necessários.
- Escolher a solução mais performática e estável com base na arquitetura web moderna (priorizando execução no navegador via WebAssembly/Web Workers).
- Corrigir automaticamente erros de tipagem, bugs de renderização ou falhas de conversão encontrados durante testes.
- A tarefa só é considerada concluída após validação funcional completa (upload, parsing, conversão, pré-visualização e exportação/cópia).

### 1.2 Limite da autonomia
- **Privacidade absoluta:** É estritamente proibido adicionar chamadas a APIs externas ou servidores de backend que recebam arquivos do usuário. O processamento deve permanecer 100% local (Client-Side).
- Não descaracterizar a identidade visual técnica e limpa (paleta Branco, Azul Tech e suporte nativo a Dark Mode).
- Não inflar desnecessariamente o bundle final; preferir scripts assíncronos/dinâmicos para bibliotecas pesadas de parsing (ex: PDF.js, SheetJS, Mammoth).
- Priorizar a preservação estrutural do Markdown de saída (tabelas legíveis, cabeçalhos hierárquicos, links preservados).

---

## 2. Identidade visual e design system

### 2.1 Paleta de cores e estética
A interface deve transmitir clareza técnica, precisão, agilidade e confiabilidade de software moderno para desenvolvedores e produtores de conteúdo.

#### Modo Claro (Light Mode)
- **Base e Superfícies:**
  - Fundo principal: Branco puro (`#FFFFFF`) e Slate Ultra-Claro (`#F8FAFC`).
  - Cards e áreas de soltura (Dropzones): Branco com bordas sutis em Slate suave (`#E2E8F0`).
- **Azul Corporativo/Tech (Ações, Destaques e Links):**
  - Azul Primário: Tom moderno e focado (`#2563EB` ou `#1D4ED8`).
  - Azul Interativo (Hover/Focus): `#1E40AF`.
  - Azul Suave (Fundos de destaque, badges, hover de lista): `#EFF6FF` ou `#DBEAFE`.
- **Textos e Contraste:**
  - Títulos e texto principal: Azul Petróleo Ultra-Escuro / Slate Profundo (`#0F172A`).
  - Textos de apoio e metadados: Slate Neutro (`#64748B`).

#### Modo Escuro (Dark Mode - Deep Navy / Slate)
- **Base e Superfícies (Proibido preto puro chapado #000000):**
  - Fundo principal: Deep Navy / Slate Noturno (`#0B0F19` ou `#0F172A`).
  - Cards, Dropzones e painel de preview: Slate Escuro Acetinado (`#1E293B`).
  - Bordas e divisores: Slate Noturno suave (`#334155`).
- **Azul Noturno (Ações e Destaques):**
  - Azul Primário Neon/Vibrante: Tom luminoso de alto contraste (`#3B82F6` ou `#60A5FA`).
  - Azul Interativo (Hover): `#93C5FD`.
  - Azul Fundo Sutil (Badges/Tags): `#172554` com opacidade.
- **Textos e Contraste:**
  - Títulos e texto principal: Branco Gelo (`#F8FAFC`).
  - Textos secundários: Cinza Claro Neutro (`#94A3B8`).

#### Cores de Estado e Feedback (Acessíveis em ambos os modos)
- **Sucesso (Arquivo convertido/Copiado):** Esmeralda (`#10B981` claro / `#34D399` escuro).
- **Processando / Atenção:** Âmbar suave (`#F59E0B`).
- **Erro (Falha de parsing ou formato inválido):** Coral avermelhado / Carmim (`#EF4444` / `#F87171`).

### 2.2 Suporte a temas (Dark/Light Mode)
- **Detecção automática:** Respeitar por padrão a preferência do sistema via `prefers-color-scheme`.
- **Alternância manual:** Botão de alternância (Toggle) persistente no cabeçalho com persistência em `localStorage`.
- **Acessibilidade:** Cumprir rigorosamente os parâmetros de contraste mínimo WCAG AA em ambos os modos, principalmente nas áreas de visualização de código Markdown (syntax highlighting) e tabelas.

### 2.3 Tipografia, componentes e layout
- **Tipografia:**
  - Interface geral: Sans-serif moderna e geométrica otimizada para telas (`Inter`, `Plus Jakarta Sans` ou `system-ui`).
  - Pré-visualização de Markdown e Blocos de Código: Monospaçada técnica de alta legibilidade (`JetBrains Mono`, `Fira Code` ou `ui-monospace`).
- **Componentes Centrais:**
  - **Área de Drag & Drop:** Bordas pontilhadas ou tracejadas (`border-dashed`), expansão animada suave no hover, ícone de upload e lista clara de extensões aceitas (`.pdf`, `.docx`, `.xlsx`, `.pptx`, etc.).
  - **Painel Duplo (Split View):** Layout responsivo lado a lado (ou em abas no mobile) permitindo:
    1. Painel de Markdown bruto com syntax highlighting e botão de cópia com feedback instantâneo.
    2. Painel de pré-visualização HTML renderizada.
  - **Badges de Status:** Indicadores compactos mostrando o peso do arquivo, tempo de conversão e formato detectado.
- **Padrão de Ícones:**
  - Estritamente ícones de traço linear (`stroke-width="1.75"` ou `"2"`), `fill="none"` e terminações arredondadas (`stroke-linecap="round"`), como Lucide Icons ou Feather Icons. Proibido ícones chapados e pesados.

---

## 3. Arquitetura técnica e processamento

### 3.1 Motor de conversão client-side
- A plataforma deve rodar inteiramente no navegador via assets estáticos (HTML/CSS/JS), viabilizando deploy direto em **GitHub Pages** sem dependência de containers ou servidores intermediários.
- **Estratégia de módulos:**
  - Word (`.docx`): Conversão semântica preservando títulos, listas e ênfases.
  - Planilhas (`.xlsx`, `.csv`, `.ods`): Conversão matricial direta para tabelas Markdown no formato `| coluna | coluna |`.
  - Apresentações (`.pptx`): Estruturação por slides com cabeçalhos (`# Slide N`) e tópicos de texto.
  - Documentos (`.pdf`): Extração de fluxo de texto com tratamento de quebras de linha e seções.
- **Performance:** Arquivos pesados devem ser processados sem travar a thread principal da interface do usuário (utilizar Web Workers ou chunks assíncronos quando viável).

### 3.2 Persistência e privacidade
- Nenhuma informação de documento é persistida remotamente.
- Configurações do usuário (tema escuro/claro, preferência de quebra de linha no Markdown, visualização raw vs. preview) são mantidas exclusivamente no `localStorage`.

---

## 4. Sistema de versionamento

- **Formato estrito SemVer:** `v.X.Y.Z` (onde `X` = Major, `Y` = Minor, `Z` = Patch).
- Versão de partida do projeto estável: `v.1.0.0`.
- **Locais obrigatórios de atualização a cada release:**
  1. Rodapé visível da interface principal (`index.html`).
  2. Arquivo `package.json` (caso utilize ecossistema Node/Vite) ou constante central de versão (`js/config.js` / `js/app.js`).
  3. Cabeçalho de metadados do `README.md`.
- **Proibição expressa de destaques de versões no README:** É terminantemente proibido adicionar ou manter seções de "Destaques da Versão", changelogs ou listas de novidades por versão no `README.md`. O README deve permanecer limpo, atemporal e focado exclusivamente na documentação técnica, matriz de formatos, manifesto de privacidade e guia de uso. No `README.md`, apenas o badge e o cabeçalho de versão são atualizados.

---

## 5. Fluxo de execução e Git

- **Formato padrão de commit:** `v.X.Y.Z: descrição objetiva da alteração`
  - *Exemplo:* `v.1.1.0: adiciona suporte a conversao de apresentacoes pptx e atalho de copia rapida`
- **Sincronização:** Push automático para a branch de publicação (`main` / `gh-pages`).

---

## 6. Comunicação ao final da execução

Ao término de qualquer intervenção no código, o agente deve responder estritamente no seguinte padrão estruturado:

1. **Versão:** `v.X.Y.Z`
2. **Alterações realizadas:** Tópicos sucintos destacando o que foi implementado, otimizado ou corrigido.
3. **Arquivos principais alterados:** Lista de caminhos relativos dos arquivos tocados.
4. **Validação funcional:** Relatório objetivo dos testes efetuados (ex: parsing de `.docx`, teste de contraste no dark mode, responsividade do split view).
5. **Status do Git:** Mensagem do commit e confirmação do push.
