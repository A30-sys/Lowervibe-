import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  Disc3,
  Heart,
  Home,
  Library,
  Mic2,
  Play,
  Search,
  Timer,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { SoundwaveIcon } from './brand/SoundwaveIcon';

interface FirstTimeTourModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface TourStep {
  id: string;
  badge: string;
  title: string;
  description: string;
  locationLabel: string;
  highlights: string[];
  routePreview?: string;
  renderVisual: () => React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    badge: 'Step 1 of 5',
    title: 'Welcome to LOWERVIBE',
    description:
      'Stream African independent music from Malawi, Nigeria, and beyond. Quick 20-second guide before you dive in.',
    locationLabel: 'App overview',
    highlights: [
      'Home, Search, Library, Upload, and Profile',
      'Save songs offline for when data is low',
      'Follow artists you love',
    ],
    renderVisual: () => (
      <div className="h-36 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center">
              <SoundwaveIcon className="w-4 h-4" isPlaying={true} />
            </div>
            <span className="font-heading font-extrabold text-[var(--text)] text-sm">LOWERVIBE</span>
          </div>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">Independent music</span>
        </div>
        <div className="flex items-end justify-center gap-1.5 h-12">
          {[35, 65, 90, 50, 80, 100, 60, 85, 45, 75].map((h, idx) => (
            <motion.div
              key={idx}
              className="w-2 rounded-full bg-[var(--accent)]"
              animate={{ height: [`${h * 0.45}%`, `${h}%`, `${h * 0.5}%`] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: idx * 0.08 }}
            />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'home-search',
    badge: 'Step 2 of 5',
    title: 'Home & Search',
    description:
      'Find fresh music on Home, or open Search in the bottom bar to look up songs, artists, and genres.',
    locationLabel: 'Bottom navigation -> Home / Search',
    routePreview: '/search',
    highlights: [
      'Pick up right where you paused in Continue listening',
      'Browse genres and country charts',
    ],
    renderVisual: () => (
      <div className="h-36 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] p-4 flex flex-col justify-between">
        <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Home className="w-4 h-4 text-[var(--accent-text)]" />
            <span className="text-xs font-bold text-[var(--text)]">Home feed & Top 10</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center">
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Search className="w-4 h-4" />
          <span>Search songs, artists, genres...</span>
        </div>
      </div>
    ),
  },
  {
    id: 'player',
    badge: 'Step 3 of 5',
    title: 'Mini-player & Sleep timer',
    description:
      'Tap any song to open the player. Expand it for lyrics, queue controls, audio quality, and a sleep timer.',
    locationLabel: 'Floating bar above bottom nav',
    highlights: [
      'One-tap like synced across your account',
      'Data Saver and offline download options',
    ],
    renderVisual: () => (
      <div className="h-36 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--text)]">
            <Timer className="w-3.5 h-3.5 text-[var(--violet)]" />
            Sleep timer: 30m
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-500 text-xs font-semibold">
            <Heart className="w-3.5 h-3.5 fill-rose-500" />
            Like
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Disc3 className="w-5 h-5 text-[var(--accent-text)]" />
            <span className="text-xs font-bold text-[var(--text)]">Now Playing</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center">
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'library',
    badge: 'Step 4 of 5',
    title: 'Library & Notifications',
    description:
      'Keep your liked songs, playlists, and offline downloads in Library. Check the top bell for alerts.',
    locationLabel: 'Bottom nav -> Library / Top Bell',
    routePreview: '/library',
    highlights: [
      'Reorder playlist tracks anytime',
      'Share public playlists with friends',
    ],
    renderVisual: () => (
      <div className="h-36 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] p-4 grid grid-cols-3 gap-2.5 items-center">
        {[
          { label: 'Liked', icon: Heart },
          { label: 'Playlists', icon: Library },
          { label: 'Alerts', icon: Bell },
        ].map((item) => (
          <div
            key={item.label}
            className="h-24 rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 flex flex-col items-center justify-center gap-2 text-center"
          >
            <item.icon className="w-5 h-5 text-[var(--accent-text)]" />
            <span className="text-xs font-bold text-[var(--text)]">{item.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'upload',
    badge: 'Step 5 of 5',
    title: 'Upload your music',
    description:
      'Making music? Switch to an artist account anytime in Upload or Profile to share your tracks and see listener stats.',
    locationLabel: 'Bottom nav -> Upload',
    routePreview: '/studio',
    highlights: [
      'Save drafts or publish straight away',
      'Track plays and follower growth',
    ],
    renderVisual: () => (
      <div className="h-36 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] p-4 flex flex-col justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center">
            <Mic2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--text)]">Creator Studio</div>
            <div className="text-[11px] text-[var(--text-muted)]">Upload · Tracks · Stats</div>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          You are all set. Enjoy discovering new music on LOWERVIBE.
        </p>
      </div>
    ),
  },
];

export const FirstTimeTourModal: React.FC<FirstTimeTourModalProps> = ({ isOpen, onComplete }) => {
  const { currentUser, updateCurrentUser } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);

  const step = TOUR_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const persistTourDoneForever = () => {
    if (currentUser) {
      updateCurrentUser({ hasCompletedTour: true, onboarded: true });
      try {
        localStorage.setItem(`lowervibe_tour_completed_${currentUser.id}`, 'true');
        localStorage.setItem('lowervibe_onboarded', 'true');
      } catch {}
    } else {
      try {
        localStorage.setItem('lowervibe_onboarded', 'true');
      } catch {}
    }
  };

  const handleFinish = () => {
    persistTourDoneForever();
    showToast('Welcome to LOWERVIBE');
    onComplete();
  };

  const handleSkip = () => {
    persistTourDoneForever();
    onComplete();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="first-time-tour-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-80 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to LOWERVIBE"
        >
          <motion.div
            key="first-time-tour-card"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative w-full max-w-lg rounded-[28px] overflow-hidden bg-[var(--surface)] border border-[var(--border)] shadow-2xl text-[var(--text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 w-full bg-[var(--surface-2)]">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
              />
            </div>

            <div className="px-5 sm:px-6 pt-5 pb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-mono font-semibold text-[var(--text-muted)]">
                {step.badge}
              </span>
              <button
                type="button"
                onClick={handleSkip}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition cursor-pointer"
              >
                <span>Skip</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-5 sm:px-6 pb-5 space-y-4">
              {step.renderVisual()}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-mono text-[var(--accent-text)]">
                    {step.locationLabel}
                  </span>
                  {step.routePreview && (
                    <button
                      type="button"
                      onClick={() => navigate(step.routePreview!)}
                      className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
                    >
                      Open page
                    </button>
                  )}
                </div>

                <h2 className="text-xl font-extrabold font-heading text-[var(--text)]">{step.title}</h2>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                  {step.description}
                </p>
              </div>

              <ul className="space-y-1.5">
                {step.highlights.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
                    <Check className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {TOUR_STEPS.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStepIndex(idx)}
                      aria-label={`Step ${idx + 1}`}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        idx === stepIndex
                          ? 'w-6 bg-[var(--accent)]'
                          : 'w-2 bg-[var(--border-strong)]'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {!isFirst && (
                    <button
                      type="button"
                      onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                      className="px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] text-xs font-bold text-[var(--text)] flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                  )}

                  {!isLast ? (
                    <button
                      type="button"
                      onClick={() => setStepIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1))}
                      className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFinish}
                      className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Start listening</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
