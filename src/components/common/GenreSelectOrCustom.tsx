import { Plus, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CANONICAL_GENRES, subscribeToFirestoreGenres } from '../../services/genresService';
import { FirestoreGenre } from '../../types';

interface GenreSelectOrCustomProps {
  value: string;
  onChange: (genre: string) => void;
  onCustomGenreCreated?: (genreName: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
}

export const GenreSelectOrCustom: React.FC<GenreSelectOrCustomProps> = ({
  value,
  onChange,
  onCustomGenreCreated,
  className = '',
  placeholder = 'Type custom genre (e.g. Lake Lo-Fi, Gqom Chill)...',
}) => {
  const [liveGenres, setLiveGenres] = useState<FirestoreGenre[]>(
    CANONICAL_GENRES.map(g => ({ ...g, trackCount: 0 }))
  );
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    const unsub = subscribeToFirestoreGenres((genres) => {
      if (genres.length > 0) {
        setLiveGenres(genres);
      }
    });
    return () => unsub();
  }, []);

  const allOptions = Array.from(
    new Map(
      [
        ...liveGenres.map(g => [g.name.toLowerCase(), g.name] as const),
        ...CANONICAL_GENRES.map(g => [g.name.toLowerCase(), g.name] as const),
      ]
    ).values()
  );

  const isInPresetList = allOptions.some(
    g => g.toLowerCase() === (value || '').trim().toLowerCase()
  );

  useEffect(() => {
    if (value && !isInPresetList) {
      setCustomMode(true);
    }
  }, [value, isInPresetList]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {!customMode ? (
          <select
            value={isInPresetList ? value : allOptions[0] || ''}
            onChange={e => {
              if (e.target.value === '__CUSTOM__') {
                setCustomMode(true);
                onChange('');
              } else {
                onChange(e.target.value);
              }
            }}
            className={
              className ||
              'flex-1 px-3.5 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer'
            }
          >
            {allOptions.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="__CUSTOM__">+ Create Custom Genre...</option>
          </select>
        ) : (
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={() => {
              if (value.trim()) {
                onCustomGenreCreated?.(value.trim());
              }
            }}
            placeholder={placeholder}
            className={
              className ||
              'flex-1 px-3.5 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]'
            }
          />
        )}

        <button
          type="button"
          onClick={() => {
            if (customMode) {
              setCustomMode(false);
              if (!value.trim() && allOptions[0]) {
                onChange(allOptions[0]);
              }
            } else {
              setCustomMode(true);
              onChange('');
            }
          }}
          className="px-3 py-2.5 rounded-xl bg-[var(--surface-2)] hover:border-[var(--border-strong)] border border-[var(--border)] text-[11px] font-bold text-[var(--text)] flex items-center gap-1 shrink-0 cursor-pointer transition"
          title={customMode ? 'Choose from existing genres' : 'Create custom genre'}
        >
          {customMode ? (
            <span>List</span>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>Custom</span>
            </>
          )}
        </button>
      </div>

      {customMode && (
        <p className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[var(--accent-text)]" />
          <span>Custom genres are saved and grouped as listeners play your song.</span>
        </p>
      )}
    </div>
  );
};
