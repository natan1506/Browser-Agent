import type { Message, LLMConfig, ProviderConfig } from '../../shared/types';
import { streamOpenAI } from './providers/openai';
import { streamAnthropic } from './providers/anthropic';
import { streamGemini } from './providers/gemini';
import { streamOpenRouter } from './providers/openrouter';
import { streamDeepSeek } from './providers/deepseek';
import { streamOllama } from './providers/ollama';

export async function* routeLLM(
  messages: Message[],
  config: LLMConfig,
  providers: Record<string, ProviderConfig>
): AsyncGenerator<string> {
  const provider = providers[config.provider];

  if (!provider) {
    throw new Error(`Provider "${config.provider}" not found.`);
  }
  if (!provider.enabled) {
    throw new Error(`Provider "${provider.name}" is disabled. Enable it in the Providers tab.`);
  }

  const keyFree = provider.id === 'ollama' || provider.apiFormat === 'ollama';
  if (!provider.apiKey && !keyFree) {
    throw new Error(`No API key set for "${provider.name}". Add it in the Providers tab.`);
  }

  const { apiKey, baseUrl } = provider;

  // Route by explicit apiFormat first; fall back to the provider id for built-ins;
  // unknown / custom providers default to OpenAI-compatible.
  const format = provider.apiFormat ?? config.provider;

  switch (format) {
    case 'openai':
      yield* streamOpenAI(messages, config, apiKey, baseUrl);
      break;
    case 'anthropic':
      yield* streamAnthropic(messages, config, apiKey, baseUrl);
      break;
    case 'gemini':
      yield* streamGemini(messages, config, apiKey, baseUrl);
      break;
    case 'openrouter':
      yield* streamOpenRouter(messages, config, apiKey, baseUrl);
      break;
    case 'deepseek':
      yield* streamDeepSeek(messages, config, apiKey, baseUrl);
      break;
    case 'ollama':
      yield* streamOllama(messages, config, apiKey, baseUrl);
      break;
    default:
      // Custom provider — assume OpenAI-compatible (most common standard)
      yield* streamOpenAI(messages, config, apiKey, baseUrl);
  }
}
