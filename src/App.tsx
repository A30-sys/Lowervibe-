import { CheckCircle2, Download, FileText, Lock } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { AdminAccessDeniedView } from './components/admin/AdminAccessDeniedView';
import { AdminLoginView } from './components/admin/AdminLoginView';
import { AdminPortal } from './components/AdminPortal';
import { ArtistProfileModal } from './components/ArtistProfileModal';
import { ReauthModal } from './components/auth/ReauthModal';
import { AuthModal } from './components/AuthModal';
import { CelebrationModal } from './components/CelebrationModal';
import { CrashRecoveryHandler } from './components/CrashRecoveryHandler';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirstTimeTourModal } from './components/FirstTimeTourModal';
import { FullscreenPlayerModal } from './components/FullscreenPlayerModal';
import { InitialLoader } from './components/InitialLoader';
import { LegalModals } from './components/LegalModals';
import { OfflineBanner } from './components/OfflineBanner';
import { OnboardingModal } from './components/OnboardingModal';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { ShareModal } from './components/ShareModal';
import { TrackDetailDrawer } from './components/TrackDetailDrawer';
import { BottomTabBar, MainTabType } from './components/layout/BottomTabBar';
import { Footer } from './components/layout/Footer';
import { StickyHeader } from './components/layout/StickyHeader';
import { BottomPlayer } from './components/player/BottomPlayer';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { AccountView } from './components/views/AccountView';
import { ArtistPublicPageView } from './components/views/ArtistPublicPageView';
import { ArtistsRosterView } from './components/views/ArtistsRosterView';
import { AuthPortalView } from './components/views/AuthPortalView';
import { DiscoverView } from './components/views/DiscoverView';
import { HomeView } from './components/views/HomeView';
import { LegalPageView } from './components/views/LegalPageView';
import { LibraryView } from './components/views/LibraryView';
import { NotFoundView } from './components/views/NotFoundView';
import { SearchResultsView } from './components/views/SearchResultsView';
import { ServerErrorView } from './components/views/ServerErrorView';
import { StudioView } from './components/views/StudioView';
import { TrackPublicPageView } from './components/views/TrackPublicPageView';
import { AudioProvider, useAudio } from './context/AudioContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import { OfflineQueueProvider } from './context/OfflineQueueContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { PRIMARY_ADMIN_EMAIL } from './services/authService';
import { Track } from './types';

