import { ArrowRight, Calendar, Check, MapPin, Music, UserPlus, Users, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { detectDefaultCountry, REGION_LIST } from '../data/regions';
import { DEFAULT_AVATAR_SVG } from '../utils/artworkFallback';
import { RegionSelect } from './common/RegionSelect';

const STARTER_GENRES = [
  'Afrobeats',
  'Amapiano',
  'Malawi Afro-Pop',
  'Gospel',
  'Hip-Hop',
  'Afro-Soul',
  'Dancehall',
  'Acoustic',
  'Lo-Fi',
  'Ambient',
  'Highlife',
  'Reggae',
];

type GenderOption = 'male' | 'female' | 'non-binary' | 'prefer_not_to_say';

const GENDER_OPTIONS: Array<{ value: GenderOption; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const STEP_ORDER: Array<'about' | 'genres' | 'artists'> = ['about', 'genres', 'artists'];

const STEP_META: Array<{ id: 'about' | 'genres' | 'artists'; label: string }> = [
  { id: 'about', label: 'About you' },
  { id: 'genres', label: 'Genres' },
  { id: 'artists', label: 'Artists' },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const { currentUser, updateCurrentUser, toggleFollowArtist } = useAuth();
  const { artists, tracks, setSelectedCountry } = useAudio();
  const { showToast } = useToast();

  const [step, setStep] = useState<'about' | 'genres' | 'artists'>('about');
  const [slideDirection, setSlideDirection] = useState<'forward' | 'back'>('forward');
  const [gender, setGender] = useState<GenderOption | ''>(() => currentUser?.gender || '');
  const [age, setAge] = useState<string>(() =>
    typeof currentUser?.age === 'number' ? String(currentUser.age) : ''
  );
  const [country, setCountry] = useState(() => currentUser?.country || detectDefaultCountry() || 'Malawi');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => currentUser?.preferredGenres || []);
  const [followedIds, setFollowedIds] = useState<string[]>(() => currentUser?.followingArtistIds || []);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.gender) setGender(currentUser.gender);
    if (typeof currentUser.age === 'number') setAge(String(currentUser.age));
    if (currentUser.country) setCountry(currentUser.country);
    if (currentUser.preferredGenres?.length) setSelectedGenres(currentUser.preferredGenres);
    if (currentUser.followingArtistIds?.length) setFollowedIds(currentUser.followingArtistIds);
  }, [currentUser?.id]);

  const genrePool = useMemo(() => {
    const liveGenres = Array.from(new Set(tracks.filter((t) => !t.isDraft).map((t) => t.genre).filter(Boolean)));
    const combined = Array.from(new Set([...liveGenres, ...STARTER_GENRES]));
    return combined.slice(0, 18);
  }, [tracks]);

  const artistSuggestions = useMemo(() => {
    return artists
      .slice()
      .sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0))
      .slice(0, 12);
  }, [artists]);

  const currentStepIdx = STEP_ORDER.indexOf(step);
  const parsedAgeNum = Number(age);
  const isAgeValid = Boolean(age.trim()) && Number.isFinite(parsedAgeNum) && parsedAgeNum >= 13 && parsedAgeNum <= 120;
  const progressPct = Math.round(((currentStepIdx + 1) / STEP_ORDER.length) * 100);

  const goToStep = (nextStep: 'about' | 'genres' | 'artists') => {
    const nextIdx = STEP_ORDER.indexOf(nextStep);
    setSlideDirection(nextIdx >= currentStepIdx ? 'forward' : 'back');
    setStep(nextStep);
  };

  if (!isOpen) return null;

  const toggleGenre = (genre: string) => {
    try {
      if ('vibrate' in navigator) navigator.vibrate?.(8);
    } catch {}
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleToggleArtist = (artistId: string) => {
    try {
      if ('vibrate' in navigator) navigator.vibrate?.(8);
    } catch {}
    setFollowedIds((prev) =>
      prev.includes(artistId) ? prev.filter((id) => id !== artistId) : [...prev, artistId]
    );
    toggleFollowArtist(artistId);
  };

  const finishOnboarding = (skipped: boolean = false) => {
    setSelectedCountry(country);
    const parsedAge = Math.floor(Number(age));
    const hasValidAge = Boolean(age.trim()) && Number.isFinite(parsedAge) && parsedAge >= 13 && parsedAge <= 120;
    if (currentUser) {
      updateCurrentUser({
        country,
        onboarded: true,
        preferredGenres: selectedGenres,
        ...(gender ? { gender } : {}),
        ...(hasValidAge ? { age: parsedAge } : {}),
      });
    }
    try {
      localStorage.setItem('lowervibe_onboarded', 'true');
      if (currentUser?.id) {
        localStorage.setItem(`lowervibe_onboarded_${currentUser.id}`, 'true');
      }
      if (selectedGenres.length > 0) {
        localStorage.setItem('lowervibe_preferred_genres', JSON.stringify(selectedGenres));
      }
    } catch {}
    if (!skipped) {
      showToast('Your home feed is ready');
    }
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Personalize your LOWERVIBE experience"
        className="w-full max-w-[490px] rounded-3xl bg-[var(--surface)] border border-[var(--border-strong)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[var(--text)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar + Animated Progress Bar */}
        <div className="px-6 pt-4 pb-3.5 border-b border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
              <span className="text-[var(--text)] font-bold">
                Step {currentStepIdx + 1} of {STEP_ORDER.length}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[var(--accent-text)]">{progressPct}%</span>
            </div>
            <button
              type="button"
              onClick={() => finishOnboarding(true)}
              className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1 cursor-pointer min-h-[36px]"
            >
              <span>Skip for now</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Continuous Progress Track */}
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            className="h-2 w-full rounded-full bg-[var(--surface-2)] overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Interactive Step Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {STEP_META.map((item, idx) => {
              const isDone = idx < currentStepIdx;
              const isActive = idx === currentStepIdx;
              const canJumpBack = idx < currentStepIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!canJumpBack}
                  onClick={() => canJumpBack && goToStep(item.id)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--accent)]/60'
                      : isDone
                      ? 'text-[var(--accent-text)] hover:bg-[var(--surface-2)] cursor-pointer'
                      : 'text-[var(--text-muted)] opacity-70 cursor-default'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-3 h-3 stroke-[3] shrink-0" />
                  ) : (
                    <span className="font-mono text-[10px]">{idx + 1}.</span>
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Content with Directional Slide-In */}
        <div className="p-6 overflow-y-auto overflow-x-hidden flex-1">
          <div
            key={step}
            className={`space-y-5 ${
              slideDirection === 'forward' ? 'animate-step-slide-right' : 'animate-step-slide-left'
            }`}
          >
            {step === 'about' && (
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)]">
                  <Users className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold text-[var(--text)]">Tell us about you</h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    Select your gender, age, and country so we can tailor LOWERVIBE for you.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">Gender</label>
                  <div className="grid grid-cols-2 gap-2">
                    {GENDER_OPTIONS.map((opt) => {
                      const active = gender === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            try {
                              if ('vibrate' in navigator) navigator.vibrate?.(8);
                            } catch {}
                            setGender(opt.value);
                          }}
                          className={`px-3 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                            active
                              ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)] font-bold shadow-sm'
                              : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {active && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                      <Calendar className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      <span>Age</span>
                    </label>
                    {age.trim().length > 0 && (
                      <span
                        className={`text-[11px] font-semibold ${
                          isAgeValid ? 'text-[var(--accent-text)]' : 'text-[var(--danger)]'
                        }`}
                      >
                        {isAgeValid ? 'Looks good' : 'Must be 13–120'}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={13}
                    max={120}
                    inputMode="numeric"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 22 (13+)"
                    className="w-full h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] transition-colors focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    <MapPin className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span>Country</span>
                  </label>
                  <RegionSelect
                    value={country}
                    onChange={setCountry}
                    includeGlobal={false}
                    className="w-full h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['Malawi', 'Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Tanzania']
                      .filter((c) => REGION_LIST.includes(c))
                      .map((quick) => (
                        <button
                          key={quick}
                          type="button"
                          onClick={() => setCountry(quick)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-[0.97] cursor-pointer ${
                            country === quick
                              ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
                              : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          {quick}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {step === 'genres' && (
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)]">
                  <Music className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl font-extrabold text-[var(--text)]">Pick your favourite genres</h2>
                    <span className="text-xs font-mono tabular-nums text-[var(--accent-text)]">
                      {selectedGenres.length} picked
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    Choose at least 1 sound (3+ recommended) so we can tune your Home feed.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {genrePool.map((g) => {
                    const active = selectedGenres.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGenre(g)}
                        className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer ${
                          active
                            ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)] shadow-sm'
                            : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        <span>{g}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 'artists' && (
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl font-extrabold text-[var(--text)]">Follow your favourite artists</h2>
                    <span className="text-xs font-mono tabular-nums text-[var(--accent-text)]">
                      {followedIds.length} following
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    Pick creators to start your setup and get their new drops in your feed.
                  </p>
                </div>
                {artistSuggestions.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text-muted)]">
                    No artists are published yet. You can follow artists anytime as tracks go live.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {artistSuggestions.map((artist) => {
                      const isFollowing = followedIds.includes(artist.id);
                      return (
                        <button
                          key={artist.id}
                          type="button"
                          onClick={() => handleToggleArtist(artist.id)}
                          className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                            isFollowing
                              ? 'bg-[var(--surface-2)] border-[var(--accent)] shadow-sm'
                              : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <img
                            src={artist.avatar || DEFAULT_AVATAR_SVG}
                            alt={artist.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover shrink-0 bg-[var(--surface)]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-[var(--text)] truncate">{artist.name}</div>
                            <div className="text-xs text-[var(--text-muted)] truncate">
                              {artist.country || 'Malawi'}
                            </div>
                          </div>
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                              isFollowing
                                ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                                : 'border border-[var(--border-strong)] text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="p-5 border-t border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-3">
          {step !== 'about' ? (
            <button
              type="button"
              onClick={() => goToStep(step === 'artists' ? 'genres' : 'about')}
              className="px-4 h-11 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] active:scale-95 transition cursor-pointer"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step === 'about' && (
            <button
              type="button"
              onClick={() => {
                if (!gender) {
                  showToast('Please select your gender option');
                  return;
                }
                if (!isAgeValid) {
                  showToast('Please enter a valid age (minimum 13)');
                  return;
                }
                goToStep('genres');
              }}
              className="px-6 h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center gap-2 hover:brightness-95 active:scale-95 transition cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 'genres' && (
            <button
              type="button"
              onClick={() => {
                if (selectedGenres.length < 1) {
                  showToast('Pick at least 1 genre or tap Skip');
                  return;
                }
                goToStep('artists');
              }}
              className="px-6 h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center gap-2 hover:brightness-95 active:scale-95 transition cursor-pointer"
            >
              <span>Next ({selectedGenres.length} picked)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 'artists' && (
            <button
              type="button"
              onClick={() => finishOnboarding(false)}
              className="px-6 h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center gap-2 hover:brightness-95 active:scale-95 transition cursor-pointer"
            >
              <span>Start listening &amp; Enter</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
