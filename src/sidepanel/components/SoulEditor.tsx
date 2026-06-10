import { useState, useEffect, useRef } from 'react';
import type { Soul } from '../../shared/types';
import { saveSoul } from '../../shared/store';

interface SoulEditorProps {
  soul: Soul;
  onChange: (soul: Soul) => void;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
];

export function SoulEditor({ soul, onChange }: SoulEditorProps) {
  const [local, setLocal] = useState<Soul>(soul);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocal(soul);
  }, [soul]);

  const update = (patch: Partial<Soul>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
    setSaved(false);

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveSoul(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  };

  const charCount = local.prompt.length;
  const charLimit = 4000;

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">
          Agent Name
        </label>
        <input
          type="text"
          value={local.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Assistant, Aria, Max..."
          maxLength={40}
          className="w-full bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Language */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">
          Response Language
        </label>
        <select
          value={local.language}
          onChange={(e) => update({ language: e.target.value })}
          className="w-full bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* System Prompt */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] uppercase tracking-wider text-text-secondary">
            System Prompt
          </label>
          <span
            className={`text-[10px] tabular-nums ${
              charCount > charLimit * 0.9 ? 'text-amber-400' : 'text-text-secondary'
            }`}
          >
            {charCount}/{charLimit}
          </span>
        </div>
        <textarea
          value={local.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          maxLength={charLimit}
          rows={10}
          placeholder="Describe how the agent should behave..."
          className="w-full bg-page border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors leading-relaxed"
        />
      </div>

      {/* Save feedback */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          Changes are auto-saved and applied to new conversations.
        </p>
        <span
          className={`text-xs transition-opacity duration-300 ${
            saved ? 'opacity-100 text-success' : 'opacity-0'
          }`}
        >
          Saved ✓
        </span>
      </div>
    </div>
  );
}
