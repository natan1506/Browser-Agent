import { useState, useRef, useEffect, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Chat } from './views/Chat';
import { Soul } from './views/Soul';
import { Providers } from './views/Providers';

// ── Error boundary ─────────────────────────────────────────────────────────

interface EBState { hasError: boolean; message: string }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(err: unknown): EBState {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', err, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
          <span className="text-2xl">⚠️</span>
          <p className="text-sm font-semibold text-[#f1f5f9]">Something went wrong</p>
          <p className="text-xs text-[#94a3b8] break-all">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-2 px-4 py-1.5 rounded-lg bg-[#6366f1] hover:bg-[#5558e3] text-white text-xs font-medium"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type Tab = 'chat' | 'soul' | 'providers';

interface TabDef {
  id: Tab;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: 'chat', label: 'Chat', icon: '✦' },
  { id: 'soul', label: 'Soul', icon: '◈' },
  { id: 'providers', label: 'Providers', icon: '⬡' },
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [indicatorStyle, setIndicatorStyle] = useState({ left: '0px', width: '0px' });
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    chat: null,
    soul: null,
    providers: null,
  });

  // Update animated indicator position
  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    setIndicatorStyle({
      left: `${rect.left - parentRect.left}px`,
      width: `${rect.width}px`,
    });
  }, [activeTab]);

  return (
    <div className="flex flex-col h-screen bg-[#080810] text-[#f1f5f9] overflow-hidden">
      {/* Header */}
      <div className="flex-none">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center text-white text-xs font-bold"
              style={{ boxShadow: '0 0 12px #6366f140' }}
            >
              AI
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight">Browser Agent</span>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-[10px] text-[#94a3b8]">ready</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="relative flex px-1 border-b border-[#1e1e35]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors duration-150',
                activeTab === tab.id
                  ? 'text-[#f1f5f9]'
                  : 'text-[#94a3b8] hover:text-[#c4cad4]',
              ].join(' ')}
            >
              <span className="opacity-70">{tab.icon}</span>
              {tab.label}
            </button>
          ))}

          {/* Sliding indicator */}
          <span
            className="absolute bottom-0 h-[2px] bg-[#6366f1] rounded-full transition-all duration-250 ease-out"
            style={indicatorStyle}
          />
        </div>
      </div>

      {/* View content */}
      <div className="flex-1 overflow-hidden">
        <ErrorBoundary>
          <div className={activeTab === 'chat' ? 'h-full' : 'hidden'}>
            <Chat />
          </div>
          <div className={activeTab === 'soul' ? 'h-full' : 'hidden'}>
            <Soul />
          </div>
          <div className={activeTab === 'providers' ? 'h-full' : 'hidden'}>
            <Providers />
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}
