
# AI Browser Agent

Extensão para Chrome/Chromium que usa LLMs (Large Language Models) para **automatizar tarefas no navegador** — preencher formulários, navegar, pesquisar, clicar, extrair dados e muito mais. Tudo via linguagem natural.

<img width="377" height="947" alt="Screen Shot 2026-06-16 at 14 36 47" src="https://github.com/user-attachments/assets/f33e83b8-437c-49c6-b19e-efcfbee9668f" />


---

## Funcionalidades

| Funcionalidade | Descrição |
|---------------|-----------|
| **🤖 Automação por linguagem natural** | Peça em português, inglês, etc. O agente lê a página e executa ações |
| **📸 Upload de imagens e PDFs** | Anexe prints ou documentos para o agente analisar e agir |
| **🔄 Múltiplos providers** | OpenAI, Anthropic (Claude), Google Gemini, OpenRouter, Groq, DeepSeek, Ollama |
| **🛡️ Fallback automático** | Configure providers reserva caso o principal falhe |
| **👤 Alma do agente** | Customize personalidade, tom e idioma |
| **📑 Scraping inteligente** | Extraia links, tabelas, listas e metadados |
| **📷 Screenshot sob demanda** | Capture visualmente a página quando texto não basta |
| **📂 Abas agrupadas** | Abas abertas pelo agente são organizadas em grupo "AI Agent" |

---

## Screenshots

### Chat com steps de navegação

<img width="2013" height="966" alt="Screen Shot 2026-06-16 at 14 37 58" src="https://github.com/user-attachments/assets/bb800734-237f-4186-9315-655552acb300" />


### Configuração de providers

<img width="378" height="967" alt="Screen Shot 2026-06-16 at 14 38 52" src="https://github.com/user-attachments/assets/25617634-65c5-4887-8cb8-859176e9607b" />


### Alma do agente (customização)


<img width="373" height="966" alt="Screen Shot 2026-06-16 at 14 39 05" src="https://github.com/user-attachments/assets/91b21ae7-1d4c-4cb0-bb64-1e81af7c4d95" />

---

## Quick Start

### 1. Instalação

```bash
git clone <repo-url> ai-browser-agent
cd ai-browser-agent
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Carregar no Chrome

1. Acesse `chrome://extensions/`
2. Ative **"Modo do desenvolvedor"**
3. Clique **"Carregar sem compactação"**
4. Selecione a pasta `dist/`

### 4. Configurar Provider

Clique no ícone da extensão na barra de ferramentas → aba **Providers**:

<img width="378" height="967" alt="Screen Shot 2026-06-16 at 14 38 52" src="https://github.com/user-attachments/assets/15ce8db0-df93-4a2c-bd3c-3dae01444b7b" />


| Provider | API Key | Modelo sugerido |
|----------|---------|----------------|
| **OpenAI** | `sk-...` | `gpt-4o` |
| **Anthropic** | `sk-ant-...` | `claude-sonnet-4-6` |
| **Google Gemini** | `AIza...` | `gemini-2.0-flash` |
| **Groq** | `gsk_...` | `llama-3.3-70b-versatile` |
| **OpenRouter** | `sk-or-...` | `anthropic/claude-sonnet-4-6` |
| **DeepSeek** | `sk-...` | `deepseek-chat` |
| **Ollama** | *(nenhuma)* | `llama3.2` |

### 5. Usar

Abra o sidepanel (clique no ícone da extensão) e converse:

<img width="378" height="967" alt="Screen Shot 2026-06-16 at 14 39 37" src="https://github.com/user-attachments/assets/fd70165f-cba9-4345-98c4-6efb4984cc5c" />

---

## Exemplos de Uso

### Automação de formulários

> "Preencha o formulário de contato com nome João, email joao@teste.com e mensagem 'Olá, gostaria de saber mais'"

O agente lê a página, identifica os campos pelo seletor exato e preenche.

