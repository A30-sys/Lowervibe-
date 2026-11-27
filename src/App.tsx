import { CheckCircle2, Download, FileText, Lock } from 'lucide-react';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AdminAccessDeniedView } from './components/admin/AdminAccessDeniedView';
import { AdminLoginView } from './components/admin/AdminLoginView';
import { ArtistProfileModal } from './components/ArtistProfileModal';
import { ReauthModal } from './components/auth/ReauthModal';
import { AuthModal } from './components/AuthModal';
import { CelebrationModal } from './components/CelebrationModal';
import { CookieBanner } from './components/common/CookieBanner';
import { ListeningBreakPrompt } from './components/common/ListeningBreakPrompt';
import { LowervibeBanner } from './components/common/LowervibeBanner';
import { PullToRefresh } from './components/common/PullToRefresh';
import { StickyMobileCta } from './components/common/StickyMobileCta';
import { CrashRecoveryHandler } from './components/CrashRecoveryHandler';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirstTimeTourModal } from './components/FirstTimeTourModal';
import { InitialLoader, LowerVibeWaveLoader } from './components/InitialLoader';
import { LegalModals } from './components/LegalModals';
import { OfflineBanner } from './components/OfflineBanner';
import { OnboardingModal } from './components/OnboardingModal';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { PromoSharePayload, ShareModal } from './components/ShareModal';
import { TrackDetailDrawer } from './components/TrackDetailDrawer';
import { BottomTabBar, MainTabType } from './components/layout/BottomTabBar';
import { Footer } from './components/layout/Footer';
import { StickyHeader } from './components/layout/StickyHeader';
import { BottomPlayer } from './components/player/BottomPlayer';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { AuthPortalView } from './components/views/AuthPortalView';
import { HomeView } from './components/views/HomeView';
import { AudioProvider, useAudio } from './context/AudioContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { OfflineQueueProvider } from './context/OfflineQueueContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import {
  getCookieConsent,
  initFirebaseAnalytics,
  trackPageView,
} from './services/analyticsService';
import { isVerifiedAdminGoogleSession, PRIMARY_ADMIN_EMAIL } from './services/authService';
import { Track } from './types';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { usePinnedPlayerSession } from './utils/playerSessionStore';
import { setActivePwaManifest } from './utils/pwaManifest';
import { applyArtistSeoMeta, applyRouteSeoMeta, applyTrackSeoMeta } from './utils/seoMeta';

const AdminPortal = lazyWithRetry(() => import('./components/AdminPortal').then((m) => ({ default: m.AdminPortal })));
const StudioView = lazyWithRetry(() => import('./components/views/StudioView').then((m) => ({ default: m.StudioView })));
const LegalPageView = lazyWithRetry(() => import('./components/views/LegalPageView').then((m) => ({ default: m.LegalPageView })));
const ArtistPublicPageView = lazyWithRetry(() =>
  import('./components/views/ArtistPublicPageView').then((m) => ({ default: m.ArtistPublicPageView }))
);
const TrackPublicPageView = lazyWithRetry(() =>
  import('./components/views/TrackPublicPageView').then((m) => ({ default: m.TrackPublicPageView }))
);
const AccountView = lazyWithRetry(() => import('./components/views/AccountView').then((m) => ({ default: m.AccountView })));
const DiscoverView = lazyWithRetry(() => import('./components/views/DiscoverView').then((m) => ({ default: m.DiscoverView })));
const LibraryView = lazyWithRetry(() => import('./components/views/LibraryView').then((m) => ({ default: m.LibraryView })));
const ArtistsRosterView = lazyWithRetry(() => import('./components/views/ArtistsRosterView').then((m) => ({ default: m.ArtistsRosterView })));
const SearchResultsView = lazyWithRetry(() => import('./components/views/SearchResultsView').then((m) => ({ default: m.SearchResultsView })));
const ThankYouView = lazyWithRetry(() => import('./components/views/ThankYouView').then((m) => ({ default: m.ThankYouView })));
const NotFoundView = lazyWithRetry(() => import('./components/views/NotFoundView').then((m) => ({ default: m.NotFoundView })));
const ServerErrorView = lazyWithRetry(() => import('./components/views/ServerErrorView').then((m) => ({ default: m.ServerErrorView })));
const FullscreenPlayerModal = lazyWithRetry(() =>
  import('./components/FullscreenPlayerModal').then((m) => ({ default: m.FullscreenPlayerModal }))
);
const ChartsPromoView = lazyWithRetry(() =>
  import('./components/views/ChartsPromoView').then((m) => ({ default: m.ChartsPromoView }))
);

const PageLoader: React.FC = () => (
  <div className="py-12 flex items-center justify-center">
    <LowerVibeWaveLoader />
  </div>
);

