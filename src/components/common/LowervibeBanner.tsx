import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
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
  compact?: boolean;
  onAction?: () => void;
  onDismiss?: () => void;
  onNavigate?: (route: string) => void;
}

interface BannerVisualConfig {
  icon: React.ComponentType<{ className?: string }>;
  eyebrowEn: string;
  eyebrowNy: string;
  iconBoxClass: string;
  eyebrowColorClass: string;
  borderClass: string;
  topLineClass: string;
  tintOverlay: string;
  ctaStyle: 'lime' | 'danger' | 'amber' | 'neutral';
  isEssential: boolean;
}

function getBannerVisuals(type: NotificationType, isDarkSurface: boolean): BannerVisualConfig {
  switch (type) {
    case 'new_release':
      return {
        icon: Disc3,
        eyebrowEn: 'New Release',
        eyebrowNy: 'Nyimbo Yatsopano',
        iconBoxClass: 'bg-[#c6ff3d]/14 text-[#c6ff3d] border-[#c6ff3d]/30',
        eyebrowColorClass: 'text-[#c6ff3d]',
        borderClass: 'border-[#2c312c]',
        topLineClass: 'bg-[#c6ff3d]/70',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(198,255,61,0.12), transparent 55%)',
        ctaStyle: 'lime',
        isEssential: false,
      };
    case 'artist_approved':
      return {
        icon: CheckCircle2,
        eyebrowEn: 'Artist Verified',
        eyebrowNy: 'Ojambula Avomerezedwa',
        iconBoxClass: isDarkSurface
          ? 'bg-[#c6ff3d]/15 text-[#c6ff3d] border-[#c6ff3d]/30'
          : 'bg-[#c6ff3d]/25 text-[#2a4900] border-[#2a4900]/20',
        eyebrowColorClass: isDarkSurface ? 'text-[#c6ff3d]' : 'text-[#2a4900]',
        borderClass: isDarkSurface ? 'border-[#c6ff3d]/30' : 'border-[#2a4900]/25',
        topLineClass: 'bg-[#c6ff3d]',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(198,255,61,0.11), transparent 52%)',
        ctaStyle: 'lime',
        isEssential: true,
      };
    case 'artist_pending':
      return {
        icon: Clock,
        eyebrowEn: 'Application Review',
        eyebrowNy: 'Kuwunikidwa kwa Pempho',
        iconBoxClass: 'bg-amber-500/14 text-amber-600 dark:text-amber-400 border-amber-500/30',
        eyebrowColorClass: 'text-amber-700 dark:text-amber-400',
        borderClass: 'border-amber-500/35',
        topLineClass: 'bg-amber-500/75',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(245,158,11,0.09), transparent 52%)',
        ctaStyle: 'amber',
        isEssential: true,
      };
    case 'artist_rejected':
      return {
        icon: AlertCircle,
        eyebrowEn: 'Application Update',
        eyebrowNy: 'Zotsatira za Pempho',
        iconBoxClass: 'bg-[var(--danger)]/14 text-[var(--danger)] border-[var(--danger)]/30',
        eyebrowColorClass: 'text-[var(--danger)]',
        borderClass: 'border-[var(--danger)]/35',
        topLineClass: 'bg-[var(--danger)]/80',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(220,38,38,0.09), transparent 52%)',
        ctaStyle: 'danger',
        isEssential: true,
      };
    case 'new_follower':
      return {
        icon: UserPlus,
        eyebrowEn: 'Community',
        eyebrowNy: 'Omvera Atsopano',
        iconBoxClass: 'bg-[var(--violet)]/14 text-[var(--violet)] border-[var(--violet)]/30',
        eyebrowColorClass: 'text-[var(--violet)]',
        borderClass: 'border-[var(--violet)]/30',
        topLineClass: 'bg-[var(--violet)]/75',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(139,110,255,0.10), transparent 52%)',
        ctaStyle: 'neutral',
        isEssential: false,
      };
    case 'playlist_update':
      return {
        icon: ListMusic,
        eyebrowEn: 'Playlist Update',
        eyebrowNy: 'Mndandanda Wasinthidwa',
        iconBoxClass: 'bg-[var(--violet)]/14 text-[var(--violet)] border-[var(--violet)]/30',
        eyebrowColorClass: 'text-[var(--violet)]',
        borderClass: 'border-[var(--violet)]/30',
        topLineClass: 'bg-[var(--violet)]/75',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(139,110,255,0.10), transparent 52%)',
        ctaStyle: 'neutral',
        isEssential: false,
      };
    case 'account_security':
      return {
        icon: ShieldAlert,
        eyebrowEn: 'Security Notice',
        eyebrowNy: 'Chitetezo cha Akaunti',
        iconBoxClass: 'bg-amber-500/14 text-amber-600 dark:text-amber-400 border-amber-500/35',
        eyebrowColorClass: 'text-amber-700 dark:text-amber-400',
        borderClass: 'border-amber-500/40',
        topLineClass: 'bg-amber-500/80',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(245,158,11,0.10), transparent 52%)',
        ctaStyle: 'amber',
        isEssential: true,
      };
    case 'upload_completed':
      return {
        icon: UploadCloud,
        eyebrowEn: 'Release Live',
        eyebrowNy: 'Nyimbo Yakwezedwa',
        iconBoxClass: isDarkSurface
          ? 'bg-[#c6ff3d]/15 text-[#c6ff3d] border-[#c6ff3d]/30'
          : 'bg-[#c6ff3d]/25 text-[#2a4900] border-[#2a4900]/20',
        eyebrowColorClass: isDarkSurface ? 'text-[#c6ff3d]' : 'text-[#2a4900]',
        borderClass: isDarkSurface ? 'border-[#c6ff3d]/30' : 'border-[#2a4900]/25',
        topLineClass: 'bg-[#c6ff3d]',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(198,255,61,0.11), transparent 52%)',
        ctaStyle: 'lime',
        isEssential: true,
      };
    case 'upload_failed':
      return {
        icon: AlertTriangle,
        eyebrowEn: 'Upload Interrupted',
        eyebrowNy: 'Kukweza Kwalephereka',
        iconBoxClass: 'bg-[var(--danger)]/14 text-[var(--danger)] border-[var(--danger)]/35',
        eyebrowColorClass: 'text-[var(--danger)]',
        borderClass: 'border-[var(--danger)]/40',
        topLineClass: 'bg-[var(--danger)]',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(220,38,38,0.10), transparent 52%)',
        ctaStyle: 'danger',
        isEssential: true,
      };
    case 'maintenance':
      return {
        icon: Wrench,
        eyebrowEn: 'Service Advisory',
        eyebrowNy: 'Chidziwitso cha Ntchito',
        iconBoxClass: 'bg-amber-500/14 text-amber-600 dark:text-amber-400 border-amber-500/35',
        eyebrowColorClass: 'text-amber-700 dark:text-amber-400',
        borderClass: 'border-amber-500/40',
        topLineClass: 'bg-amber-500/80',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(245,158,11,0.09), transparent 52%)',
        ctaStyle: 'amber',
        isEssential: true,
      };
    case 'new_feature':
      return {
        icon: Sparkles,
        eyebrowEn: 'Feature Update',
        eyebrowNy: 'Zatsopano pa LOWERVIBE',
        iconBoxClass: 'bg-[#8b6eff]/18 text-[#c4b5fd] border-[#8b6eff]/35',
        eyebrowColorClass: 'text-[#c6ff3d]',
        borderClass: 'border-[#2f2d3c]',
        topLineClass: 'bg-gradient-to-r from-[#c6ff3d] via-[#8b6eff] to-[#c6ff3d]',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(139,110,255,0.16), transparent 58%)',
        ctaStyle: 'lime',
        isEssential: false,
      };
    case 'platform_announcement':
    case 'news':
    case 'system':
    case 'withdrawal_status':
    default:
      return {
        icon: Megaphone,
        eyebrowEn: type === 'withdrawal_status' ? 'Payout Update' : 'Announcement',
        eyebrowNy: type === 'withdrawal_status' ? 'Za Malipiro' : 'Chidziwitso',
        iconBoxClass: isDarkSurface
          ? 'bg-[#c6ff3d]/15 text-[#c6ff3d] border-[#c6ff3d]/30'
          : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]',
        eyebrowColorClass: isDarkSurface ? 'text-[#c6ff3d]' : 'text-[var(--accent-text)]',
        borderClass: 'border-[var(--border-strong)]',
        topLineClass: 'bg-[var(--accent)]',
        tintOverlay: 'radial-gradient(circle at 0% 0%, rgba(198,255,61,0.07), transparent 50%)',
        ctaStyle: 'lime',
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
  compact = false,
  onAction,
  onDismiss,
  onNavigate,
}) => {
  const { language, t } = useLanguage();
  const isNy = language === 'ny';
  const isDarkSurface = tone === 'dark' || type === 'new_release' || type === 'new_feature';
  const visuals = getBannerVisuals(type, isDarkSurface);
  const Icon = visuals.icon;
  const isEssential = category ? category === 'essential' : visuals.isEssential;
  const eyebrowText = isNy ? visuals.eyebrowNy : visuals.eyebrowEn;

  const handleAction = () => {
    if (onAction) {
      onAction();
      return;
    }
    if (actionRoute && onNavigate) {
      onNavigate(actionRoute);
    }
  };

  const ctaButtonClass =
    visuals.ctaStyle === 'danger'
      ? 'bg-[var(--danger)] text-white hover:brightness-95'
      : visuals.ctaStyle === 'lime' || isDarkSurface
      ? 'bg-[#c6ff3d] text-[#0a0b0a] hover:brightness-95'
      : 'bg-[var(--text)] text-[var(--bg)] hover:opacity-90';

  return (
    <aside
      role={isEssential ? 'alert' : 'region'}
      aria-label={title}
      className={`relative overflow-hidden rounded-2xl border transition-all animate-slide-up ${
        isDarkSurface
          ? `lv-player-surface bg-[#131513] text-[#f4f5f3] ${visuals.borderClass} shadow-[0_12px_32px_rgba(0,0,0,0.34)]`
          : `bg-[var(--surface)] text-[var(--text)] ${visuals.borderClass} shadow-[0_4px_20px_rgba(11,13,11,0.06)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)]`
      }`}
    >
      {/* Subtle tonal depth + hairline top accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: visuals.tintOverlay }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] ${visuals.topLineClass}`}
      />

      <div
        className={`relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          compact ? 'px-3.5 py-2.5 sm:px-4 sm:py-3' : 'px-4 py-3.5 sm:px-5 sm:py-4 gap-3.5'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {artworkUrl ? (
            <div
              className={`relative rounded-xl overflow-hidden shrink-0 border border-white/15 shadow-sm bg-[#1b1e1b] ${
                compact ? 'w-10 h-10' : 'w-12 h-12'
              }`}
            >
              <img
                src={artworkUrl}
                alt={title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                }}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div
              className={`rounded-xl border flex items-center justify-center shrink-0 ${
                compact ? 'w-9 h-9' : 'w-11 h-11'
              } ${visuals.iconBoxClass}`}
            >
              <Icon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {/* Clean unboxed eyebrow metadata */}
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <div className="flex items-center gap-2 min-w-0 text-[11px] font-semibold">
                <span className="inline-flex items-center shrink-0 opacity-90">
                  <LowerVibeLogo size="sm" showTagline={false} />
                </span>
                <span
                  aria-hidden="true"
                  className={isDarkSurface ? 'text-white/30' : 'text-[var(--text-muted)]/60'}
                >
                  ·
                </span>
                <span className={`truncate ${visuals.eyebrowColorClass}`}>
                  {eyebrowText}
                </span>
              </div>

              {dismissible && onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label={t('banner_dismiss', 'Dismiss')}
                  title={t('banner_dismiss', 'Dismiss')}
                  className={`sm:hidden -mr-1.5 -mt-1 min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                    isDarkSurface
                      ? 'text-white/60 hover:text-white hover:bg-white/10'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <h3
              className={`font-bold leading-snug tracking-[-0.015em] ${
                compact ? 'text-[13.5px] line-clamp-1' : 'text-[15px]'
              } ${isDarkSurface ? 'text-[#f4f5f3]' : 'text-[var(--text)]'}`}
            >
              {title}
            </h3>
            <p
              className={`leading-relaxed mt-0.5 ${
                compact ? 'text-xs line-clamp-2' : 'text-[13px]'
              } ${isDarkSurface ? 'text-[#b5bbb4]' : 'text-[var(--text-muted)]'}`}
            >
              {message}
            </p>
          </div>
        </div>

        {(onAction || actionRoute || (dismissible && onDismiss)) && (
          <div className="flex items-center justify-end gap-2 shrink-0 sm:pl-2">
            {(onAction || actionRoute) && (
              <button
                type="button"
                onClick={handleAction}
                className={`min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${ctaButtonClass}`}
              >
                {type === 'upload_failed' && <RotateCcw className="w-3.5 h-3.5" />}
                <span>
                  {actionLabel ||
                    (type === 'upload_failed'
                      ? t('banner_retry', 'Retry')
                      : t('open_arrow', 'Open →').replace(/\s*→$/, ''))}
                </span>
                {type !== 'upload_failed' && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            )}

            {dismissible && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label={t('banner_dismiss', 'Dismiss')}
                title={t('banner_dismiss', 'Dismiss')}
                className={`hidden sm:flex min-h-[40px] min-w-[40px] rounded-xl border items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  isDarkSurface
                    ? 'border-white/15 bg-white/[0.06] text-white/70 hover:text-white hover:bg-white/12'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
