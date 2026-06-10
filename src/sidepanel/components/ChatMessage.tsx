import { useState } from 'react';
import type { Message, AgentStep, ContentAction } from '../../shared/types';
import { stripActionTags } from '../../shared/utils';

interface ChatMessageProps {
  message: Message;
  /** Called when user clicks Retry on a user message */
  onRetry?: (content: string) => void;
}

// ── Action icons & labels ──────────────────────────────────────────────────

const ACTION_META: Record<string, { icon: string; label: string }> = {
  read:       { icon: '📄', label: 'Reading page' },
  click:      { icon: '🖱️', label: 'Clicking' },
  fill:       { icon: '✏️', label: 'Filling form' },
  navigate:   { icon: '🧭', label: 'Navigating' },
  scrape:     { icon: '🔍', label: 'Scraping' },
  search:     { icon: '🌐', label: 'Searching web' },
  screenshot: { icon: '📷', label: 'Screenshot' },
  press:      { icon: '⌨️', label: 'Pressing key' },
};

function actionLabel(action: ContentAction | undefined): string {
  if (!action) return '⚙️ Action';
  const meta = ACTION_META[action.type] ?? { icon: '⚙️', label: action.type };
  const params = action.params ?? {};
  const detail =
    params['text'] ??
    params['selector'] ??
    params['url'] ??
    params['query'] ??
    params['scroll'] ??
    '';
  return `${meta.icon} ${meta.label}${detail ? `: ${String(detail).slice(0, 40)}` : ''}`;
}

// ── Copy button ────────────────────────────────────────────────────────────

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy"
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all duration-150
        ${copied
          ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25'
          : 'bg-surface text-text-secondary border border-border hover:text-text-primary hover:border-accent/40'
        } ${className}`}
    >
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
  );
}

// ── Step card ──────────────────────────────────────────────────────────────

function StepCard({ step }: { step: AgentStep }) {
  if (!step) return null;
  const isRunning = step.status === 'running';
  const isError   = step.status === 'error';

  return (
    <div
      className={[
        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors',
        isRunning
          ? 'bg-accent/10 border-accent/25 text-[#a5b4fc]'
          : isError
          ? 'bg-red-500/10 border-red-500/20 text-red-400'
          : 'bg-[#10b981]/8 border-[#10b981]/20 text-[#6ee7b7]',
      ].join(' ')}
    >
      {isRunning ? (
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full bg-accent animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      ) : isError ? (
        <span>✗</span>
      ) : (
        <span className="text-[#10b981]">✓</span>
      )}

      <span className="flex-1 truncate">{actionLabel(step.action)}</span>

      {step.preview && !isRunning && (
        <span className={`truncate max-w-[120px] ${isError ? 'text-red-400/70' : 'text-text-secondary'}`}>
          {step.preview}
        </span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ChatMessage({ message, onRetry }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const steps  = message.steps ?? [];
  const isDone = !message.isStreaming;

  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-in">
        <div className="group max-w-[85%] space-y-1">
          <div className="px-3 py-2 rounded-2xl rounded-tr-sm bg-accent/20 border border-accent/30 text-text-primary text-sm leading-relaxed">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>

          {/* Action bar — only visible on hover */}
          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <CopyButton text={message.content} />
            {onRetry && (
              <button
                onClick={() => onRetry(message.content)}
                title="Retry"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-surface text-text-secondary border border-border hover:text-text-primary hover:border-accent/40 transition-all duration-150"
              >
                ↺ Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 animate-slide-in">
      {/* Avatar */}
      <div className="flex-shrink-0 w-5 h-5 mt-0.5 rounded bg-gradient-to-br from-accent to-accent-cyan flex items-center justify-center text-[8px] font-bold text-white">
        AI
      </div>

      <div className="group flex-1 min-w-0 space-y-1.5">
        {/* Text bubble — only shown if there's visible text after stripping action tags */}
        {(() => {
          const visibleContent = cleanContent(message.content);
          const showBubble = visibleContent || message.isStreaming;
          if (!showBubble) return null;
          return (
            <div className="bg-surface border border-l-2 border-border border-l-accent rounded-2xl rounded-tl-sm px-3 py-2">
              <div className="text-sm text-text-primary leading-relaxed">
                {visibleContent ? (
                  <FormattedContent content={message.content} />
                ) : null}
                {message.isStreaming && !visibleContent && (
                  <span className="flex gap-1 py-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
                )}
                {message.isStreaming && visibleContent && (
                  <span className="inline-block w-0.5 h-3.5 bg-accent ml-0.5 animate-blink align-middle" />
                )}
              </div>
            </div>
          );
        })()}

        {/* Agent step cards */}
        {steps.length > 0 && (
          <div className="space-y-1 pl-1">
            {steps.map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
          </div>
        )}

        {/* Copy button — only when response is complete and has visible text */}
        {isDone && cleanContent(message.content) && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <CopyButton text={cleanContent(message.content)} />
          </div>
        )}
      </div>
    </div>
  );
}

function cleanContent(raw: string): string {
  return stripActionTags(raw);
}

// ── Inline content formatter (code blocks + inline code) ──────────────────

function FormattedContent({ content }: { content: string }) {
  const safe = cleanContent(content);
  const parts = safe.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3).split('\n');
          const lang = lines[0].trim();
          const code = lines.slice(1).join('\n').replace(/```$/, '').trimEnd();
          return (
            <pre
              key={i}
              className="mt-2 mb-2 bg-page rounded-lg p-3 overflow-x-auto text-xs border border-border relative group/code"
            >
              <div className="flex items-center justify-between mb-1">
                {lang && (
                  <div className="text-[10px] text-accent font-mono uppercase">{lang}</div>
                )}
                <CopyButton text={code} className="ml-auto opacity-0 group-hover/code:opacity-100" />
              </div>
              <code className="font-mono text-text-primary">{code}</code>
            </pre>
          );
        }

        const inline = part.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {inline.map((seg, j) =>
              seg.startsWith('`') && seg.endsWith('`') ? (
                <code
                  key={j}
                  className="bg-page text-accent-cyan text-xs px-1 py-0.5 rounded font-mono"
                >
                  {seg.slice(1, -1)}
                </code>
              ) : (
                <span key={j} className="whitespace-pre-wrap break-words">
                  {seg}
                </span>
              )
            )}
          </span>
        );
      })}
    </>
  );
}
