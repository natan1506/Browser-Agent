import type { Message, LLMConfig } from '../../../shared/types';
import { streamSSE } from '../../../shared/stream';
import { buildMessageContent } from '../../../shared/utils';

export async function* streamDeepSeek(
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
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: buildMessageContent(m, 'deepseek') })),
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepSeek ${response.status}: ${body}`);
  }

  for await (const chunk of streamSSE<{ choices?: { delta?: { content?: string } }[] }>(response)) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) yield content;
  }
}
