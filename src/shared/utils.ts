import type { ProviderConfig, LLMConfig, ContentAction, Message, ApiFormat } from './types';
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

// ─── File/message content builder ──────────────────────────────────────────

function extractBase64(dataUrl: string): string {
  return dataUrl.startsWith('data:') ? (dataUrl.split(',')[1] ?? dataUrl) : dataUrl;
}

/**
 * Builds the content payload for a message based on the provider API format.
 *
 * When the message has no files or screenshots, returns a plain string (text-only).
 * When media is present, returns an array of content parts in the provider's format:
 *
 * - 'openai' / 'openrouter' / 'groq': `{ type: 'text'|'image_url', ... }`
 * - 'anthropic': `{ type: 'text'|'image'|'document', source: {...} }`
 * - 'gemini': `{ text } | { inlineData: { mimeType, data } }`
 * - default (non-vision): plain string with file notes appended
 */
export function buildMessageContent(msg: Message, format: ApiFormat): unknown {
  const text = msg.content;
  const files = msg.files ?? [];
  const hasScreenshot = !!msg.screenshot;

  const hasMedia = files.length > 0 || hasScreenshot;

  // Plain text — no media
  if (!hasMedia) return text;

  switch (format) {
    case 'openai':
    case 'openrouter':
    case 'groq': {
      const parts: Record<string, unknown>[] = [{ type: 'text', text }];
      if (hasScreenshot) {
        parts.push({ type: 'image_url', image_url: { url: msg.screenshot } });
      }
      for (const f of files) {
        if (f.type === 'application/pdf') {
          parts.push({ type: 'text', text: `[📎 PDF: ${f.name}]` });
        } else {
          parts.push({ type: 'image_url', image_url: { url: f.data } });
        }
      }
      return parts;
    }

    case 'anthropic': {
      const parts: Record<string, unknown>[] = [{ type: 'text', text }];
      if (hasScreenshot) {
        parts.push({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: extractBase64(msg.screenshot!) },
        });
      }
      for (const f of files) {
        const data = extractBase64(f.data);
        if (f.type === 'application/pdf') {
          parts.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data },
          });
        } else {
          parts.push({
            type: 'image',
            source: { type: 'base64', media_type: f.type, data },
          });
        }
      }
      return parts;
    }

    case 'gemini': {
      const parts: Record<string, unknown>[] = [{ text }];
      if (hasScreenshot) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: extractBase64(msg.screenshot!) } });
      }
      for (const f of files) {
        parts.push({ inlineData: { mimeType: f.type, data: extractBase64(f.data) } });
      }
      return parts;
    }

    default: {
      // Non-vision providers: append file notes as text
      if (files.length === 0) return text;
      const notes = files.map((f) => `[📎 ${f.name} (${(f.size / 1024).toFixed(0)} KB)]`);
      return `${text}\n\n${notes.join('\n')}`;
    }
  }
}
