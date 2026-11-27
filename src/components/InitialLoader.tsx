import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useBatterySaver } from '../utils/batterySaver';
import { SafeImage } from './SafeImage';
import { LowerVibeMark } from './brand/LowerVibeLogo';

const INTRO_DURATION_MS = 6000;
const INTRO_FAST_DURATION_MS = 1600;
const VIBE_INDEX_STORAGE_KEY = 'lowervibe_intro_vibe_idx_v1';

interface IntroVibePreset {
  id: string;
  titleKey: string;
  titleFallback: string;
  subKey: string;
  subFallback: string;
  ambientClass: string;
  barHeights: number[];
}

const INTRO_VIBE_PRESETS: IntroVibePreset[] = [
  {
    id: 'afro-soul-sunrise',
    titleKey: 'intro_vibe_1_title',
    titleFallback: 'Afro-Soul Sunrise',
    subKey: 'intro_vibe_1_sub',
    subFallback: 'Warm acoustic melodies & fresh Malawi voices',
    ambientClass:
      'bg-[radial-gradient(circle_at_50%_38%,rgba(198,255,61,0.14)_0%,rgba(124,92,255,0.12)_34%,transparent_66%)]',
    barHeights: [12, 18, 24, 16, 28, 32, 32, 28, 16, 24, 18, 12],
  },
  {
    id: 'blantyre-bassline',
    titleKey: 'intro_vibe_2_title',
    titleFallback: 'Blantyre Bassline',
    subKey: 'intro_vibe_2_sub',
    subFallback: 'Trap, Dancehall & street-level energy',
    ambientClass:
      'bg-[radial-gradient(circle_at_50%_38%,rgba(124,92,255,0.22)_0%,rgba(198,255,61,0.08)_38%,transparent_68%)]',
    barHeights: [16, 26, 18, 30, 22, 32, 32, 22, 30, 18, 26, 16],
  },
  {
    id: 'lake-malawi-sunset',
    titleKey: 'intro_vibe_3_title',
    titleFallback: 'Lake Malawi Sunset',
    subKey: 'intro_vibe_3_sub',
    subFallback: 'Amapiano log drums & sunlit grooves',
    ambientClass:
      'bg-[radial-gradient(circle_at_50%_38%,rgba(198,255,61,0.16)_0%,rgba(165,190,120,0.12)_32%,transparent_65%)]',
    barHeights: [10, 16, 22, 26, 30, 24, 24, 30, 26, 22, 16, 10],
  },
  {
    id: 'lilongwe-studio',
    titleKey: 'intro_vibe_4_title',
    titleFallback: 'Lilongwe Studio',
    subKey: 'intro_vibe_4_sub',
    subFallback: 'Independent creators, direct to every listener',
    ambientClass:
      'bg-[radial-gradient(circle_at_50%_38%,rgba(124,92,255,0.16)_0%,rgba(198,255,61,0.12)_35%,transparent_66%)]',
    barHeights: [14, 22, 28, 20, 26, 32, 32, 26, 20, 28, 22, 14],
  },
  {
    id: 'pan-african-pulse',
    titleKey: 'intro_vibe_5_title',
    titleFallback: 'Pan-African Pulse',
    subKey: 'intro_vibe_5_sub',
    subFallback: 'Sound moving from Malawi across the continent',
    ambientClass:
      'bg-[radial-gradient(circle_at_50%_38%,rgba(198,255,61,0.18)_0%,rgba(124,92,255,0.14)_36%,transparent_68%)]',
    barHeights: [14, 20, 28, 32, 24, 28, 28, 24, 32, 28, 20, 14],
  },
  {
    id: 'after-hours-echo',
    titleKey: 'intro_vibe_6_title',
    titleFallback: 'After-Hours Echo',
    subKey: 'intro_vibe_6_sub',
    subFallback: 'R&B, chill sessions & late-night replay',
    ambientClass:
      'bg-[radial-gradient(circle_at_50%_38%,rgba(124,92,255,0.20)_0%,rgba(165,190,120,0.09)_35%,transparent_66%)]',
    barHeights: [10, 14, 20, 24, 28, 30, 30, 28, 24, 20, 14, 10],
  },
];