### Pesquisa na web

> "Pesquise sobre inteligência artificial"

O agente abre uma nova aba no Google, faz a busca e retorna os resultados.

### Navegação multi-etapas

> "Abra o YouTube, pesquise por 'lofi hip hop' e clique no primeiro vídeo"

```mermaid
sequenceDiagram
    User->>Agent: Abra o YouTube, pesquise lofi
    Agent->>Browser: navigate(url, newTab)
    Browser->>Agent: Page content + inputs
    Agent->>Browser: fill(search_input, "lofi hip hop", submit)
    Browser->>Agent: Resultados da busca
    Agent->>User: ✅ Pronto! Mostrando resultados
```

### Trabalhar com prints/anexos

> *(anexa print de um formulário)* "Preencha o formulário na tela igual a este print"

O agente vê a imagem, entende a estrutura do formulário e replica no site real.

---

## Providers: Fallback

Na aba de chat, clique no ícone 🔀 para configurar fallbacks:

<img width="374" height="967" alt="Screen Shot 2026-06-16 at 14 40 01" src="https://github.com/user-attachments/assets/7d08e0e7-bad9-4344-ad15-caf8b7efd6a5" />


Se o provider principal falhar (timeout, rate limit, erro), o sistema tenta automaticamente o próximo da lista.

---

## Arquitetura

```
src/
├── manifest.json            # Manifesto MV3
├── background/
│   ├── index.ts             # Service worker: agentic loop, dispatch de ações
│   └── llm/
│       ├── router.ts        # Roteamento para o provider correto
│       └── providers/       # Implementações de cada provider
│           ├── openai.ts
│           ├── anthropic.ts
│           ├── gemini.ts
│           ├── openrouter.ts
│           ├── deepseek.ts
│           ├── groq.ts       # (usa streamOpenAI com formato groq)
│           ├── ollama.ts
│           └── opencode.ts
├── content/
│   ├── index.ts             # Content script: message listener
│   └── actions/
│       ├── reader.ts        # Leitura de página + elementos interativos
│       ├── clicker.ts       # Clique por seletor/texto/aria-label
│       ├── filler.ts        # Preenchimento de formulários
│       ├── navigator.ts     # Navegação, scroll
│       └── scraper.ts       # Scraping de dados
├── sidepanel/
│   ├── App.tsx              # UI principal com abas
│   ├── views/
│   │   ├── Chat.tsx         # Chat com streaming + upload de arquivos
│   │   ├── Providers.tsx    # Gerenciamento de providers
│   │   └── Soul.tsx         # Personalidade do agente
│   └── components/
│       ├── ChatMessage.tsx  # Bolha de mensagem com steps + files
│       ├── ModelSelector.tsx
│       └── ProviderCard.tsx
└── shared/
    ├── types.ts             # Tipos compartilhados
    ├── constants.ts         # Providers built-in, tool instructions
    ├── utils.ts             # Parsing de actions, buildMessageContent
    ├── store.ts             # Persistência chrome.storage.local
    └── stream.ts            # SSE/JSON line streaming
```

### Fluxo de uma requisição

```mermaid
flowchart LR
    User[Usuário] --> Chat[Sidepanel Chat]
    Chat -->|CHAT port message| BG[Background Service Worker]
    BG -->|routeLLM| Provider[LLM Provider]
    Provider -->|stream| BG
    BG -->|parseActionTags| Action[ContentAction]
    Action -->|dispatch| Tab[Aba ativa]
    Tab -->|ActionResult| BG
    BG -->|buildToolResultMessage| History[Histórico]
    History -->|próximo turno| Provider
    BG -->|STREAM_CHUNK| Chat
    Chat -->|exibe| User
```

---

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Build + watch para desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | Validação TypeScript |
| `npm run lint` | Lint via ESLint |
| `npm run test` | Testes unitários (Vitest) |

---

## Licença

MIT
