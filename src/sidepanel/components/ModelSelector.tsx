import { useState, useRef, useEffect } from 'react';
import type { LLMConfig, ProviderId, ProviderConfig } from '../../shared/types';
import { PROVIDER_COLORS } from '../../shared/constants';

interface ModelSelectorProps {
  config: LLMConfig;
  providers: Partial<Record<ProviderId, ProviderConfig>>;
  onChange: (config: LLMConfig) => void;
}

export function ModelSelector({ config, providers, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const enabledProviders = Object.values(providers).filter(
    (p): p is ProviderConfig => !!p?.enabled
  );

  const currentProvider = providers[config.provider];
  const accentColor = PROVIDER_COLORS[config.provider] ?? '#6366f1';

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setSearch('');
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectModel = (providerId: ProviderId, model: string) => {
    onChange({ ...config, provider: providerId, model });
    setOpen(false);
    setSearch('');
  };

  // Use typed text as a custom model under a specific provider
  const useCustomModel = (providerId: ProviderId) => {
    const model = search.trim();
    if (!model) return;
    onChange({ ...config, provider: providerId, model });
    setOpen(false);
    setSearch('');
  };

  // Filter: keep providers that have at least one matching model OR if search might be custom
  const filtered = enabledProviders.map((provider) => ({
    ...provider,
    matchedModels: provider.models.filter((m) =>
      !search || m.toLowerCase().includes(search.toLowerCase())
    ),
  }));

  const term = search.trim();
  // Custom option: typed text that doesn't exactly match any model in any provider
  const isExactMatch = enabledProviders.some((p) =>
    p.models.some((m) => m === term)
  );
  const showCustom = term.length > 0 && !isExactMatch;

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg bg-page border border-border hover:border-[#2e2e4a] transition-colors text-left"
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <span className="flex-1 min-w-0 text-xs text-text-primary truncate">
          {currentProvider?.name ?? config.provider} — {config.model}
        </span>
        <svg
          className={`w-3 h-3 text-text-secondary flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-72">
          {/* Search input */}
          <div className="flex-none p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); return; }
                if (e.key === 'Enter' && showCustom && enabledProviders.length > 0) {
                  // Use first enabled provider for custom model
                  useCustomModel(enabledProviders[0].id);
                }
              }}
              placeholder="Search or type any model name…"
              className="w-full bg-page border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Model list */}
          <div className="flex-1 overflow-y-auto">
            {enabledProviders.length === 0 ? (
              <div className="px-3 py-4 text-xs text-text-secondary text-center">
                No providers enabled.{' '}
                <span className="text-accent">Configure in Providers tab.</span>
              </div>
            ) : (
              <>
                {filtered.map((provider) => (
                  <div key={provider.id}>
                    {/* Provider header */}
                    <div className="sticky top-0 px-3 py-1.5 flex items-center gap-2 bg-surface border-b border-border">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PROVIDER_COLORS[provider.id] }}
                      />
                      <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex-1">
                        {provider.name}
                      </span>
                      {/* Custom model for this provider (shown when typing) */}
                      {showCustom && (
                        <button
                          onClick={() => useCustomModel(provider.id)}
                          className="text-[10px] text-accent hover:text-[#818cf8] px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 transition-colors"
                        >
                          use here
                        </button>
                      )}
                    </div>

                    {/* Models */}
                    {provider.matchedModels.length > 0 ? (
                      provider.matchedModels.map((model) => (
                        <button
                          key={model}
                          onClick={() => selectModel(provider.id, model)}
                          className={[
                            'w-full text-left px-4 py-2 text-xs transition-colors',
                            config.provider === provider.id && config.model === model
                              ? 'bg-accent/15 text-text-primary'
                              : 'text-text-secondary hover:bg-hover-bg hover:text-text-primary',
                          ].join(' ')}
                        >
                          {model}
                          {config.provider === provider.id && config.model === model && (
                            <span className="ml-2 text-accent">✓</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-2 text-[11px] text-text-secondary/50 italic">
                        No matches
                      </p>
                    )}
                  </div>
                ))}

                {/* Global custom model banner */}
                {showCustom && (
                  <div className="sticky bottom-0 border-t border-border bg-surface px-3 py-2 flex items-center gap-2">
                    <span className="text-[10px] text-text-secondary flex-1 truncate">
                      Custom:{' '}
                      <span className="text-accent-cyan font-mono">{term}</span>
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      Press{' '}
                      <kbd className="px-1 py-0.5 rounded bg-hover-bg text-text-primary">↵</kbd>{' '}
                      to use
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