const EQ_BAR_COLORS = [
  'bg-[#7C5CFF]',
  'bg-[#7C5CFF]',
  'bg-[#8F76FF]',
  'bg-[#A5BE78]',
  'bg-[#C6FF3D]',
  'bg-[#C6FF3D]',
  'bg-[#C6FF3D]',
  'bg-[#C6FF3D]',
  'bg-[#A5BE78]',
  'bg-[#8F76FF]',
  'bg-[#7C5CFF]',
  'bg-[#7C5CFF]',
];

const EQ_HEIGHT_CLASSES = [
  'h-3',
  'h-5',
  'h-7',
  'h-4',
  'h-7',
  'h-8',
  'h-8',
  'h-7',
  'h-4',
  'h-7',
  'h-5',
  'h-3',
];

const EQ_ANIMATION_CLASSES = [
  'lv-eq-bar-1',
  'lv-eq-bar-2',
  'lv-eq-bar-3',
  'lv-eq-bar-4',
  'lv-eq-bar-5',
  'lv-eq-bar-6',
  'lv-eq-bar-6',
  'lv-eq-bar-5',
  'lv-eq-bar-4',
  'lv-eq-bar-3',
  'lv-eq-bar-2',
  'lv-eq-bar-1',
];

function getNextVisitVibe(): IntroVibePreset {
  try {
    const raw = localStorage.getItem(VIBE_INDEX_STORAGE_KEY);
    const prevIdx = raw !== null ? Number.parseInt(raw, 10) : -1;
    const nextIdx =
      Number.isFinite(prevIdx) && prevIdx >= 0
        ? (prevIdx + 1) % INTRO_VIBE_PRESETS.length
        : 0;
    localStorage.setItem(VIBE_INDEX_STORAGE_KEY, String(nextIdx));
    return INTRO_VIBE_PRESETS[nextIdx];
  } catch {
    return INTRO_VIBE_PRESETS[0];
  }
}

export const LowerVibeWaveLoader: React.FC<{ label?: string }> = ({ label }) => (
  <div
    className="flex flex-col items-center justify-center gap-3.5 py-8 text-center"
    role="status"
    aria-live="polite"
  >
    <div className="relative flex items-center justify-center w-16 h-16">
      <div className="relative w-14 h-14 rounded-2xl bg-[#0A0B0A] border border-[#C6FF3D]/40 flex items-center justify-center shadow-lg">
        <LowerVibeMark className="w-11 h-11" animated />
      </div>
    </div>
    {label && <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>}
  </div>
);

/**
 * Coordinates the instant pre-React #lv-boot-splash in index.html and orchestrates
 * a choreographed 6-second LOWERVIBE opening experience on every visit.
 */
