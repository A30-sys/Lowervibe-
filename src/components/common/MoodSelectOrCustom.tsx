import { Plus, Sparkles, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

export const PRESET_MOODS = [
  'Chill',
  'Afro Chill',
  'Deep',
  'Night',
  'Upbeat',
  'Warm',
  'Lake Breeze',
  'Midnight',
  'Golden Hour',
  'Focus',
  'Party',
  'Romantic',
  'Soulful',
  'Hype',
] as const;

interface MoodSelectOrCustomProps {
  value: string;
  onChange: (mood: string) => void;
  className?: string;
  placeholder?: string;
  allowSkip?: boolean;
}

export const MoodSelectOrCustom: React.FC<MoodSelectOrCustomProps> = ({
  value,
  onChange,
  className = '',
  placeholder,
  allowSkip = true,
}) => {
  const { language } = useLanguage();
  const isNy = language === 'ny';
  const trimmed = (value || '').trim();
  const isInPresetList =
    trimmed === '' ||
    PRESET_MOODS.some((m) => m.toLowerCase() === trimmed.toLowerCase());

  const [customMode, setCustomMode] = useState(() => Boolean(trimmed && !isInPresetList));

  useEffect(() => {
    if (trimmed && !isInPresetList) {
      setCustomMode(true);
    }
  }, [trimmed, isInPresetList]);

  const matchedPreset =
    PRESET_MOODS.find((m) => m.toLowerCase() === trimmed.toLowerCase()) || '';

  const resolvedPlaceholder =
    placeholder ||
    (isNy
      ? 'Lembani maganizo anu (mwachitsanzo, Madzulo a ku Nsanje, Chikondi)...'
      : 'Type custom mood (e.g. Nsanje Sunset, Heartbreak)...');

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {!customMode ? (
          <select
            value={trimmed === '' ? '' : matchedPreset}
            onChange={(e) => {
              const next = e.target.value;
              if (next === '__CUSTOM__') {
                setCustomMode(true);
                onChange('');
              } else {
                onChange(next);
              }
            }}
            className={
              className ||
              'flex-1 min-w-0 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer'
            }
          >
            {allowSkip && (
              <option value="">
                {isNy ? 'Palibe maganizo (Dumphani — Osakakamizidwa)' : 'No mood (Skip — Optional)'}
              </option>
            )}
            {PRESET_MOODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value="__CUSTOM__">
              {isNy ? '+ Lembani maganizo anu...' : '+ Create custom mood...'}
            </option>
          </select>
        ) : (
          <input
            type="text"
            maxLength={40}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={resolvedPlaceholder}
            className={
              className ||
              'flex-1 min-w-0 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]'
            }
          />
        )}

        <button
          type="button"
          onClick={() => {
            if (customMode) {
              setCustomMode(false);
            } else {
              setCustomMode(true);
              if (isInPresetList) {
                onChange('');
              }
            }
          }}
          className="px-3 py-2.5 rounded-xl bg-[var(--surface-2)] hover:border-[var(--border-strong)] border border-[var(--border)] text-[11px] font-bold text-[var(--text)] flex items-center gap-1 shrink-0 cursor-pointer transition"
          title={
            customMode
              ? isNy ? 'Sankhani pa zokonzedwa' : 'Pick from preset moods'
              : isNy ? 'Lembani maganizo anu' : 'Write your own custom mood'
          }
        >
          {customMode ? (
            <span>{isNy ? 'Zokonzedwa' : 'Presets'}</span>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{isNy ? 'Wanu' : 'Custom'}</span>
            </>
          )}
        </button>

        {allowSkip && (trimmed !== '' || customMode) && (
          <button
            type="button"
            onClick={() => {
              setCustomMode(false);
              onChange('');
            }}
            className="p-2.5 rounded-xl bg-[var(--surface-2)] hover:border-[var(--border-strong)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] shrink-0 cursor-pointer transition"
            title={isNy ? 'Dumphani maganizo (siyani mopanda kanthu)' : 'Skip mood (leave empty)'}
            aria-label={isNy ? 'Dumphani maganizo' : 'Skip mood'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {customMode && (
        <p className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[var(--accent-text)] shrink-0" />
          <span>
            {isNy
              ? 'Osakakamizidwa — siyani chopanda kanthu kapena dinani X ngati simukufuna kuika.'
              : 'Optional — leave blank or tap X if you prefer not to set a mood.'}
          </span>
        </p>
      )}
    </div>
  );
};
