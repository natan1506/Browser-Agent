import { useState, useEffect } from 'react';
import { ProviderCard } from '../components/ProviderCard';
import { loadState, saveProviders, saveLLMConfig } from '../../shared/store';
import { resolveActiveProvider, applyResolvedProvider, isProviderReady } from '../../shared/utils';
import { getProviderColor } from '../../shared/constants';
import type { ProviderConfig, LLMConfig, ApiFormat } from '../../shared/types';

// ── Add-provider form ──────────────────────────────────────────────────────

interface NewProviderForm {
  name: string;
  apiFormat: ApiFormat;
  baseUrl: string;
  apiKey: string;
  models: string;
}

const EMPTY_FORM: NewProviderForm = {
  name: '',
  apiFormat: 'openai',
  baseUrl: '',
  apiKey: '',
  models: '',
};

const FORMAT_LABELS: Record<ApiFormat, string> = {
  openai:     'OpenAI-compatible (most APIs)',
  anthropic:  'Anthropic',
  gemini:     'Google Gemini',
  openrouter: 'OpenRouter',
  deepseek:   'DeepSeek',
  ollama:     'Ollama (local, no key needed)',
};

function slugify(name: string): string {
  return (
    'custom-' +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) +
    '-' +
    Math.random().toString(36).slice(2, 6)
  );
}

