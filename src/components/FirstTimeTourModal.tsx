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
import { useLanguage } from '../context/LanguageContext';
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

function getTourSteps(isNy: boolean): TourStep[] {
  return [
    {
      id: 'welcome',
      badge: isNy ? 'Gawo 1 pa 5' : 'Step 1 of 5',
      title: isNy ? 'Takulandirani ku LOWERVIBE' : 'Welcome to LOWERVIBE',
      description: isNy
        ? 'Mverani nyimbo za ku Malawi, Nigeria, ndi Africa yonse. Chitsogozo chachidule chisanayambe.'
        : 'Stream African independent music from Malawi, Nigeria, and beyond. Quick 20-second guide before you dive in.',
      locationLabel: isNy ? 'Chiyambi cha pulogalamu' : 'App overview',
      highlights: isNy
        ? [
            'Kunyumba, Fufuzani, Nyumba, Tumizani, ndi Mbiri',
            'Sungani nyimbo zomvera popanda intaneti',
            'Tsatirani oimba omwe mumakonda',
          ]
        : [
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
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              {isNy ? 'Nyimbo zoyera' : 'Independent music'}
            </span>
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
      badge: isNy ? 'Gawo 2 pa 5' : 'Step 2 of 5',
      title: isNy ? 'Kunyumba & Fufuzani' : 'Home & Search',
      description: isNy
        ? 'Pezani nyimbo zatsopano Kunyumba, kapena tsegulani Fufuzani pansi kuti mupeze nyimbo, oimba, ndi mitundu.'
        : 'Find fresh music on Home, or open Search in the bottom bar to look up songs, artists, and genres.',
      locationLabel: isNy ? 'Pansi -> Kunyumba / Fufuzani' : 'Bottom navigation -> Home / Search',
      routePreview: '/search',
      highlights: isNy
        ? [
            'Pitirizani pamene munaima mu Pitirizani kumvera',
            'Yang’anani mitundu ya nyimbo ndi ma chart a mayiko',
          ]
        : [
            'Pick up right where you paused in Continue listening',
            'Browse genres and country charts',
          ],
      renderVisual: () => (
        <div className="h-36 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] p-4 flex flex-col justify-between">
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Home className="w-4 h-4 text-[var(--accent-text)]" />
              <span className="text-xs font-bold text-[var(--text)]">
                {isNy ? 'Kunyumba & Top 10' : 'Home feed & Top 10'}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center">
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Search className="w-4 h-4" />
            <span>{isNy ? 'Fufuzani nyimbo, oimba, mitundu...' : 'Search songs, artists, genres...'}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'player',
      badge: isNy ? 'Gawo 3 pa 5' : 'Step 3 of 5',
      title: isNy ? 'Choyimbira & Nthawi yogona' : 'Mini-player & Sleep timer',
      description: isNy
        ? 'Dinani nyimbo iliyonse kuti itsegule choyimbira. Kukulitsa kukuwonetsani mawu a nyimbo, mndandanda, ndi nthawi yogona.'
        : 'Tap any song to open the player. Expand it for lyrics, queue controls, audio quality, and a sleep timer.',
      locationLabel: isNy ? 'Choyimbira chapamwamba pa menyu ya pansi' : 'Floating bar above bottom nav',
      highlights: isNy
        ? [
            'Konda nyimbo ndi kuwasunga pa akaunti yanu',
            'Kusunga data ndi kutsitsa nyimbo zopanda intaneti',
          ]
        : [
            'One-tap like synced across your account',
            'Data Saver and offline download options',
          ],
      renderVisual: () => (
        <div className="h-36 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--text)]">
              <Timer className="w-3.5 h-3.5 text-[var(--violet)]" />
              {isNy ? 'Nthawi yogona: 30m' : 'Sleep timer: 30m'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-500 text-xs font-semibold">
              <Heart className="w-3.5 h-3.5 fill-rose-500" />
              {isNy ? 'Konda' : 'Like'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Disc3 className="w-5 h-5 text-[var(--accent-text)]" />
              <span className="text-xs font-bold text-[var(--text)]">
                {isNy ? 'Ikusewera pano' : 'Now Playing'}
              </span>
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
      badge: isNy ? 'Gawo 4 pa 5' : 'Step 4 of 5',
      title: isNy ? 'Nyumba & Zidziwitso' : 'Library & Notifications',
      description: isNy
        ? 'Sungani nyimbo zomwe mumakonda, mindandanda, ndi zotsitsa mu Nyumba. Onani belu pamwamba pa zidziwitso.'
        : 'Keep your liked songs, playlists, and offline downloads in Library. Check the top bell for alerts.',
      locationLabel: isNy ? 'Pansi -> Nyumba / Belu pamwamba' : 'Bottom nav -> Library / Top Bell',
      routePreview: '/library',
      highlights: isNy
        ? [
            'Konzani nyimbo mu mndandanda nthawi iliyonse',
            'Gawani mindandanda yanu ndi anzanu',
          ]
        : [
            'Reorder playlist tracks anytime',
            'Share public playlists with friends',
          ],
      renderVisual: () => (
        <div className="h-36 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] p-4 grid grid-cols-3 gap-2.5 items-center">
          {[
            { label: isNy ? 'Zokonda' : 'Liked', icon: Heart },
            { label: isNy ? 'Mindandanda' : 'Playlists', icon: Library },
            { label: isNy ? 'Zidziwitso' : 'Alerts', icon: Bell },
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
      badge: isNy ? 'Gawo 5 pa 5' : 'Step 5 of 5',
      title: isNy ? 'Tumizani nyimbo zanu' : 'Upload your music',
      description: isNy
        ? 'Mukupanga nyimbo? Lemberani ku Creator kuti mugawane nyimbo zanu ndi kuwona chiwerengero cha omvera.'
        : 'Making music? Switch to an artist account anytime in Upload or Profile to share your tracks and see listener stats.',
      locationLabel: isNy ? 'Pansi -> Tumizani' : 'Bottom nav -> Upload',
      routePreview: '/artistcreator',
      highlights: isNy
        ? [
            'Sungani zojambula kapena tumizani pomwepo',
            'Onani chiwerengero cha kusewera ndi otsatira',
          ]
        : [
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
              <div className="text-xs font-bold text-[var(--text)]">
                {isNy ? 'Studio ya Woimba' : 'Artist Creator'}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {isNy ? 'Tumizani · Nyimbo · Chiwerengero' : 'Upload · Tracks · Stats'}
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {isNy
              ? 'Zonse zakonzeka. Sangalalani kupeza nyimbo zatsopano pa LOWERVIBE.'
              : 'You are all set. Enjoy discovering new music on LOWERVIBE.'}
          </p>
        </div>
      ),
    },
  ];
}

export const FirstTimeTourModal: React.FC<FirstTimeTourModalProps> = ({ isOpen, onComplete }) => {
  const { currentUser, updateCurrentUser } = useAuth();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);

  const tourSteps = getTourSteps(isNy);
  const step = tourSteps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tourSteps.length - 1;

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
    showToast(isNy ? 'Takulandirani ku LOWERVIBE' : 'Welcome to LOWERVIBE');
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
          aria-label={isNy ? 'Takulandirani ku LOWERVIBE' : 'Welcome to LOWERVIBE'}
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
                style={{ width: `${((stepIndex + 1) / tourSteps.length) * 100}%` }}
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
                <span>{isNy ? 'Dumphani' : 'Skip'}</span>
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
                      {isNy ? 'Tsegulani tsamba' : 'Open page'}
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
                  {tourSteps.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStepIndex(idx)}
                      aria-label={isNy ? `Gawo ${idx + 1}` : `Step ${idx + 1}`}
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
                      <span>{t('back', 'Back')}</span>
                    </button>
                  )}

                  {!isLast ? (
                    <button
                      type="button"
                      onClick={() => setStepIndex((i) => Math.min(tourSteps.length - 1, i + 1))}
                      className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{t('next', 'Next')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFinish}
                      className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{isNy ? 'Yambani kumvera' : 'Start listening'}</span>
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