function AppContent() {
  const { currentRoute, navigate, searchParams } = useRouter();
  const { language, t } = useLanguage();
  const { visibleBanners, dismissBanner } = useNotifications();
  const { showToast } = useToast();
  const isNy = language === 'ny';
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [tourDismissedInSession, setTourDismissedInSession] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [standaloneGateBypassed, setStandaloneGateBypassed] = useState(false);
  const [isScrolledPastBannerSlot, setIsScrolledPastBannerSlot] = useState(false);
  const [activeSharePromo, setActiveSharePromo] = useState<PromoSharePayload | null>(null);
  const standaloneInitialRoutedRef = useRef(false);

  // Continuous listening break timer (soft prompt after 2 hours = 7200s of active playback)
  const CONTINUOUS_BREAK_INTERVAL_SECONDS = 7200;
  const PAUSE_RESET_THRESHOLD_MS = 10 * 60 * 1000;
  const [continuousPlaySeconds, setContinuousPlaySeconds] = useState(0);
  const [nextBreakPromptAt, setNextBreakPromptAt] = useState(CONTINUOUS_BREAK_INTERVAL_SECONDS);
  const [isBreakPromptOpen, setIsBreakPromptOpen] = useState(false);
  const lastPausedAtRef = useRef<number | null>(null);

  const {
    tracks,
    artists,
    currentTrack,
    isPlaying,
    playbackState,
    isMiniPlayerVisible,
    activeShareTrack,
    setActiveShareTrack,
    activeShareArtist,
    setActiveShareArtist,
    activeDetailTrack,
    setActiveDetailTrack,
    selectedArtistModal,
    setSelectedArtistModal,
    isAuthModalOpen,
    closeAuthModal,
    authModalTab,
    openLegalModal,
    activeDownload,
    activeBatchDownload,
    dismissAllModals,
    setIsFullscreenPlayerOpen,
    clearActiveTrack,
    togglePlayPause,
  } = useAudio();

  const pinnedSession = usePinnedPlayerSession();
  const activeSessionTrack = currentTrack || (pinnedSession.pinned ? pinnedSession.track : null);
  const isBottomPlayerActive = Boolean(
    activeSessionTrack &&
      (isPlaying || isMiniPlayerVisible || pinnedSession.pinned || playbackState !== 'idle')
  );

  const [isPlayerMounted, setIsPlayerMounted] = useState(isBottomPlayerActive);
  const [isPlayerExiting, setIsPlayerExiting] = useState(false);
  const lastPlayerTrackRef = useRef<Track | null>(activeSessionTrack);
  const playerExitTimerRef = useRef<number | null>(null);
  const artistsRef = useRef(artists);
  const tracksRef = useRef(tracks);
  const currentTrackRef = useRef(activeSessionTrack);

  artistsRef.current = artists;
  tracksRef.current = tracks;
  currentTrackRef.current = activeSessionTrack;

  useEffect(() => {
    if (activeSessionTrack) {
      lastPlayerTrackRef.current = activeSessionTrack;
    }
  }, [activeSessionTrack]);

  useEffect(() => {
    if (isBottomPlayerActive) {
      if (playerExitTimerRef.current) {
        window.clearTimeout(playerExitTimerRef.current);
        playerExitTimerRef.current = null;
      }
      setIsPlayerExiting(false);
      setIsPlayerMounted(true);
    } else if (isPlayerMounted && !isPlayerExiting) {
      setIsPlayerExiting(true);
      playerExitTimerRef.current = window.setTimeout(() => {
        setIsPlayerMounted(false);
        setIsPlayerExiting(false);
        playerExitTimerRef.current = null;
      }, 240);
    }
  }, [isBottomPlayerActive, isPlayerMounted, isPlayerExiting]);

  useEffect(() => {
    return () => {
      if (playerExitTimerRef.current) {
        window.clearTimeout(playerExitTimerRef.current);
      }
    };
  }, []);

  const handleCloseBottomPlayer = useCallback(() => {
    if (playerExitTimerRef.current) {
      window.clearTimeout(playerExitTimerRef.current);
    }
    setIsPlayerExiting(true);
    clearActiveTrack();
    playerExitTimerRef.current = window.setTimeout(() => {
      setIsPlayerMounted(false);
      setIsPlayerExiting(false);
      playerExitTimerRef.current = null;
    }, 240);
  }, [clearActiveTrack]);

  const handleOpenFullscreenPlayer = useCallback(() => {
    setIsFullscreenPlayerOpen(true);
  }, [setIsFullscreenPlayerOpen]);

  const continuousPlaySecondsRef = useRef(0);
  continuousPlaySecondsRef.current = continuousPlaySeconds;

  // Track continuous listening duration and show soft break prompt at 2 hours (7,200 seconds)
  useEffect(() => {
    if (!isPlaying) {
      if (lastPausedAtRef.current === null && continuousPlaySecondsRef.current > 0) {
        lastPausedAtRef.current = Date.now();
      }
      return;
    }

    // If the listener rested (paused for >= 10 minutes), start a fresh continuous streak
    if (
      lastPausedAtRef.current !== null &&
      Date.now() - lastPausedAtRef.current >= PAUSE_RESET_THRESHOLD_MS
    ) {
      setContinuousPlaySeconds(0);
      setNextBreakPromptAt(CONTINUOUS_BREAK_INTERVAL_SECONDS);
    }
    lastPausedAtRef.current = null;

    const intervalId = window.setInterval(() => {
      setContinuousPlaySeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isPlaying, PAUSE_RESET_THRESHOLD_MS, CONTINUOUS_BREAK_INTERVAL_SECONDS]);

  useEffect(() => {
    if (continuousPlaySeconds >= nextBreakPromptAt && !isBreakPromptOpen) {
      setIsBreakPromptOpen(true);
    }
  }, [continuousPlaySeconds, nextBreakPromptAt, isBreakPromptOpen]);

  const handleTakeListeningBreak = useCallback(() => {
    setIsBreakPromptOpen(false);
    setContinuousPlaySeconds(0);
    setNextBreakPromptAt(CONTINUOUS_BREAK_INTERVAL_SECONDS);
    lastPausedAtRef.current = null;
    if (isPlaying) {
      togglePlayPause();
    }
    showToast(t('break_taken_toast', 'Playback paused — enjoy a short break.'), 'info');
  }, [isPlaying, togglePlayPause, showToast, t, CONTINUOUS_BREAK_INTERVAL_SECONDS]);

  const handleContinueListening = useCallback(() => {
    setIsBreakPromptOpen(false);
    setNextBreakPromptAt(continuousPlaySeconds + CONTINUOUS_BREAK_INTERVAL_SECONDS);
  }, [continuousPlaySeconds, CONTINUOUS_BREAK_INTERVAL_SECONDS]);

  // Track scroll position so newly arrived or essential banners remain reachable in both Browser and installed WebApp
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolledPastBannerSlot(window.scrollY > 140);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const {
    currentUser,
    isArtist,
    isAdmin,
    isGuestMode,
    needTermsUpdateAck,
    acceptLatestTerms,
    authReady,
    authModalOpen,
    authPromptReason,
    closeAuthGateModal,
  } = useAuth();

  const isApprovedArtistAccount = Boolean(
    currentUser &&
      (isArtist ||
        isAdmin ||
        currentUser.role === 'artist' ||
        currentUser.applicationStatus === 'approved')
  );

  const isStandaloneArtistApp = Boolean(
    !standaloneGateBypassed && searchParams.get('standalone') === 'artist'
  );

  // Dynamically bind the installable PWA manifest: LOWERVIBE Main App for listeners, LOWERVIBE Creator inside Studio for approved artists
  useEffect(() => {
    setActivePwaManifest(
      currentRoute.route === 'studio' && isApprovedArtistAccount ? 'creator' : 'main'
    );
  }, [currentRoute.route, isApprovedArtistAccount]);

  // Prompt incomplete Google / Phone / legacy accounts to pick gender, age, genres & artists before entering
  useEffect(() => {
    if (!authReady || !currentUser || isAdmin) {
      setIsOnboardingOpen(false);
      return;
    }
    let locallyDone = false;
    try {
      locallyDone = localStorage.getItem(`lowervibe_onboarded_${currentUser.id}`) === 'true';
    } catch {}
    const needsSetup =
      !currentUser.onboarded &&
      !locallyDone &&
      (!currentUser.gender || !currentUser.age || !(currentUser.preferredGenres?.length));
    if (needsSetup) {
      setIsOnboardingOpen(true);
    } else {
      setIsOnboardingOpen(false);
    }
  }, [
    authReady,
    currentUser?.id,
    currentUser?.onboarded,
    currentUser?.gender,
    currentUser?.age,
    currentUser?.preferredGenres?.length,
    isAdmin,
  ]);

  // Keep URLs canonical: /studio -> /artistcreator, short links / ?track= / ?artist= -> /tracks/:id or /artists/:slug, and /admin -> /administrationside
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';
    const searchStr = window.location.search || '';
    const params = new URLSearchParams(searchStr);
    const legacyTrack = params.get('track')?.trim();
    if (legacyTrack && (rawPath === '/' || rawPath === '/home')) {
      navigate(`/tracks/${encodeURIComponent(legacyTrack)}`, { replace: true });
      return;
    }
    const legacyArtist = params.get('artist')?.trim();
    if (legacyArtist && (rawPath === '/' || rawPath === '/home')) {
      navigate(`/artists/${encodeURIComponent(legacyArtist)}`, { replace: true });
      return;
    }
    const shortTrackMatch = rawPath.match(/^\/(?:s|song)\/([^/]+)$/);
    if (shortTrackMatch) {
      navigate(`/tracks/${encodeURIComponent(decodeURIComponent(shortTrackMatch[1]))}${searchStr}`, {
        replace: true,
      });
      return;
    }
    const shortArtistMatch = rawPath.match(/^\/(?:a|artist)\/([^/]+)$/);
    if (shortArtistMatch) {
      navigate(`/artists/${encodeURIComponent(decodeURIComponent(shortArtistMatch[1]))}${searchStr}`, {
        replace: true,
      });
      return;
    }
    if (rawPath === '/studio') {
      navigate(`/artistcreator${searchStr}`, { replace: true });
      return;
    }
    if (
      rawPath === '/administration' ||
      rawPath === '/administration/dashboard' ||
      rawPath === '/admin' ||
      rawPath === '/admin/dashboard'
    ) {
      navigate(`/administrationside${searchStr}`, { replace: true });
      return;
    }
    if (rawPath === '/administration/login' || rawPath === '/admin/login') {
      navigate(`/administrationside/login${searchStr}`, { replace: true });
      return;
    }
    if (rawPath === '/administration/access-denied' || rawPath === '/admin/access-denied') {
      navigate(`/administrationside/access-denied${searchStr}`, { replace: true });
    }
  }, [currentRoute.pathname, navigate]);

  // Handle service worker notificationclick navigation messages seamlessly in-app
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | undefined;
      if (data?.type === 'LOWERVIBE_NAVIGATE' && typeof data.url === 'string' && data.url) {
        dismissAllModals();
        navigate(data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [navigate, dismissAllModals]);

  // When an approved artist launches the standalone WebApp, open straight into Artist Creator
  useEffect(() => {
    if (!authReady || !currentUser || !isApprovedArtistAccount || !isStandaloneArtistApp) return;
    if (standaloneInitialRoutedRef.current) return;
    standaloneInitialRoutedRef.current = true;
    if (currentRoute.route === 'home') {
      navigate('/artistcreator?standalone=artist', { replace: true });
    }
  }, [authReady, currentUser, isApprovedArtistAccount, isStandaloneArtistApp, currentRoute.route, navigate]);

  // Deny browser / webapp pinch, wheel, and keyboard zoom everywhere
  useEffect(() => {
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const preventKeyboardZoom = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) {
        e.preventDefault();
      }
    };

    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    const preventMultiTouchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', preventWheelZoom, { passive: false });
    window.addEventListener('keydown', preventKeyboardZoom, { passive: false });
    window.addEventListener('gesturestart', preventGesture, { passive: false });
    window.addEventListener('gesturechange', preventGesture, { passive: false });
    window.addEventListener('gestureend', preventGesture, { passive: false });
    document.addEventListener('touchmove', preventMultiTouchZoom, { passive: false });

    return () => {
      window.removeEventListener('wheel', preventWheelZoom);
      window.removeEventListener('keydown', preventKeyboardZoom);
      window.removeEventListener('gesturestart', preventGesture);
      window.removeEventListener('gesturechange', preventGesture);
      window.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('touchmove', preventMultiTouchZoom);
    };
  }, []);

  // Keyboard shortcut: Cmd+K, Ctrl+K, or / opens quick search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Capture runtime errors into a bounded local buffer for Admin System Health inspection
  useEffect(() => {
    const pushRuntimeError = (message: string, source: string) => {
      try {
        const key = 'lowervibe_runtime_errors_v1';
        const raw = localStorage.getItem(key);
        const existing = raw ? JSON.parse(raw) : [];
        const next = [
          {
            id: `err-${Date.now()}`,
            message: message.slice(0, 240),
            source,
            at: new Date().toISOString(),
          },
          ...(Array.isArray(existing) ? existing : []),
        ].slice(0, 20);
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
    };

    const onError = (event: ErrorEvent) => {
      if (event?.message) pushRuntimeError(event.message, event.filename || 'window.error');
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event?.reason instanceof Error
          ? event.reason.message
          : typeof event?.reason === 'string'
          ? event.reason
          : 'Unhandled promise rejection';
      pushRuntimeError(reason, 'unhandledrejection');
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  // Initialize analytics when cookie consent permits
  useEffect(() => {
    if (getCookieConsent() !== 'essential') {
      void initFirebaseAnalytics();
    }
  }, []);

  // Sync per-route <title>, <meta description>, canonical, OG tags, JSON-LD, and analytics page_view
  useEffect(() => {
    if (currentRoute.route === 'artist_detail') {
      const slugParam = (currentRoute.params.slug || '').toLowerCase();
      const matchedArtist = artists.find(
        (a) =>
          (a.slug && a.slug.toLowerCase() === slugParam) ||
          a.id.toLowerCase() === slugParam ||
          (a.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') === slugParam
      );
      if (matchedArtist) {
        const artistNameLower = (matchedArtist.name || '').toLowerCase();
        const artistTracksCount = tracks.filter(
          (t) =>
            !t.isDraft &&
            !t.isDeranked &&
            (t.artistId === matchedArtist.id ||
              (t.artistName || '').toLowerCase() === artistNameLower)
        ).length;
        applyArtistSeoMeta(matchedArtist, artistTracksCount);
        trackPageView(
          currentRoute.pathname,
          typeof document !== 'undefined' ? document.title : 'LOWERVIBE'
        );
      }
      return;
    }

    if (currentRoute.route === 'track_detail') {
      const trackIdParam = currentRoute.params.id || '';
      const matchedTrack = tracks.find(
        (t) => t.id === trackIdParam && !t.isDraft && !t.isDeranked
      );
      if (matchedTrack) {
        const matchedArtist = artists.find((a) => a.id === matchedTrack.artistId);
        applyTrackSeoMeta(matchedTrack, matchedArtist);
        trackPageView(
          currentRoute.pathname,
          typeof document !== 'undefined' ? document.title : 'LOWERVIBE'
        );
      }
      return;
    }

    applyRouteSeoMeta(currentRoute.route, currentRoute.searchQuery);
    trackPageView(currentRoute.pathname, typeof document !== 'undefined' ? document.title : 'LOWERVIBE');
  }, [
    currentRoute.route,
    currentRoute.pathname,
    currentRoute.searchQuery,
    currentRoute.params.slug,
    currentRoute.params.id,
    artists,
    tracks,
  ]);

  const handleSelectArtist = useCallback(
    (artistId: string) => {
      const artist = artistsRef.current.find((a) => a.id === artistId);
      if (artist) {
        navigate(`/artists/${artist.slug || artist.id}`);
      } else if (artistId) {
        navigate(`/artists/${artistId}`);
      }
    },
    [navigate]
  );

  const handleOpenTrackDetails = useCallback(
    (track?: Track) => {
      if (track) {
        navigate(`/tracks/${track.id}`);
      } else if (currentTrackRef.current) {
        navigate(`/tracks/${currentTrackRef.current.id}`);
      } else if (tracksRef.current.length > 0) {
        navigate(`/tracks/${tracksRef.current[0].id}`);
      }
    },
    [navigate]
  );

  const handleOpenCurrentTrackDetails = useCallback(() => {
    handleOpenTrackDetails();
  }, [handleOpenTrackDetails]);

  if (!authReady) {
    return null;
  }

  const isLegalDocRoute =
    currentRoute.route === 'terms' ||
    currentRoute.route === 'privacy' ||
    currentRoute.route === 'copyright' ||
    currentRoute.route === 'about';
  const isSignedOutThankYouRoute =
    currentRoute.route === 'thank_you' && !currentUser && !isGuestMode;
  const isMinimalPublicRoute = isLegalDocRoute || isSignedOutThankYouRoute;

  // Dedicated Standalone Administration Side (/administrationside, /administrationside/login, /administrationside/access-denied)
  if (currentRoute.route === 'admin_login') {
    return <AdminLoginView />;
  }
  if (currentRoute.route === 'admin_access_denied') {
    return <AdminAccessDeniedView />;
  }
  if (currentRoute.route === 'admin' || currentRoute.route === 'admin_dashboard') {
    if (
      currentUser?.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL &&
      isVerifiedAdminGoogleSession()
    ) {
      return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-8 max-w-6xl mx-auto">
          <Suspense fallback={<PageLoader />}>
            <AdminPortal onBackToExplore={() => navigate('/')} />
          </Suspense>
        </div>
      );
    }
    if (!currentUser) {
      return <AdminLoginView />;
    }
    return <AdminAccessDeniedView />;
  }

  // Public exploration & listening works immediately without forcing login;
  // private account/library/creator pages & explicit auth routes render AuthPortalView when signed out.
  const requiresSignedInView =
    currentRoute.route === 'library' ||
    currentRoute.route === 'studio' ||
    currentRoute.route === 'account';

  if (
    (!currentUser && !isGuestMode && requiresSignedInView) ||
    currentRoute.route === 'login' ||
    currentRoute.route === 'register' ||
    currentRoute.route === 'forgot_password'
  ) {
    const initialMode =
      currentRoute.route === 'register'
        ? 'register'
        : currentRoute.route === 'forgot_password'
        ? 'forgot_password'
        : 'login';

    return (
      <AuthPortalView
        initialMode={initialMode}
        onSuccess={() => {
          if (
            currentRoute.route === 'login' ||
            currentRoute.route === 'register' ||
            currentRoute.route === 'forgot_password'
          ) {
            navigate('/');
          }
        }}
      />
    );
  }

  // Standalone LOWERVIBE Artist WebApp gate: only approved registered artists can access standalone mode
  if (isStandaloneArtistApp && currentUser && !isApprovedArtistAccount) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-[28px] bg-[var(--surface)] border border-[var(--border-strong)] p-7 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--violet)]">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-extrabold font-heading text-[var(--text)]">
              {isNy ? 'Oimba Ovomerezeka Okha' : 'Approved Artists Only'}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              {isNy
                ? 'Pulogalamu ya LOWERVIBE Artist imatseguka yokha pempho lanu la woimba likavomerezedwa. Tumizani kapena yang\'anani pempho lanu kaye.'
                : 'The standalone LOWERVIBE Artist WebApp unlocks automatically after your artist registration is approved. Submit or check your artist application first.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => {
                setStandaloneGateBypassed(true);
                navigate('/artistcreator');
              }}
              className="flex-1 py-3 px-4 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs cursor-pointer"
            >
              {currentUser.applicationStatus === 'pending'
                ? isNy
                  ? 'Onani Pempho Lanu'
                  : 'View Approval Status'
                : isNy
                ? 'Lembani Ngati Woimba'
                : 'Register as Artist'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStandaloneGateBypassed(true);
                navigate('/');
              }}
              className="flex-1 py-3 px-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-semibold text-xs cursor-pointer"
            >
              {isNy ? 'Pitirizani Kumvera' : 'Continue Listening'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeTab: MainTabType = (() => {
    switch (currentRoute.route) {
      case 'home':
      case 'charts':
        return 'home';
      case 'search':
      case 'discover':
      case 'artists':
      case 'artist_detail':
        return 'search';
      case 'library':
        return 'library';
      case 'studio':
        return 'upload';
      case 'account':
        return 'profile';
      default:
        return 'home';
    }
  })();

  const handleSelectTab = (tab: MainTabType) => {
    if (tab === 'admin') {
      if (
        currentUser?.email?.toLowerCase() !== PRIMARY_ADMIN_EMAIL ||
        !isVerifiedAdminGoogleSession()
      ) {
        navigate('/administrationside/access-denied');
        return;
      }
      navigate('/administrationside');
      return;
    }

    dismissAllModals();
    setIsPageTransitioning(true);

    if (tab === 'home') navigate('/');
    else if (tab === 'search' || tab === 'discover') navigate('/search');
    else if (tab === 'library') navigate('/library');
    else if (tab === 'upload' || tab === 'studio') navigate('/artistcreator');
    else if (tab === 'profile' || tab === 'account') navigate('/account');

    setTimeout(() => setIsPageTransitioning(false), 160);
  };

  const handleSelectCategory = (category: string) => {
    navigate(`/discover?genre=${encodeURIComponent(category)}`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-sans transition-colors duration-200 selection:bg-[var(--accent)]/30 overflow-x-hidden">
      {isMinimalPublicRoute ? (
        <main
          className={`flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-6 ${
            isPlayerMounted && !isPlayerExiting ? 'pb-36' : 'pb-16'
          }`}
        >
          {isLegalDocRoute ? (
            <Suspense fallback={<PageLoader />}>
              <LegalPageView docType={currentRoute.route as 'terms' | 'privacy' | 'copyright' | 'about'} />
            </Suspense>
          ) : (
            <Suspense fallback={<PageLoader />}>
              <ThankYouView />
            </Suspense>
          )}
        </main>
      ) : (
        <>
          {/* Subtle route progress bar */}
          <div
            className={`fixed top-0 left-0 right-0 h-0.5 z-50 pointer-events-none transition-all duration-200 ease-out transform-gpu ${
              isPageTransitioning
                ? 'opacity-100 bg-gradient-to-r from-[var(--violet)] via-[var(--accent)] to-[var(--violet)] scale-x-100 origin-left'
                : 'opacity-0 scale-x-0 origin-left'
            }`}
          />

          <StickyHeader
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenAccount={() => handleSelectTab('profile')}
            onLogoClick={() => navigate('/')}
          />

          <OfflineBanner />

          {/* Floating alert banner dock when user is scrolled past top banner slot (works identically in Browser & installed WebApp) */}
          {isScrolledPastBannerSlot && visibleBanners.length > 0 && (
            <div className="sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-30 px-3 sm:px-6 pt-2 pointer-events-none">
              <div className="max-w-5xl mx-auto pointer-events-auto">
                <LowervibeBanner
                  key={`floating-${visibleBanners[0].id}`}
                  id={visibleBanners[0].id}
                  type={visibleBanners[0].type}
                  title={visibleBanners[0].title}
                  message={visibleBanners[0].message}
                  artworkUrl={visibleBanners[0].artworkUrl}
                  actionLabel={visibleBanners[0].actionLabel}
                  actionRoute={visibleBanners[0].actionRoute}
                  dismissible={visibleBanners[0].dismissible}
                  tone={visibleBanners[0].tone}
                  category={visibleBanners[0].category}
                  compact
                  onAction={visibleBanners[0].onAction}
                  onDismiss={() => dismissBanner(visibleBanners[0].id)}
                  onNavigate={navigate}
                />
              </div>
            </div>
          )}

          {/* Standalone Artist WebApp quick switcher (Studio / Artist Page / Withdrawals) */}
          {isStandaloneArtistApp && isApprovedArtistAccount && (
            <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2">
              <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[var(--accent-text)] tracking-tight text-xs">
                  LOWERVIBE Creator
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => navigate('/artistcreator?standalone=artist')}
                    className={`px-3 py-1 rounded-full font-semibold cursor-pointer ${
                      currentRoute.route === 'studio' && searchParams.get('tab') !== 'withdrawals'
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                        : 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]'
                    }`}
                  >
                    {t('artist_creator', 'Artist Creator')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = currentUser?.artistId;
                      if (targetId) navigate(`/artists/${targetId}?standalone=artist`);
                      else navigate('/artistcreator?standalone=artist');
                    }}
                    className={`px-3 py-1 rounded-full font-semibold cursor-pointer ${
                      currentRoute.route === 'artist_detail'
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                        : 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]'
                    }`}
                  >
                    {isNy ? 'Tsamba Langa la Woimba' : 'My Artist Page'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/artistcreator?standalone=artist&tab=withdrawals')}
                    className={`px-3 py-1 rounded-full font-semibold cursor-pointer ${
                      currentRoute.route === 'studio' && searchParams.get('tab') === 'withdrawals'
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                        : 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]'
                    }`}
                  >
                    {t('studio_tab_withdrawals', 'Withdrawals')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Terms update acknowledgment banner */}
          {currentUser && needTermsUpdateAck && (
            <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2.5">
              <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-[var(--text)]">
                  <FileText className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                  <span>
                    {isNy ? 'Takonza ' : 'We updated our '}
                    <button
                      type="button"
                      onClick={() => navigate('/terms')}
                      className="underline font-semibold hover:text-[var(--accent-text)] cursor-pointer"
                    >
                      {t('footer_terms', 'Terms of Service')}
                    </button>{' '}
                    {isNy ? 'ndi ' : 'and '}
                    <button
                      type="button"
                      onClick={() => navigate('/privacy')}
                      className="underline font-semibold hover:text-[var(--accent-text)] cursor-pointer"
                    >
                      {t('footer_privacy', 'Privacy Policy')}
                    </button>
                    .
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => acceptLatestTerms()}
                  className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs cursor-pointer"
                >
                  {isNy ? 'Vomerezani' : 'Accept'}
                </button>
              </div>
            </div>
          )}

          {/* Main Content Container with interactive Pull-to-Refresh + dynamic Mini-Player clearance */}
          <PullToRefresh
            disabled={
              isOnboardingOpen ||
              isSearchOpen ||
              isAuthModalOpen ||
              authModalOpen ||
              Boolean(
                activeDetailTrack ||
                  activeShareTrack ||
                  activeShareArtist ||
                  activeSharePromo ||
                  selectedArtistModal
              )
            }
          >
            <main
              className={`flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 mb-0 transition-[padding] duration-200 ${
                isPlayerMounted && !isPlayerExiting ? 'pb-40 md:pb-28' : 'pb-20 md:pb-0'
              }`}
            >
              {visibleBanners.length > 0 && (
                <div className="space-y-3 mb-5">
                  {visibleBanners.map((banner) => (
                    <LowervibeBanner
                      key={banner.id}
                      id={banner.id}
                      type={banner.type}
                      title={banner.title}
                      message={banner.message}
                      artworkUrl={banner.artworkUrl}
                      actionLabel={banner.actionLabel}
                      actionRoute={banner.actionRoute}
                      dismissible={banner.dismissible}
                      tone={banner.tone}
                      category={banner.category}
                      onAction={banner.onAction}
                      onDismiss={() => dismissBanner(banner.id)}
                      onNavigate={navigate}
                    />
                  ))}
                </div>
              )}

              <div key={currentRoute.pathname} className="animate-fadeIn">
                <Suspense fallback={<PageLoader />}>
                  {currentRoute.route === 'home' && (
                    <HomeView
                      onSelectArtist={handleSelectArtist}
                      onOpenTrackDetails={handleOpenTrackDetails}
                      onOpenLegal={openLegalModal}
                      onOpenStudio={() => handleSelectTab('upload')}
                      onSelectCategory={handleSelectCategory}
                    />
                  )}

                  {currentRoute.route === 'discover' && (
                    <DiscoverView
                      onSelectArtist={handleSelectArtist}
                      onOpenTrackDetails={handleOpenTrackDetails}
                    />
                  )}

                  {currentRoute.route === 'artists' && <ArtistsRosterView />}

                  {currentRoute.route === 'artist_detail' && <ArtistPublicPageView />}

                  {currentRoute.route === 'track_detail' && <TrackPublicPageView />}

                  {currentRoute.route === 'library' && (
                    <LibraryView onOpenTrackDetails={handleOpenTrackDetails} />
                  )}

                  {currentRoute.route === 'studio' && (
                    <StudioView onOpenTrackDetails={handleOpenTrackDetails} />
                  )}

                  {currentRoute.route === 'account' && <AccountView />}

                  {currentRoute.route === 'search' && (
                    <SearchResultsView onOpenTrackDetails={handleOpenTrackDetails} />
                  )}

                  {currentRoute.route === 'charts' && (
                    <ChartsPromoView
                      onOpenTrackDetails={handleOpenTrackDetails}
                      onSharePromo={setActiveSharePromo}
                    />
                  )}

                  {currentRoute.route === 'thank_you' && <ThankYouView />}

                  {currentRoute.route === 'not_found' && <NotFoundView />}

                  {currentRoute.route === 'server_error' && <ServerErrorView />}
                </Suspense>
              </div>

              <Footer onOpenLegal={openLegalModal} onNavigate={navigate} />
            </main>
          </PullToRefresh>

          <BottomTabBar activeTab={activeTab} onSelectTab={handleSelectTab} />

          <StickyMobileCta isPlayerVisible={isPlayerMounted && !isPlayerExiting} />
        </>
      )}

      {isPlayerMounted && (
        <BottomPlayer
          key="pinned-bottom-player"
          onOpenDetails={handleOpenCurrentTrackDetails}
          onOpenArtist={handleSelectArtist}
          onOpenFullscreen={handleOpenFullscreenPlayer}
          onClosePlayer={handleCloseBottomPlayer}
          isExiting={isPlayerExiting}
          fallbackTrack={lastPlayerTrackRef.current}
        />
      )}

      <CookieBanner hasPlayerOffset={isPlayerMounted && !isPlayerExiting} />

      <ListeningBreakPrompt
        isOpen={isBreakPromptOpen}
        elapsedSeconds={continuousPlaySeconds}
        hasPlayerOffset={isPlayerMounted && !isPlayerExiting}
        onTakeBreak={handleTakeListeningBreak}
        onContinueListening={handleContinueListening}
      />

      {/* Active Offline Save Progress Toast (Single or Batch Playlist/Catalog Sync) */}
      {(activeBatchDownload || activeDownload) && (
        <div
          className={`fixed right-4 sm:right-6 z-50 flex flex-col gap-2 transition-all duration-200 ${
            isPlayerMounted && !isPlayerExiting
              ? 'bottom-[calc(154px+env(safe-area-inset-bottom,0px))] md:bottom-24'
              : 'bottom-[calc(76px+env(safe-area-inset-bottom,0px))] md:bottom-6'
          }`}
        >
          {activeBatchDownload && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] shadow-2xl animate-slideUp max-w-[300px]">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shrink-0">
                {activeBatchDownload.isComplete ? (
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--text)] truncate">
                    {activeBatchDownload.label}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[var(--accent-text)] tabular-nums shrink-0">
                    {activeBatchDownload.completed}/{activeBatchDownload.total}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] truncate">
                  {activeBatchDownload.isComplete
                    ? activeBatchDownload.failed > 0
                      ? `${activeBatchDownload.completed - activeBatchDownload.failed} saved · ${activeBatchDownload.failed} failed`
                      : t('playlist_saved_offline', 'Saved offline')
                    : activeBatchDownload.currentTrackTitle}
                </div>
                <div className="w-full bg-[var(--surface-2)] rounded-full h-1 mt-1.5 overflow-hidden">
                  <div
                    className="bg-[var(--accent)] h-1 rounded-full transition-all duration-200"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (activeBatchDownload.completed /
                            Math.max(1, activeBatchDownload.total)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeDownload && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] shadow-2xl animate-slideUp">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shrink-0">
                {activeDownload.isComplete ? (
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text)] truncate max-w-[160px]">
                    {activeDownload.trackTitle}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[var(--accent-text)] tabular-nums">
                    {activeDownload.isComplete ? t('saved', 'Saved') : `${activeDownload.progress}%`}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[180px]">
                  {activeDownload.isComplete
                    ? isNy
                      ? 'Yakonzeka kumvera popanda intaneti'
                      : 'Ready for offline listening'
                    : isNy
                    ? 'Ikusunga nyimbo popanda intaneti...'
                    : 'Saving track for offline play...'}
                </div>
                <div className="w-full bg-[var(--surface-2)] rounded-full h-1 mt-1.5 overflow-hidden">
                  <div
                    className="bg-[var(--accent)] h-1 rounded-full transition-all duration-200"
                    style={{ width: `${activeDownload.progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectArtistProfile={handleSelectArtist}
      />

      <ArtistProfileModal
        artist={selectedArtistModal}
        onClose={() => setSelectedArtistModal(null)}
      />

      <TrackDetailDrawer
        track={activeDetailTrack}
        onClose={() => setActiveDetailTrack(null)}
      />

      <ShareModal
        track={activeShareTrack}
        artist={activeShareArtist}
        promoShare={activeSharePromo}
        onClose={() => {
          setActiveShareTrack(null);
          setActiveShareArtist(null);
          setActiveSharePromo(null);
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen || authModalOpen}
        initialTab={authModalTab}
        promptReason={authPromptReason}
        onClose={() => {
          closeAuthModal();
          closeAuthGateModal();
        }}
      />

      <ReauthModal />

      <CelebrationModal onGoToStudio={() => navigate('/artistcreator')} />

      <Suspense fallback={null}>
        <FullscreenPlayerModal />
      </Suspense>

      <FirstTimeTourModal
        isOpen={Boolean(
          currentUser &&
            !isOnboardingOpen &&
            !currentUser.hasCompletedTour &&
            !tourDismissedInSession &&
            (() => {
              try {
                const onboardedDone =
                  Boolean(currentUser.onboarded) ||
                  localStorage.getItem(`lowervibe_onboarded_${currentUser.id}`) === 'true';
                return (
                  onboardedDone &&
                  localStorage.getItem(`lowervibe_tour_completed_${currentUser.id}`) !== 'true'
                );
              } catch {
                return true;
              }
            })()
        )}
        onComplete={() => setTourDismissedInSession(true)}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onComplete={() => setIsOnboardingOpen(false)}
      />

      <LegalModals />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider>
        <LanguageProvider>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <NotificationProvider>
                  <AudioProvider>
                    <OfflineQueueProvider>
                      <CrashRecoveryHandler />
                      <InitialLoader />
                      <PwaInstallPrompt />
                      <AppContent />
                    </OfflineQueueProvider>
                  </AudioProvider>
                </NotificationProvider>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </LanguageProvider>
      </RouterProvider>
    </ErrorBoundary>
  );
}
