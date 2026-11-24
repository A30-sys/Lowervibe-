import { Check, ListMusic, Plus, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DEFAULT_ARTWORK_SVG } from '../utils/artworkFallback';
import { GenreSelectOrCustom } from './common/GenreSelectOrCustom';
import { RegionSelect } from './common/RegionSelect';

export const PlaylistModal: React.FC = () => {
  const { isPlaylistModalOpen, closePlaylistModal, playlistModalTrack, selectedCountry, upsertGenre } = useAudio();
  const { currentUser, createPlaylist, addTrackToPlaylist } = useAuth();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistGenre, setNewPlaylistGenre] = useState('Afro Chillout');
  const [newPlaylistCountry, setNewPlaylistCountry] = useState('Malawi');
  const [newPlaylistPublic, setNewPlaylistPublic] = useState(true);
  const [addedSuccessId, setAddedSuccessId] = useState<string | null>(null);

  useEffect(() => {
    if (playlistModalTrack) {
      setNewPlaylistGenre(playlistModalTrack.genre || 'Afro Chillout');
      setNewPlaylistCountry(
        playlistModalTrack.region ||
          (selectedCountry && selectedCountry !== 'Global' ? selectedCountry : currentUser?.country || 'Malawi')
      );
    }
  }, [playlistModalTrack, selectedCountry, currentUser?.country]);

  if (!isPlaylistModalOpen || !playlistModalTrack) return null;

  const userPlaylists = currentUser?.playlists || [];

  const handleAddToExisting = (playlistId: string) => {
    addTrackToPlaylist(playlistId, playlistModalTrack.id);
    setAddedSuccessId(playlistId);
    setTimeout(() => {
      setAddedSuccessId(null);
      closePlaylistModal();
    }, 1000);
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    const cleanGenre = newPlaylistGenre.trim() || playlistModalTrack.genre || 'Afrobeats';
    const cleanCountry = newPlaylistCountry.trim() || 'Malawi';
    await upsertGenre(cleanGenre, { region: cleanCountry });

    const newPl = createPlaylist(
      newPlaylistName.trim(),
      newPlaylistDesc.trim(),
      playlistModalTrack.coverArt,
      {
        country: cleanCountry,
        region: cleanCountry,
        genre: cleanGenre,
        isPublic: newPlaylistPublic,
      }
    );
    addTrackToPlaylist(newPl.id, playlistModalTrack.id);

    setAddedSuccessId(newPl.id);
    setTimeout(() => {
      setAddedSuccessId(null);
      setIsCreatingNew(false);
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      closePlaylistModal();
    }, 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={closePlaylistModal}
    >
      <div
        className="relative w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-[24px] shadow-2xl overflow-hidden text-[var(--text)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-[var(--accent-text)]" />
            <h3 className="text-base font-bold text-[var(--text)] font-heading">
              {isNy ? 'Onjezani ku mndandanda' : 'Add to playlist'}
            </h3>
          </div>
          <button
            type="button"
            onClick={closePlaylistModal}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-xl transition cursor-pointer"
            aria-label={t('close', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Track Thumbnail */}
        <div className="p-4 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center gap-3">
          <img
            src={playlistModalTrack.coverArt || DEFAULT_ARTWORK_SVG}
            alt={playlistModalTrack.title}
            referrerPolicy="no-referrer"
            className="w-12 h-12 rounded-xl object-cover border border-[var(--border)]"
          />
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-[var(--text)] truncate font-heading">
              {playlistModalTrack.title}
            </h4>
            <p className="text-xs text-[var(--text-muted)] truncate">{playlistModalTrack.artistName}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {!isCreatingNew ? (
            <>
              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-[var(--border-strong)] hover:border-[var(--accent-text)] bg-[var(--surface-2)] text-[var(--accent-text)] text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isNy ? 'Pangani mndandanda watsopano' : 'Create new playlist'}</span>
              </button>

              <div className="space-y-2 pt-1">
                {userPlaylists.length === 0 ? (
                  <p className="text-center text-xs text-[var(--text-muted)] py-4">
                    {isNy
                      ? 'Mulibe mndandanda pano. Pangani watsopano pamwambapa.'
                      : 'You have no playlists yet. Create one above.'}
                  </p>
                ) : (
                  userPlaylists.map((pl) => {
                    const alreadyHas = pl.trackIds.includes(playlistModalTrack.id);
                    const isSuccess = addedSuccessId === pl.id;

                    return (
                      <button
                        type="button"
                        key={pl.id}
                        onClick={() => handleAddToExisting(pl.id)}
                        disabled={alreadyHas}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition ${
                          alreadyHas
                            ? 'bg-[var(--surface-2)]/60 border-[var(--border)] opacity-60 cursor-not-allowed'
                            : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--border-strong)] cursor-pointer'
                        }`}
                      >
                        <div className="min-w-0">
                          <h5 className="text-xs font-semibold text-[var(--text)] truncate">{pl.name}</h5>
                          <span className="text-[11px] font-mono text-[var(--text-muted)]">
                            {isNy
                              ? `nyimbo ${pl.trackIds.length} · ${pl.isPublic ? 'Poyera' : 'Yachinsinsi'}`
                              : `${pl.trackIds.length} songs · ${pl.isPublic ? 'Public' : 'Private'}`}
                          </span>
                        </div>

                        {isSuccess ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                            <Check className="w-4 h-4" /> {isNy ? 'Yaonjezedwa' : 'Added'}
                          </span>
                        ) : alreadyHas ? (
                          <span className="text-[11px] font-mono text-[var(--text-muted)]">
                            {isNy ? 'Ili mu mndandanda' : 'In playlist'}
                          </span>
                        ) : (
                          <Plus className="w-4 h-4 text-[var(--text-muted)]" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleCreateAndAdd} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
                  {isNy ? 'Dzina la mndandanda' : 'Playlist name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isNy ? 'mwachitsanzo: Nyimbo za Usiku' : 'e.g. Blantyre Late Drive'}
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-xl text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-text)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
                  {isNy ? 'Mafotokozedwe (ngati mukufuna)' : 'Description (optional)'}
                </label>
                <input
                  type="text"
                  placeholder={isNy ? 'Mawu ochepa okhudza mndandandawu' : 'Short note about this playlist'}
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-xl text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-text)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
                  {t('genre', 'Genre')}
                </label>
                <GenreSelectOrCustom
                  value={newPlaylistGenre}
                  onChange={setNewPlaylistGenre}
                  onCustomGenreCreated={(name) => upsertGenre(name, { region: newPlaylistCountry })}
                  className="w-full px-3.5 py-2.5 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-xl text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
                  {isNy ? 'Dziko' : 'Country'}
                </label>
                <RegionSelect
                  value={newPlaylistCountry}
                  onChange={setNewPlaylistCountry}
                  includeGlobal={true}
                  className="w-full px-3.5 py-2.5 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-xl text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPlaylistPublic}
                  onChange={(e) => setNewPlaylistPublic(e.target.checked)}
                  className="accent-[var(--violet)] rounded"
                />
                <span>{isNy ? 'Ikani poyera kuti aliyense amvere' : 'Make public so anyone can listen'}</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] text-xs font-semibold hover:opacity-80 transition cursor-pointer"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] hover:brightness-95 disabled:opacity-50 text-[var(--accent-contrast)] text-xs font-bold transition cursor-pointer"
                >
                  {isNy ? 'Sungani & onjezani nyimbo' : 'Save & add song'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