function AddProviderPanel({
  onAdd,
  onCancel,
}: {
  onAdd: (p: ProviderConfig) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<NewProviderForm>(EMPTY_FORM);
  const [error, setError] = useState('');

  const set = (patch: Partial<NewProviderForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.baseUrl.trim()) { setError('Base URL is required'); return; }
    if (form.apiFormat !== 'ollama' && !form.apiKey.trim()) {
      setError('API Key is required for this format'); return;
    }
    const modelList = form.models.split(',').map((m) => m.trim()).filter(Boolean);
    if (modelList.length === 0) { setError('Add at least one model name'); return; }

    onAdd({
      id: slugify(form.name),
      name: form.name.trim(),
      apiKey: form.apiKey.trim(),
      baseUrl: form.baseUrl.trim().replace(/\/$/, ''),
      enabled: true,
      models: modelList,
      selectedModel: modelList[0],
      apiFormat: form.apiFormat,
      isCustom: true,
    });
  };

  return (
    <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a0a14] p-4 space-y-3">
      <h3 className="text-xs font-semibold text-[#f1f5f9] uppercase tracking-wider">New Provider</h3>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
          {error}
        </p>
      )}

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1">Name</label>
        <input type="text" placeholder="My Custom API" value={form.name}
          onChange={(e) => { set({ name: e.target.value }); setError(''); }}
          className="w-full bg-[#080810] border border-[#1e1e35] rounded-lg px-2.5 py-1.5 text-xs text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#6366f1] transition-colors" />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1">API Format</label>
        <select value={form.apiFormat}
          onChange={(e) => { set({ apiFormat: e.target.value as ApiFormat }); setError(''); }}
          className="w-full bg-[#080810] border border-[#1e1e35] rounded-lg px-2.5 py-1.5 text-xs text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] transition-colors">
          {(Object.entries(FORMAT_LABELS) as [ApiFormat, string][]).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1">Base URL</label>
        <input type="text" placeholder="https://api.example.com/v1" value={form.baseUrl}
          onChange={(e) => { set({ baseUrl: e.target.value }); setError(''); }}
          className="w-full bg-[#080810] border border-[#1e1e35] rounded-lg px-2.5 py-1.5 text-xs text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#6366f1] transition-colors font-mono" />
      </div>

      {form.apiFormat !== 'ollama' && (
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1">API Key</label>
          <input type="password" placeholder="sk-..." value={form.apiKey}
            onChange={(e) => { set({ apiKey: e.target.value }); setError(''); }}
            className="w-full bg-[#080810] border border-[#1e1e35] rounded-lg px-2.5 py-1.5 text-xs text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#6366f1] transition-colors font-mono" />
        </div>
      )}

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1">
          Models <span className="normal-case opacity-60">(comma-separated)</span>
        </label>
        <input type="text" placeholder="model-id-1, model-id-2" value={form.models}
          onChange={(e) => { set({ models: e.target.value }); setError(''); }}
          className="w-full bg-[#080810] border border-[#1e1e35] rounded-lg px-2.5 py-1.5 text-xs text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#6366f1] transition-colors font-mono" />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={handleSubmit}
          className="flex-1 py-1.5 rounded-lg bg-[#6366f1] hover:bg-[#5558e3] text-white text-xs font-medium transition-colors">
          Add Provider
        </button>
        <button onClick={onCancel}
          className="px-4 py-1.5 rounded-lg bg-[#0f0f1a] border border-[#1e1e35] text-[#94a3b8] hover:text-[#f1f5f9] text-xs transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────

export function Providers() {
  const [providers, setProviders] = useState<Record<string, ProviderConfig> | null>(null);
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadState().then((state) => {
      setProviders(state.providers);
      setLlmConfig(state.llmConfig);
    });
  }, []);

  const persist = async (
    next: Record<string, ProviderConfig>,
    currentConfig: LLMConfig
  ) => {
    setProviders(next);
    await saveProviders(next);

    const resolved = resolveActiveProvider(next, currentConfig);
    if (resolved) {
      const curProvider = next[currentConfig.provider];
      if (!curProvider || !isProviderReady(curProvider)) {
        const updatedConfig = applyResolvedProvider(currentConfig, resolved);
        setLlmConfig(updatedConfig);
        await saveLLMConfig(updatedConfig);
      }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChange = async (updated: ProviderConfig) => {
    if (!providers || !llmConfig) return;
    await persist({ ...providers, [updated.id]: updated }, llmConfig);
  };

  const handleDelete = async (id: string) => {
    if (!providers || !llmConfig) return;
    const next = { ...providers };
    delete next[id];
    await persist(next, llmConfig);
  };

  const handleAdd = async (p: ProviderConfig) => {
    if (!providers || !llmConfig) return;
    await persist({ ...providers, [p.id]: p }, llmConfig);
    setShowAddForm(false);
  };

  if (!providers || !llmConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs text-[#94a3b8]">Loading...</span>
      </div>
    );
  }

  const providerList = Object.values(providers);
  const readyCount = providerList.filter(isProviderReady).length;
  const enabledCount = providerList.filter((p) => p.enabled).length;

  return (
    <div className="h-full overflow-y-auto px-3 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#f1f5f9]">LLM Providers</h2>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            {readyCount === 0 && enabledCount === 0
              ? 'Enable at least one provider to start chatting'
              : readyCount === 0 && enabledCount > 0
              ? `${enabledCount} enabled — add an API key to activate`
              : `${readyCount} provider${readyCount > 1 ? 's' : ''} ready`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs transition-opacity duration-300 ${saved ? 'opacity-100 text-[#10b981]' : 'opacity-0'}`}>
            Saved ✓
          </span>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-2.5 py-1 rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#6366f1] text-xs hover:bg-[#6366f1]/20 transition-colors font-medium"
          >
            {showAddForm ? '✕' : '＋ Add'}
          </button>
        </div>
      </div>

      {/* Active provider badge */}
      {readyCount > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-[#10b981]/10 border border-[#10b981]/20 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
          <p className="text-xs text-[#10b981]">
            Active:{' '}
            <span className="font-semibold">
              {providers[llmConfig.provider]?.name ?? llmConfig.provider}
            </span>{' '}
            —{' '}
            <span className="font-mono text-[11px]">{llmConfig.model}</span>
          </p>
        </div>
      )}

      {/* Add provider form */}
      {showAddForm && (
        <div className="mb-3">
          <AddProviderPanel onAdd={handleAdd} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {/* Provider cards */}
      <div className="space-y-3">
        {providerList.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            color={getProviderColor(provider.id)}
            onChange={handleChange}
            onDelete={provider.isCustom ? () => handleDelete(provider.id) : undefined}
          />
        ))}
      </div>

      <p className="mt-5 text-[11px] text-[#94a3b8]/60 text-center leading-relaxed">
        API keys are stored locally in your browser.
        <br />
        They are never sent anywhere except to the provider's API.
      </p>
    </div>
  );
}
