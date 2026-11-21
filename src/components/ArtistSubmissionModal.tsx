import {
  ArrowLeft,
  ArrowRight,
  Check,
  Disc,
  Headphones,
  Info,
  Layers,
  Music,
  Radio,
  Sliders,
  Sparkles,
  Upload,
  User,
  ShieldCheck,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { detectDefaultCountry } from '../data/regions';
import { Artist, Track } from '../types';
import { makeAvatarSvg, makeBannerSvg, makeCoverSvg } from '../utils/artworkFallback';
import { RegionSelect } from './common/RegionSelect';
import { GenreSelectOrCustom } from './common/GenreSelectOrCustom';

interface ArtistSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newArtist: Artist, newTrack: Track) => void;
}

const PRESET_AVATARS = [
  makeAvatarSvg('#1E1B3A', '#101218', '#C6FF4A'),
  makeAvatarSvg('#10252B', '#0B1118', '#38BDF8'),
  makeAvatarSvg('#2A152E', '#120D18', '#F472B6'),
  makeAvatarSvg('#241E12', '#12100C', '#F59E0B'),
];

const PRESET_BANNERS = [
  makeBannerSvg('#0B0B10', '#18122B', '#6C4BFF'),
  makeBannerSvg('#0B1318', '#0F252E', '#38BDF8'),
  makeBannerSvg('#180E20', '#111118', '#EC4899'),
  makeBannerSvg('#14180F', '#0B0B10', '#C6FF4A'),
];

const PRESET_COVERS = [
  makeCoverSvg('#12121A', '#1B1633', '#C6FF4A'),
  makeCoverSvg('#0E1B24', '#102A38', '#38BDF8'),
  makeCoverSvg('#24122B', '#140C1C', '#A855F7'),
  makeCoverSvg('#261A10', '#120E0A', '#F59E0B'),
];

const ALL_GENRES = ['Afrobeats', 'Hip Hop', 'R&B', 'Amapiano', 'Afro-Fusion', 'Neo-Soul', 'Boom Bap', 'Electronic', 'Lo-Fi', 'Ambient', 'Downtempo'];
const ALL_VIBE_TAGS = ['Afrobeats', 'Hip Hop', 'R&B Soul', 'Log Drum', 'Late Night', 'Rainy Rhodes', 'Deep Focus', 'Analog Tape', 'Heavy 808', 'Boom Bap', 'Sub Bass', 'Lagos Groove'];

