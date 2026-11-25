import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Disc3,
  Download,
  ListMusic,
  Megaphone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  User as UserIcon,
  UserPlus,
  Volume2,
  VolumeX,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { formatLocalizedRelativeTime, useLanguage } from '../../context/LanguageContext';
import { useNotifications } from '../../context/NotificationContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { NotificationItem } from '../../types';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { playNotificationSound, showDeviceNotification } from '../../utils/notificationSound';
import {
  CREATOR_PWA_INSTALLED_KEY,
  MAIN_PWA_INSTALLED_KEY,
  openPwaInstallPrompt,
} from '../../utils/pwaManifest';
import { LowerVibeLogo } from '../brand/LowerVibeLogo';

interface StickyHeaderProps {
  onOpenSearch?: () => void;
  onOpenAccount: () => void;
  onLogoClick: () => void;
}

export const StickyHeader: React.FC<StickyHeaderProps> = ({
  onOpenAccount,
  onLogoClick,
}) => {
  const { isPlaying } = useAudio();
  const { currentUser, isArtist, isAdmin, userSettings, updateUserSettings } = useAuth();
  const { language, t } = useLanguage();
  const {
    notifications,
    unreadCount,
    isNotificationRead,
    markAsRead,
    markAllAsRead,
    activePlatformBanners,
    refreshBanners,
    fcmStatus,
    hasVapidKey,
    enablePushNotifications,
  } = useNotifications();
  const { showToast } = useToast();
  const { currentRoute, navigate, searchParams } = useRouter();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'news'>('all');
  const [isMainPwaStandalone, setIsMainPwaStandalone] = useState(false);
  const [isCreatorPwaInstalled, setIsCreatorPwaInstalled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const notifContainerRef = useRef<HTMLDivElement>(null);

  const canInstallArtistApp = Boolean(
    currentUser &&
      (isArtist ||
        isAdmin ||
        currentUser.role === 'artist' ||
        currentUser.applicationStatus === 'approved')
  );
  const isCreatorStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true) &&
    searchParams.get('standalone') === 'artist';

  useEffect(() => {
    const syncInstalledState = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const creatorStandalone = standalone && searchParams.get('standalone') === 'artist';
      const mainStandalone = standalone && !creatorStandalone;
      setIsMainPwaStandalone(
        mainStandalone || localStorage.getItem(MAIN_PWA_INSTALLED_KEY) === 'true'
      );
      setIsCreatorPwaInstalled(
        creatorStandalone || localStorage.getItem(CREATOR_PWA_INSTALLED_KEY) === 'true'
      );
    };

    syncInstalledState();

    const handleInstalled = () => {
      syncInstalledState();
    };
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('lowervibe:pwa-installed', syncInstalledState);
    return () => {
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('lowervibe:pwa-installed', syncInstalledState);
    };
  }, [searchParams]);

  useEffect(() => {
    if (!isNotifOpen) return;
    void refreshBanners();
    const handleClickOutside = (e: MouseEvent) => {
      if (notifContainerRef.current && !notifContainerRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotifOpen, refreshBanners]);

  const isUpdateType = (type: NotificationItem['type']) =>
    type === 'new_release' ||
    type === 'news' ||
    type === 'system' ||
    type === 'withdrawal_status' ||
    type === 'platform_announcement' ||
    type === 'maintenance' ||
    type === 'new_feature' ||
    type === 'playlist_update' ||
    type === 'account_security' ||
    type === 'upload_completed' ||
    type === 'upload_failed';

  const updatesCount = notifications.filter((item) => isUpdateType(item.type)).length;

  const filteredNotifications = notifications.filter((item) => {
    if (notifFilter === 'unread') return !isNotificationRead(item);
    if (notifFilter === 'news') {
      return isUpdateType(item.type);
    }
    return true;
  });

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!isNotificationRead(item)) {
      await markAsRead(item.id);
    }
    if (item.actionRoute) {
      navigate(item.actionRoute);
      setIsNotifOpen(false);
    }
  };

  const getNotificationActionLabel = (item: NotificationItem): string => {
    if (item.actionLabel && item.actionLabel.trim()) return item.actionLabel;
    if (item.actionRoute?.startsWith('/artistcreator') || item.actionRoute?.startsWith('/studio')) {
      return t('open_artist_creator', 'Open Artist Creator →').replace(/\s*→$/, '');
    }
    if (item.actionRoute?.startsWith('/artists')) {
      return t('view_artist', 'View Artist →').replace(/\s*→$/, '');
    }
    return t('open_arrow', 'Open →').replace(/\s*→$/, '');
  };

  const renderNotifIcon = (item: NotificationItem) => {
    if (item.artworkUrl) {
      return (
        <img
          src={item.artworkUrl}
          alt={item.title}
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
          }}
          className="w-10 h-10 rounded-xl object-cover border border-[var(--border)] shrink-0 shadow-xs"
        />
      );
    }
    switch (item.type) {
      case 'new_release':
        return (
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 text-[var(--accent-text)] border border-[var(--accent)]/35 flex items-center justify-center shrink-0">
            <Disc3 className="w-4 h-4" />
          </div>
        );
      case 'artist_approved':
        return (
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 text-[var(--accent-text)] border border-[var(--accent)]/35 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case 'artist_pending':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/35 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        );
      case 'artist_rejected':
        return (
          <div className="w-10 h-10 rounded-xl bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/35 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
        );
      case 'new_follower':
        return (
          <div className="w-10 h-10 rounded-xl bg-[var(--violet)]/15 text-[var(--violet)] border border-[var(--violet)]/35 flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4" />
          </div>
        );
      case 'playlist_update':
        return (
          <div className="w-10 h-10 rounded-xl bg-[var(--violet)]/15 text-[var(--violet)] border border-[var(--violet)]/35 flex items-center justify-center shrink-0">
            <ListMusic className="w-4 h-4" />
          </div>
        );
      case 'upload_completed':
        return (
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 text-[var(--accent-text)] border border-[var(--accent)]/35 flex items-center justify-center shrink-0">
            <UploadCloud className="w-4 h-4" />
          </div>
        );
      case 'upload_failed':
        return (
          <div className="w-10 h-10 rounded-xl bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/35 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        );
      case 'account_security':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/35 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
        );
      case 'maintenance':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/35 flex items-center justify-center shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
        );
      case 'new_feature':
        return (
          <div className="w-10 h-10 rounded-xl bg-[var(--violet)]/15 text-[var(--violet)] border border-[var(--violet)]/35 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
        );
      case 'withdrawal_status':
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/35 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
        );
      case 'system':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
        );
      case 'platform_announcement':
      case 'news':
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-[var(--violet)]/15 text-[var(--violet)] border border-[var(--violet)]/35 flex items-center justify-center shrink-0">
            <Megaphone className="w-4 h-4" />
          </div>
        );
    }
  };

  const desktopLinks = [
    { label: t('home', 'Home'), path: '/', active: currentRoute.route === 'home' },
    {
      label: t('search', 'Search'),
      path: '/search',
      active: currentRoute.route === 'search' || currentRoute.route === 'discover',
    },
    { label: t('library', 'Library'), path: '/library', active: currentRoute.route === 'library' },
    {
      label: t('artist_creator', 'Artist Creator'),
      path: '/artistcreator',
      active: currentRoute.route === 'studio',
    },
    { label: t('profile', 'Profile'), path: '/account', active: currentRoute.route === 'account' },
  ];

  const totalBadgeCount = unreadCount + (unreadCount === 0 && activePlatformBanners.length > 0 ? 0 : 0);

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--bg)]/[0.97] pt-[env(safe-area-inset-top,0px)] border-b border-[var(--border)] transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand Logo only */}
        <div className="flex items-center gap-4 shrink-0">
          <LowerVibeLogo size="md" isPlaying={isPlaying} showTagline={false} onClick={onLogoClick} />
        </div>

        {/* Center (Desktop md+): Clean navigation links */}
        <nav
          className="hidden md:flex items-center gap-1 bg-[var(--surface)] p-1 rounded-2xl border border-[var(--border)]"
          aria-label="Main navigation"
        >
          {desktopLinks.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => navigate(link.path)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer min-h-[40px] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                link.active
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
              }`}
              aria-current={link.active ? 'page' : undefined}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right: Install App / Creator App + Notification Bell + Avatar */}
        <div className="flex items-center gap-2">
          {canInstallArtistApp && !isCreatorStandalone && !isCreatorPwaInstalled ? (
            <button
              type="button"
              onClick={() => openPwaInstallPrompt('creator')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 rounded-2xl bg-[var(--surface)] text-[var(--accent-text)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all active:scale-95 min-h-[44px] sm:min-h-[48px] cursor-pointer text-xs font-bold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              title={t('creator_app', 'Creator App')}
              aria-label={t('creator_app', 'Creator App')}
            >
              <Download className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">{t('creator_app', 'Creator App')}</span>
            </button>
          ) : (
            !isMainPwaStandalone && (
              <button
                type="button"
                onClick={() => openPwaInstallPrompt('main')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 rounded-2xl bg-[var(--surface)] text-[var(--accent-text)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all active:scale-95 min-h-[44px] sm:min-h-[48px] cursor-pointer text-xs font-bold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                title={t('install_app', 'Install App')}
                aria-label={t('install_app', 'Install App')}
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline">{t('install_app', 'Install App')}</span>
              </button>
            )
          )}

          {/* Notifications Bell + Adaptive Responsive Notification Drawer */}
          <div className="relative" ref={notifContainerRef}>
            <button
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              className={`relative rounded-2xl border transition-all active:scale-95 min-h-[46px] min-w-[46px] sm:min-h-[48px] sm:min-w-[48px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                isNotifOpen
                  ? 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--violet)] shadow-sm'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)]'
              }`}
              title={t('notifications', 'Notifications')}
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={isNotifOpen}
              aria-haspopup="dialog"
            >
              <Bell className="w-4 h-4" />
              {totalBadgeCount > 0 ? (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-[10px] font-bold font-mono tabular-nums flex items-center justify-center shadow-xs">
                  {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
                </span>
              ) : (
                activePlatformBanners.length > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--violet)]"
                  />
                )
              )}
            </button>

            {isNotifOpen && (
              <>
                {/* Backdrop scrim on mobile */}
                <div
                  className="fixed inset-0 bg-black/55 backdrop-blur-[2px] sm:hidden z-40 animate-fadeIn"
                  onClick={() => setIsNotifOpen(false)}
                  aria-hidden="true"
                />

                <div
                  role="dialog"
                  aria-label={t('notifications', 'Notifications')}
                  className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:absolute sm:right-0 sm:top-14 sm:w-[432px] rounded-t-[28px] sm:rounded-[24px] bg-[var(--surface)] border-t sm:border border-[var(--border-strong)] shadow-[0_24px_60px_rgba(0,0,0,0.42)] overflow-hidden z-50 animate-player-pop-up sm:animate-slide-up flex flex-col max-h-[84dvh] sm:max-h-[580px] pb-[env(safe-area-inset-bottom,0px)] sm:pb-0"
                >
                  {/* Top hairline accent + mobile drag handle */}
                  <div
                    aria-hidden="true"
                    className="h-[2px] w-full bg-gradient-to-r from-[var(--violet)] via-[var(--accent)] to-[var(--violet)] shrink-0"
                  />
                  <div className="sm:hidden pt-2 pb-0.5 flex justify-center shrink-0">
                    <span className="w-10 h-1 rounded-full bg-[var(--border-strong)]" />
                  </div>

                  {/* Panel Header */}
                  <div className="px-4 py-3 sm:py-3.5 border-b border-[var(--border)] flex items-center justify-between gap-2 shrink-0">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-extrabold text-[var(--text)] font-heading tracking-tight">
                        {t('notifications', 'Notifications')}
                      </h3>
                      <p className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] mt-0.5">
                        {unreadCount > 0
                          ? t('unread_count', '{count} unread', { count: unreadCount })
                          : t('all_caught_up', 'All caught up')}{' '}
                        · {t('total_count', '{count} total', { count: notifications.length })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          const next = userSettings.notifications.soundEnabled === false;
                          await updateUserSettings({ notifications: { soundEnabled: next } });
                          if (next) void playNotificationSound('artist');
                        }}
                        className="min-w-[40px] min-h-[40px] rounded-xl bg-[var(--surface-2)] hover:border-[var(--border-strong)] border border-[var(--border)] flex items-center justify-center transition cursor-pointer text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        title={
                          userSettings.notifications.soundEnabled === false
                            ? 'Notification sound muted — click to enable'
                            : 'Notification sound active'
                        }
                        aria-label="Toggle notification sound"
                      >
                        {userSettings.notifications.soundEnabled === false ? (
                          <VolumeX className="w-4 h-4 text-[var(--text-muted)]" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-[var(--accent-text)]" />
                        )}
                      </button>

                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-xl bg-[var(--surface-2)] hover:border-[var(--border-strong)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text)] transition cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          <CheckCheck className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                          <span>{t('mark_all_read', 'Mark all read')}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsNotifOpen(false)}
                        className="min-w-[40px] min-h-[40px] rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        aria-label={t('close', 'Close')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* OS & FCM Lock-Screen Push Prompt Bar */}
                  {(notifPermission === 'default' ||
                    (notifPermission === 'granted' &&
                      hasVapidKey &&
                      Boolean(currentUser) &&
                      fcmStatus !== 'registered')) && (
                    <div className="px-4 py-2.5 bg-[var(--accent)]/10 border-b border-[var(--border)] flex items-center justify-between gap-2.5 text-xs shrink-0">
                      <span className="text-[var(--text)] font-medium leading-snug">
                        {notifPermission === 'granted'
                          ? t('fcm_push_title', 'Connect lock-screen push alerts for closed-app releases')
                          : t(
                              'enable_alerts_banner',
                              'Enable device sound & OS alerts for releases & admin updates'
                            )}
                      </span>
                      <button
                        type="button"
                        disabled={fcmStatus === 'registering'}
                        onClick={async () => {
                          try {
                            const perm =
                              notifPermission === 'granted'
                                ? 'granted'
                                : await Notification.requestPermission();
                            setNotifPermission(perm);
                            if (perm === 'granted') {
                              await updateUserSettings({
                                notifications: {
                                  newReleasesPush: true,
                                  payoutUpdatesPush: true,
                                  productNewsPush: true,
                                  soundEnabled: true,
                                },
                              });
                              if (currentUser && hasVapidKey) {
                                const res = await enablePushNotifications();
                                if (res.ok) {
                                  showToast(t('fcm_push_active', 'Lock-screen alerts active'), 'success');
                                } else if (res.error) {
                                  showToast(res.error, 'info');
                                }
                              }
                              void playNotificationSound('artist');
                              void showDeviceNotification({
                                title: 'LOWERVIBE alerts enabled',
                                body: 'You will get sound & device alerts for new music releases and updates.',
                                url: '/discover',
                                tag: 'lv-alerts-enabled',
                              });
                            }
                          } catch {}
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold cursor-pointer shrink-0 min-h-[38px] text-xs whitespace-nowrap disabled:opacity-60"
                      >
                        {fcmStatus === 'registering'
                          ? t('fcm_push_syncing', 'Connecting...')
                          : t('enable', 'Enable')}
                      </button>
                    </div>
                  )}

                  {/* Interactive Filter Bar */}
                  <div
                    role="tablist"
                    aria-label="Notification filter"
                    className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/45 grid grid-cols-3 gap-1.5 shrink-0"
                  >
                    {[
                      {
                        id: 'all' as const,
                        label: t('notif_tab_all', 'All'),
                        count: notifications.length,
                      },
                      {
                        id: 'unread' as const,
                        label: t('notif_tab_unread', 'Unread'),
                        count: unreadCount,
                      },
                      {
                        id: 'news' as const,
                        label: t('notif_tab_updates', 'Updates'),
                        count: updatesCount,
                      },
                    ].map((tab) => {
                      const active = notifFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setNotifFilter(tab.id)}
                          className={`min-h-[40px] px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                            active
                              ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold shadow-xs'
                              : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span className="font-mono text-[10px] tabular-nums opacity-85">
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Scrollable Notification & Active Platform Alerts Body */}
                  <div className="flex-1 overflow-y-auto overscroll-contain">
                    {/* Active Platform Alert Banners Section (syncs seamlessly across Browser & installed WebApp) */}
                    {activePlatformBanners.length > 0 && (
                      <div className="px-3.5 pt-3 pb-2.5 border-b border-[var(--border)] bg-[var(--surface-2)]/25 space-y-2">
                        <div className="flex items-center justify-between px-0.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            {t('active_alerts', 'Active platform alerts')}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-[var(--accent-text)] font-bold">
                            {activePlatformBanners.length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {activePlatformBanners.slice(0, 3).map((banner) => (
                            <div
                              key={banner.id}
                              className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] flex items-start gap-2.5 shadow-xs"
                            >
                              {banner.artworkUrl ? (
                                <img
                                  src={banner.artworkUrl}
                                  alt={banner.title}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                                  }}
                                  className="w-9 h-9 rounded-xl object-cover border border-[var(--border)] shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 text-[var(--accent-text)] border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                                  <Megaphone className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-[var(--text)] leading-snug line-clamp-1">
                                  {banner.title}
                                </p>
                                <p className="text-[11.5px] text-[var(--text-muted)] leading-snug line-clamp-2 mt-0.5">
                                  {banner.message}
                                </p>
                                {(banner.actionRoute || banner.onAction) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (banner.onAction) {
                                        banner.onAction();
                                      } else if (banner.actionRoute) {
                                        navigate(banner.actionRoute);
                                      }
                                      setIsNotifOpen(false);
                                    }}
                                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent-text)] hover:underline cursor-pointer"
                                  >
                                    <span>{banner.actionLabel || t('open_arrow', 'Open →').replace(/\s*→$/, '')}</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Personal & Broadcast Notification Feed */}
                    {filteredNotifications.length === 0 ? (
                      <div className="px-6 py-10 text-center space-y-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
                          <Bell className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-bold text-[var(--text)]">
                          {notifFilter === 'unread'
                            ? t('no_unread_notifs', 'No unread notifications')
                            : notifFilter === 'news'
                            ? t('no_updates_yet', 'No updates yet')
                            : t('no_notifs_yet', 'No notifications yet')}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
                          {notifFilter === 'unread'
                            ? t(
                                'no_unread_desc',
                                'You have read all incoming creator and account activity.'
                              )
                            : t(
                                'no_notifs_desc',
                                'Studio approvals, upload updates, and releases appear here.'
                              )}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 space-y-1.5">
                        {filteredNotifications.map((item) => {
                          const read = isNotificationRead(item);
                          return (
                            <div
                              key={item.id}
                              className={`group rounded-2xl border transition-all duration-150 ${
                                !read
                                  ? 'bg-[var(--surface-2)]/70 border-[var(--border-strong)] shadow-xs'
                                  : 'bg-transparent border-transparent hover:bg-[var(--surface-2)]/40 hover:border-[var(--border)]'
                              }`}
                            >
                              <div className="p-3 flex items-start gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleNotificationClick(item)}
                                  className="flex-1 min-w-0 flex items-start gap-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-xl"
                                >
                                  {renderNotifIcon(item)}
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <span
                                        className={`text-[13px] leading-snug line-clamp-1 ${
                                          read
                                            ? 'font-semibold text-[var(--text-dim)]'
                                            : 'font-bold text-[var(--text)]'
                                        }`}
                                      >
                                        {item.title}
                                      </span>
                                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                        <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
                                          {formatLocalizedRelativeTime(item.createdAt, language)}
                                        </span>
                                        {!read && (
                                          <span
                                            className="w-2 h-2 rounded-full bg-[var(--accent)]"
                                            aria-label={t('notif_tab_unread', 'Unread')}
                                          />
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3">
                                      {item.message}
                                    </p>
                                  </div>
                                </button>
                              </div>

                              {(item.actionRoute || !read) && (
                                <div className="px-3 pb-2.5 pl-[64px] flex items-center justify-between gap-2">
                                  {item.actionRoute ? (
                                    <button
                                      type="button"
                                      onClick={() => handleNotificationClick(item)}
                                      className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[var(--accent-text)] hover:underline cursor-pointer min-h-[30px]"
                                    >
                                      <span>{getNotificationActionLabel(item)}</span>
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  ) : (
                                    <span />
                                  )}

                                  {!read && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void markAsRead(item.id);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg)] border border-[var(--border)] text-[10.5px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer"
                                    >
                                      <Check className="w-3 h-3 text-[var(--accent-text)]" />
                                      <span>{t('mark_read', 'Mark read')}</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profile Avatar Button */}
          <button
            type="button"
            onClick={onOpenAccount}
            className="flex items-center gap-2 p-1.5 pr-2 sm:pr-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all active:scale-95 min-h-[46px] sm:min-h-[48px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            title={currentUser ? `${currentUser.name}` : t('sign_in', 'Sign in')}
            aria-label={t('profile', 'Profile')}
          >
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-[var(--border)]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--violet)]/15 text-[var(--violet)] flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
            <span className="hidden sm:inline text-xs font-semibold text-[var(--text)] max-w-[100px] truncate">
              {currentUser ? currentUser.name : t('sign_in', 'Sign in')}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
