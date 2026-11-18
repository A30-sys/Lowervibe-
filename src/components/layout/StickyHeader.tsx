import {
  AlertCircle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Download,
  Megaphone,
  ShieldCheck,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNotifications } from '../../context/NotificationContext';
import { useRouter } from '../../context/RouterContext';
import { PRIMARY_ADMIN_EMAIL } from '../../services/authService';
import { NotificationItem } from '../../types';
import { LowerVibeLogo } from '../brand/LowerVibeLogo';

interface StickyHeaderProps {
  onOpenSearch?: () => void;
  onOpenAccount: () => void;
  onLogoClick: () => void;
}

function formatRelativeTime(isoDate: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(isoDate).toLocaleDateString();
}

export const StickyHeader: React.FC<StickyHeaderProps> = ({
  onOpenAccount,
  onLogoClick,
}) => {
  const { isPlaying } = useAudio();
  const { currentUser, isArtist, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { notifications, unreadCount, isNotificationRead, markAsRead, markAllAsRead } = useNotifications();
  const { currentRoute, navigate } = useRouter();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'news'>('all');
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  const isOwnerAdmin = currentUser?.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL;
  const canInstallArtistApp = Boolean(
    currentUser &&
      (isArtist ||
        isAdmin ||
        currentUser.role === 'artist' ||
        currentUser.applicationStatus === 'approved')
  );

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      localStorage.getItem('lowervibe_pwa_installed') === 'true';
    setIsPwaInstalled(standalone);

    const handleInstalled = () => setIsPwaInstalled(true);
    window.addEventListener('appinstalled', handleInstalled);
    return () => window.removeEventListener('appinstalled', handleInstalled);
  }, []);

  useEffect(() => {
    if (!isNotifOpen) return;
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
  }, [isNotifOpen]);

  const updatesCount = notifications.filter(
    (item) =>
      item.type === 'news' ||
      item.type === 'system' ||
      item.type === 'withdrawal_status'
  ).length;

  const filteredNotifications = notifications.filter((item) => {
    if (notifFilter === 'unread') return !isNotificationRead(item);
    if (notifFilter === 'news') {
      return (
        item.type === 'news' ||
        item.type === 'system' ||
        item.type === 'withdrawal_status'
      );
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

  const renderNotifIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'artist_approved':
        return (
          <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 text-[var(--accent-text)] border border-[var(--accent)]/35 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case 'artist_rejected':
        return (
          <div className="w-9 h-9 rounded-xl bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/35 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
        );
      case 'withdrawal_status':
        return (
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/35 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
        );
      case 'system':
        return (
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
        );
      case 'news':
      default:
        return (
          <div className="w-9 h-9 rounded-xl bg-[var(--violet)]/15 text-[var(--violet)] border border-[var(--violet)]/35 flex items-center justify-center shrink-0">
            <Megaphone className="w-4 h-4" />
          </div>
        );
    }
  };

  const desktopLinks = [
    { label: t('home', 'Home'), path: '/', active: currentRoute.route === 'home' },
    { label: t('search', 'Search'), path: '/search', active: currentRoute.route === 'search' || currentRoute.route === 'discover' },
    { label: t('library', 'Library'), path: '/library', active: currentRoute.route === 'library' },
    { label: t('upload', 'Upload'), path: '/studio', active: currentRoute.route === 'studio' },
    { label: t('profile', 'Profile'), path: '/account', active: currentRoute.route === 'account' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[var(--bg)]/90 border-b border-[var(--border)] transition-colors duration-200">
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
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer min-h-[40px] ${
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

        {/* Right: Install Artist App + Admin + Notification Bell + Avatar */}
        <div className="flex items-center gap-2">
          {!isPwaInstalled && canInstallArtistApp && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('lowervibe:open-install-prompt'))}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 rounded-2xl bg-[var(--surface)] text-[var(--accent-text)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all active:scale-95 min-h-[44px] sm:min-h-[48px] cursor-pointer text-xs font-bold"
              title="Install LOWERVIBE Artist WebApp (Android & iPhone)"
              aria-label="Install Artist WebApp"
            >
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">Artist App</span>
            </button>
          )}

          {/* Owner-only Admin Shortcut */}
          {isOwnerAdmin && (
            <button
              type="button"
              onClick={() => navigate('/administration')}
              className="hidden sm:flex items-center gap-1.5 px-3 rounded-2xl bg-[var(--surface)] text-[var(--accent-text)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all active:scale-95 min-h-[48px] cursor-pointer text-xs font-bold"
              title="Open Standalone Administration Portal"
              aria-label="Administration Portal"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden lg:inline">Admin</span>
            </button>
          )}

          {/* Notifications Bell + Rebuilt Panel */}
          <div className="relative" ref={notifContainerRef}>
            <button
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              className={`relative rounded-2xl border transition-all active:scale-95 min-h-[48px] min-w-[48px] flex items-center justify-center cursor-pointer ${
                isNotifOpen
                  ? 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--violet)]'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)]'
              }`}
              title="Notifications"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={isNotifOpen}
              aria-haspopup="dialog"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-[10px] font-bold font-mono tabular-nums flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <>
                {/* Mobile backdrop scrim */}
                <div
                  className="fixed inset-0 top-16 bg-black/45 backdrop-blur-[1px] sm:hidden z-40"
                  onClick={() => setIsNotifOpen(false)}
                  aria-hidden="true"
                />

                <div
                  role="dialog"
                  aria-label="Notifications"
                  className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-[74px] sm:top-14 sm:w-[400px] rounded-[24px] bg-[var(--surface)] border border-[var(--border-strong)] shadow-2xl overflow-hidden z-50 animate-slideUp flex flex-col max-h-[calc(100vh-110px)] sm:max-h-[520px]"
                >
                  {/* Panel Header */}
                  <div className="px-4 py-3.5 border-b border-[var(--border)] flex items-center justify-between gap-2 shrink-0">
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-[var(--text)] font-heading tracking-tight">
                        Notifications
                      </h3>
                      <p className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} · {notifications.length} total
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-xl bg-[var(--surface-2)] hover:border-[var(--border-strong)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text)] transition cursor-pointer whitespace-nowrap"
                        >
                          <CheckCheck className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                          <span>Mark all read</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsNotifOpen(false)}
                        className="min-w-[40px] min-h-[40px] rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center justify-center transition cursor-pointer"
                        aria-label="Close notifications"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Interactive Filter Bar */}
                  <div
                    role="tablist"
                    aria-label="Notification filter"
                    className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/40 grid grid-cols-3 gap-1.5 shrink-0"
                  >
                    {[
                      { id: 'all' as const, label: 'All', count: notifications.length },
                      { id: 'unread' as const, label: 'Unread', count: unreadCount },
                      { id: 'news' as const, label: 'Updates', count: updatesCount },
                    ].map((tab) => {
                      const active = notifFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setNotifFilter(tab.id)}
                          className={`min-h-[38px] px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                            active
                              ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold shadow-xs'
                              : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span className="font-mono text-[10px] tabular-nums opacity-80">
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Notification List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                    {filteredNotifications.length === 0 ? (
                      <div className="p-8 text-center space-y-2">
                        <div className="w-11 h-11 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
                          <Bell className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-bold text-[var(--text)]">
                          {notifFilter === 'unread'
                            ? 'No unread notifications'
                            : notifFilter === 'news'
                            ? 'No updates yet'
                            : 'No notifications yet'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
                          {notifFilter === 'unread'
                            ? 'You have read all incoming creator and account activity.'
                            : 'Studio approvals, upload updates, and releases appear here.'}
                        </p>
                      </div>
                    ) : (
                      filteredNotifications.map((item) => {
                        const read = isNotificationRead(item);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleNotificationClick(item)}
                            className={`w-full px-4 py-3.5 text-left flex items-start gap-3 transition-colors hover:bg-[var(--surface-2)]/70 cursor-pointer min-h-[56px] ${
                              !read ? 'bg-[var(--surface-2)]/35' : ''
                            }`}
                          >
                            {renderNotifIcon(item.type)}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className={`text-xs leading-snug line-clamp-1 ${
                                    read
                                      ? 'font-semibold text-[var(--text-dim)]'
                                      : 'font-bold text-[var(--text)]'
                                  }`}
                                >
                                  {item.title}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                  <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
                                    {formatRelativeTime(item.createdAt)}
                                  </span>
                                  {!read && (
                                    <span
                                      className="w-2 h-2 rounded-full bg-[var(--accent)]"
                                      aria-label="Unread"
                                    />
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3">
                                {item.message}
                              </p>
                              {item.actionRoute && (
                                <span className="inline-block text-[11px] font-semibold text-[var(--accent-text)] pt-0.5">
                                  {item.actionRoute === '/studio'
                                    ? 'Open Studio →'
                                    : item.actionRoute.startsWith('/artists')
                                    ? 'View Artist →'
                                    : 'Open →'}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
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
            className="flex items-center gap-2 p-1.5 pr-2 sm:pr-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all active:scale-95 min-h-[48px] cursor-pointer"
            title={currentUser ? `${currentUser.name}` : 'Sign in'}
            aria-label="Open profile"
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
              {currentUser ? currentUser.name : 'Sign in'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
