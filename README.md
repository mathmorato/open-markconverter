# Open Mark (doc2md) `v.1.8.8`

[![Version](https://img.shields.io/badge/version-v.1.8.8-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Architecture: 100% Client--Side](https://img.shields.io/badge/Architecture-100%25%20Client--Side-informational.svg)](#-manifesto-de-segurança-e-privacidade-data-privacy-by-design)
[![Privacy: Zero Server Upload](https://img.shields.io/badge/Privacy-Zero%20Server%20Upload-green.svg)](#-manifesto-de-segurança-e-privacidade-data-privacy-by-design)
[![Deploy: GitHub Pages Ready](https://img.shields.io/badge/Deploy-GitHub%20Pages%20Ready-brightgreen.svg)](#-instruções-de-deploy-no-github-pages)

Uma plataforma web estática moderna, ultrarrápida e universal para processamento e conversão de múltiplos formatos de documento em **Markdown semântico e estruturado** (`.md`). Desenvolvida em Vanilla JavaScript modular (ES Modules), a ferramenta roda **100% no navegador do usuário**, eliminando qualquer dependência de servidores, containers ou transmissão de dados para a nuvem.

### 🌐 Acesso Online Imediato
Além da instalação e execução local, você pode utilizar a versão em produção diretamente pelo navegador (100% client-side, sem necessidade de instalar nada):
👉 **[Acessar Open Mark](https://mathmorato.github.io/open-mark/#)**

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

O **Open Mark** foi arquitetado sob a premissa fundamental de soberania de dados do usuário:

1. **Execução 100% Client-Side:** Toda a lógica de leitura binária, parsing de XML/ZIP e compilação de Markdown executa no sandbox do motor JavaScript do navegador do usuário (`V8`, `SpiderMonkey`, `JavaScriptCore`).
2. **Zero Tráfego de Rede para Documentos:** Nenhum documento, fragmento de texto, nome de arquivo ou metadado trafega por redes externas ou servidores centrais. A aplicação funciona plenamente até mesmo em modo offline (*Air-Gapped*).
3. **Telemetria Zero:** Sem ferramentas invasivas de analytics, cookies de rastreamento ou chamadas ocultas a APIs de terceiros. Apenas bibliotecas de parsing abertas são carregadas via CDNs consolidadas e imutáveis.
4. **Ciclo de Vida de Memória Efêmero:** Os buffers binários (`ArrayBuffer`) e strings geradas residem estritamente na memória da sessão da aba aberta. Ao remover um item da fila ou recarregar a página, todos os recursos são descartados pelo *Garbage Collector*.
5. **Conformidade Corporativa:** Ideal para ambientes regulados que lidam com propriedade intelectual confidencial, dados pessoais (LGPD/GDPR) e diretrizes rígidas de segurança corporativa.

---

## 📁 Estrutura do Repositório (Árvore Limpa)

```
open-mark/
├── index.html                   # Interface SPA semântica, Dropzone e Fila de Lote
├── package.json                 # Metadados do projeto e dependências
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
git clone https://github.com/mathmorato/open-mark.git
cd open-mark
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
   `https://<seu-usuario>.github.io/open-mark/`

---

## 🏷️ Licença e Versionamento SemVer

- **Controle SemVer:** O projeto segue com rigor o padrão [Semantic Versioning 2.0.0](https://semver.org/). A versão atual é **`v.1.8.8`**, sincronizada nos pontos de governança do projeto:
  1. Interface principal (`index.html`).
  2. Arquivo `package.json` (`"version": "1.8.8"`).
  3. Constante `APP_CONFIG.VERSION` em `js/config.js`.
  4. Badges e cabeçalho deste `README.md`.
- **Licença de Uso:** Distribuído sob os termos da licença **MIT**. Para maiores detalhes, consulte o arquivo [LICENSE](LICENSE).
