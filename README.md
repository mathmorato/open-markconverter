# Universal MarkConverter (doc2md) `v.1.1.0`

[![Version](https://img.shields.io/badge/version-v.1.1.0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Privacy: 100% Client--Side](https://img.shields.io/badge/Privacy-100%25%20Client--Side-green.svg)](#privacidade-e-segurança)
[![Static Deploy](https://img.shields.io/badge/Deploy-GitHub%20Pages-informational.svg)](#instruções-de-deploy-github-pages)

Uma plataforma web estática moderna, ultrarrápida e universal para conversão local de múltiplos formatos de documentos em **Markdown semântico e estruturado**, projetada para rodar 100% no navegador (*client-side*) com zero dependências de backend ou telemetria.

---

## 🚀 Recursos Principais

- **100% Client-Side e Privado:** Todos os documentos são processados exclusivamente na máquina do usuário via JavaScript ES Modules e Web Workers. Seus dados nunca saem do seu navegador.
- **Detecção e Conversão Universal:**
  - 📄 **Word (`.docx`):** Conversão semântica via [Mammoth.js](https://github.com/mwilliamson/mammoth.js) e Turndown (preservação de títulos hierárquicos, listas, ênfases, tabelas e links).
  - 📊 **Planilhas (`.xlsx`, `.csv`, `.ods`):** Conversão matricial direta para tabelas Markdown nativas (`| coluna | coluna |`) via [SheetJS](https://sheetjs.com/).
  - 📽️ **Apresentações (`.pptx`):** Extração estruturada por slides (`# Slide N`), tópicos hierárquicos e anotações do apresentador via [JSZip](https://stuk.github.io/jszip/).
  - 📕 **Documentos (`.pdf`):** Extração de fluxo contínuo de texto, quebras de linha e separação de seções via [PDF.js](https://mozilla.github.io/pdf.js/).
  - 📝 **Texto puro / Código (`.txt`, `.json`, `.html`, `.rtf`, `.md`, `.xml`):** Conversão direta, formatação de blocos de código com syntax highlighting e higienização.
- **Painel Duplo (Split View Responsivo):**
  - **Raw Markdown:** Editor de texto com contador de caracteres, linhas e palavras.
  - **Rendered Preview:** Pré-visualização HTML formatada em tempo real com estilos GitHub-Flavored Markdown.
  - **Modos de Exibição:** Alternância com 1 clique entre Lado a Lado (Split), Somente Raw e Somente Preview.
- **Ações Rápidas com Feedback:**
  - Botão de **Copiar Markdown** com feedback visual imediato e animação.
  - Botão de **Download `.md`** com nomenclatura automática compatível.
  - Suporte a **Arrastar & Soltar (Drag & Drop)** e **Colar da Área de Transferência (Ctrl+V)**.
- **Design System Técnico e Elegante:**
  - Suporte nativo a **Modo Escuro (Dark Mode)** e **Modo Claro (Light Mode)** com detecção de preferência de sistema e persistência em `localStorage`.
  - Tipografia moderna (*Inter* e *JetBrains Mono*).
  - Ícones lineares técnicos e leves (estilo Lucide / Feather).

---

## 📂 Arquitetura do Projeto

```
open-markconverter/
├── index.html            # Estrutura semântica, Split View e componentes
├── package.json          # Metadados e versão SemVer v.1.0.0
├── css/
│   └── styles.css        # Variáveis CSS, temas claro/escuro e layout responsivo
├── js/
│   ├── config.js         # Constantes de versão SemVer e extensões aceitas
│   ├── app.js            # Controle de UI, Drag & Drop, temas e ciclo de eventos
│   ├── parsers/
│   │   ├── docx-parser.js # Parser Mammoth + Turndown para .docx
│   │   ├── xlsx-parser.js # Parser SheetJS para tabelas matriciais
│   │   ├── pptx-parser.js # Parser JSZip para slides e tópicos
│   │   ├── pdf-parser.js  # Parser PDF.js para fluxo de texto
│   │   └── text-parser.js # Parser para txt, json, html, rtf, code
│   └── workers/
│       └── converter-worker.js # Web Worker para conversão assíncrona
└── README.md             # Documentação técnica e arquitetura
```

---

## 🔒 Privacidade e Segurança

- **Zero Chamadas de API Externas:** Nenhum dado é enviado para servidores remotos, APIs de IA de terceiros ou serviços de telemetria.
- **Isolamento de Memória:** O ciclo de vida dos arquivos termina na aba aberta do navegador.
- **Sanitização de Saída:** Todo o HTML gerado na pré-visualização é higienizado via DOMPurify para evitar injeções XSS.

---

## 🛠️ Execução Local

Você pode rodar localmente com qualquer servidor estático HTTP simples:

```bash
# Clone o repositório
git clone https://github.com/mathmorato/open-markconverter.git
cd open-markconverter

# Com npx serve:
npx serve . -l 3000

# Ou com Python 3:
python -m http.server 3000
```

Abra no navegador em `http://localhost:3000`.

---

## 🌐 Instruções de Deploy (GitHub Pages)

Por ser uma aplicação 100% estática sem necessidade de build complexo no servidor:

1. Acesse as **Settings** do seu repositório no GitHub.
2. Vá até a seção **Pages** (no menu lateral esquerdo).
3. Em **Build and deployment > Source**, selecione **Deploy from a branch**.
4. Em **Branch**, selecione `main` e a pasta `/ (root)`.
5. Clique em **Save**. Em instantes seu MarkConverter estará no ar em `https://<seu-usuario>.github.io/open-markconverter/`.

---

## 🏷️ Versionamento SemVer

O projeto segue estritamente a especificação [SemVer](https://semver.org/) no formato `v.X.Y.Z`:
- **Versão Atual:** `v.1.0.3`
- A versão está sincronizada no rodapé e cabeçalho de `index.html`, em `js/config.js`, no `package.json` e neste `README.md`.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para obter mais informações.
