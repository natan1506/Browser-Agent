# Plano de Melhorias — AI Browser Agent

## Pré-requisitos
Antes de executar, crie um branch: `git checkout -b refactor/improvements`

---

## Fase 1 — Shared Utilities + Correções

### 1.1 Criar `src/shared/stream.ts`

```typescript
export async function* streamResponseLines(response: Response): AsyncGenerator<string>
export async function* streamSSE<T>(response: Response): AsyncGenerator<T>
export async function* streamJSONLines<T>(response: Response): AsyncGenerator<T>
```

### 1.2 Refatorar providers para usar `streamResponseLines`

Modificar **6 providers** (openai, openrouter, deepseek, anthropic, gemini, ollama).
O opencode tem lógica muito diferente — deixar como está.

Cada provider perde ~15 linhas de boilerplate (reader/decoder/buffer).

Exemplo — `openai.ts` após refatoração:
```typescript
import { streamSSE } from '../../../shared/stream';

export async function* streamOpenAI(...): AsyncGenerator<string> {
  const response = await fetch(...);
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);

  for await (const chunk of streamSSE<{ choices: { delta: { content?: string } }[] }>(response)) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) yield content;
  }
}
```

### 1.3 Adicionar `console.warn` nos catch silenciosos

Em todos os providers, trocar:
```typescript
catch {
  // skip malformed chunks
}
```
para:
```typescript
catch {
  console.warn('[providerName] malformed chunk:', line.slice(0, 200));
}
```

### 1.4 Mover `parseActionTags` / `stripActionTags` para `src/shared/utils.ts`

- Mover as funções de `background/index.ts` para `utils.ts`
- Exportar e importar em `background/index.ts` e `ChatMessage.tsx` (que tem `cleanContent` duplicado)
- Renomear `cleanContent` para usar `stripActionTags`

### 1.5 Corrigir bug de precedência de operadores

Em `src/sidepanel/views/Chat.tsx:29`:
```typescript
// De:
(p) => p.enabled && p.apiKey || p.id === 'ollama'
// Para:
(p) => p.enabled && (p.apiKey || p.id === 'ollama')
```

Em `src/sidepanel/views/Providers.tsx:28`:
```typescript
// De:
(p) => p.enabled && p.apiKey || p.id === 'ollama'
// Para:
(p) => p.enabled && (p.apiKey || p.id === 'ollama')
```

### 1.6 CSS: remover `textarea { resize: none }` global

Em `src/sidepanel/index.css:59`:
```css
/* Remover: */
textarea { resize: none; }
```

Em `Chat.tsx`, adicionar `resize-none` na classe do textarea.

---

## Fase 2 — Refatoração do Background

### 2.1 Extrair funções do `runAgentLoop` (`background/index.ts`)

Quebrar em:
- `executeActionSequence(actions, windowId, port)` — executa actions, retorna resultParts
- `buildFallbackChain(agentConfig, fallbacks)` — monta array de configs
- `buildToolResultMessage(resultParts, pendingScreenshot)` — monta mensagem de retorno
- `formatActionResult(action, result)` — mesma lógica do `resultPreview` atual

### 2.2 Adicionar verificação `chrome.runtime.lastError`

Em todas as chamadas assíncronas de chrome API que não têm `.catch()`:
- `chrome.tabs.update`
- `chrome.tabs.group`
- `chrome.scripting.executeScript`

Adicionar:
```typescript
if (chrome.runtime.lastError) {
  console.warn('[background] chrome error:', chrome.runtime.lastError);
}
```

---

## Fase 3 — TypeScript Strict + Lint

### 3.1 Ativar `noUnusedLocals: true` e `noUnusedParameters: true`

Em `tsconfig.json`, mudar para `true` e corrigir todos os erros.

### 3.2 Adicionar ESLint

```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks
```

`eslint.config.js`:
```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
```

### 3.3 Adicionar Prettier

```bash
npm install -D prettier
```

`.prettierrc`:
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true
}
```

Adicionar script no `package.json`:
```json
"lint": "eslint src/",
"format": "prettier --write src/"
```

---

## Fase 4 — Performance

### 4.1 Batch de chunks com rAF

Em `Chat.tsx`, agrupar chunks durante o streaming:

```typescript
const accumulatedRef = useRef('');
const flushTimerRef = useRef<number | null>(null);

