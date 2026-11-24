import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Disc3,
  ListMusic,
  Megaphone,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { NotificationType } from '../../types';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { LowerVibeLogo } from '../brand/LowerVibeLogo';

export interface LowervibeBannerProps {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  artworkUrl?: string;
  actionLabel?: string;
  actionRoute?: string;
  dismissible?: boolean;
  tone?: 'light' | 'dark';
  category?: 'essential' | 'promotional';
  onAction?: () => void;
  onDismiss?: () => void;
  onNavigate?: (route: string) => void;
}

function getBannerVisuals(type: NotificationType) {
  switch (type) {
    case 'new_release':
      return {
        icon: Disc3,
        accentClass: 'text-[var(--accent-text)] bg-[var(--accent)]/15 border-[var(--accent)]/35',
        borderClass: 'border-[var(--accent)]/40',
        isEssential: false,
      };
    case 'artist_approved':
      return {
        icon: CheckCircle2,
        accentClass: 'text-[var(--accent-text)] bg-[var(--accent)]/15 border-[var(--accent)]/35',
        borderClass: 'border-[var(--accent)]/40',
        isEssential: true,
      };
    case 'artist_pending':
      return {
        icon: Clock,
        accentClass: 'text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/35',
        borderClass: 'border-amber-500/35',
        isEssential: true,
      };
    case 'artist_rejected':
      return {
        icon: AlertCircle,
        accentClass: 'text-[var(--danger)] bg-[var(--danger)]/15 border-[var(--danger)]/35',
        borderClass: 'border-[var(--danger)]/40',
        isEssential: true,
      };
    case 'new_follower':
      return {
        icon: UserPlus,
        accentClass: 'text-[var(--violet)] bg-[var(--violet)]/15 border-[var(--violet)]/35',
        borderClass: 'border-[var(--violet)]/35',
        isEssential: false,
      };
    case 'playlist_update':
      return {
        icon: ListMusic,
        accentClass: 'text-[var(--violet)] bg-[var(--violet)]/15 border-[var(--violet)]/35',
        borderClass: 'border-[var(--violet)]/35',
        isEssential: false,
      };
    case 'account_security':
      return {
        icon: ShieldAlert,
        accentClass: 'text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/35',
        borderClass: 'border-amber-500/45',
        isEssential: true,
      };
    case 'upload_completed':
      return {
        icon: UploadCloud,
        accentClass: 'text-[var(--accent-text)] bg-[var(--accent)]/15 border-[var(--accent)]/35',
        borderClass: 'border-[var(--accent)]/40',
        isEssential: true,
      };
    case 'upload_failed':
      return {
        icon: AlertTriangle,
        accentClass: 'text-[var(--danger)] bg-[var(--danger)]/15 border-[var(--danger)]/35',
        borderClass: 'border-[var(--danger)]/45',
        isEssential: true,
      };
    case 'maintenance':
      return {
        icon: Wrench,
        accentClass: 'text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/35',
        borderClass: 'border-amber-500/40',
        isEssential: true,
      };
    case 'new_feature':
      return {
        icon: Sparkles,
        accentClass: 'text-[var(--violet)] bg-[var(--violet)]/15 border-[var(--violet)]/35',
        borderClass: 'border-[var(--violet)]/40',
        isEssential: false,
      };
    case 'platform_announcement':
    case 'news':
    case 'system':
    case 'withdrawal_status':
    default:
      return {
        icon: Megaphone,
        accentClass: 'text-[var(--accent-text)] bg-[var(--accent)]/15 border-[var(--accent)]/35',
        borderClass: 'border-[var(--border-strong)]',
        isEssential: type === 'system' || type === 'withdrawal_status',
      };
  }
}

export const LowervibeBanner: React.FC<LowervibeBannerProps> = ({
  type,
  title,
  message,
  artworkUrl,
  actionLabel,
  actionRoute,
  dismissible = true,
  tone,
  category,
  onAction,
  onDismiss,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const visuals = getBannerVisuals(type);
  const Icon = visuals.icon;
  const isEssential = category ? category === 'essential' : visuals.isEssential;
  const isDarkSurface = tone === 'dark' || type === 'new_release' || type === 'new_feature';

  const handleAction = () => {
    if (onAction) {
      onAction();
      return;
    }
    if (actionRoute && onNavigate) {
      onNavigate(actionRoute);
    }
  };

  return (
    <aside
      role={isEssential ? 'alert' : 'region'}
      aria-label={title}
      className={`rounded-[20px] border px-4 py-3.5 shadow-sm transition-colors ${
        isDarkSurface
          ? 'lv-player-surface bg-[#131513] text-[#f4f5f3] border-[#2b302b]'
          : `bg-[var(--surface)] text-[var(--text)] ${visuals.borderClass}`
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt={title}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
              }}
              className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[var(--border)]"
            />
          ) : (
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${visuals.accentClass}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 opacity-90">
                <LowerVibeLogo size="sm" showTagline={false} />
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  isEssential
                    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                    : isDarkSurface
                    ? 'bg-[#c6ff3d]/15 text-[#c6ff3d] border border-[#c6ff3d]/30'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]'
                }`}
              >
                {isEssential
                  ? t('banner_essential_badge', 'Account Notice')
                  : t('banner_promo_badge', 'LOWERVIBE Update')}
              </span>
            </div>
            <h3 className={`text-sm font-bold leading-snug ${isDarkSurface ? 'text-[#f4f5f3]' : 'text-[var(--text)]'}`}>
              {title}
            </h3>
            <p className={`text-xs leading-relaxed ${isDarkSurface ? 'text-[#b5bbb4]' : 'text-[var(--text-muted)]'}`}>
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {(onAction || actionRoute) && (
            <button
              type="button"
              onClick={handleAction}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#c6ff3d] text-[#0b0d0b] text-xs font-bold hover:brightness-95 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              {type === 'upload_failed' && <RotateCcw className="w-3.5 h-3.5" />}
              <span>
                {actionLabel ||
                  (type === 'upload_failed'
                    ? t('banner_retry', 'Retry')
                    : t('open_arrow', 'Open →').replace(/\s*→$/, ''))}
              </span>
            </button>
          )}
          {dismissible && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t('banner_dismiss', 'Dismiss')}
              title={t('banner_dismiss', 'Dismiss')}
              className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center transition cursor-pointer ${
                isDarkSurface
                  ? 'border-[#2f342f] bg-[#1b1e1b] text-[#b5bbb4] hover:text-white'
                  : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
