import type { ProviderConfig, LLMConfig } from './types';
import { BUILTIN_PROVIDER_IDS } from './constants';

export interface ResolvedProvider {
  provider: string;
  model: string;
}

/**
 * Returns whether a provider is considered "ready":
 * enabled AND has an API key (Ollama-format providers are key-free).
 */
export function isProviderReady(p: ProviderConfig): boolean {
  const keyFree = p.id === 'ollama' || p.apiFormat === 'ollama';
  return p.enabled && (!!p.apiKey || keyFree);
}

/**
 * Resolves the best provider+model to use given the current config and providers.
 *
 * Logic:
 * 1. If the configured provider is ready → keep it
 * 2. Try built-in providers in priority order
 * 3. Try any custom providers that are ready
 * 4. Fallback: any enabled provider (user may be mid-setup)
 * 5. Returns null if nothing is enabled at all
 */
export function resolveActiveProvider(
  providers: Record<string, ProviderConfig>,
  currentConfig: LLMConfig
): ResolvedProvider | null {
  const current = providers[currentConfig.provider];

  // Current provider is good — keep it
  if (current && isProviderReady(current)) {
    return { provider: currentConfig.provider, model: currentConfig.model };
  }

  // Try built-ins in priority order
  for (const id of BUILTIN_PROVIDER_IDS) {
    const p = providers[id];
    if (p && isProviderReady(p)) {
      return { provider: id, model: p.selectedModel };
    }
  }

  // Try custom providers
  for (const p of Object.values(providers)) {
    if (p.isCustom && isProviderReady(p)) {
      return { provider: p.id, model: p.selectedModel };
    }
  }

  // Fallback: any enabled provider (user may be typing the key)
  for (const id of BUILTIN_PROVIDER_IDS) {
    const p = providers[id];
    if (p?.enabled) return { provider: id, model: p.selectedModel };
  }
  for (const p of Object.values(providers)) {
    if (p.enabled) return { provider: p.id, model: p.selectedModel };
  }

  return null;
}

/**
 * Applies the resolved provider to an existing LLMConfig.
 * Preserves temperature, maxTokens, systemPrompt etc.
 */
export function applyResolvedProvider(
  config: LLMConfig,
  resolved: ResolvedProvider
): LLMConfig {
  return { ...config, provider: resolved.provider, model: resolved.model };
}
