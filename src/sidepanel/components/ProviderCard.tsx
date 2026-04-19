import { useState } from 'react';
import type { ProviderConfig, ApiFormat } from '../../shared/types';

interface ProviderCardProps {
  provider: ProviderConfig;
  color: string;
  onChange: (updated: ProviderConfig) => void;
  /** Present only for custom (user-created) providers */
  onDelete?: () => void;
}

const FORMAT_LABELS: Record<ApiFormat, string> = {
  openai:     'OpenAI-compatible',
  anthropic:  'Anthropic',
  gemini:     'Gemini',
  openrouter: 'OpenRouter',
  deepseek:   'DeepSeek',
  ollama:     'Ollama (local)',
};

export function ProviderCard({ provider, color, onChange, onDelete }: ProviderCardProps) {
  const [showKey, setShowKey] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = (patch: Partial<ProviderConfig>) =>
    onChange({ ...provider, ...patch });

  const addModel = () => {
    const model = customModel.trim();
    if (!model || provider.models.includes(model)) return;
    update({ models: [...provider.models, model] });
    setCustomModel('');
  };

  const removeModel = (model: string) => {
    const models = provider.models.filter((m) => m !== model);
    const selectedModel = models.includes(provider.selectedModel)
      ? provider.selectedModel
      : (models[0] ?? '');
    update({ models, selectedModel });
  };

  const isKeyFree = provider.id === 'ollama' || provider.apiFormat === 'ollama';

  return (
    <div
      className={[
        'rounded-xl border transition-all duration-300 overflow-hidden',
        provider.enabled ? 'border-[#1e1e35] bg-[#0f0f1a]' : 'border-[#1e1e35] bg-[#0a0a14]',
      ].join(' ')}
      style={
        provider.enabled
          ? { boxShadow: `0 0 0 1px ${color}25, 0 0 16px 0 ${color}15` }
          : undefined
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className={['w-2.5 h-2.5 flex-shrink-0 rounded-full transition-all duration-300', provider.enabled ? 'animate-glow-pulse' : ''].join(' ')}
            style={{
              backgroundColor: provider.enabled ? color : '#1e1e35',
              boxShadow: provider.enabled ? `0 0 6px ${color}` : 'none',
            }}
          />
          <span className="text-sm font-semibold text-[#f1f5f9] truncate">{provider.name}</span>
          {isKeyFree && (
            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
              local
            </span>
          )}
          {provider.isCustom && (
            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20">
              custom
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Delete button (custom providers only) */}
          {onDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { onDelete(); setConfirmDelete(false); }}
                  className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[10px] text-[#94a3b8] hover:text-[#f1f5f9]"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-[#94a3b8]/40 hover:text-red-400 transition-colors"
                title="Delete provider"
              >
                🗑
              </button>
            )
          )}

          {/* Enable/disable toggle */}
          <button
            onClick={() => update({ enabled: !provider.enabled })}
            role="switch"
            aria-checked={provider.enabled}
            aria-label={provider.enabled ? 'Disable provider' : 'Enable provider'}
            className={[
              'relative flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none',
              provider.enabled ? 'bg-[#6366f1]' : 'bg-[#1e1e35]',
            ].join(' ')}
            style={{ width: 44, height: 24 }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: 3,
                width: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                transition: 'transform 0.2s ease',
                transform: provider.enabled ? 'translateX(20px)' : 'translateX(0px)',
              }}
            />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-4 space-y-3 border-t border-[#1e1e35]">

        {/* API Format selector — custom providers only */}
        {provider.isCustom && (
          <div className="pt-3">
            <label className="block text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1.5">
              API Format
            </label>
            <select
              value={provider.apiFormat ?? 'openai'}
              onChange={(e) => update({ apiFormat: e.target.value as ApiFormat })}
              className="w-full bg-[#080810] border border-[#1e1e35] rounded-lg px-2.5 py-1.5 text-xs text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] transition-colors"
            >
              {(Object.entries(FORMAT_LABELS) as [ApiFormat, string][]).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {/* API Key */}
        {!isKeyFree && (
          <div className={provider.isCustom ? '' : 'pt-3'}>
            <label className="block text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1.5">
              API Key
            </label>
            <div className="flex gap-1.5">
              <input
                type={showKey ? 'text' : 'password'}
                value={provider.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="flex-1 min-w-0 bg-[#080810] border border-[#1e1e35] rounded-lg px-2.5 py-1.5 text-xs text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#6366f1] transition-colors font-mono"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="px-2 py-1.5 rounded-lg bg-[#080810] border border-[#1e1e35] text-[#94a3b8] hover:text-[#f1f5f9] transition-colors text-xs"
                title={showKey ? 'Hide' : 'Show'}
              >
                {showKey ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        )}

        {/* Base URL */}
        <div className={!isKeyFree && !provider.isCustom ? '' : (provider.isCustom ? '' : 'pt-3')}>
          <label className="block text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1.5">
            Base URL
          </label>
          <input
            type="text"
            value={provider.baseUrl}
            onChange={(e) => update({ baseUrl: e.target.value })}
            className="w-full bg-[#080810] border border-[#1e1e35] rounded-lg px-2.5 py-1.5 text-xs text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#6366f1] transition-colors font-mono"
          />
        </div>

        {/* Model selector */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[#94a3b8] mb-1.5">
            Model
          </label>
          <select
            value={provider.selectedModel}
            onChange={(e) => update({ selectedModel: e.target.value })}
            className="w-full bg-[#080810] border border-[#1e1e35] rounded-lg px-2.5 py-1.5 text-xs text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] transition-colors"
          >
            {provider.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Add custom model */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addModel()}
            placeholder="Add model ID…"
            className="flex-1 min-w-0 bg-[#080810] border border-[#1e1e35] rounded-lg px-2.5 py-1.5 text-xs text-[#f1f5f9] placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <button
            onClick={addModel}
            disabled={!customModel.trim()}
            className="px-3 py-1.5 rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#6366f1] text-xs hover:bg-[#6366f1]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>

        {/* Model chips — shown for custom providers (removable) */}
        {provider.isCustom && provider.models.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {provider.models.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1e1e35] text-[10px] text-[#94a3b8]"
              >
                {m}
                <button
                  onClick={() => removeModel(m)}
                  className="text-[#94a3b8]/60 hover:text-red-400 transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
