import type { ProviderConfig, LLMConfig, ContentAction } from './types';
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
  const keyFree =
    p.id === 'ollama' ||
    p.apiFormat === 'ollama' ||
    p.apiFormat === 'opencode';
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

// ─── Action tag parsing ─────────────────────────────────────────────────────

/**
 * Some models emit <tool_call><function=X>{...}</function></tool_call> instead
 * of our <action> format. Normalise those into ContentAction objects.
 */
function parseToolCallTag(inner: string): ContentAction | null {
  const fnMatch = inner.match(/<function=(\w+)>([\s\S]*?)<\/function>/);
  if (fnMatch) {
    const type = fnMatch[1] as ContentAction['type'];
    try {
      const params = JSON.parse(fnMatch[2].trim());
      return { type, params };
    } catch {
      return { type, params: {} };
    }
  }
  try {
    return JSON.parse(inner.trim()) as ContentAction;
  } catch {
    return null;
  }
}

/**
 * Normalise common JSON formatting issues that smaller LLMs produce:
 * - single quotes instead of double quotes
 * - unquoted keys
 * - trailing commas
 */
function normalizeJSON(text: string): string {
  return text
    .replace(/'/g, '"')
    .replace(/(\s+)(\w+)(\s*):/g, '"$2":')
    .replace(/,(\s*[}\]])/g, '$1');
}

export function parseActionTags(text: string): ContentAction[] {
  const actions: ContentAction[] = [];

  // Also find tags wrapped inside markdown code fences
  const clean = text.replace(/```[\s\S]*?```/g, (m) => {
    // Strip fence markers but keep content for tag matching
    return m.replace(/```\w*\n?/g, '');
  });

  const re1 = /<action>([\s\S]*?)<\/action>/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(clean)) !== null) {
    try {
      const parsed = JSON.parse(normalizeJSON(m[1].trim())) as ContentAction;
      if (parsed.type && parsed.params) actions.push(parsed);
    } catch { /* skip malformed */ }
  }

  const re2 = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  while ((m = re2.exec(clean)) !== null) {
    const action = parseToolCallTag(normalizeJSON(m[1]));
    if (action) actions.push(action);
  }

  return actions;
}

export function stripActionTags(text: string): string {
  return text
    .replace(/<action>[\s\S]*?<\/action>/g, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}