export const InitialLoader: React.FC = () => {
  const { t } = useLanguage();
  const { authReady } = useAuth();
  const { tracks, offlineTrackIds } = useAudio();
  const batterySaver = useBatterySaver();

  const isAdminRoute =
    typeof window !== 'undefined' && /^\/administrationside/i.test(window.location.pathname);

  const [prefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const isConstrainedMotion = prefersReducedMotion || batterySaver.active;
  const targetDurationMs = isConstrainedMotion ? INTRO_FAST_DURATION_MS : INTRO_DURATION_MS;

  // Pick a fresh visit vibe once per app open
  const vibeRef = useRef<IntroVibePreset | null>(null);
  if (!vibeRef.current) {
    vibeRef.current = getNextVisitVibe();
  }
  const activeVibe = vibeRef.current;

  const startTimeRef = useRef<number>(Date.now());
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [skipRequested, setSkipRequested] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(isAdminRoute);
  const [isOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  // Synchronously hand off from the static index.html splash to this interactive stage without flicker
  useLayoutEffect(() => {
    const splash = document.getElementById('lv-boot-splash');
    if (splash) {
      splash.remove();
    }
  }, []);

  // Track elapsed time smoothly at low overhead (120ms ticks for phase transitions & 0:00 -> 0:06 counter)
  useEffect(() => {
    if (isDone || isExiting) return;

    const timer = window.setInterval(() => {
      const next = Date.now() - startTimeRef.current;
      setElapsedMs(next);
    }, 120);

    return () => window.clearInterval(timer);
  }, [isDone, isExiting]);

  // Begin exit transition once target duration (or skip) AND authReady are satisfied
  useEffect(() => {
    if (isDone || isExiting) return;
    const readyToExit = authReady && (skipRequested || elapsedMs >= targetDurationMs);
    if (!readyToExit) return;

    setIsExiting(true);
    const finishTimer = window.setTimeout(() => {
      setIsDone(true);
    }, 460);

    return () => window.clearTimeout(finishTimer);
  }, [authReady, skipRequested, elapsedMs, targetDurationMs, isDone, isExiting]);

  // Pick real live tracks (or cached offline tracks) to spotlight in Act II without any fake data
  const spotlightTracks = useMemo(() => {
    const available = tracks.filter(
      (item) =>
        item &&
        item.title &&
        !item.isDraft &&
        (!item.moderationStatus ||
          item.moderationStatus === 'approved' ||
          item.moderationStatus === 'published') &&
        (!isOffline || offlineTrackIds.includes(item.id))
    );
    const pool = available.length > 0 ? available : tracks.filter((item) => item && item.title);
    const withCovers = pool.filter((item) => Boolean(item.coverArt));
    const ordered = withCovers.length >= 3 ? withCovers : pool;
    // Rotate starting offset softly using the visit vibe index so returning visits spotlight different songs
    const vibeIndex = INTRO_VIBE_PRESETS.findIndex((v) => v.id === activeVibe.id);
    if (ordered.length <= 3 || vibeIndex <= 0) {
      return ordered.slice(0, 3);
    }
    const offset = vibeIndex % ordered.length;
    return [...ordered.slice(offset), ...ordered.slice(0, offset)].slice(0, 3);
  }, [tracks, offlineTrackIds, isOffline, activeVibe.id]);

  if (isDone) {
    return null;
  }

  const totalSeconds = Math.round(targetDurationMs / 1000);
  const currentSeconds = Math.min(totalSeconds, Math.floor(elapsedMs / 1000));
  const formattedCurrent = `00:0${currentSeconds}`;
  const formattedTotal = `00:0${totalSeconds}`;

  // 3-Act Choreography across the 6 seconds
  const act: 1 | 2 | 3 =
    isConstrainedMotion
      ? elapsedMs >= 900
        ? 3
        : 1
      : elapsedMs >= 4300
      ? 3
      : elapsedMs >= 1800
      ? 2
      : 1;

  const canShowSkip = elapsedMs >= 750 && !isExiting;
  const leadTrack = spotlightTracks[0];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('intro_tagline', 'Independent African Music')}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between px-6 py-8 sm:py-12 bg-[var(--bg)] text-[var(--text)] select-none overflow-hidden transition-all duration-[460ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isExiting ? 'opacity-0 scale-[1.025] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Dynamic Ambient Sound Field */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${activeVibe.ambientClass}`}
      />

      {/* Top Subtle Cultural Bar */}
      <div className="relative z-10 w-full max-w-md flex items-center justify-between text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)] pt-safe">
        <span>LOWERVIBE</span>
        <span>Malawi · Africa</span>
      </div>

      {/* Centerpiece Audio-Visual Stage */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center my-auto">
        {/* Orbital Emblem Stage */}
        <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center mb-6">
          {!isConstrainedMotion && (
            <>
              <span
                aria-hidden="true"
                className="absolute inset-4 rounded-[32px] border border-[#C6FF3D]/35 animate-lv-ripple-1 pointer-events-none"
              />
              <span
                aria-hidden="true"
                className="absolute inset-4 rounded-[32px] border border-[#7C5CFF]/40 animate-lv-ripple-2 pointer-events-none"
              />
            </>
          )}

          {/* Rotating Harmonic Orbit Rings */}
          <svg
            viewBox="0 0 160 160"
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full pointer-events-none ${
              isConstrainedMotion ? '' : 'animate-lv-orbit'
            }`}
          >
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="#C6FF3D"
              strokeOpacity="0.28"
              strokeWidth="1.5"
              strokeDasharray="44 18 12 28"
              strokeLinecap="round"
            />
          </svg>
          <svg
            viewBox="0 0 160 160"
            aria-hidden="true"
            className={`absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] pointer-events-none ${
              isConstrainedMotion ? '' : 'animate-lv-orbit-reverse'
            }`}
          >
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke="#7C5CFF"
              strokeOpacity="0.42"
              strokeWidth="1.5"
              strokeDasharray="24 36 8 24"
              strokeLinecap="round"
            />
          </svg>

          {/* Official LOWERVIBE Waveform Emblem */}
          <div className="relative w-[88px] h-[88px] rounded-[24px] bg-[#0A0B0A] border border-[#C6FF3D]/40 shadow-[0_20px_48px_rgba(0,0,0,0.45)] flex items-center justify-center overflow-hidden">
            <LowerVibeMark className="w-full h-full" animated={!isConstrainedMotion} />
          </div>
        </div>

        {/* 12-Bar Symmetrical Studio Equalizer */}
        <div
          aria-hidden="true"
          className="h-9 flex items-center justify-center gap-1.5 mb-5"
        >
          {EQ_BAR_COLORS.map((colorClass, idx) => (
            <span
              key={idx}
              className={`w-[3px] rounded-full ${colorClass} ${EQ_HEIGHT_CLASSES[idx]} ${
                isConstrainedMotion ? 'opacity-75' : `lv-eq-bar ${EQ_ANIMATION_CLASSES[idx]}`
              }`}
            />
          ))}
        </div>

        {/* Brand Wordmark */}
        <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-[0.2em] pl-[0.2em] leading-none text-[var(--text)]">
          LOWERVIBE
        </h1>
        <p className="text-xs font-medium text-[var(--text-muted)] mt-1.5">
          {t('intro_tagline', 'Independent African Music')}
        </p>

        {/* 3-Act Crossfading Story Container (fixed min-height prevents layout jump) */}
        <div className="mt-6 min-h-[88px] w-full flex flex-col items-center justify-center">
          {act === 1 && (
            <div key="act-1" className="animate-lv-beat-in flex flex-col items-center">
              <p className="text-base sm:text-lg font-bold tracking-tight text-[var(--text)]">
                {t(activeVibe.titleKey, activeVibe.titleFallback)}
              </p>
              <p className="text-xs sm:text-sm text-[var(--text-dim)] mt-1 max-w-xs">
                {t(activeVibe.subKey, activeVibe.subFallback)}
              </p>
            </div>
          )}

          {act === 2 && (
            <div key="act-2" className="animate-lv-beat-in flex flex-col items-center gap-2.5">
              {spotlightTracks.length > 0 ? (
                <>
                  <div className="flex items-center justify-center -space-x-2.5">
                    {spotlightTracks.map((track, idx) => (
                      <div
                        key={track.id}
                        className={`w-11 h-11 rounded-xl overflow-hidden border-2 border-[var(--bg)] shadow-md bg-[var(--surface)] ${
                          idx === 1 ? 'scale-105 z-10' : 'opacity-95'
                        }`}
                      >
                        <SafeImage
                          src={track.coverArt}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  {leadTrack && (
                    <div className="max-w-xs">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent-text)]">
                        {isOffline
                          ? t('intro_offline_ready', 'Offline library ready')
                          : t('intro_now_streaming', 'Now streaming')}
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-[var(--text)] truncate mt-0.5">
                        {leadTrack.title} · <span className="text-[var(--text-muted)] font-medium">{leadTrack.artistName}</span>
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs sm:text-sm font-medium text-[var(--text-dim)] max-w-xs">
                  {t('intro_direct_artists', 'Direct to artists · Built for offline listening')}
                </p>
              )}
            </div>
          )}

          {act === 3 && (
            <div key="act-3" className="animate-lv-beat-in flex flex-col items-center">
              <p className="text-base sm:text-lg font-bold tracking-tight text-[var(--text)]">
                {t('intro_ready_to_listen', 'Your sound is ready')}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t(activeVibe.titleKey, activeVibe.titleFallback)}
              </p>
            </div>
          )}
        </div>

        {/* 6-Second Progress Rail & Tabular Timecode */}
        <div className="mt-5 w-56 sm:w-64 flex flex-col gap-2">
          <div className="w-full h-[3px] rounded-full bg-[var(--border-strong)]/45 overflow-hidden">
            <div
              className={`w-full h-full rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#C6FF3D] ${
                isConstrainedMotion ? 'lv-intro-progress-fill-fast' : 'lv-intro-progress-fill'
              }`}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
            <span>{formattedCurrent}</span>
            <span>{formattedTotal}</span>
          </div>
        </div>
      </div>

      {/* Thumb-Zone Skip Affordance (44px+ touch target) */}
      <div className="relative z-10 pb-safe flex items-center justify-center min-h-[48px]">
        <button
          type="button"
          onClick={() => setSkipRequested(true)}
          disabled={!canShowSkip}
          className={`min-h-[44px] min-w-[116px] px-5 rounded-xl inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]/80 border border-[var(--border)]/70 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] active:scale-[0.98] ${
            canShowSkip ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <span>{t('intro_skip', 'Skip intro')}</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
