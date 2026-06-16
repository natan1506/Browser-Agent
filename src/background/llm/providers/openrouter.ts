import type { Message, LLMConfig } from '../../../shared/types';
import { streamSSE } from '../../../shared/stream';
import { buildMessageContent } from '../../../shared/utils';

export async function* streamOpenRouter(
  messages: Message[],
  config: LLMConfig,
  apiKey: string,
  baseUrl: string
): AsyncGenerator<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/ai-browser-agent',
      'X-Title': 'AI Browser Agent',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        ...messages.map((m) => ({
          role: m.role,
          content: buildMessageContent(m, 'openrouter'),
        })),
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${body}`);
  }

  for await (const chunk of streamSSE<{ choices?: { delta?: { content?: string } }[] }>(response)) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) yield content;
  }
}
