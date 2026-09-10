# Universal MarkConverter (doc2md) `v.1.6.2`

[![Version](https://img.shields.io/badge/version-v.1.6.2-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Architecture: 100% Client--Side](https://img.shields.io/badge/Architecture-100%25%20Client--Side-informational.svg)](#-manifesto-de-segurança-e-privacidade-data-privacy-by-design)
[![Privacy: Zero Server Upload](https://img.shields.io/badge/Privacy-Zero%20Server%20Upload-green.svg)](#-manifesto-de-segurança-e-privacidade-data-privacy-by-design)
[![Deploy: GitHub Pages Ready](https://img.shields.io/badge/Deploy-GitHub%20Pages%20Ready-brightgreen.svg)](#-instruções-de-deploy-no-github-pages)

Uma plataforma web estática moderna, ultrarrápida e universal para processamento e conversão de múltiplos formatos de documento em **Markdown semântico e estruturado** (`.md`). Desenvolvida em Vanilla JavaScript modular (ES Modules), a ferramenta roda **100% no navegador do usuário**, eliminando qualquer dependência de servidores, containers ou transmissão de dados para a nuvem.

### 🌐 Acesso Online Imediato
Além da instalação e execução local, você pode utilizar a versão em produção diretamente pelo navegador (100% client-side, sem necessidade de instalar nada):
👉 **[Acessar Universal MarkConverter](https://mathmorato.github.io/open-markconverter/#)**

---

## 🚀 Destaques da Versão v.1.6.2

- **Auto-Scroll Inteligente em Filas de Grande Porte (.file-queue-list):**
  - Acompanhamento automático e suave (`scrollIntoView({ behavior: 'smooth', block: 'nearest' })`) focalizando o item que entra em conversão ativa e o item recém-concluído.
  - Altura máxima do container de scroll expandida para **`480px`** com rolagem macia (`scroll-behavior: smooth`) e respiro de scrollbar (`padding-right: 0.5rem`).
- **Preservação do Controle e Navegação Manual do Usuário:**
  - Sensores passivos de eventos (`wheel`, `touchstart`, `scroll`) identificam quando o usuário sobe a lista manualmente (> 120px do rodapé) e desativam temporariamente a rolagem automática para não interromper a inspeção de itens anteriores.
  - Retomada automática e instantânea do auto-scroll assim que o usuário rolar de volta para a base da fila.
- **Governança SemVer em Base Decimal Estrita:**
  - Versão **`v.1.6.2`** rigorosamente sincronizada nos 4 pontos obrigatórios do sistema (`index.html`, `package.json`, `js/config.js` e `README.md`).

---

## 🚀 Destaques da Versão v.1.6.1

- **Restrição das Barras de Progresso a 1/3 (~33.33%) da Largura do Card:**
  - Limitação estrita do container central de progresso (`.queue-item-progress` / `.file-progress-group`) para no máximo **`33.33%`** da largura total do card com `min-width: 180px`, impedindo que as barras se estiquem desproporcionalmente pela interface.
  - Centralização refinada (`margin: 0 auto`) do miolo de progresso na faixa mediana do card.
- **Harmonização e Distribuição Proporcional dos 3 Blocos da Fila:**
  - **Bloco 1 (Esquerda - Identificação):** ampliado para `max-width: 45%` (`flex: 1 1 auto`), permitindo que títulos longos de arquivos tenham ampla legibilidade antes do truncamento por reticências (`text-overflow: ellipsis`).
  - **Bloco 3 (Direita - Status e Ações):** espaçamento calibrado (`gap: 0.75rem`) com alinhamento à direita (`margin-left: auto`), mantendo tempo, peso do Markdown e botões integrados e sem vazamentos.
- **Governança SemVer em Base Decimal Estrita:**
  - Versão **`v.1.6.1`** rigorosamente sincronizada nos 4 pontos obrigatórios do sistema (`index.html`, `package.json`, `js/config.js` e `README.md`).

---

## 🚀 Destaques da Versão v.1.6.0

- **Descompactação Automática Client-Side de Pacotes Compactados (.zip, .rar, .7z, etc.):**
  - Descompactação 100% em memória no navegador via `JSZip` e streams, com extração recursiva automática de documentos compatíveis (`.docx`, `.xlsx`, `.pdf`, `.pptx`, `.txt`, `.csv`, etc.) diretamente para a fila de conversão.
  - Filtro inteligente que descarta diretórios vazios e artefatos de sistema operacional como pastas `__MACOSX`, `.DS_Store` e arquivos ocultos/temporários.
  - Isolamento resiliente de falhas para arquivos corrompidos ou protegidos por senha com exibição de erro individualizado no card, sem interromper o processamento dos demais itens.
  - Limite estrito de 1,5 GB por arquivo compactado mantido integralmente.
- **Opção Selecionável de Mesclagem Unificada ("Mesclar em Arquivo Único"):**
  - Adição de seletor visual toggle no cabeçalho da fila: *"Mesclar arquivos em um único .md"*, com persistência de preferência via `localStorage`.
  - Botão de ação coletiva contextual *"Baixar Markdown Unificado (.md)"* ao lado do download em lote `.zip`.
  - Concatenação estruturada com delimitadores visíveis e padronizados contendo metadados (nome original, extensão, tamanho formatado e separador `---`), com proteção contra blocos de código abertos ou quebras de tabelas.
- **Governança SemVer em Base Decimal Estrita:**
  - Sincronização global da versão **`v.1.6.0`** nos 4 pontos do sistema (`index.html`, `package.json`, `js/config.js` e `README.md`).

---

## 🚀 Destaques da Versão v.1.5.2

- **Padronização e Redução Harmoniosa da Tipografia:**
  - Redefinição do nome do arquivo (`.file-name`) para uma escala harmoniosa e legível de **`0.95rem` (~15.2px)** com `font-weight: 600`, eliminando o tamanho excessivo anterior e restabelecendo elegância estética.
  - Badges de metadados (`.badge-file-size`, `.badge-elapsed-time`) padronizadas em **`0.8rem–0.85rem`** (~12.8px–13.6px) com `font-weight: 500`, preenchimento compacto (`padding: 0.2rem 0.5rem`) e cantos arredondados suaves (`border-radius: 6px`).
  - Telemetria de tamanho do Markdown (`.badge-md-size`) padronizada em **`0.85rem`** em Verde Esmeralda (`#10B981`) de alta legibilidade.
  - Rótulos e percentuais das etapas (`.mini-progress-label`, `.read-percent`, `.convert-percent`) consolidados em **`0.82rem`**.
- **Preservação Integral dos Ícones Ampliados:**
  - Ícone vetorial de arquivo com badge (`.file-badge-icon`) mantido em área de destaque visual (~52px de altura) com etiqueta de extensão perfeitamente centralizada e nítida.
  - Glifos de ação, status e etapas conservados em dimensões generosas (**22px a 26px**), criando contraste refinado entre a solidez dos ícones e a sutileza da tipografia padrão.
  - Alinhamento vertical milimétrico em linha única (`align-items: center`) e respiro equilibrado nos cards da fila (`min-height: 68px; padding: 0.85rem 1.25rem`).

---

## 🚀 Destaques da Versão v.1.5.1

- **Governança SemVer em Base Decimal Estrita (`v.X.Y.Z` com Y, Z ≤ 9):**
  - Estabelecimento de regra estrita onde os índices de Minor (**Y**) e Patch (**Z**) são restritos a exatamente um único dígito decimal (`0` a `9`), sendo terminantemente proibido qualquer valor superior a 9 (como dois dígitos).
  - Tratamento determinístico de overflow: ao atingir `9`, qualquer incremento em Patch (**Z**) provoca virada automática do Minor (**Y**) e reinício de Z em `0` (ex.: após `v.1.4.9` ocorre virada para `v.1.5.0` -> `v.1.5.1`). Da mesma forma, overflow em Minor provoca virada do Major (**X**).
  - Correção e sincronização global de versão para **`v.1.5.1`** em todos os 4 pontos obrigatórios do sistema com validação automatizada regex (`/^v\.[0-9]\.[0-9]\.[0-9]$/`).
- **Expansão de 50% na Altura e Área Física dos Cards da Fila (`.file-queue-item`):**
  - Elevação da altura mínima (`min-height`) de ~52px para **`78px`** (+50%) e expansão do padding interno para **`1rem 1.4rem`**, proporcionando maior respiro visual, ergonomia tátil e conforto de clique.
- **Aumento de 50% na Escala de Todos os Ícones:**
  - **Ícone de Arquivo com Badge (`.file-badge-icon`):** ampliado de `36px × 44px` para **`54px × 66px`**, com a etiqueta de extensão (`.file-extension-tag`) redimensionada proporcionalmente para **`0.78rem`** (~12-13px).
  - **Ícones de Etapas (`.step-icon-upload`, `.step-icon-convert`):** ampliados para **`24px × 24px`** e **`26px × 22px`**, com keyframe ascendente ajustado para amplitude maior (`translateY(-12px)`).
  - **Indicadores de Status (`.status-icon`, `.status-indicator`):** ampulheta giratória e check verde ampliados para **`28px × 28px`** (container com área mínima de `36px × 36px`).
  - **Botões de Ação (`.btn-download`, `.btn-remove`):** ampliados para acomodar SVGs de **`24px`** e área de toque confortável de **`40px × 40px`** (`padding: 0.5rem`).
- **Aumento de 50% na Tipografia e Espessura de Trilhos:**
  - **Nome do Arquivo (`.file-name`):** ampliado para **`1.3rem` (~21px)** em peso semi-negrito (`font-weight: 600`), mantendo contenção horizontal contínua.
  - **Badges de Metadados (`.badge-file-size`, `.badge-elapsed-time`, `.badge-md-size`):** ampliados para **`1.1rem–1.15rem`** com bordas e preenchimento proporcionais.
  - **Rótulos e Percentuais de Progresso (`.mini-progress-label`, `.read-percent`, `.convert-percent`):** legibilidade elevada com tamanho de **`1.1rem–1.15rem`**.
  - **Trilhos de Progresso (`.mini-progress-track`):** espessura ampliada de `4px` para **`6px`** para equilíbrio estético com a nova escala tipográfica.

---

## 🚀 Destaques da Versão v.1.4.11

- **Animação Ascendente Infinita da Seta de Upload (`upload-ascend-infinite`):**
  - Implementação de loop contínuo e infinito de subida vertical da seta (`@keyframes upload-ascend-infinite`), subindo a partir da base (`translateY(4px)`), atingindo opacidade máxima e desaparecendo no topo (`translateY(-8px); opacity: 0`) em ciclo perpétuo enquanto o buffer estiver sendo lido.
  - Correção de renderização SVG via `transform-box: fill-box; transform-origin: center;` e contenção perfeitamente alinhada no ícone (`.step-icon-upload { width: 16px; height: 16px; overflow: hidden; position: relative; }`), mantendo o berço/bandeja estável e a seta sem invadir elementos adjacentes.
  - Sincronização reativa no pipeline via classe `.is-reading` e cessação suave da animação com transição cromática ao atingir `.upload-done`.
- **Redução Dimensional de 10% e Respiro Anti-Corte no Ícone de Arquivo:**
  - Aplicação de escala reduzida em 10% (`transform: scale(0.9)`) e expansão do viewBox do SVG para `-2 -2 44 52` com container seguro (`width: 36px; height: 44px; padding: 2px; box-sizing: border-box; overflow: visible`), eliminando qualquer ceifamento nas extremidades da folha dobrada e na etiqueta da extensão.
  - Ajuste na tipografia da etiqueta `.file-extension-tag` (`font-size: 0.52rem; border-width: 1.75px`) com proporções perfeitas tanto no tema claro quanto no escuro.
- **Resolução Definitiva de Escopo de `mdSizeText`:**
  - Inicialização e obtenção defensiva do tamanho do Markdown gerado (`mdSizeText`) em `js/app.js` prevenindo o crash de tempo de execução `ReferenceError: mdSizeText is not defined` durante a renderização inicial da fila (`queued`/`processing`).
- **Ícones Vetoriais Animados nas Etapas de Upload e Conversão:**
  - **Ícone Animado de Upload:** Posicionado ao lado do rótulo **"Upload"**, inspirado em uma seta ascendente com berço/bandeja (`.step-icon-upload`). Executa microanimação suave de flutuação vertical (`@keyframes upload-bounce` com `translateY(-3px)`) enquanto o buffer estiver sendo lido.
  - **Ícone Animado de Conversão:** Posicionado ao lado do rótulo **"Conversão"**, inspirado na estrutura de duas folhas de documentos unidas por uma seta de transição horizontal apontando da esquerda para a direita (`.step-icon-convert`). Executa microanimação direcional contínua (`@keyframes convert-slide` com `translateX(2px)`) durante o parsing do documento.
  - **Traço Linear Consistente & Zero Repaints:** Renderização SVG vetorial pura (`stroke-width: 2`, `stroke-linecap: round`, `stroke-linejoin: round`), proporções equilibradas (14px a 16px), aceleração por GPU via `transform` e transição automática para a cor de sucesso verde esmeralda (`#10B981`) ou colapso suave após a conclusão.
- **Contenção Total de Overflow e Encaixe de Layout na Fila:**
  - Ajuste de flexbox e contenção de largura (`min-width: 0; overflow: hidden;` no card e no Bloco 1 com `flex: 0 1 35%`, `flex: 1 1 auto;` no Bloco 2 e `flex: 0 0 auto;` no Bloco 3), impedindo que as barras de progresso estourem a borda direita ou desalinhem os botões de ação e status.
- **Atualização dos Rótulos Textuais das Etapas:**
  - Substituição da nomenclatura anterior "Leitura" por **"Upload"** e de "Conversão Markdown" por **"Conversão"**, proporcionando rótulos mais diretos, modernos e compactos.
- **Alinhamento Linear Contínuo & Posicionamento Preciso de Métricas:**
  - O peso original do documento (ex.: `80.5 MB`, `19.5 MB`) é posicionado imediatamente ao lado do nome do arquivo, logo após a extensão, em uma linha contínua e sem quebras secas indesejadas.
  - O tamanho do Markdown convertido (`(MD: 2.2 MB)`, `(MD: 616.9 KB)`) em verde esmeralda é posicionado estritamente à esquerda do certinho verde de conclusão no Bloco 3.
  - Cards da fila padronizados com altura estável (`min-height: 52px; align-items: center`), colapso completo das barras de progresso após a conclusão e transição fluida sem saltos de layout.
- **Eliminação Total de Toasts e Popups Flutuantes:**
  - Erradicação definitiva de balões de notificação e toasts temporários nos cantos da interface. Todo o ciclo de feedback de status (sucesso, leitura, limites excedentes ou eventuais erros de parsing) é mantido estritamente contextualizado nos próprios cards de documento da fila e na dropzone, eliminando poluição visual e riscos de bloqueio de cliques.
- **Ícone Vetorial de Arquivo com Badge Dinâmico da Extensão (`.XXX`):**
  - Folha de documento com orelha dobrada no canto superior e etiqueta retangular estilizada em alto contraste contendo a extensão do arquivo em caixa alta (ex.: `.PDF`, `.DOCX`, `.XLSX`, `.PPTX`, `.TXT`, `.JSON`).
- **Exibição do Nome Completo do Arquivo:**
  - Remoção de truncamento precoce por reticências no Bloco 1, viabilizando a leitura integral e quebra tipográfica harmoniosa de títulos e identificadores longos.
- **Desaparecimento Suave das Barras ao Concluir (Progress Auto-Collapse):**
  - Transição de saída animada (`fade-out` / `collapse`) das barras ao concluir com êxito (100%), deixando o card visualmente limpo e compacto com as métricas consolidadas (tamanho original, tempo formatado e tamanho MD gerado).
- **Formatação Inteligente de Tempo de Execução (`h min s`):**
  - Substituição da amostragem em milissegundos por representação humana condicional (`formatElapsedTime`): horas, minutos e segundos (`1h 12min 4s`, `2min 15s`, `7.3s` ou `850ms`), omitindo zeros redundantes à esquerda.
- **Telemetria de Peso do Markdown Gerado (`(MD: X KB)`):**
  - Cálculo instantâneo via Blob local do tamanho em bytes do Markdown convertido, exibindo a métrica `.md-output-size` para comparação direta com o arquivo de entrada.
- **Card de Fila Contínuo em 3 Blocos (Single-Line 3-Column Item):**
  - **Bloco 1 (Identificação):** Ícone vetorial com etiqueta de extensão + Nome completo + Badge consolidada de tamanho e tempo.
  - **Bloco 2 (Progresso Unificado):** Dupla barra compacta (ativa durante processamento, auto-colapsada ao concluir).
  - **Bloco 3 (Status e Ações):** Microinteração animada com ampulheta giratória e transição para check verde + Botão de download individual (.md) + Botão de remoção.
- **Microinteração com Ampulheta Giratória e Transição para Check Verde:**
  - Durante o processamento/conversão de Markdown, uma ampulheta linear gira suavemente (`@keyframes spin-hourglass`).
  - Ao concluir (100%), a ampulheta dá lugar com animação elástica e suave (`pop-check`) a um certinho circular em Verde Esmeralda (`#10B981`).
- **Indicação Visível do Limite de 1,5 GB:**
  - Badge explícito no container da Dropzone informando aos usuários o teto máximo de 1,5 GB por arquivo com ícone linear informativo.
- **Suavização e Throttling na Leitura (Upload Smoothing):**
  - Transição fluida via CSS (`transition: width 240ms cubic-bezier(0.4, 0, 0.2, 1)`) e interpolação gradual via `requestAnimationFrame`.
- **Linearização Adaptativa do Pipeline de Conversão:**
  - Eliminação definitiva da estagnação no valor de 60%, ticker linear adaptativo e sub-progresso granular por blocos.
- **Fila de Processamento em Lote (Batch Queue Pipeline):**
  - Adição de múltiplos documentos simultâneos via botão nativo de seleção, arrastar e soltar (*Drag & Drop*) ou colagem direta via atalho de teclado (`Ctrl+V`).
  - Concorrência assíncrona controlada (processamento de 2 itens em paralelo) para garantir fluidez da interface e gerenciamento estável da memória RAM do navegador.
- **Dupla Barra de Progresso por Arquivo:**
  - **Etapa 1 (Leitura do Arquivo):** Cálculo visual em tempo real baseado nos bytes lidos pelo evento nativo `FileReader.onprogress` (Azul Tech `#3B82F6`).
  - **Etapa 2 (Conversão Markdown):** Indicador de status dos parsers semânticos (20% carregamento do parser, 60% extração de dados e 100% conclusão com transição para verde Esmeralda `#10B981` ou Coral `#EF4444` em caso de erro).
- **Exportação Flexível e Download em Massa:**
  - **Download Individual Imediato:** Cada card de documento possui ação direta para baixar seu respectivo arquivo `.md`.
  - **Download em Lote (.zip):** Compactação coletiva instantânea de todos os arquivos convertidos gerando um arquivo `.zip` via biblioteca JSZip em memória local.
  - **Descarte e Cancelamento:** Remoção individual de qualquer arquivo da fila com liberação imediata dos buffers de memória alocados.
- **Harmonização Visual e Design Mobile-First:**
  - Grid central unificado (`.app-main-container`) com largura balanceada entre container de upload e cards de fila.
  - Interface adaptativa para smartphones e tablets (320px a 768px), com botões acessíveis ao polegar, quebra inteligente de nomes longos e prevenção de scroll horizontal.
  - Suporte nativo e persistente a **Modo Escuro (Dark Mode)** e **Modo Claro (Light Mode)** com contraste em conformidade com WCAG AA.

---

## 📊 Matriz Universal de Formatos Suportados (+30 Extensões)

O motor de conversão combina parsers documentais especializados com fallback heurístico para decodificação textual em UTF-8:

| Categoria | Extensões Suportadas | Motor Técnico de Conversão | Estrutura de Saída Markdown |
| :--- | :--- | :--- | :--- |
| **Documentos de Texto** | `.docx`, `.odt`, `.rtf` | Mammoth.js + Turndown Service + DOMParser | Títulos (`#` a `######`), parágrafos, listas ordenadas/não-ordenadas, ênfases (`*itálico*`, `**negrito**`), tabelas e hiperlinks. |
| **Planilhas & Matrizes** | `.xlsx`, `.xls`, `.csv`, `.tsv`, `.ods` | SheetJS (xlsx.full.min.js) | Matrizes tabulares com cabeçalhos estruturados e alinhamento padronizado (`\| coluna \|`). Múltiplas abas são convertidas em seções Markdown dedicadas. |
| **Apresentações** | `.pptx`, `.odp` | JSZip + DOMParser XML | Extração hierárquica slide a slide (`# Slide N`), tópicos em listas e anotações do apresentador. |
| **Documentos Fechados & E-books** | `.pdf`, `.epub` | PDF.js (Mozilla) | Fluxo contínuo de texto, preservação de quebras de parágrafo, paginação semântica e blocos destacados. |
| **Marcação & Dados** | `.html`, `.htm`, `.xml`, `.json`, `.yaml`, `.yml`, `.svg` | Turndown + Prettifier Nativo | Elementos semânticos convertidos para sintaxe Markdown; dados estruturados organizados em blocos de código com identificação de linguagem (ex: ````json ... ````). |
| **Código-Fonte & Scripts** | `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.cs`, `.go`, `.rs`, `.php`, `.rb`, `.sql`, `.sh`, `.bash`, etc. | TextDecoder UTF-8 | Blocos de código cercados (fenced code blocks) com indicação automática de sintaxe para visualizadores e LLMs. |
| **Texto Puro & Configurações** | `.txt`, `.md`, `.markdown`, `.log`, `.ini`, `.env`, `.toml` | Leitor Nativo de Streams UTF-8 | Higienização de quebras de linha (CRLF -> LF) e formatação de texto preservada. |
| **Fallback Universal** | Qualquer arquivo de texto válido | Heurística de decodificação UTF-8 | Detecção dinâmica e conversão direta para bloco Markdown higienizado. |

---

## 🔒 Manifesto de Segurança e Privacidade (Data Privacy by Design)

O **Universal MarkConverter** foi arquitetado sob a premissa fundamental de soberania de dados do usuário:

1. **Execução 100% Client-Side:** Toda a lógica de leitura binária, parsing de XML/ZIP e compilação de Markdown executa no sandbox do motor JavaScript do navegador do usuário (`V8`, `SpiderMonkey`, `JavaScriptCore`).
2. **Zero Tráfego de Rede para Documentos:** Nenhum documento, fragmento de texto, nome de arquivo ou metadado trafega por redes externas ou servidores centrais. A aplicação funciona plenamente até mesmo em modo offline (*Air-Gapped*).
3. **Telemetria Zero:** Sem ferramentas invasivas de analytics, cookies de rastreamento ou chamadas ocultas a APIs de terceiros. Apenas bibliotecas de parsing abertas são carregadas via CDNs consolidadas e imutáveis.
4. **Ciclo de Vida de Memória Efêmero:** Os buffers binários (`ArrayBuffer`) e strings geradas residem estritamente na memória da sessão da aba aberta. Ao remover um item da fila ou recarregar a página, todos os recursos são descartados pelo *Garbage Collector*.
5. **Conformidade Corporativa:** Ideal para ambientes regulados que lidam com propriedade intelectual confidencial, dados pessoais (LGPD/GDPR) e diretrizes rígidas de segurança corporativa.

---

## 📁 Estrutura do Repositório (Árvore Limpa)

```
open-markconverter/
├── index.html                   # Interface SPA semântica, Dropzone e Fila de Lote
├── package.json                 # Metadados do projeto e versão SemVer v.1.4.2
├── package-lock.json            # Travamento determinístico de dependências locais
├── LICENSE                      # Termos de licença open-source MIT
├── README.md                    # Documentação técnica integral da plataforma
├── .gitignore                   # Regras de exclusão de arquivos e diretórios
├── css/
│   └── styles.css               # Design system, temas Claro/Escuro e media queries mobile
├── js/
│   ├── config.js                # Configuração central, constantes e CDN loaders
│   ├── app.js                   # Controlador da aplicação, ciclo de vida da fila e Web APIs
│   ├── parsers/                 # Módulos de conversão especializados
│   │   ├── docx-parser.js       # Motor Mammoth + Turndown para DOCX/ODT
│   │   ├── xlsx-parser.js       # Motor SheetJS para planilhas e tabelas matriciais
│   │   ├── pptx-parser.js       # Motor JSZip para apresentações e anotações de slides
│   │   ├── pdf-parser.js        # Motor PDF.js para documentos e fluxo textual
│   │   └── text-parser.js       # Motor para texto puro, código-fonte e formatos de dados
│   └── workers/
│       └── converter-worker.js  # Web Worker para processamento assíncrono em background
└── test/                        # Suíte completa de testes automatizados
    ├── test-batch-queue.js      # Validação de concorrência, fila e dupla barra de progresso
    ├── test-dropzone-logic.js   # Validação de extensões, detecção de MIME e filtros
    └── validate-parsers.js      # Validação de sintaxe, SemVer e integridade de arquivos
```

---

## 🛠️ Guia de Instalação e Execução Local

Como se trata de uma Single Page Application construída com ES Modules nativos, é recomendável servi-la via HTTP local para evitar bloqueios de CORS em navegadores modernos:

### 1. Clonar o repositório
```bash
git clone https://github.com/mathmorato/open-markconverter.git
cd open-markconverter
```

### 2. Executar via servidor estático (escolha uma das opções abaixo)

**Opção A — Usando Node.js / npx serve:**
```bash
npx serve . -l 3000
```

**Opção B — Usando Python 3:**
```bash
python -m http.server 3000
```

**Opção C — Usando a extensão Live Server (VS Code / Antigravity IDE):**
Clique com o botão direito em `index.html` e selecione **Open with Live Server**.

### 3. Acessar a aplicação
Abra o navegador em `http://localhost:3000` (ou porta indicada no terminal).

---

## 🌐 Instruções de Deploy no GitHub Pages

O projeto está 100% preparado para publicação contínua direta pelo GitHub Pages sem etapas intermediárias de build:

1. **Acessar Configurações:** No repositório no GitHub, clique na aba **Settings**.
2. **Navegar para Pages:** No menu lateral esquerdo, selecione a opção **Pages**.
3. **Configurar Publicação:**
   - Em **Build and deployment > Source**, certifique-se de selecionar **Deploy from a branch**.
   - Em **Branch**, selecione `main` e a pasta `/ (root)`.
   - Clique em **Save**.
4. **Deploy Concluído:** Em menos de 1 minuto, sua instância estará ativa e pronta para uso em:
   `https://<seu-usuario>.github.io/open-markconverter/`

---

## 🏷️ Licença e Versionamento SemVer

- **Controle SemVer:** O projeto segue com rigor o padrão [Semantic Versioning 2.0.0](https://semver.org/). A versão atual é **`v.1.4.8`**, sincronizada nos quatro pontos do projeto:
  1. Cabeçalho e rodapé do `index.html`.
  2. Arquivo `package.json` (`"version": "1.4.8"`).
  3. Constante `APP_CONFIG.VERSION` em `js/config.js`.
  4. Badges e títulos deste `README.md`.
- **Licença de Uso:** Distribuído sob os termos da licença **MIT**. Para maiores detalhes, consulte o arquivo [LICENSE](LICENSE).
