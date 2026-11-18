import { ArrowRight, Check, MapPin, Music, UserPlus, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
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

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const { currentUser, updateCurrentUser, toggleFollowArtist } = useAuth();
  const { artists, tracks, setSelectedCountry } = useAudio();
  const { showToast } = useToast();

  const [step, setStep] = useState<'country' | 'genres' | 'artists'>('country');
  const [country, setCountry] = useState(() => currentUser?.country || detectDefaultCountry() || 'Malawi');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => currentUser?.preferredGenres || []);
  const [followedIds, setFollowedIds] = useState<string[]>(() => currentUser?.followingArtistIds || []);

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

  if (!isOpen) return null;

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleToggleArtist = (artistId: string) => {
    setFollowedIds((prev) =>
      prev.includes(artistId) ? prev.filter((id) => id !== artistId) : [...prev, artistId]
    );
    toggleFollowArtist(artistId);
  };

  const finishOnboarding = (skipped: boolean = false) => {
    setSelectedCountry(country);
    if (currentUser) {
      updateCurrentUser({
        country,
        onboarded: true,
        preferredGenres: selectedGenres,
      });
    }
    try {
      localStorage.setItem('lowervibe_onboarded', 'true');
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
        className="w-full max-w-[480px] rounded-3xl bg-[var(--surface)] border border-[var(--border-strong)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[var(--text)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
            <span>
              Step {step === 'country' ? '1' : step === 'genres' ? '2' : '3'} of 3
            </span>
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

        {/* Step Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {step === 'country' && (
            <div className="space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)]">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-[var(--text)]">Where are you listening from?</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  We use your country to highlight local artists and trending sounds near you.
                </p>
              </div>
              <RegionSelect
                value={country}
                onChange={setCountry}
                includeGlobal={false}
                className="w-full h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {['Malawi', 'Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Tanzania'].filter((c) =>
                  REGION_LIST.includes(c)
                ).map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => setCountry(quick)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
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
          )}

          {step === 'genres' && (
            <div className="space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)]">
                <Music className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-[var(--text)]">Pick 3 or more genres</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Choose the sounds you love so we can tune your Home feed.
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
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                        active
                          ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
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
                <h2 className="text-xl font-extrabold text-[var(--text)]">Follow artists</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Pick a few creators (3+ suggested) to get new drops in your feed.
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
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer ${
                          isFollowing
                            ? 'bg-[var(--surface-2)] border-[var(--accent)]'
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
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
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

        {/* Footer CTA */}
        <div className="p-5 border-t border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-3">
          {step !== 'country' ? (
            <button
              type="button"
              onClick={() => setStep(step === 'artists' ? 'genres' : 'country')}
              className="px-4 h-11 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] cursor-pointer"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step === 'country' && (
            <button
              type="button"
              onClick={() => setStep('genres')}
              className="px-6 h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 'genres' && (
            <button
              type="button"
              onClick={() => {
                if (selectedGenres.length < 3) {
                  showToast('Pick at least 3 genres or tap Skip');
                  return;
                }
                setStep('artists');
              }}
              className="px-6 h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <span>Next ({selectedGenres.length} picked)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 'artists' && (
            <button
              type="button"
              onClick={() => finishOnboarding(false)}
              className="px-6 h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <span>Start listening</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