export const ArtistSubmissionModal: React.FC<ArtistSubmissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { addNewArtist, addNewTrack, playTrack, openLegalModal, upsertGenre } = useAudio();
  const { currentUser, isArtist, isAdmin, submitArtistApplication } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Artist Profile Details (Use user's actual profile data or clean blanks)
  const [artistName, setArtistName] = useState(currentUser?.name || '');
  const [handle, setHandle] = useState(currentUser?.username || '');
  const [location, setLocation] = useState(() => detectDefaultCountry());
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser?.avatar || PRESET_AVATARS[0]);
  const [selectedBanner, setSelectedBanner] = useState(PRESET_BANNERS[0]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['Afro-Fusion']);
  const [customGenre, setCustomGenre] = useState('Afro-Fusion');
  const [gearText, setGearText] = useState('');
  const [soundcloud, setSoundcloud] = useState('');
  const [spotify, setSpotify] = useState('');
  const [bandcamp, setBandcamp] = useState('');
  const [instagram, setInstagram] = useState('');

  // Step 2: Music & Album Submission Details
  const [trackTitle, setTrackTitle] = useState('');
  const [albumName, setAlbumName] = useState('');
  const [synthPreset, setSynthPreset] = useState<Track['synthPreset']>('rainy_rhodes');
  const [bpm, setBpm] = useState(104);
  const [keySignature, setKeySignature] = useState('F Maj 7');
  const [selectedCover, setSelectedCover] = useState(PRESET_COVERS[0]);
  const [selectedVibeTags, setSelectedVibeTags] = useState<string[]>(['Afrobeats', 'Lagos Groove']);
  const [trackStory, setTrackStory] = useState('');
  const [isDownloadable, setIsDownloadable] = useState(true);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | undefined>(undefined);
  const [audioFileName, setAudioFileName] = useState<string>('');

  if (!isOpen) return null;

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      if (selectedGenres.length > 1) {
        setSelectedGenres(selectedGenres.filter(g => g !== genre));
      }
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const toggleVibeTag = (tag: string) => {
    if (selectedVibeTags.includes(tag)) {
      setSelectedVibeTags(selectedVibeTags.filter(t => t !== tag));
    } else {
      setSelectedVibeTags([...selectedVibeTags, tag]);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFileName(file.name);
      
      // Auto-fill track title if empty
      if (!trackTitle.trim()) {
        const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTrackTitle(cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1));
      }

      // Immediately create Blob URL for zero-lag instant playback in current session
      const blobUrl = URL.createObjectURL(file);
      setUploadedAudioUrl(blobUrl);

      // Read as Data URL so audio survives browser refresh without losing the file!
      if (file.size < 15 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setUploadedAudioUrl(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleFinalPublish = () => {
    const primaryGenre = (customGenre || selectedGenres[0] || 'Afro-Fusion').trim();
    const resolvedLocation = location.trim() || 'Global';
    if (primaryGenre) {
      upsertGenre(primaryGenre, { region: resolvedLocation }).catch(() => {});
    }

    // Listeners must apply and receive Admin approval before becoming Artists
    if (!isArtist && !isAdmin) {
      submitArtistApplication({
        userId: currentUser?.id || '',
        userEmail: currentUser?.email || '',
        stageName: artistName.trim() || currentUser?.name || 'Creator',
        legalName: currentUser?.name || artistName.trim() || 'Independent Creator',
        country: resolvedLocation,
        primaryGenre,
        bio: bio.trim(),
        avatarUrl: selectedAvatar,
        sampleTrackTitle: trackTitle.trim() || 'Original Submission',
        sampleTrackUrl: uploadedAudioUrl,
        rightsConfirmed: true,
      });
      showToast('Artist application submitted! Admin will review & notify you.');
      onClose();
      navigate('/artistcreator');
      return;
    }

    // 1. Create artist profile (starts unmonetized unless admin)
    const createdArtist = addNewArtist({
      name: artistName,
      handle: handle.startsWith('@') ? handle : `@${handle}`,
      avatar: selectedAvatar,
      banner: selectedBanner,
      bio,
      location: resolvedLocation,
      country: resolvedLocation,
      genres: Array.from(new Set([primaryGenre, ...selectedGenres])),
      gearAndSetup: gearText.split(',').map(s => s.trim()).filter(Boolean),
      socials: {
        soundcloud: soundcloud || undefined,
        spotify: spotify || undefined,
        bandcamp: bandcamp || undefined,
        instagram: instagram || undefined,
      },
      isMonetized: Boolean(isAdmin),
      monetizationStatus: isAdmin ? 'approved' : 'locked',
      earningsBalance: 0,
      likesCount: 0,
      likedByUserIds: [],
    });

    // 2. Create the track
    const createdTrack = addNewTrack({
      title: trackTitle,
      artistId: createdArtist.id,
      artistName: createdArtist.name,
      artistAvatar: createdArtist.avatar,
      coverArt: selectedCover,
      audioUrl: uploadedAudioUrl,
      synthPreset,
      durationSeconds: 210,
      genre: primaryGenre,
      region: resolvedLocation,
      vibeTags: selectedVibeTags,
      bpm,
      keySignature,
      story: trackStory,
      downloadable: isDownloadable,
    });

    // 3. Immediately play the created track
    playTrack(createdTrack);

    onSuccess?.(createdArtist, createdTrack);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-heading">Artist Submission & Music Hub</h2>
              <p className="text-xs text-zinc-400">
                Step {step} of 3 • {step === 1 ? 'Artist Identity' : step === 2 ? 'Share Your Music' : 'Review & Publish'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="grid grid-cols-3 border-b border-zinc-800 bg-zinc-950/40">
          <button
            onClick={() => setStep(1)}
            className={`py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
              step === 1 ? 'border-amber-400 text-amber-400 bg-amber-500/5' : 'border-transparent text-zinc-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px]">1</span>
            <span>Artist Profile</span>
          </button>
          <button
            onClick={() => setStep(2)}
            className={`py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
              step === 2 ? 'border-amber-400 text-amber-400 bg-amber-500/5' : 'border-transparent text-zinc-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px]">2</span>
            <span>Share Music</span>
          </button>
          <button
            onClick={() => setStep(3)}
            className={`py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
              step === 3 ? 'border-amber-400 text-amber-400 bg-amber-500/5' : 'border-transparent text-zinc-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px]">3</span>
            <span>Launch & Vibe</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: Artist Profile */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-200">
                <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  LOWERVIBE celebrates independent bedroom producers, modular synthesis explorers, and lo-fi sound designers. Set up your artist presence below.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Artist / Stage Name *</label>
                  <input
                    type="text"
                    value={artistName}
                    onChange={e => setArtistName(e.target.value)}
                    placeholder="e.g. Kaito Nori, Solar Drift"
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Public Handle (@) *</label>
                  <input
                    type="text"
                    value={handle}
                    onChange={e => setHandle(e.target.value)}
                    placeholder="auradrift_audio"
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Country / Region *</label>
                  <RegionSelect
                    value={location}
                    onChange={setLocation}
                    required={true}
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Hardware & Studio Gear (Comma-separated)</label>
                  <input
                    type="text"
                    value={gearText}
                    onChange={e => setGearText(e.target.value)}
                    placeholder="SP-404MKII, OP-1, Roland Juno, Tape Deck"
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Artist Bio & Sonic Philosophy</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Share what inspires your sonic landscape, recording methods, or personal story..."
                  className="w-full p-3 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              {/* Primary Genre (Preset or Custom) + Multi-select */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Primary Genre (or Create Custom) *</label>
                  <GenreSelectOrCustom
                    value={customGenre}
                    onChange={(g) => {
                      setCustomGenre(g);
                      if (g.trim() && !selectedGenres.includes(g.trim())) {
                        setSelectedGenres(prev => [g.trim(), ...prev.filter(x => x !== g.trim())]);
                      }
                    }}
                    onCustomGenreCreated={(name) => {
                      upsertGenre(name, { region: location }).catch(() => {});
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">Additional Tags (Optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_GENRES.map(g => {
                      const active = selectedGenres.includes(g);
                      return (
                        <button
                          type="button"
                          key={g}
                          onClick={() => toggleGenre(g)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                            active
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          {g} {active && '✓'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Avatar & Banner Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">Choose Artist Avatar</label>
                  <div className="flex gap-2">
                    {PRESET_AVATARS.map((url, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setSelectedAvatar(url)}
                        className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition ${
                          selectedAvatar === url ? 'border-amber-400 scale-105' : 'border-zinc-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">Choose Header Banner</label>
                  <div className="flex gap-2">
                    {PRESET_BANNERS.map((url, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setSelectedBanner(url)}
                        className={`relative w-16 h-10 rounded-lg overflow-hidden border-2 transition ${
                          selectedBanner === url ? 'border-amber-400 scale-105' : 'border-zinc-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Social Channels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">SoundCloud Profile</label>
                  <input
                    type="url"
                    value={soundcloud}
                    onChange={e => setSoundcloud(e.target.value)}
                    placeholder="https://soundcloud.com/..."
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Spotify / Bandcamp Link</label>
                  <input
                    type="url"
                    value={spotify}
                    onChange={e => setSpotify(e.target.value)}
                    placeholder="https://open.spotify.com/artist/..."
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-zinc-200"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Share Music */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-200">
                <Music className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  Share your first track on LOWERVIBE! You can use our built-in analog sound engine preset, or upload your own MP3/WAV file directly.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Track Title *</label>
                <input
                  type="text"
                  value={trackTitle}
                  onChange={e => setTrackTitle(e.target.value)}
                  placeholder="e.g. Midnight Echoes, Solitude at 4am"
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Audio Source Picker */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-amber-400" />
                    Audio Sound Engine & Synthesis
                  </span>
                  <span className="text-[11px] text-amber-400 font-mono">Real-time WebAudio</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'rainy_rhodes', title: 'Rainy Rhodes', desc: 'Warm 70s electric piano, vinyl noise, smooth sub' },
                    { id: 'tape_warmth', title: 'Tape Warmth', desc: 'Analog filters, dub chord sweeps, heavy low-end' },
                    { id: 'midnight_drift', title: 'Midnight Drift', desc: 'Hypnotic minor chords, slow tape flutter' },
                    { id: 'tokyo_dawn', title: 'Tokyo Dawn', desc: 'Vapor-chill maj7 keys, gentle morning glow' },
                    { id: 'ambient_dusk', title: 'Ambient Dusk', desc: 'Cinematic drone, granular sus chords, zero gravity' },
                    { id: 'deep_chill', title: 'Deep Chill', desc: 'Dusty soul chords, warm tape compression' },
                  ].map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSynthPreset(item.id as Track['synthPreset'])}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        synthPreset === item.id && !uploadedAudioUrl
                          ? 'border-amber-400 bg-amber-500/10 text-white shadow-md shadow-amber-500/10'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-semibold text-xs text-zinc-200 flex items-center justify-between">
                        <span>{item.title}</span>
                        {synthPreset === item.id && !uploadedAudioUrl && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1">{item.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Upload MP3 Option */}
                <div className="pt-2 border-t border-zinc-800/80">
                  <label className="block text-xs font-medium text-zinc-400 mb-2">Or upload your own audio file (MP3 / WAV):</label>
                  <label className="flex items-center justify-center gap-2 p-3.5 rounded-xl border border-dashed border-zinc-700 hover:border-amber-400/80 bg-zinc-900/40 cursor-pointer transition">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-zinc-300">
                      {audioFileName ? `File selected: ${audioFileName}` : 'Choose local audio track from device'}
                    </span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="hidden"
                    />
                  </label>
                  {uploadedAudioUrl && (
                    <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-400">
                      <span>✓ Custom audio loaded and ready to stream</span>
                      <button
                        type="button"
                        onClick={() => { setUploadedAudioUrl(undefined); setAudioFileName(''); }}
                        className="text-zinc-400 hover:text-zinc-200 underline"
                      >
                        Use Synth Engine instead
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* BPM & Key Signature */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Tempo (BPM)</label>
                    <span className="text-xs font-mono text-amber-400">{bpm} BPM</span>
                  </div>
                  <input
                    type="range"
                    min={54}
                    max={120}
                    value={bpm}
                    onChange={e => setBpm(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Musical Key Signature</label>
                  <input
                    type="text"
                    value={keySignature}
                    onChange={e => setKeySignature(e.target.value)}
                    placeholder="e.g. C Maj 7, F# Min"
                    className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100"
                  />
                </div>
              </div>

              {/* Album Art Cover Selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">Select Album Cover Artwork</label>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {PRESET_COVERS.map((url, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setSelectedCover(url)}
                      className={`relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border-2 transition ${
                        selectedCover === url ? 'border-amber-400 scale-105 shadow-lg shadow-amber-500/20' : 'border-zinc-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="Cover" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Vibe Tags */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">Vibe & Mood Tags</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_VIBE_TAGS.map(tag => {
                    const active = selectedVibeTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleVibeTag(tag)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                          active
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        #{tag} {active && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Track Story */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Liner Notes / The Story Behind the Music</label>
                <textarea
                  rows={2}
                  value={trackStory}
                  onChange={e => setTrackStory(e.target.value)}
                  placeholder="Where were you when you wrote this? What feelings or environment shaped it?"
                  className="w-full p-3 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              {/* Downloadable checkbox */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="dl"
                  checked={isDownloadable}
                  onChange={e => setIsDownloadable(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="dl" className="text-xs text-zinc-300 cursor-pointer">
                  Allow community listeners to download free high-res audio
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: Review & Publish */}
          {step === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center py-2">
                <div className="inline-flex p-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-2">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white font-heading">Ready to Share with LOWERVIBE</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                  Here is how your artist card and debut track will appear to the world.
                </p>
              </div>

              {/* Preview Card */}
              <div className="rounded-2xl border border-zinc-700/80 bg-zinc-950 overflow-hidden shadow-2xl">
                {/* Banner Header */}
                <div className="relative h-28 w-full overflow-hidden">
                  <img src={selectedBanner} alt="Banner" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
                  <div className="absolute bottom-3 left-4 flex items-center gap-3">
                    <img
                      src={selectedAvatar}
                      alt={artistName}
                      className="w-14 h-14 rounded-full border-2 border-amber-400 object-cover shadow-lg"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-bold text-white font-heading">{artistName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                          NEW ARTIST
                        </span>
                      </div>
                      <span className="text-xs text-zinc-400 font-mono">{handle.startsWith('@') ? handle : `@${handle}`} • {location}</span>
                    </div>
                  </div>
                </div>

                {/* Track Preview Box */}
                <div className="p-4 border-t border-zinc-800 flex items-center gap-4 bg-zinc-900/60">
                  <img
                    src={selectedCover}
                    alt={trackTitle}
                    className="w-16 h-16 rounded-xl object-cover border border-zinc-700 shadow"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate font-heading">{trackTitle}</span>
                      <span className="text-[10px] font-mono text-zinc-400">{bpm} BPM</span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{trackStory}</p>
                    <div className="flex gap-1.5 mt-2">
                      {selectedVibeTags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 space-y-1">
                <div className="flex justify-between">
                  <span>Audio Engine:</span>
                  <span className="font-mono text-zinc-200">{uploadedAudioUrl ? 'Custom File Audio' : synthPreset}</span>
                </div>
                <div className="flex justify-between">
                  <span>Key / Scale:</span>
                  <span className="font-mono text-zinc-200">{keySignature}</span>
                </div>
                <div className="flex justify-between">
                  <span>Genres:</span>
                  <span className="text-zinc-200">{selectedGenres.join(', ')}</span>
                </div>
              </div>

              {/* Creator Rights & Legal Certification Box */}
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-zinc-300 space-y-1">
                    <span className="font-bold text-white block">
                      Creator Rights & Copyright Declaration
                    </span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      By publishing, you confirm that you own or have licensed all sample/audio rights in this submission. LOWERVIBE guarantees that you retain 100% master and publishing rights. Subject to the{' '}
                      <button
                        type="button"
                        onClick={() => openLegalModal('terms')}
                        className="text-amber-400 hover:underline font-semibold"
                      >
                        Creator Terms
                      </button>{' '}
                      and{' '}
                      <button
                        type="button"
                        onClick={() => openLegalModal('privacy')}
                        className="text-emerald-400 hover:underline font-semibold"
                      >
                        Privacy Policy
                      </button>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as 1 | 2)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((step + 1) as 2 | 3)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition shadow-lg shadow-amber-500/20"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalPublish}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 text-sm font-bold transition shadow-xl shadow-amber-500/25"
            >
              <Sparkles className="w-4 h-4" />
              <span>Publish & Stream Music Now</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
