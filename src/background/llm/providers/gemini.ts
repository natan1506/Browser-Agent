import type { Message, LLMConfig } from '../../../shared/types';
import { streamResponseLines } from '../../../shared/stream';
import { buildMessageContent } from '../../../shared/utils';

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export async function* streamGemini(
  messages: Message[],
  config: LLMConfig,
  apiKey: string,
  baseUrl: string
): AsyncGenerator<string> {
  const contents: GeminiContent[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: buildMessageContent(m, 'gemini') as GeminiPart[],
    }));

  const response = await fetch(
    `${baseUrl}/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: config.systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini ${response.status}: ${body}`);
  }

  for await (const line of streamResponseLines(response)) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (!data) continue;

    try {
      const parsed = JSON.parse(data) as {
        candidates?: {
          content?: { parts?: { text?: string }[] };
        }[];
      };
      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) yield text;
    } catch {
      console.warn('[Gemini] malformed chunk:', data.slice(0, 200));
    }
  }
}
