import { useState, useRef, useEffect, Component, useCallback } from 'react';
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
          <p className="text-sm font-semibold text-text-primary">Something went wrong</p>
          <p className="text-xs text-text-secondary break-all">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-2 px-4 py-1.5 rounded-lg bg-accent hover:bg-[#5558e3] text-white text-xs font-medium"
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

type Theme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'uiTheme';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [theme, setTheme] = useState<Theme>('dark');
  const [indicatorStyle, setIndicatorStyle] = useState({ left: '0px', width: '0px' });
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    chat: null,
    soul: null,
    providers: null,
  });

  useEffect(() => {
    chrome.storage.local.get(THEME_STORAGE_KEY).then((result) => {
      const saved = result[THEME_STORAGE_KEY] as Theme | undefined;
      if (saved) {
        setTheme(saved);
      }
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme === 'dark');
    chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme });
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

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
    <div className="flex flex-col h-screen bg-page text-text-primary overflow-hidden">
      {/* Header */}
      <div className="flex-none">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-cyan flex items-center justify-center text-white text-xs font-bold"
              style={{ boxShadow: '0 0 12px #6366f140' }}
            >
              AI
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight">Browser Agent</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="flex-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-hover-bg text-text-secondary hover:text-text-primary transition-colors"
            >
              {theme === 'dark' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Status indicator */}
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] text-text-secondary">ready</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="relative flex px-1 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors duration-150',
                activeTab === tab.id
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-[#c4cad4]',
              ].join(' ')}
            >
              <span className="opacity-70">{tab.icon}</span>
              {tab.label}
            </button>
          ))}

          {/* Sliding indicator */}
          <span
            className="absolute bottom-0 h-[2px] bg-accent rounded-full transition-all duration-250 ease-out"
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
