import {
  Bell,
  CheckCircle2,
  Download,
  Headphones,
  Lock,
  MoreVertical,
  Music,
  Share,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRouter } from '../context/RouterContext';
import {
  CREATOR_PWA_INSTALLED_KEY,
  MAIN_PWA_INSTALLED_KEY,
  PwaAppTarget,
  setActivePwaManifest,
} from '../utils/pwaManifest';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const SESSION_DISMISS_MAIN_KEY = 'lowervibe_install_dismissed_main_session_v1';
const SESSION_DISMISS_CREATOR_KEY = 'lowervibe_install_dismissed_creator_session_v1';
const BRAND_LOGO_SRC =
  '/assets/aistudio/hf_20261027_065809_f2446c35-920d-4d5a-a97a-dcfad0262ef1_802ab9c5.png';

export const PwaInstallPrompt: React.FC = () => {
  const { currentUser, isArtist, isAdmin, updateUserSettings } = useAuth();
  const { language, t } = useLanguage();
  const { currentRoute, navigate, searchParams } = useRouter();
  const isNy = language === 'ny';
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [targetApp, setTargetApp] = useState<PwaAppTarget>('main');
  const [platformTab, setPlatformTab] = useState<'android' | 'ios'>('android');
  const [mainInstalled, setMainInstalled] = useState(false);
  const [creatorInstalled, setCreatorInstalled] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);

  const isApprovedArtist = Boolean(
    currentUser &&
      (isArtist ||
        isAdmin ||
        currentUser.role === 'artist' ||
        currentUser.applicationStatus === 'approved')
  );

  useEffect(() => {
    let active = true;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isCreatorStandalone = isStandalone && searchParams.get('standalone') === 'artist';
    const isMainStandalone = isStandalone && !isCreatorStandalone;

    if (isMainStandalone) {
      try {
        localStorage.setItem(MAIN_PWA_INSTALLED_KEY, 'true');
      } catch {}
    }
    if (isCreatorStandalone) {
      try {
        localStorage.setItem(CREATOR_PWA_INSTALLED_KEY, 'true');
      } catch {}
    }

    const storedMainInstalled =
      isMainStandalone || localStorage.getItem(MAIN_PWA_INSTALLED_KEY) === 'true';
    const storedCreatorInstalled =
      isCreatorStandalone || localStorage.getItem(CREATOR_PWA_INSTALLED_KEY) === 'true';

    setMainInstalled(storedMainInstalled);
    setCreatorInstalled(storedCreatorInstalled);

    // Check Android Chrome getInstalledRelatedApps if supported so previously installed PWAs stay hidden forever
    const navWithRelated = window.navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>;
    };
    if (!storedMainInstalled && typeof navWithRelated.getInstalledRelatedApps === 'function') {
      navWithRelated
        .getInstalledRelatedApps()
        .then((apps) => {
          if (!active || !Array.isArray(apps) || apps.length === 0) return;
          try {
            localStorage.setItem(MAIN_PWA_INSTALLED_KEY, 'true');
          } catch {}
          setMainInstalled(true);
          setShowPrompt(false);
          window.dispatchEvent(new Event('lowervibe:pwa-installed'));
        })
        .catch(() => {});
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setPlatformTab(isIosDevice ? 'ios' : 'android');

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
      setTargetApp((currentTarget) => {
        if (currentTarget === 'creator') {
          setCreatorInstalled(true);
          try {
            localStorage.setItem(CREATOR_PWA_INSTALLED_KEY, 'true');
          } catch {}
        } else {
          setMainInstalled(true);
          try {
            localStorage.setItem(MAIN_PWA_INSTALLED_KEY, 'true');
          } catch {}
        }
        window.dispatchEvent(new Event('lowervibe:pwa-installed'));
        return currentTarget;
      });
    };

    const handleOpenInstallModal = (e: Event) => {
      const detail = (e as CustomEvent<{ target?: PwaAppTarget }>).detail;
      const nextTarget: PwaAppTarget = detail?.target === 'creator' ? 'creator' : 'main';
      setTargetApp(nextTarget);
      if (nextTarget === 'main' || isApprovedArtist) {
        setActivePwaManifest(nextTarget);
      } else {
        setActivePwaManifest('main');
      }
      setInstallNotice(null);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('lowervibe:open-install-prompt', handleOpenInstallModal);

    // Pop up automatically on every visit until the user actually installs the app; then vanish forever
    const skipAutoRoutes = new Set([
      'login',
      'register',
      'forgot_password',
      'admin',
      'admin_login',
      'admin_dashboard',
      'admin_access_denied',
    ]);
    let autoTimer: number | undefined;

    if (!isStandalone && !skipAutoRoutes.has(currentRoute.route)) {
      if (currentRoute.route === 'studio' && isApprovedArtist) {
        let dismissedThisSession = false;
        try {
          dismissedThisSession = sessionStorage.getItem(SESSION_DISMISS_CREATOR_KEY) === 'true';
        } catch {}
        if (!storedCreatorInstalled && !dismissedThisSession) {
          autoTimer = window.setTimeout(() => {
            setTargetApp('creator');
            setActivePwaManifest('creator');
            setShowPrompt(true);
          }, 1200);
        }
      } else {
        let dismissedThisSession = false;
        try {
          dismissedThisSession = sessionStorage.getItem(SESSION_DISMISS_MAIN_KEY) === 'true';
        } catch {}
        if (!storedMainInstalled && !dismissedThisSession) {
          autoTimer = window.setTimeout(() => {
            setTargetApp('main');
            setActivePwaManifest('main');
            setShowPrompt(true);
          }, 1700);
        }
      }
    }

    return () => {
      active = false;
      if (autoTimer) window.clearTimeout(autoTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('lowervibe:open-install-prompt', handleOpenInstallModal);
    };
  }, [isApprovedArtist, currentUser?.id, currentRoute.route, searchParams]);

  const handleSelectTarget = (next: PwaAppTarget) => {
    setTargetApp(next);
    setInstallNotice(null);
    if (next === 'main' || isApprovedArtist) {
      setActivePwaManifest(next);
    } else {
      setActivePwaManifest('main');
    }
  };

  const requestDeviceAlertsIfSupported = async () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          await updateUserSettings({
            notifications: {
              newReleasesPush: true,
              payoutUpdatesPush: true,
              productNewsPush: true,
              soundEnabled: true,
            },
          });
        }
      } catch {}
    }
  };

  const handleInstallClick = async () => {
    if (targetApp === 'creator' && !isApprovedArtist) return;

    setActivePwaManifest(targetApp);
    await requestDeviceAlertsIfSupported();

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          if (targetApp === 'creator') {
            setCreatorInstalled(true);
            try {
              localStorage.setItem(CREATOR_PWA_INSTALLED_KEY, 'true');
            } catch {}
          } else {
            setMainInstalled(true);
            try {
              localStorage.setItem(MAIN_PWA_INSTALLED_KEY, 'true');
            } catch {}
          }
          window.dispatchEvent(new Event('lowervibe:pwa-installed'));
          setShowPrompt(false);
          setDeferredPrompt(null);
          return;
        }
      } catch {
        // Fallback to browser steps
      }
      setDeferredPrompt(null);
    }

    const appLabel = targetApp === 'creator' ? 'LOWERVIBE Creator' : 'LOWERVIBE';
    setInstallNotice(
      platformTab === 'ios'
        ? isNy
          ? `Mu Safari, dinani batani la Share pansipa ndipo sankhani "Add to Home Screen" kuti muike ${appLabel}.`
          : `In Safari, tap Share below and choose "Add to Home Screen" to install ${appLabel}.`
        : isNy
        ? `Mu Chrome, tsegulani menyu ya ⋮ ndipo dinani "Install app" kapena "Add to Home screen" ya ${appLabel}.`
        : `In Chrome, open the ⋮ menu and tap "Install app" or "Add to Home screen" for ${appLabel}.`
    );
  };

  const handleDismiss = () => {
    try {
      const sessionKey =
        targetApp === 'creator' ? SESSION_DISMISS_CREATOR_KEY : SESSION_DISMISS_MAIN_KEY;
      sessionStorage.setItem(sessionKey, 'true');
    } catch {}
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  const isTargetInstalled = targetApp === 'creator' ? creatorInstalled : mainInstalled;
  const isCreatorLocked = targetApp === 'creator' && !isApprovedArtist;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Install LOWERVIBE WebApps"
    >
      <div className="relative w-full max-w-md bg-[var(--surface)] border border-[var(--border-strong)] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-[var(--text)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-12 rounded-2xl bg-white border border-[var(--border-strong)] shadow-sm shrink-0 overflow-hidden flex items-center justify-center px-1">
              <img
                src={BRAND_LOGO_SRC}
                alt={targetApp === 'creator' ? 'LOWERVIBE Creator' : 'LOWERVIBE'}
                className="w-full h-full object-cover object-[50%_52.5%] scale-[1.25]"
              />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent-text)] font-bold inline-flex items-center gap-1">
                {targetApp === 'creator' ? (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    <span>
                      {isApprovedArtist
                        ? isNy
                          ? 'Pulogalamu Yovomerezeka ya Woimba'
                          : 'Approved Creator App'
                        : isNy
                        ? 'Ikufuna Kuvomerezedwa ndi Situdiyo'
                        : 'Requires Studio Approval'}
                    </span>
                  </>
                ) : (
                  <>
                    <Headphones className="w-3 h-3" />
                    <span>{isNy ? 'Pulogalamu Yaikulu ya Omvera' : 'Listener Main App'}</span>
                  </>
                )}
              </span>
              <h3 className="text-base font-bold text-[var(--text)] font-heading leading-tight">
                {targetApp === 'creator' ? 'LOWERVIBE Creator' : t('install_app')}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--surface-2)] transition cursor-pointer shrink-0"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual App Selector */}
        <div className="p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => handleSelectTarget('main')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              targetApp === 'main'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>LOWERVIBE</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTarget('creator')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              targetApp === 'creator'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {isApprovedArtist ? <Music className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{t('creator_app')}</span>
          </button>
        </div>

        {isCreatorLocked ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--violet)]">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  {currentUser?.applicationStatus === 'pending'
                    ? t('studio_pending_badge')
                    : isNy
                    ? 'Lembani mu Situdiyo kuti mutsegule LOWERVIBE Creator'
                    : 'Apply in Studio to unlock LOWERVIBE Creator'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {currentUser?.applicationStatus === 'pending'
                  ? isNy
                    ? 'Pempho lanu la woimba likudikira kuvomerezedwa ndi Oyang\'anira. Mukavomerezedwa, mutha kuika pulogalamu yapadera ya LOWERVIBE Creator.'
                    : 'Your artist application is waiting for Administrator approval. Once approved, you can install and use the separate LOWERVIBE Creator app on top of the main LOWERVIBE app.'
                  : isNy
                  ? 'Omvera atha kuika pulogalamu yaikulu ya LOWERVIBE tsopano. Kuti muike LOWERVIBE Creator, lembani ku Situdiyo ndi kudikira chilolezo.'
                  : 'Listeners can install the main LOWERVIBE app right now to explore all music. To install LOWERVIBE Creator, apply in Artist Creator Studio and wait for Admin approval.'}
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectTarget('main')}
                className="flex-1 py-3 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold cursor-pointer min-h-[44px]"
              >
                {isNy ? 'Ikani Pulogalamu Yaikulu' : 'Install Main App'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPrompt(false);
                  navigate(currentUser ? '/artistcreator' : '/register');
                }}
                className="flex-1 py-3 px-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer min-h-[44px]"
              >
                {currentUser?.applicationStatus === 'pending'
                  ? isNy
                    ? 'Onani Momwe Zayendera'
                    : 'Check Approval'
                  : currentUser
                  ? t('apply_in_studio')
                  : t('create_account')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {targetApp === 'creator'
                ? isNy
                  ? 'Tsegulani LOWERVIBE Creator mwachindunji kuti mukweze nyimbo, muone chiwerengero ndi kutenga ndalama — komanso sungani pulogalamu yaikulu ya LOWERVIBE.'
                  : 'Launch directly into your dedicated LOWERVIBE Creator app for uploads, analytics, and withdrawals — plus keep the main LOWERVIBE app installed.'
                : isNy
                ? 'Ikani LOWERVIBE pa foni yanu kuti mupeze nyimbo mwachangu, mumvere popanda intaneti ndikupeza phokoso la zidziwitso pa nyimbo zatsopano.'
                : 'Install LOWERVIBE on your home screen to explore music faster, stream offline saves, and receive real-time sound alerts for artist releases and updates.'}
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--text)]">
              <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                <span>
                  {targetApp === 'creator'
                    ? isNy
                      ? 'Pulogalamu ya Woimba'
                      : 'Dedicated Creator App'
                    : isNy
                    ? 'Nyimbo & Popanda Intaneti'
                    : 'Full Discovery & Offline'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[var(--violet)] shrink-0" />
                <span>
                  {targetApp === 'creator'
                    ? isNy
                      ? 'Zidziwitso za Situdiyo'
                      : 'Studio & Payout Alerts'
                    : isNy
                    ? 'Zidziwitso Zaphokoso'
                    : 'Sound Update Alerts'}
                </span>
              </div>
            </div>

            <div className="p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => {
                  setPlatformTab('android');
                  setInstallNotice(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  platformTab === 'android'
                    ? 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border-strong)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {isNy ? 'Android / Kompyuta' : 'Android / Desktop'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlatformTab('ios');
                  setInstallNotice(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  platformTab === 'ios'
                    ? 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border-strong)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                iPhone &amp; iPad
              </button>
            </div>

            {platformTab === 'android' ? (
              <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] space-y-2">
                <div className="font-bold text-[var(--accent-text)] flex items-center gap-1.5">
                  <MoreVertical className="w-3.5 h-3.5" />
                  {isNy ? 'Ikani' : 'Install'}{' '}
                  {targetApp === 'creator' ? 'LOWERVIBE Creator' : 'LOWERVIBE'}:
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[var(--text-muted)] text-[11px]">
                  <li>
                    {isNy ? 'Tsegulani mu' : 'Open in'}{' '}
                    <strong className="text-[var(--text)]">Chrome</strong>{' '}
                    {isNy ? 'kapena Edge.' : 'or Edge.'}
                  </li>
                  <li>
                    {isNy ? 'Dinani' : 'Tap'}{' '}
                    <strong className="text-[var(--text)]">
                      {isNy ? 'Ikani' : 'Install'}
                    </strong>{' '}
                    {isNy ? 'pansipa (kapena dinani' : 'below (or tap'}{' '}
                    <strong className="text-[var(--text)]">⋮ → Install app</strong>).
                  </li>
                  <li>
                    {isNy
                      ? 'Lolani zidziwitso kuti muzimva phokoso la nyimbo zatsopano ndi zosintha.'
                      : 'Allow notifications to hear real chimes for artist releases & admin updates.'}
                  </li>
                </ol>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] space-y-2">
                <div className="font-bold text-[var(--accent-text)] flex items-center gap-1.5">
                  <Share className="w-3.5 h-3.5" />
                  {isNy ? 'Ikani pa iPhone & iPad:' : 'Install on iPhone & iPad:'}
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[var(--text-muted)] text-[11px]">
                  <li>
                    {isNy ? 'Tsegulani tsambali mu' : 'Open this page in'}{' '}
                    <strong className="text-[var(--text)]">Safari</strong>.
                  </li>
                  <li>
                    {isNy ? 'Dinani chizindikiro cha' : 'Tap the'}{' '}
                    <strong className="text-[var(--text)]">Share icon</strong>.
                  </li>
                  <li>
                    {isNy ? 'Sankhani' : 'Choose'}{' '}
                    <strong className="text-[var(--accent-text)]">"Add to Home Screen"</strong>.
                  </li>
                </ol>
              </div>
            )}

            {isTargetInstalled && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {targetApp === 'creator' ? 'LOWERVIBE Creator' : 'LOWERVIBE'}{' '}
                  {isNy ? 'waikidwa kale pa chipangizochi.' : 'is marked as installed on this device.'}
                </span>
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
                {t('maybe_later')}
              </button>

              {platformTab === 'android' ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <Download className="w-4 h-4" />
                  <span>{targetApp === 'creator' ? t('creator_app') : t('install_app')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await requestDeviceAlertsIfSupported();
                    handleDismiss();
                  }}
                  className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isNy ? 'Zatheka' : 'Done'}</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
