export async function* streamResponseLines(response: Response): AsyncGenerator<string> {
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
      yield line;
    }
  }
}

export async function* streamSSE<T = unknown>(response: Response): AsyncGenerator<T> {
  for await (const line of streamResponseLines(response)) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') return;
    if (!data) continue;

    try {
      yield JSON.parse(data) as T;
    } catch {
      console.warn('[streamSSE] malformed chunk:', data.slice(0, 200));
    }
  }
}

export async function* streamJSONLines<T = unknown>(response: Response): AsyncGenerator<T> {
  for await (const line of streamResponseLines(response)) {
    if (!line.trim()) continue;

    try {
      yield JSON.parse(line) as T;
    } catch {
      console.warn('[streamJSONLines] malformed line:', line.slice(0, 200));
    }
  }
}
