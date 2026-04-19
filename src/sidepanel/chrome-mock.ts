/**
 * Stub chrome APIs when running outside the extension context (e.g. Vite dev server).
 * This file is imported only in main.tsx and has no effect when chrome is already defined.
 */

if (typeof chrome === 'undefined' || !chrome.storage) {
  const store: Record<string, unknown> = {
    messages: [
      {
        id: 'u1', role: 'user', content: 'preencha o formulário na tela', timestamp: Date.now(),
      },
      {
        id: 'a1', role: 'assistant',
        content: 'Vou ler a página primeiro para entender o formulário.',
        timestamp: Date.now(), isStreaming: false,
        steps: [
          { id: 's1', action: { type: 'read', params: {} }, status: 'done', preview: '"Contact Form | Acme"' },
          { id: 's2', action: { type: 'fill', params: { fields: { '#name': 'João', '#email': 'joao@example.com' } } }, status: 'done', preview: '2 fields filled' },
          { id: 's3', action: { type: 'click', params: { text: 'Enviar' } }, status: 'done', preview: 'Enviar' },
        ],
      },
      {
        id: 'u2', role: 'user', content: 'pesquise sobre inteligência artificial', timestamp: Date.now(),
      },
      {
        id: 'a2', role: 'assistant',
        content: 'Pesquisando agora…',
        timestamp: Date.now(), isStreaming: true,
        steps: [
          { id: 's4', action: { type: 'search', params: { query: 'inteligência artificial 2024' } }, status: 'running' },
        ],
      },
    ],
    providers: {
      openai: {
        id: 'openai', name: 'OpenAI', apiKey: '', baseUrl: 'https://api.openai.com/v1',
        enabled: true,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        selectedModel: 'gpt-4o',
      },
      openrouter: {
        id: 'openrouter', name: 'OpenRouter', apiKey: '', baseUrl: 'https://openrouter.ai/api/v1',
        enabled: true,
        models: [
          'anthropic/claude-sonnet-4-6',
          'openai/gpt-4o',
          'meta-llama/llama-3.3-70b-instruct',
          'google/gemini-2.0-flash-001',
          'mistralai/mistral-7b-instruct:free',
          'google/gemma-3-27b-it:free',
          'meta-llama/llama-4-scout:free',
        ],
        selectedModel: 'anthropic/claude-sonnet-4-6',
      },
    },
  };

  type StorageListener = (
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    area: string
  ) => void;
  const storageListeners: StorageListener[] = [];

  const chromeMock = {
    storage: {
      onChanged: {
        addListener(fn: StorageListener) { storageListeners.push(fn); },
        removeListener(fn: StorageListener) {
          const idx = storageListeners.indexOf(fn);
          if (idx !== -1) storageListeners.splice(idx, 1);
        },
      },
      local: {
        get(keys: string[], cb: (result: Record<string, unknown>) => void) {
          const result: Record<string, unknown> = {};
          keys.forEach((k) => {
            if (k in store) result[k] = store[k];
          });
          cb(result);
        },
        set(items: Record<string, unknown>, cb?: () => void) {
          const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: store[k], newValue: v };
            store[k] = v;
          }
          cb?.();
          storageListeners.forEach((fn) => fn(changes, 'local'));
        },
      },
    },
    runtime: {
      connect() {
        const listeners: ((msg: unknown) => void)[] = [];
        const disconnectListeners: (() => void)[] = [];
        return {
          name: 'agent',
          postMessage(_msg: unknown) {
            // no-op in preview
          },
          onMessage: {
            addListener(fn: (msg: unknown) => void) {
              listeners.push(fn);
            },
          },
          onDisconnect: {
            addListener(fn: () => void) {
              disconnectListeners.push(fn);
            },
          },
          disconnect() {
            disconnectListeners.forEach((fn) => fn());
          },
        };
      },
    },
    tabs: {
      query(_opts: unknown, cb: (tabs: unknown[]) => void) {
        cb([{ id: 1, url: 'https://example.com', title: 'Example' }]);
      },
    },
    sidePanel: {
      open() {},
      setPanelBehavior() {
        return Promise.resolve();
      },
    },
    action: {
      onClicked: { addListener() {} },
    },
  };

  // @ts-expect-error — intentional global stub
  window.chrome = chromeMock;
}
