import { describe, it, expect } from 'vitest';
import {
  isProviderReady,
  resolveActiveProvider,
  applyResolvedProvider,
  parseActionTags,
  stripActionTags,
} from '../shared/utils';
import type { ProviderConfig, LLMConfig } from '../shared/types';

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'test',
    name: 'Test',
    apiKey: '',
    baseUrl: 'https://example.com',
    enabled: false,
    models: ['model-1'],
    selectedModel: 'model-1',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<LLMConfig> = {}): LLMConfig {
  return {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'You are a helpful assistant.',
    ...overrides,
  };
}

describe('isProviderReady', () => {
  it('returns false when disabled', () => {
    expect(isProviderReady(makeProvider({ enabled: false, apiKey: 'sk-123' }))).toBe(false);
  });

  it('returns false when no API key and not key-free', () => {
    expect(isProviderReady(makeProvider({ enabled: true, apiKey: '' }))).toBe(false);
  });

  it('returns true when enabled with API key', () => {
    expect(isProviderReady(makeProvider({ enabled: true, apiKey: 'sk-123' }))).toBe(true);
  });

  it('returns true for ollama without API key', () => {
    expect(isProviderReady(makeProvider({ id: 'ollama', enabled: true, apiKey: '' }))).toBe(true);
  });

  it('returns true for ollama apiFormat without API key', () => {
    expect(isProviderReady(makeProvider({ enabled: true, apiKey: '', apiFormat: 'ollama' }))).toBe(true);
  });

  it('returns true for opencode apiFormat without API key', () => {
    expect(isProviderReady(makeProvider({ enabled: true, apiKey: '', apiFormat: 'opencode' }))).toBe(true);
  });
});

describe('resolveActiveProvider', () => {
  const openaiReady = makeProvider({ id: 'openai', enabled: true, apiKey: 'sk-123' });
  const anthropicReady = makeProvider({ id: 'anthropic', enabled: true, apiKey: 'sk-ant' });

  it('returns current provider if ready', () => {
    const providers = { openai: openaiReady };
    const config = makeConfig({ provider: 'openai', model: 'gpt-4o' });
    const result = resolveActiveProvider(providers, config);
    expect(result).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('falls back to built-in if current is not ready', () => {
    const providers = {
      openai: makeProvider({ id: 'openai', enabled: false }),
      anthropic: anthropicReady,
    };
    const config = makeConfig({ provider: 'openai' });
    const result = resolveActiveProvider(providers, config);
    expect(result?.provider).toBe('anthropic');
  });

  it('falls back to custom provider if no built-in is ready', () => {
    const custom = makeProvider({ id: 'my-custom', isCustom: true, enabled: true, apiKey: 'sk-custom' });
    const providers = { 'my-custom': custom, openai: makeProvider({ id: 'openai', enabled: false }) };
    const result = resolveActiveProvider(providers, makeConfig({ provider: 'openai' }));
    expect(result?.provider).toBe('my-custom');
  });

  it('returns null when nothing is enabled', () => {
    const providers = { openai: makeProvider({ id: 'openai', enabled: false }) };
    expect(resolveActiveProvider(providers, makeConfig())).toBeNull();
  });

  it('uses current provider model when ready', () => {
    const providers = { openai: openaiReady };
    const config = makeConfig({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(resolveActiveProvider(providers, config)).toEqual({ provider: 'openai', model: 'gpt-4o-mini' });
  });

  it('uses fallback provider selectedModel', () => {
    const providers = {
      openai: makeProvider({ id: 'openai', enabled: false }),
      anthropic: makeProvider({ id: 'anthropic', enabled: true, apiKey: 'sk-ant', selectedModel: 'claude-sonnet-4-6' }),
    };
    const result = resolveActiveProvider(providers, makeConfig({ provider: 'openai' }));
    expect(result).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
  });
});

describe('applyResolvedProvider', () => {
  it('updates provider and model while preserving other fields', () => {
    const config = makeConfig({ temperature: 0.5, maxTokens: 1000 });
    const result = applyResolvedProvider(config, { provider: 'anthropic', model: 'claude-3' });
    expect(result).toEqual({
      ...config,
      provider: 'anthropic',
      model: 'claude-3',
    });
  });
});

describe('parseActionTags', () => {
  it('parses a single action tag', () => {
    const text = '<action>{"type": "click", "params": {"selector": "#btn"}}</action>';
    expect(parseActionTags(text)).toEqual([{ type: 'click', params: { selector: '#btn' } }]);
  });

  it('parses multiple action tags', () => {
    const text =
      '<action>{"type": "read", "params": {}}</action> some text <action>{"type": "click", "params": {"text": "Submit"}}</action>';
    const actions = parseActionTags(text);
    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe('read');
    expect(actions[1].type).toBe('click');
  });

  it('returns empty array for text without action tags', () => {
    expect(parseActionTags('Hello world')).toEqual([]);
  });

  it('skips malformed JSON inside action tag', () => {
    const text = '<action>{invalid}</action>';
    expect(parseActionTags(text)).toEqual([]);
  });

  it('parses tool_call tags with function notation', () => {
    const text = '<tool_call><function=click>{"selector": "#btn"}</function></tool_call>';
    const actions = parseActionTags(text);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'click', params: { selector: '#btn' } });
  });

  it('parses tool_call tags with raw JSON', () => {
    const text = '<tool_call>{"type": "navigate", "params": {"url": "https://x.com"}}</tool_call>';
    const actions = parseActionTags(text);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'navigate', params: { url: 'https://x.com' } });
  });

  it('handles mixed action and tool_call tags', () => {
    const text =
      '<action>{"type": "read", "params": {}}</action> done <tool_call><function=click>{"text": "Go"}</function></tool_call>';
    const actions = parseActionTags(text);
    expect(actions).toHaveLength(2);
  });
});

describe('stripActionTags', () => {
  it('removes action tags', () => {
    expect(stripActionTags('<action>{"type": "click"}</action>hello')).toBe('hello');
  });

  it('removes tool_call tags', () => {
    expect(stripActionTags('<tool_call>{"type": "click"}</tool_call>world')).toBe('world');
  });

  it('removes both tag types', () => {
    const text =
      '<action>{"type": "read"}</action> summary <tool_call><function=click>{}</function></tool_call> done';
    expect(stripActionTags(text)).toBe('summary done');
  });

  it('reduces excessive newlines', () => {
    const text = 'hello\n\n\n\nworld';
    expect(stripActionTags(text)).toBe('hello\n\nworld');
  });

  it('returns empty string for tags-only content', () => {
    expect(stripActionTags('<action>{"type": "read"}</action>')).toBe('');
  });

  it('returns original text when no tags present', () => {
    expect(stripActionTags('hello world')).toBe('hello world');
  });
});
