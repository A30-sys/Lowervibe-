import { Coffee, Pause, Play, X } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface ListeningBreakPromptProps {
  isOpen: boolean;
  elapsedSeconds: number;
  hasPlayerOffset: boolean;
  onTakeBreak: () => void;
  onContinueListening: () => void;
}

function formatDurationLabel(totalSeconds: number, isNy: boolean): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  if (isNy) {
    if (hours > 0) return `Maola ${hours}${mins > 0 ? ` ndi mphindi ${mins}` : ''}`;
    return `Mphindi ${mins}`;
  }
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  return `${mins}m`;
}

export const ListeningBreakPrompt: React.FC<ListeningBreakPromptProps> = ({
  isOpen,
  elapsedSeconds,
  hasPlayerOffset,
  onTakeBreak,
  onContinueListening,
}) => {
  const { language, t } = useLanguage();
  const isNy = language === 'ny';

  if (!isOpen) return null;

  const durationText = formatDurationLabel(elapsedSeconds, isNy);

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label={t('break_prompt_title', 'Time for a short break?')}
      className={`fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-[400px] z-50 rounded-2xl bg-[var(--surface)]/95 backdrop-blur-xl border border-[var(--border-strong)] shadow-[0_18px_44px_rgba(0,0,0,0.28)] overflow-hidden animate-slide-up transition-all duration-200 ${
        hasPlayerOffset
          ? 'bottom-[calc(154px+env(safe-area-inset-bottom,0px))] md:bottom-24'
          : 'bottom-[calc(76px+env(safe-area-inset-bottom,0px))] md:bottom-6'
      }`}
    >
      <div
        aria-hidden="true"
        className="h-[2px] w-full bg-gradient-to-r from-[var(--violet)] via-[var(--accent)] to-[var(--violet)]"
      />

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--violet)]/14 border border-[var(--violet)]/30 text-[var(--violet)] flex items-center justify-center shrink-0">
            <Coffee className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold font-mono tabular-nums text-[var(--accent-text)]">
                {t('listening_session_label', 'Listening wellness')} · {durationText}
              </span>
              <button
                type="button"
                onClick={onContinueListening}
                aria-label={t('close', 'Close')}
                className="min-h-[36px] min-w-[36px] -mr-1.5 -mt-1.5 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-sm font-bold text-[var(--text)] leading-snug mt-0.5">
              {t('break_prompt_title', 'Time for a short listening break')}
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-1">
              {t(
                'break_prompt_body',
                'You have been listening continuously for {duration}. Rest your ears for a few minutes and grab some water when you are ready.',
                { duration: durationText }
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={onTakeBreak}
            className="flex-1 min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs transition active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>{t('take_short_break', 'Take a break')}</span>
          </button>
          <button
            type="button"
            onClick={onContinueListening}
            className="flex-1 min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--surface-2)] hover:brightness-95 border border-[var(--border)] text-[var(--text)] font-semibold text-xs transition active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--violet)]"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{t('continue_listening_btn', 'Keep listening')}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
