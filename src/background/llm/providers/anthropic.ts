import type { Message, LLMConfig } from '../../../shared/types';
import { streamResponseLines } from '../../../shared/stream';
import { buildMessageContent } from '../../../shared/utils';

export async function* streamAnthropic(
  messages: Message[],
  config: LLMConfig,
  apiKey: string,
  baseUrl: string
): AsyncGenerator<string> {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      system: config.systemPrompt,
      messages: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role,
          content: buildMessageContent(m, 'anthropic'),
        })),
      stream: true,
      temperature: config.temperature,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic ${response.status}: ${body}`);
  }

  for await (const line of streamResponseLines(response)) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (!data) continue;

    try {
      const parsed = JSON.parse(data) as {
        type?: string;
        delta?: { type?: string; text?: string };
      };
      if (
        parsed.type === 'content_block_delta' &&
        parsed.delta?.type === 'text_delta' &&
        parsed.delta.text
      ) {
        yield parsed.delta.text;
      }
    } catch {
      console.warn('[Anthropic] malformed chunk:', data.slice(0, 200));
    }
  }
}
