import type { Message, LLMConfig } from '../../../shared/types';
import { streamJSONLines } from '../../../shared/stream';
import { buildMessageContent } from '../../../shared/utils';

export async function* streamOllama(
  messages: Message[],
  config: LLMConfig,
  _apiKey: string,
  baseUrl: string
): AsyncGenerator<string> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: buildMessageContent(m, 'ollama') })),
      ],
      stream: true,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama ${response.status}: ${body}`);
  }

  for await (const chunk of streamJSONLines<{ message?: { content?: string }; done?: boolean }>(response)) {
    const content = chunk.message?.content;
    if (content) yield content;
    if (chunk.done) return;
  }
}
