import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '../components/ChatMessage';
import { ModelSelector } from '../components/ModelSelector';
import { loadState, saveMessages, saveLLMConfig } from '../../shared/store';
import { resolveActiveProvider, applyResolvedProvider } from '../../shared/utils';
import type {
  Message,
  LLMConfig,
  AppState,
  ProviderConfig,
  AgentStep,
  ContentAction,
  ActionResult,
  FallbackConfig,
} from '../../shared/types';

// ── Fallbacks panel ───────────────────────────────────────────────────────

function FallbacksPanel({
  fallbacks,
  providers,
  onChange,
}: {
  fallbacks: FallbackConfig[];
  providers: Record<string, ProviderConfig>;
  onChange: (fallbacks: FallbackConfig[]) => void;
}) {
  const readyProviders = Object.values(providers).filter(
    (p) => p.enabled && p.apiKey || p.id === 'ollama'
  );

  const addFallback = () => {
    const first = readyProviders[0];
    if (!first) return;
    onChange([...fallbacks, { provider: first.id, model: first.selectedModel }]);
  };

  const removeFallback = (i: number) => {
    onChange(fallbacks.filter((_, idx) => idx !== i));
  };

  const updateFallback = (i: number, patch: Partial<FallbackConfig>) => {
    onChange(fallbacks.map((fb, idx) => (idx === i ? { ...fb, ...patch } : fb)));
  };

  return (
    <div className="space-y-1.5">
      {fallbacks.map((fb, i) => {
        const prov = providers[fb.provider];
        const models = prov?.models ?? [];
        return (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#94a3b8] w-3 text-right shrink-0">{i + 1}</span>
            <select
              value={fb.provider}
              onChange={(e) => {
                const p = providers[e.target.value];
                updateFallback(i, { provider: e.target.value, model: p?.selectedModel ?? '' });
              }}
              className="flex-1 min-w-0 bg-[#080810] border border-[#1e1e35] rounded-lg px-2 py-1 text-[11px] text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] transition-colors"
            >
              {Object.values(providers).filter((p) => p.enabled).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={fb.model}
              onChange={(e) => updateFallback(i, { model: e.target.value })}
              className="flex-1 min-w-0 bg-[#080810] border border-[#1e1e35] rounded-lg px-2 py-1 text-[11px] text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] transition-colors font-mono"
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              onClick={() => removeFallback(i)}
              className="shrink-0 text-[#94a3b8] hover:text-red-400 text-sm leading-none transition-colors px-0.5"
              title="Remove"
            >
              ✕
            </button>
          </div>
        );
      })}
      <button
        onClick={addFallback}
        disabled={readyProviders.length === 0}
        className="text-[11px] text-[#6366f1] hover:text-[#818cf8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        + Add fallback
      </button>
    </div>
  );
}

export function Chat() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  /** True only while an action step is actively executing (Stop button visible) */
  const [isActionsRunning, setIsActionsRunning] = useState(false);
  const [showFallbacks, setShowFallbacks] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const lastStepIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeActionsRef = useRef(0);       // count of in-flight action steps
  const actionsEverStarted = useRef(false); // true once first AGENT_RESULT arrives
  // Refs that mirror state so we can read current values outside of state updaters
  const messagesRef = useRef<Message[]>([]);
  const configRef = useRef<LLMConfig | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadState().then((state) => {
      const base: LLMConfig = { ...state.llmConfig, systemPrompt: state.soul.prompt };
      const resolved = resolveActiveProvider(state.providers, base);
      const effective = resolved ? applyResolvedProvider(base, resolved) : base;
      if (resolved && (resolved.provider !== base.provider || resolved.model !== base.model)) {
        saveLLMConfig(effective);
      }
      setAppState(state);
      setMessages(state.messages);
      setConfig(effective);
    });
  }, []);

  // ── React to provider changes made in the Providers tab ───────────────────
  useEffect(() => {
    function onChange(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) {
      if (area !== 'local' || !changes['providers']) return;
      const updated = changes['providers'].newValue as Record<string, ProviderConfig>;
      setAppState((prev) => (prev ? { ...prev, providers: updated } : prev));
      setConfig((prev) => {
        if (!prev) return prev;
        const cur = updated[prev.provider];
        const ok = cur?.enabled && (!!cur.apiKey || prev.provider === 'ollama' || cur.apiFormat === 'ollama');
        if (ok) return prev;
        const r = resolveActiveProvider(updated, prev);
        if (!r) return prev;
        return applyResolvedProvider(prev, r);
      });
      setTimeout(() => {
        if (configRef.current) saveLLMConfig(configRef.current);
      }, 0);
    }
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  // Keep refs in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { configRef.current = config; }, [config]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Config change ─────────────────────────────────────────────────────────
  const handleConfigChange = useCallback((c: LLMConfig) => {
    setConfig(c);
    configRef.current = c;
    saveLLMConfig(c);
  }, []);

  const handleFallbacksChange = useCallback((fallbacks: FallbackConfig[]) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, fallbacks };
      configRef.current = next;
      saveLLMConfig(next);
      return next;
    });
  }, []);

  // ── Internal: reset all streaming state ───────────────────────────────────
  const resetStreamState = useCallback(() => {
    activeActionsRef.current = 0;
    setIsActionsRunning(false);
    setIsStreaming(false);
    streamingIdRef.current = null;
  }, []);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string) => {
      if (!config || isActionsRunning || !content.trim()) return;

      // If LLM is writing its final summary (streaming text, no active actions),
      // abort that cleanly then proceed with the new message immediately.
      let baseMessages = messagesRef.current;
      if (isStreaming && streamingIdRef.current) {
        portRef.current?.postMessage({ type: 'ABORT' });
        portRef.current?.disconnect();
        portRef.current = null;
        // Commit partial assistant message as done
        baseMessages = baseMessages.map((m) =>
          m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m
        );
        setMessages(baseMessages);
        resetStreamState();
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      const assistantId = crypto.randomUUID();
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
        steps: [],
      };

      streamingIdRef.current = assistantId;
      actionsEverStarted.current = false; // reset for this new request
      const history = [...baseMessages, userMsg];
      setMessages([...history, assistantMsg]);
      setIsStreaming(true);
      setInput('');

      const port = chrome.runtime.connect({ name: 'agent' });
      portRef.current = port;
      let accumulated = '';

      port.onMessage.addListener((reply) => {
        // ── Text chunk ──────────────────────────────────────────────────
        if (reply.type === 'STREAM_CHUNK') {
          accumulated += reply.content;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated } : m
            )
          );

        // ── Stream finished ─────────────────────────────────────────────
        } else if (reply.type === 'STREAM_END') {
          const cur = messagesRef.current.find((m) => m.id === assistantId);
          const finalMsg: Message = {
            ...assistantMsg,
            content: accumulated,
            isStreaming: false,
            steps: cur?.steps ?? [],
          };
          const updated = [...history, finalMsg];
          setMessages(updated);
          saveMessages(updated);
          resetStreamState();
          port.disconnect();

        // ── Error ───────────────────────────────────────────────────────
        } else if (reply.type === 'STREAM_ERROR') {
          const cur = messagesRef.current.find((m) => m.id === assistantId);
          const errMsg: Message = {
            ...assistantMsg,
            content: accumulated || `⚠️ ${reply.error}`,
            isStreaming: false,
            steps: cur?.steps ?? [],
          };
          const updated = [...history, errMsg];
          setMessages(updated);
          saveMessages(updated);
          resetStreamState();
          port.disconnect();

        // ── Agent started an action ─────────────────────────────────────
        } else if (reply.type === 'AGENT_ACTION') {
          activeActionsRef.current++;
          setIsActionsRunning(true);

          const stepId = crypto.randomUUID();
          lastStepIdRef.current = stepId;
          const newStep: AgentStep = {
            id: stepId,
            action: reply.action,
            status: 'running',
          };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, steps: [...(m.steps ?? []), newStep] }
                : m
            )
          );

        // ── Action completed ────────────────────────────────────────────
        } else if (reply.type === 'AGENT_RESULT') {
          actionsEverStarted.current = true; // at least one action has finished
          activeActionsRef.current = Math.max(0, activeActionsRef.current - 1);
          if (activeActionsRef.current === 0) setIsActionsRunning(false);

          const stepId = lastStepIdRef.current;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId) return m;
              return {
                ...m,
                steps: (m.steps ?? []).map((s) => {
                  if (s.id !== stepId) return s;
                  return {
                    ...s,
                    status: reply.result.success ? 'done' : 'error',
                    preview: buildPreview(s.action, reply.result),
                  };
                }),
              };
            })
          );
        }
      });

      port.onDisconnect.addListener(() => {
        const disconnectedId = streamingIdRef.current;
        resetStreamState();
        if (disconnectedId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === disconnectedId ? { ...m, isStreaming: false } : m
            )
          );
        }
      });

      port.postMessage({ type: 'CHAT', messages: history, config });
    },
    [config, isActionsRunning, isStreaming, resetStreamState]
  );

  const abort = useCallback(() => {
    portRef.current?.postMessage({ type: 'ABORT' });
    portRef.current?.disconnect();
    portRef.current = null;
    // Capture the id NOW before resetStreamState nulls the ref
    const abortedId = streamingIdRef.current;
    resetStreamState();
    if (abortedId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === abortedId ? { ...m, isStreaming: false } : m
        )
      );
    }
  }, [resetStreamState]);

  // ── Retry ─────────────────────────────────────────────────────────────────
  // Finds the user message in history, trims everything after it, and resends.
  const retryMessage = useCallback(
    (content: string) => {
      if (isActionsRunning) return;

      // Find the last occurrence of this message in history
      const msgs = messagesRef.current;
      let idx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'user' && msgs[i].content === content) { idx = i; break; }
      }
      if (idx === -1) {
        // Fallback: just send as new
        sendMessage(content);
        return;
      }

      // Abort any ongoing stream first
      if (isStreaming) {
        portRef.current?.postMessage({ type: 'ABORT' });
        portRef.current?.disconnect();
        portRef.current = null;
        resetStreamState();
      }

      // Trim history to just before this user message, then resend
      const trimmed = msgs.slice(0, idx);
      setMessages(trimmed);
      saveMessages(trimmed);
      // Use a microtask so setMessages flushes before sendMessage reads messagesRef
      setTimeout(() => sendMessage(content), 0);
    },
    [isActionsRunning, isStreaming, sendMessage, resetStreamState]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    saveMessages([]);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!config || !appState) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs text-[#94a3b8]">Loading…</span>
      </div>
    );
  }

  const noProvider = !resolveActiveProvider(appState.providers, config);
  // Disable input only when actions are actively executing
  const inputDisabled = noProvider || isActionsRunning;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header: model selector + actions */}
      <div className="flex-none border-b border-[#1e1e35]">
        <div className="px-3 py-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <ModelSelector
              config={config}
              providers={appState.providers}
              onChange={handleConfigChange}
            />
          </div>
          {/* Fallbacks toggle */}
          <button
            onClick={() => setShowFallbacks((v) => !v)}
            title={`Fallback providers${(config.fallbacks?.length ?? 0) > 0 ? ` (${config.fallbacks!.length} configured)` : ''}`}
            className={`relative flex-none w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
              showFallbacks
                ? 'bg-[#6366f1]/20 text-[#6366f1]'
                : (config.fallbacks?.length ?? 0) > 0
                ? 'text-[#6366f1] hover:bg-[#1e1e35]'
                : 'text-[#94a3b8] hover:bg-[#1e1e35] hover:text-[#f1f5f9]'
            }`}
          >
            {/* Shuffle / retry-chain icon */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 3h2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 8a5 5 0 0 1 8.5-3.5L13 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 13H3v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 8a5 5 0 0 1-8.5 3.5L3 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {(config.fallbacks?.length ?? 0) > 0 && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#6366f1] text-white text-[8px] font-bold flex items-center justify-center leading-none">
                {config.fallbacks!.length}
              </span>
            )}
          </button>
          {/* New session */}
          <button
            onClick={clearChat}
            disabled={isActionsRunning || messages.length === 0}
            title="New session"
            className="flex-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#1e1e35] text-[#94a3b8] hover:text-[#f1f5f9] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {/* New chat: speech bubble + plus */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-3 2.5V11H3a1 1 0 0 1-1-1V3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M8 5v4M6 7h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Fallbacks panel */}
        {showFallbacks && (
          <div className="px-3 pb-3 pt-1 border-t border-[#1e1e35]">
            <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] mb-2">
              Fallback providers — tried in order if primary fails
            </p>
            <FallbacksPanel
              fallbacks={config.fallbacks ?? []}
              providers={appState.providers}
              onChange={handleFallbacksChange}
            />
          </div>
        )}
      </div>

      {/* No-provider warning */}
      {noProvider && (
        <div className="flex-none mx-3 mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center gap-2">
          <span className="text-amber-400 text-sm">⚠️</span>
          <p className="text-xs text-amber-300">
            No provider active. Enable one in the{' '}
            <span className="font-semibold text-amber-200">Providers</span> tab.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#94a3b8]">
            <div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center text-white text-lg font-bold"
              style={{ boxShadow: '0 0 20px #6366f130' }}
            >
              ✦
            </div>
            <p className="text-sm font-medium">How can I help you today?</p>
            <div className="text-xs opacity-60 text-center leading-relaxed space-y-1">
              <p>Try: <span className="text-[#6366f1]">"fill the form on screen"</span></p>
              <p>or: <span className="text-[#6366f1]">"search for Claude AI capabilities"</span></p>
              <p>or: <span className="text-[#6366f1]">"scroll down and click Sign In"</span></p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onRetry={msg.role === 'user' ? retryMessage : undefined}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-none px-3 py-3 border-t border-[#1e1e35]">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isActionsRunning
                ? 'Agent is working…'
                : isStreaming && !actionsEverStarted.current
                ? 'Waiting for response…'
                : noProvider
                ? 'Enable a provider first…'
                : isStreaming
                ? 'Message… (interrupts current response)'
                : 'Message… (Enter to send)'
            }
            disabled={inputDisabled || (isStreaming && !actionsEverStarted.current)}
            rows={2}
            className="flex-1 min-w-0 bg-[#0f0f1a] border border-[#1e1e35] rounded-xl px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#6366f1]/60 transition-colors leading-relaxed disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <div className="flex flex-col gap-1.5">
            {/* Show Stop when:
                  - actions are actively running, OR
                  - streaming but no action has completed yet (waiting / pure text)
                Show Send when streaming final summary (all actions done) */}
            {isActionsRunning || (isStreaming && !actionsEverStarted.current) ? (
              <button
                onClick={abort}
                className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-medium transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || noProvider}
                className="px-3 py-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e3] disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildPreview(action: ContentAction | undefined, result: ActionResult): string {
  if (!result.success) return result.error ?? 'failed';
  if (!action) return 'done';
  const d = result.data as Record<string, unknown> | null;
  const p = action.params ?? {};
  switch (action.type) {
    case 'read':
      return `"${(d as { title?: string })?.title ?? 'page'}"`;
    case 'click':
      return String(p['text'] ?? p['selector'] ?? 'element');
    case 'fill': {
      const fields = p['fields'] as Record<string, string> | undefined;
      const n = fields ? Object.keys(fields).length : 1;
      return `${n} field${n > 1 ? 's' : ''} filled`;
    }
    case 'navigate':
      return String(p['url'] ?? p['scroll'] ?? 'done');
    case 'scrape': {
      const count = (d as { count?: number })?.count;
      return count != null ? `${count} items` : 'done';
    }
    case 'search':
      return `"${p['query']}"`;
    case 'screenshot':
      return 'captured';
    case 'press':
      return String(p['key'] ?? 'key');
    default:
      return 'done';
  }
}
