import { useState, useEffect } from 'react';
import { SoulEditor } from '../components/SoulEditor';
import { loadState } from '../../shared/store';
import type { Soul as SoulType } from '../../shared/types';

export function Soul() {
  const [soul, setSoul] = useState<SoulType | null>(null);

  useEffect(() => {
    loadState().then((state) => setSoul(state.soul));
  }, []);

  if (!soul) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs text-[#94a3b8]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-[#f1f5f9]">Agent Soul</h2>
        <p className="text-xs text-[#94a3b8] mt-1">
          Define your agent's personality, capabilities, and response style.
        </p>
      </div>

      <SoulEditor soul={soul} onChange={setSoul} />

      {/* Tips */}
      <div className="mt-6 p-3 rounded-xl bg-[#6366f1]/5 border border-[#6366f1]/15">
        <p className="text-[10px] font-semibold text-[#6366f1] uppercase tracking-wider mb-2">
          Tips
        </p>
        <ul className="space-y-1.5 text-xs text-[#94a3b8]">
          <li className="flex gap-2">
            <span className="text-[#6366f1] flex-shrink-0">→</span>
            Mention the language you want responses in
          </li>
          <li className="flex gap-2">
            <span className="text-[#6366f1] flex-shrink-0">→</span>
            Describe the agent's tone: formal, casual, concise
          </li>
          <li className="flex gap-2">
            <span className="text-[#6366f1] flex-shrink-0">→</span>
            List capabilities or tools the agent should use
          </li>
          <li className="flex gap-2">
            <span className="text-[#6366f1] flex-shrink-0">→</span>
            Add domain knowledge or constraints
          </li>
        </ul>
      </div>
    </div>
  );
}
