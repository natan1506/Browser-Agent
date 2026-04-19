import type { Message, LLMConfig } from '../../../shared/types';

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
    .map((m) => {
      const parts: GeminiPart[] = [{ text: m.content }];
      if (m.screenshot) {
        const base64 = m.screenshot.split(',')[1] ?? '';
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64 } });
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });

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

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();

      try {
        const parsed = JSON.parse(data) as {
          candidates?: {
            content?: { parts?: { text?: string }[] };
          }[];
        };
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch {
        // skip malformed chunks
      }
    }
  }
}