function AppContent() {
  const { currentRoute, navigate, searchParams } = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [tourDismissedInSession, setTourDismissedInSession] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [standaloneGateBypassed, setStandaloneGateBypassed] = useState(false);
  const standaloneInitialRoutedRef = useRef(false);

  const {
    tracks,
    artists,
    currentTrack,
    isPlaying,
    playbackState,
    isMiniPlayerVisible,
    activeShareTrack,
    setActiveShareTrack,
    activeDetailTrack,
    setActiveDetailTrack,
    selectedArtistModal,
    setSelectedArtistModal,
    isAuthModalOpen,
    closeAuthModal,
    authModalTab,
    openLegalModal,
    activeDownload,
    dismissAllModals,
    setIsFullscreenPlayerOpen,
    clearActiveTrack,
  } = useAudio();

  const isBottomPlayerActive = Boolean(
    currentTrack && (isPlaying || isMiniPlayerVisible || playbackState !== 'idle')
  );

  const [isPlayerMounted, setIsPlayerMounted] = useState(isBottomPlayerActive);
  const [isPlayerExiting, setIsPlayerExiting] = useState(false);
  const lastPlayerTrackRef = useRef<Track | null>(currentTrack);
  const playerExitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentTrack) {
      lastPlayerTrackRef.current = currentTrack;
    }
  }, [currentTrack]);

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

  const handleCloseBottomPlayer = () => {
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
  };

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
    !standaloneGateBypassed &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        searchParams.get('standalone') === 'artist')
  );

  // When an approved artist launches the standalone WebApp, open straight into Studio / Artist Page
  useEffect(() => {
    if (!authReady || !currentUser || !isApprovedArtistAccount || !isStandaloneArtistApp) return;
    if (standaloneInitialRoutedRef.current) return;
    standaloneInitialRoutedRef.current = true;
    if (currentRoute.route === 'home') {
      navigate('/studio?standalone=artist', { replace: true });
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

  if (!authReady) {
    return <InitialLoader />;
  }

  // Public Legal routes render cleanly even when signed out
  if (currentRoute.route === 'terms' || currentRoute.route === 'privacy' || currentRoute.route === 'copyright') {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-sans transition-colors duration-200">
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-6 pb-16">
          <LegalPageView docType={currentRoute.route} />
        </main>
      </div>
    );
  }

  // Dedicated Standalone Administration Page (/administration, /administration/login, /administration/access-denied)
  if (currentRoute.route === 'admin_login') {
    return <AdminLoginView />;
  }
  if (currentRoute.route === 'admin_access_denied') {
    return <AdminAccessDeniedView />;
  }
  if (currentRoute.route === 'admin' || currentRoute.route === 'admin_dashboard') {
    if (currentUser?.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL) {
      return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-8 max-w-6xl mx-auto">
          <AdminPortal onBackToExplore={() => navigate('/')} />
        </div>
      );
    }
    return <AdminAccessDeniedView />;
  }

  // Dedicated Auth routes or unauthenticated gate (unless user explicitly entered Guest Browsing)
  if (
    (!currentUser && !isGuestMode) ||
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

    return <AuthPortalView initialMode={initialMode} onSuccess={() => navigate('/')} />;
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
              Approved Artists Only
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              The standalone LOWERVIBE Artist WebApp unlocks automatically after your artist registration is approved. Submit or check your artist application first.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => {
                setStandaloneGateBypassed(true);
                navigate('/studio');
              }}
              className="flex-1 py-3 px-4 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs cursor-pointer"
            >
              {currentUser.applicationStatus === 'pending' ? 'View Approval Status' : 'Register as Artist'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStandaloneGateBypassed(true);
                navigate('/');
              }}
              className="flex-1 py-3 px-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-semibold text-xs cursor-pointer"
            >
              Continue Listening
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeTab: MainTabType = (() => {
    switch (currentRoute.route) {
      case 'home':
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
      if (currentUser?.email?.toLowerCase() !== PRIMARY_ADMIN_EMAIL) {
        navigate('/administration/access-denied');
        return;
      }
      navigate('/administration');
      return;
    }

    dismissAllModals();
    setIsPageTransitioning(true);

    if (tab === 'home') navigate('/');
    else if (tab === 'search' || tab === 'discover') navigate('/search');
    else if (tab === 'library') navigate('/library');
    else if (tab === 'upload' || tab === 'studio') navigate('/studio');
    else if (tab === 'profile' || tab === 'account') navigate('/account');

    setTimeout(() => setIsPageTransitioning(false), 160);
  };

  const handleSelectArtist = (artistId: string) => {
    const artist = artists.find((a) => a.id === artistId);
    if (artist) {
      navigate(`/artists/${artist.slug || artist.id}`);
    } else if (artistId) {
      navigate(`/artists/${artistId}`);
    }
  };

  const handleOpenTrackDetails = (track?: Track) => {
    if (track) {
      navigate(`/tracks/${track.id}`);
    } else if (currentTrack) {
      navigate(`/tracks/${currentTrack.id}`);
    } else if (tracks.length > 0) {
      navigate(`/tracks/${tracks[0].id}`);
    }
  };

  const handleSelectCategory = (category: string) => {
    navigate(`/discover?genre=${encodeURIComponent(category)}`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-sans transition-colors duration-200 selection:bg-[var(--accent)]/30 overflow-x-hidden">
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

      {/* Standalone Artist WebApp quick switcher (Studio / Artist Page / Withdrawals) */}
      {isStandaloneArtistApp && isApprovedArtistAccount && (
        <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[var(--accent-text)] font-mono uppercase tracking-wider text-[10px]">
              LOWERVIBE Artist WebApp
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => navigate('/studio?standalone=artist')}
                className={`px-3 py-1 rounded-full font-semibold cursor-pointer ${
                  currentRoute.route === 'studio' && searchParams.get('tab') !== 'withdrawals'
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]'
                }`}
              >
                Artist Studio
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = currentUser?.artistId;
                  if (targetId) navigate(`/artists/${targetId}?standalone=artist`);
                  else navigate('/studio?standalone=artist');
                }}
                className={`px-3 py-1 rounded-full font-semibold cursor-pointer ${
                  currentRoute.route === 'artist_detail'
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]'
                }`}
              >
                My Artist Page
              </button>
              <button
                type="button"
                onClick={() => navigate('/studio?standalone=artist&tab=withdrawals')}
                className={`px-3 py-1 rounded-full font-semibold cursor-pointer ${
                  currentRoute.route === 'studio' && searchParams.get('tab') === 'withdrawals'
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]'
                }`}
              >
                Withdrawals
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
                We updated our{' '}
                <button
                  type="button"
                  onClick={() => navigate('/terms')}
                  className="underline font-semibold hover:text-[var(--accent-text)] cursor-pointer"
                >
                  Terms of Service
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => navigate('/privacy')}
                  className="underline font-semibold hover:text-[var(--accent-text)] cursor-pointer"
                >
                  Privacy Policy
                </button>
                .
              </span>
            </div>
            <button
              type="button"
              onClick={() => acceptLatestTerms()}
              className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs cursor-pointer"
            >
              Accept
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container with dynamic clearance matching active Mini-Player state */}
      <main
        className={`flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 mb-0 transition-[padding] duration-200 ${
          isPlayerMounted && !isPlayerExiting ? 'pb-40 md:pb-28' : 'pb-20 md:pb-0'
        }`}
      >
        <div key={currentRoute.pathname} className="animate-fadeIn">
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

          {currentRoute.route === 'not_found' && <NotFoundView />}

          {currentRoute.route === 'server_error' && <ServerErrorView />}
        </div>

        <Footer onOpenLegal={openLegalModal} onNavigate={navigate} />
      </main>

      {isPlayerMounted && (
        <BottomPlayer
          onOpenDetails={() => handleOpenTrackDetails()}
          onOpenArtist={handleSelectArtist}
          onOpenFullscreen={() => setIsFullscreenPlayerOpen(true)}
          onClosePlayer={handleCloseBottomPlayer}
          isExiting={isPlayerExiting}
          fallbackTrack={lastPlayerTrackRef.current}
        />
      )}

      <BottomTabBar activeTab={activeTab} onSelectTab={handleSelectTab} />

      {/* Active Offline Save Progress Toast */}
      {activeDownload && (
        <div
          className={`fixed right-4 sm:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] shadow-2xl animate-slideUp transition-all duration-200 ${
            isPlayerMounted && !isPlayerExiting ? 'bottom-36 md:bottom-24' : 'bottom-20 md:bottom-6'
          }`}
        >
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
              <span className="text-[11px] font-mono font-bold text-[var(--accent-text)]">
                {activeDownload.isComplete ? 'Saved' : `${activeDownload.progress}%`}
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[180px]">
              {activeDownload.isComplete ? 'Ready for offline listening' : 'Saving track for offline play...'}
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
        onClose={() => setActiveShareTrack(null)}
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

      <CelebrationModal onGoToStudio={() => navigate('/studio')} />

      <FullscreenPlayerModal />

      <FirstTimeTourModal
        isOpen={Boolean(
          currentUser &&
            !currentUser.hasCompletedTour &&
            !tourDismissedInSession &&
            (() => {
              try {
                return localStorage.getItem(`lowervibe_tour_completed_${currentUser.id}`) !== 'true';
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
