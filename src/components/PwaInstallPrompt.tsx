import {
  CheckCircle2,
  Download,
  Lock,
  MoreVertical,
  Share,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const GUIDE_KEY_PREFIX = 'lowervibe_artist_pwa_guide_v3_';
const BRAND_LOGO_SRC =
  '/assets/aistudio/hf_20261027_065809_f2446c35-920d-4d5a-a97a-dcfad0262ef1_802ab9c5.png';

export const PwaInstallPrompt: React.FC = () => {
  const { currentUser, isArtist, isAdmin } = useAuth();
  const { navigate } = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [platformTab, setPlatformTab] = useState<'android' | 'ios'>('android');
  const [installed, setInstalled] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);

  const isApprovedArtist = Boolean(
    currentUser &&
      (isArtist ||
        isAdmin ||
        currentUser.role === 'artist' ||
        currentUser.applicationStatus === 'approved')
  );

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone || localStorage.getItem('lowervibe_pwa_installed') === 'true') {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setPlatformTab(isIosDevice ? 'ios' : 'android');

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowPrompt(false);
      localStorage.setItem('lowervibe_pwa_installed', 'true');
      if (currentUser?.id) {
        localStorage.setItem(`${GUIDE_KEY_PREFIX}${currentUser.id}`, 'true');
      }
    };

    const handleOpenInstallModal = () => {
      setInstallNotice(null);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('lowervibe:open-install-prompt', handleOpenInstallModal);

    // Only automatically offer the Artist WebApp install prompt once a user is registered & approved as an artist
    let firstApprovalTimer: number | undefined;
    if (isApprovedArtist && currentUser?.id) {
      const seenKey = `${GUIDE_KEY_PREFIX}${currentUser.id}`;
      if (!localStorage.getItem(seenKey)) {
        firstApprovalTimer = window.setTimeout(() => {
          setShowPrompt(true);
        }, 900);
      }
    }

    return () => {
      if (firstApprovalTimer) window.clearTimeout(firstApprovalTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('lowervibe:open-install-prompt', handleOpenInstallModal);
    };
  }, [isApprovedArtist, currentUser?.id]);

  const handleInstallClick = async () => {
    if (!isApprovedArtist) return;

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstalled(true);
          localStorage.setItem('lowervibe_pwa_installed', 'true');
          if (currentUser?.id) {
            localStorage.setItem(`${GUIDE_KEY_PREFIX}${currentUser.id}`, 'true');
          }
          setShowPrompt(false);
          setDeferredPrompt(null);
          return;
        }
      } catch {
        // Fallback to manual browser steps shown below
      }
      setDeferredPrompt(null);
    }

    setInstallNotice(
      platformTab === 'ios'
        ? 'In Safari, tap Share below and choose "Add to Home Screen" to install your standalone Artist WebApp.'
        : 'In Chrome for Android, tap the ⋮ menu in the top-right and choose "Install app" or "Add to Home screen".'
    );
  };

  const handleDismiss = () => {
    if (currentUser?.id) {
      localStorage.setItem(`${GUIDE_KEY_PREFIX}${currentUser.id}`, 'true');
    }
    setShowPrompt(false);
  };

  if (!showPrompt || installed) return null;

  // Non-artist or unapproved user trying to open the WebApp installer
  if (!isApprovedArtist) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-label="LOWERVIBE Artist WebApp Access"
      >
        <div className="relative w-full max-w-md bg-[var(--surface)] border border-[var(--border-strong)] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-[var(--text)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--violet)] shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--violet)] font-bold">
                  Approved Artists Only
                </span>
                <h3 className="text-base font-bold text-[var(--text)] font-heading leading-tight">
                  LOWERVIBE Artist WebApp
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--surface-2)] transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            The standalone LOWERVIBE WebApp is reserved exclusively for registered artists. Once your artist registration is approved, you will receive access to install and open your dedicated Artist Page &amp; Studio directly on your device.
          </p>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              className="flex-1 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold cursor-pointer min-h-[44px]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPrompt(false);
                navigate(currentUser ? '/studio' : '/register');
              }}
              className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer min-h-[44px]"
            >
              {currentUser ? 'Open Artist Studio' : 'Register as Artist'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Install LOWERVIBE Artist WebApp"
    >
      <div className="relative w-full max-w-md bg-[var(--surface)] border border-[var(--border-strong)] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-[var(--text)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-16 h-12 rounded-2xl bg-white border border-[var(--border-strong)] shadow-sm shrink-0 overflow-hidden flex items-center justify-center px-1">
              <img
                src={BRAND_LOGO_SRC}
                alt="LOWERVIBE Artist WebApp"
                className="w-full h-full object-cover object-[50%_52.5%] scale-[1.25]"
              />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent-text)] font-bold inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Approved Artist Access</span>
              </span>
              <h3 className="text-base font-bold text-[var(--text)] font-heading leading-tight">
                Install LOWERVIBE Artist App
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--surface-2)] transition cursor-pointer shrink-0"
            aria-label="Close install guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Your artist registration is approved! Install the standalone LOWERVIBE Artist WebApp to launch directly into your Artist Page, track uploads, earnings, and withdrawals like a native app.
        </p>

        <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--text)]">
          <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
            <span>Standalone Artist Page</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--violet)] shrink-0" />
            <span>Studio &amp; Withdrawals</span>
          </div>
        </div>

        {/* Platform Switcher: Android & iPhone */}
        <div className="p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setPlatformTab('android');
              setInstallNotice(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              platformTab === 'android'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Android (Chrome)
          </button>
          <button
            type="button"
            onClick={() => {
              setPlatformTab('ios');
              setInstallNotice(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              platformTab === 'ios'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            iPhone &amp; iPad (Safari)
          </button>
        </div>

        {platformTab === 'android' ? (
          <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] space-y-2">
            <div className="font-bold text-[var(--accent-text)] flex items-center gap-1.5">
              <MoreVertical className="w-3.5 h-3.5" />
              Install on Android:
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-[var(--text-muted)] text-[11px]">
              <li>
                Open this page in <strong className="text-[var(--text)]">Google Chrome</strong>.
              </li>
              <li>
                Tap <strong className="text-[var(--text)]">Install LOWERVIBE</strong> below (or tap <strong className="text-[var(--text)]">⋮</strong> in Chrome).
              </li>
              <li>
                Confirm <strong className="text-[var(--accent-text)]">"Install app"</strong> to open your standalone Artist WebApp from your Home Screen.
              </li>
            </ol>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] space-y-2">
            <div className="font-bold text-[var(--accent-text)] flex items-center gap-1.5">
              <Share className="w-3.5 h-3.5" />
              Install on iPhone &amp; iPad:
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-[var(--text-muted)] text-[11px]">
              <li>
                Open this page in <strong className="text-[var(--text)]">Safari</strong>.
              </li>
              <li>
                Tap the <strong className="text-[var(--text)]">Share icon</strong> (square with upward arrow).
              </li>
              <li>
                Tap <strong className="text-[var(--accent-text)]">"Add to Home Screen"</strong> and confirm <strong className="text-[var(--text)]">Add</strong>.
              </li>
            </ol>
          </div>
        )}

        {installNotice && (
          <div className="p-2.5 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[11px] text-[var(--accent-text)] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{installNotice}</span>
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 py-3 rounded-xl bg-[var(--surface-2)] hover:border-[var(--border-strong)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold transition cursor-pointer min-h-[44px]"
          >
            Later
          </button>

          {platformTab === 'android' && deferredPrompt ? (
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>Install LOWERVIBE</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Got It</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
