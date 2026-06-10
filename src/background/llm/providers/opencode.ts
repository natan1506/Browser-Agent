import type { Message, LLMConfig } from '../../../shared/types';

interface OCEvent {
  type: string;
  properties: Record<string, unknown>;
}

/**
 * OpenCode local server provider.
 * Communicates via:
 *   POST   {baseUrl}/session              — create session
 *   GET    {baseUrl}/event               — SSE bus (all events)
 *   POST   {baseUrl}/session/:id/message — send user message
 *
 * Text deltas arrive as  message.part.delta  { field:"text", delta:"..." }
 * Completion is signalled by  session.status  { status:{ type:"idle" } }
 */
export async function* streamOpenCode(
  messages: Message[],
  config: LLMConfig,
  baseUrl: string
): AsyncGenerator<string> {
  const base = baseUrl.replace(/\/$/, '');

  // ── 1. Create a fresh session ──────────────────────────────────────────────
  const sessionRes = await fetch(`${base}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!sessionRes.ok) {
    const body = await sessionRes.text();
    throw new Error(`OpenCode: failed to create session (${sessionRes.status}): ${body}`);
  }
  const session = (await sessionRes.json()) as { id: string };
  const sessionId = session.id;

  // ── 2. Subscribe to the SSE event bus BEFORE posting the message ───────────
  const eventRes = await fetch(`${base}/event`, {
    headers: { Accept: 'text/event-stream' },
  });
  if (!eventRes.ok) {
    throw new Error(`OpenCode: failed to connect to event stream (${eventRes.status})`);
  }
  const reader = eventRes.body!.getReader();
  const decoder = new TextDecoder();

  // ── 3. Build system + history context ─────────────────────────────────────
  const historyMessages = messages.slice(0, -1);
  let systemContent = config.systemPrompt ?? '';

  if (historyMessages.length > 0) {
    const hist = historyMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    systemContent += `\n\n--- Previous conversation ---\n${hist}\n--- End of previous conversation ---`;
  }

  const lastMsg = messages[messages.length - 1];

  // ── 4. Post the user message (fire-and-forget; response comes via SSE) ─────
  fetch(`${base}/session/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts: [{ type: 'text', text: lastMsg.content }],
      ...(systemContent ? { system: systemContent } : {}),
    }),
  }).catch(() => {});

  // ── 5. Stream SSE events, yield text deltas ────────────────────────────────
  let buffer = '';
  let completed = false;

  try {
    while (!completed) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let event: OCEvent;
        try {
          event = JSON.parse(raw) as OCEvent;
        } catch {
          continue;
        }

        const { type, properties } = event;

        // Only process events for our session
        const evtSession = properties?.sessionID as string | undefined;
        if (evtSession && evtSession !== sessionId) continue;

        if (type === 'message.part.delta') {
          // field:"text" → visible response; field:"reasoning" → internal thinking (skip)
          const field = properties.field as string | undefined;
          const delta = properties.delta as string | undefined;
          if (field === 'text' && delta) {
            yield delta;
          }
        } else if (type === 'session.status') {
          const status = properties.status as { type: string } | undefined;
          if (status?.type === 'idle') {
            completed = true;
            break;
          }
        } else if (type === 'message.updated') {
          // Surface any error from the assistant message
          const info = properties.info as { role?: string; error?: unknown } | undefined;
          if (info?.role === 'assistant' && info.error) {
            const err = info.error as Record<string, unknown>;
            throw new Error(
              typeof err === 'object'
                ? ((err['message'] as string) ?? JSON.stringify(err))
                : String(err)
            );
          }
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
