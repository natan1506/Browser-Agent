import type { AppState, ProviderConfig, Soul, LLMConfig, Message } from './types';
import { PROVIDER_DEFAULTS, DEFAULT_SOUL, DEFAULT_LLM_CONFIG } from './constants';

function buildInitialProviders(): Record<string, ProviderConfig> {
  return Object.fromEntries(
    Object.entries(PROVIDER_DEFAULTS).map(([id, config]) => [
      id,
      { ...config, apiKey: '' } as ProviderConfig,
    ])
  );
}

const INITIAL_STATE: AppState = {
  messages: [],
  llmConfig: DEFAULT_LLM_CONFIG,
  providers: buildInitialProviders(),
  soul: DEFAULT_SOUL,
  isStreaming: false,
};

export function loadState(): Promise<AppState> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['providers', 'llmConfig', 'soul', 'messages'],
      (result) => {
        resolve({
          ...INITIAL_STATE,
          providers: result['providers'] ?? INITIAL_STATE.providers,
          llmConfig: result['llmConfig'] ?? INITIAL_STATE.llmConfig,
          soul: result['soul'] ?? INITIAL_STATE.soul,
          messages: result['messages'] ?? INITIAL_STATE.messages,
          isStreaming: false,
        });
      }
    );
  });
}

export function saveProviders(
  providers: Record<string, ProviderConfig>
): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ providers }, resolve);
  });
}

export function saveLLMConfig(llmConfig: LLMConfig): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ llmConfig }, resolve);
  });
}

export function saveSoul(soul: Soul): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ soul }, resolve);
  });
}

export function saveMessages(messages: Message[]): Promise<void> {
  return new Promise((resolve) => {
    // Keep last 200 messages to stay within storage limits
    const trimmed = messages.slice(-200);
    chrome.storage.local.set({ messages: trimmed }, resolve);
  });
}

export function clearMessages(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ messages: [] }, resolve);
  });
}