// No handler STREAM_CHUNK:
accumulatedRef.current += reply.content;
if (!flushTimerRef.current) {
  flushTimerRef.current = requestAnimationFrame(() => {
    flushTimerRef.current = null;
    const text = accumulatedRef.current;
    accumulatedRef.current = '';
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId ? { ...m, content: (m.content || '') + text } : m
      )
    );
  });
}
```

### 4.2 Debounce no `saveMessages`

Já existe `saveMessages` chamado no `STREAM_END`. Se quiser salvar intermediário, usar debounce de 2s.

---

## Fase 5 — Testes

### 5.1 Adicionar Vitest

```bash
npm install -D vitest
```

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

### 5.2 `chrome-mock` para testes

Criar `src/__tests__/setup.ts` que define `chrome` global mock.

### 5.3 Testes unitários

`src/__tests__/utils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseActionTags, stripActionTags, isProviderReady } from '../shared/utils';

describe('parseActionTags', () => {
  it('extracts action from <action> tag', () => {
    expect(parseActionTags('<action>{"type":"read","params":{}}</action>'))
      .toEqual([{ type: 'read', params: {} }]);
  });
  // ...
});
```

Adicionar script: `"test": "vitest run"`

---

## Fase 6 — UI

### 6.1 Light/dark mode

Adicionar `darkMode: 'class'` no `tailwind.config.js`. Criar toggle no header do `App.tsx`. O tema atual é dark — usar como `.dark`. Para light, definir cores claras equivalentes.

### 6.2 Keyboard shortcuts

- `Cmd/Ctrl + Enter` → sendMessage (já tem Enter sem Shift, mas adicionar o Cmd também)
- `Escape` → abort (já tem no ModelSelector para fechar dropdown, adicionar global)

---

## Fase 7 — Config

### 7.1 `.nvmrc`

```
18
```

### 7.2 `engines` no `package.json`

```json
"engines": {
  "node": ">=18.0.0"
}
```

---

## Ordem de Execução

| Passo | Descrição | Depende de |
|-------|-----------|------------|
| 1 | Criar `stream.ts` | — |
| 2 | Refatorar 6 providers | 1 |
| 3 | Adicionar `console.warn` nos providers | 2 |
| 4 | Mover `parseActionTags` para utils | — |
| 5 | Corrigir bug precedência | — |
| 6 | CSS resize-none | — |
| 7 | Extrair funções do runAgentLoop | — |
| 8 | Adicionar lastError checks | — |
| 9 | Ativar strict TS + corrigir erros | 4 |
| 10 | ESLint + Prettier | 9 |
| 11 | Batch rAF no Chat | — |
| 12 | Vitest + testes | 4 |
| 13 | .nvmrc + engines | — |
| 14 | Light/dark mode | — |
| 15 | Keyboard shortcuts | — |

---

## Arquivos Modificados

### Criados (3):
- `src/shared/stream.ts`
- `eslint.config.js`
- `.prettierrc`
- `.nvmrc`
- `vitest.config.ts`
- `src/__tests__/utils.test.ts`

### Modificados (19):
- `src/shared/utils.ts` — add parseActionTags, stripActionTags
- `src/background/index.ts` — import utils, extrair funções, add lastError
- `src/background/llm/router.ts` — (nenhuma mudança necessária)
- `src/background/llm/providers/openai.ts` — usar streamSSE
- `src/background/llm/providers/anthropic.ts` — usar streamResponseLines
- `src/background/llm/providers/gemini.ts` — usar streamResponseLines
- `src/background/llm/providers/openrouter.ts` — usar streamSSE
- `src/background/llm/providers/deepseek.ts` — usar streamSSE
- `src/background/llm/providers/ollama.ts` — usar streamJSONLines
- `src/sidepanel/views/Chat.tsx` — fix precedência, rAF batch, resize-none
- `src/sidepanel/views/Providers.tsx` — fix precedência
- `src/sidepanel/components/ChatMessage.tsx` — import stripActionTags
- `src/sidepanel/index.css` — remove resize global
- `src/sidepanel/App.tsx` — dark mode toggle
- `tailwind.config.js` — darkMode config
- `tsconfig.json` — strict flags
- `package.json` — engines, scripts
