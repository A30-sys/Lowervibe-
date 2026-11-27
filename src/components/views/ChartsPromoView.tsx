import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Disc3,
  Download,
  Flame,
  Globe,
  Headphones,
  Heart,
  Info,
  Pause,
  Play,
  Share2,
  Sparkles,
  Tag,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { Track } from '../../types';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { getTrackLikeCount, isTrackLikedByUser } from '../../utils/formatters';
import { groupTracksByCategory, translateGenreCategory } from '../../utils/genreCategories';
import { exportReleasePromoCard } from '../../utils/promoBannerExport';
import { applyChartsSeoMeta, resetDefaultSeoMeta } from '../../utils/seoMeta';
import { getChartsShareUrl, getShortChartsShareUrl } from '../../utils/shareLinks';
import {
  extractCatalogTags,
  getTrackEngagementScore,
  getTrackSubTags,
  normalizeTagLabel,
} from '../../utils/tags';
import { SafeImage } from '../SafeImage';
import { PromoSharePayload } from '../ShareModal';

interface ChartsPromoViewProps {
  onOpenTrackDetails?: (track: Track) => void;
  onSharePromo?: (promo: PromoSharePayload) => void;
}

type ChartTab = 'most-played' | 'trending' | 'genres';

export const ChartsPromoView: React.FC<ChartsPromoViewProps> = ({
  onOpenTrackDetails,
  onSharePromo,
}) => {
  const {
    tracks,
    artists,
    currentTrack,
    isPlaying,
    playTrackList,
    togglePlayPause,
    setActiveShareTrack,
    isCatalogLoaded,
  } = useAudio();
  const { currentUser, toggleLikeTrack } = useAuth();
  const { language, t } = useLanguage();
  const { navigate, searchParams } = useRouter();
  const { showToast } = useToast();
  const isNy = language === 'ny';

  const initialTab = (() => {
    const raw = searchParams.get('tab');
    if (raw === 'trending' || raw === 'genres' || raw === 'most-played') return raw;
    if (searchParams.get('genre')) return 'genres';
    return 'most-played';
  })();

  const [activeTab, setActiveTab] = useState<ChartTab>(initialTab);
  const [selectedGenre, setSelectedGenre] = useState<string>(searchParams.get('genre') || '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [exportingType, setExportingType] = useState<'square' | 'story' | null>(null);

  const paramTab = searchParams.get('tab');
  const paramGenre = searchParams.get('genre') || '';
  const paramTrackId = searchParams.get('track') || '';

  useEffect(() => {
    if (paramTab === 'trending' || paramTab === 'genres' || paramTab === 'most-played') {
      setActiveTab(paramTab);
    } else if (paramGenre) {
      setActiveTab('genres');
    }
    if (paramGenre) {
      setSelectedGenre(paramGenre);
    }
  }, [paramTab, paramGenre]);

  const artistLookup = useMemo(() => {
    const map = new Map<string, (typeof artists)[number]>();
    artists.forEach((a) => {
      map.set(a.id, a);
      if (a.name) map.set(a.name.toLowerCase(), a);
    });
    return map;
  }, [artists]);

  const publicTracks = useMemo(
    () => tracks.filter((tr) => !tr.isDraft && !tr.isDeranked),
    [tracks]
  );

  const mostPlayedTracks = useMemo(
    () =>
      [...publicTracks].sort((a, b) => {
        const playDiff = (b.plays || 0) - (a.plays || 0);
        if (playDiff !== 0) return playDiff;
        return (b.likes || 0) - (a.likes || 0);
      }),
    [publicTracks]
  );

  const trendingTracks = useMemo(
    () =>
      [...publicTracks].sort((a, b) => {
        const diff = getTrackEngagementScore(b) - getTrackEngagementScore(a);
        if (diff !== 0) return diff;
        return (b.plays || 0) - (a.plays || 0);
      }),
    [publicTracks]
  );

  const genreGroups = useMemo(
    () =>
      groupTracksByCategory(publicTracks).filter(
        (g) => g.category !== 'Other' || g.tracks.length > 0
      ),
    [publicTracks]
  );

  const trendingTags = useMemo(
    () => extractCatalogTags(publicTracks, artists).slice(0, 18),
    [publicTracks, artists]
  );

  const regionalBreakdown = useMemo(() => {
    const map = new Map<string, { region: string; tracksCount: number; totalPlays: number }>();
    publicTracks.forEach((tr) => {
      const artist = artistLookup.get(tr.artistId);
      const regionName = (tr.region || artist?.country || '').trim();
      if (!regionName) return;
      const key = regionName.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.tracksCount += 1;
        existing.totalPlays += tr.plays || 0;
      } else {
        map.set(key, {
          region: regionName,
          tracksCount: 1,
          totalPlays: tr.plays || 0,
        });
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.totalPlays - a.totalPlays || b.tracksCount - a.tracksCount)
      .slice(0, 8);
  }, [publicTracks, artistLookup]);

  const selectedGenreGroup = useMemo(() => {
    if (!selectedGenre) return null;
    const target = normalizeTagLabel(selectedGenre).toLowerCase();
    return (
      genreGroups.find((g) => g.category.toLowerCase() === target) ||
      null
    );
  }, [genreGroups, selectedGenre]);

  const displayedList = useMemo(() => {
    if (selectedGenreGroup && activeTab === 'genres') {
      return selectedGenreGroup.tracks.slice(0, 25);
    }
    if (activeTab === 'trending') return trendingTracks.slice(0, 25);
    return mostPlayedTracks.slice(0, 25);
  }, [activeTab, mostPlayedTracks, trendingTracks, selectedGenreGroup]);

  const spotlightTrack =
    (paramTrackId ? publicTracks.find((tr) => tr.id === paramTrackId) : undefined) ||
    displayedList[0] ||
    mostPlayedTracks[0] ||
    null;
  const topGenreName = selectedGenreGroup?.category || genreGroups[0]?.category || '';
  const totalChartPlays = useMemo(
    () => publicTracks.reduce((sum, tr) => sum + (tr.plays || 0), 0),
    [publicTracks]
  );

  useEffect(() => {
    const spotlightArtist = spotlightTrack ? artistLookup.get(spotlightTrack.artistId) || null : null;
    applyChartsSeoMeta({
      tab: activeTab,
      genre: selectedGenreGroup?.category,
      topTrack: spotlightTrack,
      artist: spotlightArtist,
      totalCount: publicTracks.length,
    });
  }, [activeTab, selectedGenreGroup, spotlightTrack, artistLookup, publicTracks.length]);

  useEffect(() => {
    return () => {
      resetDefaultSeoMeta();
    };
  }, []);

  const activeShareUrl = getChartsShareUrl({
    tab: activeTab,
    genre: selectedGenreGroup?.category,
    trackId: paramTrackId || undefined,
  });
  const activeShortUrl = getShortChartsShareUrl({
    tab: activeTab,
    genre: selectedGenreGroup?.category,
    trackId: paramTrackId || undefined,
  });

  const buildPromoPayload = (options?: {
    title?: string;
    subtitle?: string;
    eyebrow?: string;
    artworkUrl?: string;
    genre?: string;
    tab?: ChartTab;
    trackId?: string;
  }): PromoSharePayload => {
    const chosenTab = options?.tab || activeTab;
    const chosenGenre = options?.genre ?? (chosenTab === 'genres' ? selectedGenreGroup?.category : undefined);
    const chosenTrackId = options?.trackId || paramTrackId || undefined;
    const shareUrl = getChartsShareUrl({
      tab: chosenTab,
      genre: chosenGenre,
      trackId: chosenTrackId,
    });
    const shortUrl = getShortChartsShareUrl({
      tab: chosenTab,
      genre: chosenGenre,
      trackId: chosenTrackId,
    });
    const topItem = spotlightTrack;
    const title =
      options?.title ||
      (chosenGenre
        ? `Top ${translateGenreCategory(chosenGenre, language)} on LOWERVIBE`
        : chosenTab === 'trending'
        ? isNy
          ? 'Nyimbo Zomwe Zikukula Kwambiri'
          : 'Most Trending Chart on LOWERVIBE'
        : isNy
        ? 'Nyimbo Zomwe Zikumveka Kwambiri'
        : 'Most Played Songs on LOWERVIBE');

    const subtitle =
      options?.subtitle ||
      (topItem
        ? `#1: "${topItem.title}" by ${topItem.artistName} · ${(topItem.plays || 0).toLocaleString()} plays`
        : `${publicTracks.length} verified tracks streaming free`);

    const eyebrow =
      options?.eyebrow ||
      (chosenGenre
        ? `${translateGenreCategory(chosenGenre, language)} Chart`
        : chosenTab === 'trending'
        ? isNy
          ? 'Tchati cha Zomwe Zikukula'
          : 'Live Trending Chart'
        : isNy
        ? 'Tchati cha Nyimbo Zotchuka'
        : 'Official Play Chart');

    const caption = topItem
      ? isNy
        ? `#1 pa LOWERVIBE tsopano: "${topItem.title}" ya ${topItem.artistName}${
            chosenGenre ? ` (${translateGenreCategory(chosenGenre, language)})` : ''
          }! Mverani ndi kugawana nawo tchati chathu: ${shortUrl} #LOWERVIBE #MalawiMusic`
        : `#1 on LOWERVIBE right now: "${topItem.title}" by ${topItem.artistName}${
            chosenGenre ? ` (${translateGenreCategory(chosenGenre, language)})` : ''
          }! Stream the full chart free and support independent artists: ${shortUrl} #LOWERVIBE #AfricanMusic`
      : `Stream the hottest independent music on LOWERVIBE: ${shortUrl} #LOWERVIBE`;

    return {
      title,
      subtitle,
      eyebrow,
      artworkUrl: options?.artworkUrl || topItem?.coverArt,
      shareUrl,
      shortUrl,
      caption,
      badgeText: topGenreName ? translateGenreCategory(topGenreName, language) : 'Top Charts',
      ctaLabel: 'Explore Chart on LOWERVIBE',
      tab: chosenTab,
      genre: chosenGenre,
      trackId: chosenTrackId || topItem?.id,
    };
  };

  const handleCopyText = async (key: string, text: string) => {
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {}
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        ta.remove();
      } catch {}
    }
    if (copied) {
      setCopiedKey(key);
      showToast(t('link_copied', 'Copied to clipboard'));
      window.setTimeout(() => setCopiedKey(null), 2200);
    }
  };

  const handleDownloadBanner = async (aspect: 'square' | 'story') => {
    const promo = buildPromoPayload();
    setExportingType(aspect);
    await exportReleasePromoCard({
      title: promo.title,
      subtitle: promo.subtitle,
      eyebrow: promo.eyebrow,
      artworkUrl: promo.artworkUrl,
      shortUrl: promo.shortUrl,
      aspect,
      ctaLabel: promo.ctaLabel,
    });
    setExportingType(null);
  };

  const handleOpenPromoShare = (custom?: Parameters<typeof buildPromoPayload>[0]) => {
    const payload = buildPromoPayload(custom);
    if (onSharePromo) {
      onSharePromo(payload);
    } else if (spotlightTrack) {
      setActiveShareTrack(spotlightTrack);
    }
  };

  const handlePlayChartQueue = (queueList: Track[], startIdx = 0) => {
    const target = queueList[startIdx];
    if (!target) return;
    if (currentTrack?.id === target.id) {
      togglePlayPause();
    } else {
      playTrackList(queueList, startIdx);
    }
  };

  const navigateArtist = (track: Track) => {
    const artist = artistLookup.get(track.artistId);
    navigate(`/artists/${encodeURIComponent(artist?.slug || track.artistId)}`);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-8">
      {/* Header & Shareable Chart Promo Spotlight */}
      <section className="relative overflow-hidden rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface)] p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{isNy ? 'Tchati Chogawana cha LOWERVIBE' : 'LOWERVIBE Shareable Charts & Promo'}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold font-heading tracking-tight text-[var(--text)] leading-tight">
              {isNy
                ? 'Nyimbo Zotchuka & Mitundu Yomwe Ikukula'
                : 'Most Played & Trending Music Charts'}
            </h1>

            <p className="text-sm text-[var(--text-muted)] max-w-2xl leading-relaxed">
              {isNy
                ? 'Onani nyimbo zomwe anthu akuzimvera kwambiri, ma chart otentha, ndi mitundu yotchuka — ndipo gawanani link kapena chithunzi chopromote ndi anzanu.'
                : 'Track the most played songs, fastest-rising chart hits, and hottest sub-genres across LOWERVIBE. Share trusted links or download promo cards with one tap.'}
            </p>

            {/* Live Catalog Stats (Real only) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--text-muted)] pt-1">
              <span className="font-semibold text-[var(--text)] font-mono tabular-nums">
                {totalChartPlays.toLocaleString()} {isNy ? 'masewera' : 'total plays'}
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">
                {publicTracks.length} {isNy ? 'nyimbo' : 'tracks ranked'}
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">
                {genreGroups.length} {isNy ? 'mitundu' : 'active genres'}
              </span>
            </div>

            {/* Primary Promo & Share Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {displayedList.length > 0 && (
                <button
                  type="button"
                  onClick={() => handlePlayChartQueue(displayedList, 0)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold hover:brightness-95 transition cursor-pointer min-h-[42px]"
                >
                  {spotlightTrack && currentTrack?.id === spotlightTrack.id && isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  <span>{isNy ? 'Sewerani Tchati' : 'Play Chart'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleOpenPromoShare()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border-strong)] text-[var(--text)] text-xs font-bold transition cursor-pointer min-h-[42px]"
              >
                <Share2 className="w-4 h-4 text-[var(--accent-text)]" />
                <span>{isNy ? 'Gawani Tchati & Promo' : 'Share Chart Promo'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyText('chart-link', activeShortUrl)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold transition cursor-pointer min-h-[42px]"
              >
                {copiedKey === 'chart-link' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                )}
                <span>
                  {copiedKey === 'chart-link'
                    ? t('link_copied', 'Copied!')
                    : isNy
                    ? 'Koperani Link'
                    : 'Copy Chart Link'}
                </span>
              </button>

              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => handleDownloadBanner('square')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold transition cursor-pointer min-h-[42px] disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                <span>{exportingType === 'square' ? '...' : 'Promo Card PNG'}</span>
              </button>

              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => handleDownloadBanner('story')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold transition cursor-pointer min-h-[42px] disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-[var(--violet)]" />
                <span>{exportingType === 'story' ? '...' : 'Story 9:16'}</span>
              </button>
            </div>
          </div>

          {/* #1 Ranked Track Card Preview */}
          {spotlightTrack && (
            <div className="w-full lg:w-[340px] shrink-0 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-strong)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider">
                <span className="text-[var(--accent-text)] inline-flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>
                    {activeTab === 'trending'
                      ? isNy
                        ? '#1 Yotentha Tsopano'
                        : '#1 Trending Now'
                      : isNy
                      ? '#1 Yoyimbidwa Kwambiri'
                      : '#1 Most Played'}
                  </span>
                </span>
                <span className="font-mono text-[var(--text-muted)] tabular-nums">
                  {(spotlightTrack.plays || 0).toLocaleString()} {isNy ? 'masewera' : 'plays'}
                </span>
              </div>

              <div className="flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => handlePlayChartQueue(displayedList, 0)}
                  className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[var(--border)] group cursor-pointer"
                  aria-label={`Play ${spotlightTrack.title}`}
                >
                  <SafeImage
                    src={spotlightTrack.coverArt}
                    fallbackSrc={DEFAULT_ARTWORK_SVG}
                    alt={spotlightTrack.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    {currentTrack?.id === spotlightTrack.id && isPlaying ? (
                      <Pause className="w-6 h-6 text-white fill-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                    )}
                  </span>
                </button>

                <div className="min-w-0 flex-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/tracks/${encodeURIComponent(spotlightTrack.id)}`)}
                    className="block text-left text-base font-extrabold text-[var(--text)] hover:text-[var(--accent-text)] truncate w-full cursor-pointer font-heading"
                  >
                    {spotlightTrack.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateArtist(spotlightTrack)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] truncate max-w-full cursor-pointer"
                  >
                    <span className="truncate">{spotlightTrack.artistName}</span>
                    {(artistLookup.get(spotlightTrack.artistId)?.verified ||
                      artistLookup.get(spotlightTrack.artistId)?.isVerified) && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                    )}
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {spotlightTrack.genre && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/discover?genre=${encodeURIComponent(spotlightTrack.genre)}`)
                        }
                        className="px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[10.5px] font-semibold text-[var(--text-dim)] hover:text-[var(--accent-text)] hover:border-[var(--accent)] transition cursor-pointer"
                      >
                        {translateGenreCategory(spotlightTrack.genre, language)}
                      </button>
                    )}
                    {getTrackSubTags(spotlightTrack)
                      .slice(0, 2)
                      .map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => navigate(`/search?tag=${encodeURIComponent(sub)}`)}
                          className="px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[10.5px] font-medium text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:border-[var(--accent)] transition cursor-pointer"
                        >
                          #{sub}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)] text-[11px]">
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText('spotlight-caption', buildPromoPayload().caption)
                  }
                  className="inline-flex items-center gap-1 font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  {copiedKey === 'spotlight-caption' ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>
                    {copiedKey === 'spotlight-caption'
                      ? isNy
                        ? 'Mau akopedwa!'
                        : 'Caption copied!'
                      : isNy
                      ? 'Koperani mau otsatsa'
                      : 'Copy promo caption'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveShareTrack(spotlightTrack)}
                  className="font-semibold text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                >
                  {isNy ? 'Gawani #1 →' : 'Share #1 →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Chart Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Chart rankings"
          className="inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]"
        >
          {[
            {
              id: 'most-played' as const,
              label: isNy ? 'Zomwe Zikumveka Kwambiri' : 'Most Played Songs',
              icon: Headphones,
            },
            {
              id: 'trending' as const,
              label: isNy ? 'Tchati Chotentha' : 'Most Trending Chart',
              icon: TrendingUp,
            },
            {
              id: 'genres' as const,
              label: isNy ? 'Mitundu & Ma Tag Otchuka' : 'Trending Genres & Tags',
              icon: Sparkles,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'genres') setSelectedGenre('');
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap min-h-[40px] ${
                  active
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)] font-mono hidden sm:inline truncate max-w-[240px]">
            {activeShareUrl.replace(/^https?:\/\//, '')}
          </span>
          <button
            type="button"
            onClick={() => navigate('/discover')}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] font-semibold transition cursor-pointer"
          >
            <span>{isNy ? 'Onani Zina' : 'Open Discover'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Genres & Sub-Genres Tab Content */}
      {activeTab === 'genres' && (
        <section className="space-y-6">
          {/* Trending Genres Leaderboard Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold font-heading text-[var(--text)] flex items-center gap-2">
                <Disc3 className="w-4 h-4 text-[var(--accent-text)]" />
                <span>{isNy ? 'Mitundu ya Nyimbo Yotsogola' : 'Top Performing Genres'}</span>
              </h2>
              {selectedGenreGroup && (
                <button
                  type="button"
                  onClick={() => setSelectedGenre('')}
                  className="text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  {isNy ? 'Onani mitundu yonse' : 'Show all genres'}
                </button>
              )}
            </div>

            {genreGroups.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center text-sm text-[var(--text-muted)]">
                {!isCatalogLoaded
                  ? t('loading', 'Loading charts...')
                  : isNy
                  ? 'Palibe mitundu ya nyimbo pakadali pano.'
                  : 'No ranked genres yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {genreGroups.map((group, idx) => {
                  const leadTrack = group.tracks[0];
                  const isFocused =
                    selectedGenreGroup?.category.toLowerCase() === group.category.toLowerCase();
                  return (
                    <div
                      key={group.category}
                      className={`rounded-2xl border p-4 transition flex flex-col justify-between gap-3 ${
                        isFocused
                          ? 'bg-[var(--surface-2)] border-[var(--accent)] shadow-sm'
                          : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-[var(--border)] shrink-0 relative">
                          <SafeImage
                            src={leadTrack?.coverArt}
                            fallbackSrc={DEFAULT_ARTWORK_SVG}
                            alt={group.category}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-mono font-bold">
                            #{idx + 1}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedGenre(isFocused ? '' : group.category)
                            }
                            className="text-left font-bold text-sm text-[var(--text)] hover:text-[var(--accent-text)] truncate block w-full cursor-pointer font-heading"
                          >
                            {translateGenreCategory(group.category, language)}
                          </button>
                          <p className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums mt-0.5">
                            {group.tracks.length} {isNy ? 'nyimbo' : 'tracks'} ·{' '}
                            {group.totalPlays.toLocaleString()} {isNy ? 'masewera' : 'plays'}
                          </p>
                          {leadTrack && (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/tracks/${encodeURIComponent(leadTrack.id)}`)
                              }
                              className="text-[11px] text-[var(--text-dim)] hover:text-[var(--accent-text)] truncate block max-w-full mt-1 cursor-pointer text-left"
                            >
                              #1: {leadTrack.title} · {leadTrack.artistName}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border)]">
                        {leadTrack && (
                          <button
                            type="button"
                            onClick={() => handlePlayChartQueue(group.tracks, 0)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] text-[11px] font-bold cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{t('play', 'Play')}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenPromoShare({
                              tab: 'genres',
                              genre: group.category,
                              title: `Top ${translateGenreCategory(group.category, language)} on LOWERVIBE`,
                              subtitle: leadTrack
                                ? `#1: "${leadTrack.title}" by ${leadTrack.artistName} · ${group.totalPlays.toLocaleString()} genre plays`
                                : `${group.tracks.length} tracks streaming free`,
                              eyebrow: `${translateGenreCategory(group.category, language)} Chart`,
                              artworkUrl: leadTrack?.coverArt,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-[11px] font-semibold cursor-pointer"
                        >
                          <Share2 className="w-3 h-3 text-[var(--accent-text)]" />
                          <span>{isNy ? 'Gawani' : 'Share'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/discover?genre=${encodeURIComponent(group.category)}`)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] text-[11px] font-semibold cursor-pointer ml-auto"
                        >
                          <span>{isNy ? 'Zambiri' : 'Explore'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Clickable Trending Sub-Genres & Mood Tags Cloud */}
          {trendingTags.length > 0 && (
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold font-heading text-[var(--text)] flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[var(--violet)]" />
                  <span>
                    {isNy ? 'Ma Tag ndi Zokonda Zomwe Zikuyenda' : 'Trending Sub-Genres & Mood Tags'}
                  </span>
                </h3>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {isNy ? 'Dinani tag kuti mufufuze' : 'Tap any tag to discover'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {trendingTags.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigate(`/search?tag=${encodeURIComponent(item.tag)}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-2)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] transition cursor-pointer whitespace-nowrap"
                  >
                    <span>#{item.tag}</span>
                    <span className="text-[10px] font-mono opacity-75">
                      {item.count > 0 ? item.count : item.artistCount}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Ranked Track List (Most Played, Trending, or Focused Genre) */}
      {(activeTab !== 'genres' || selectedGenreGroup) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold font-heading text-[var(--text)]">
              {selectedGenreGroup && activeTab === 'genres'
                ? `${translateGenreCategory(selectedGenreGroup.category, language)} — ${
                    isNy ? 'Nyimbo Zotsogola' : 'Top Songs'
                  }`
                : activeTab === 'trending'
                ? isNy
                  ? 'Nyimbo 25 Zomwe Zikukula Kwambiri'
                  : 'Top 25 Most Trending Songs'
                : isNy
                ? 'Nyimbo 25 Zomwe Zikumveka Kwambiri'
                : 'Top 25 Most Played Songs'}
            </h2>
            <span className="text-xs font-mono text-[var(--text-muted)] tabular-nums">
              {displayedList.length} {isNy ? 'nyimbo' : 'tracks'}
            </span>
          </div>

          {displayedList.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-2">
              <Disc3 className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
              <p className="text-sm font-semibold text-[var(--text)]">
                {!isCatalogLoaded
                  ? t('loading', 'Loading tracks...')
                  : isNy
                  ? 'Palibe nyimbo zotchuka pakadali pano.'
                  : 'No published tracks available in charts yet.'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
              {displayedList.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                const liked = isTrackLikedByUser(track, currentUser);
                const artist = artistLookup.get(track.artistId);
                const subTags = getTrackSubTags(track);
                const engagementScore = getTrackEngagementScore(track);

                return (
                  <div
                    key={track.id}
                    className={`flex items-center gap-3 sm:gap-4 p-3 sm:px-4 transition ${
                      isCurrent ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]/60'
                    }`}
                  >
                    {/* Rank # */}
                    <div
                      className={`w-7 sm:w-8 text-center font-mono text-sm font-extrabold tabular-nums shrink-0 ${
                        idx < 3 ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {/* Playable Artwork */}
                    <button
                      type="button"
                      onClick={() => handlePlayChartQueue(displayedList, idx)}
                      className="relative w-12 h-12 rounded-xl overflow-hidden border border-[var(--border)] shrink-0 group cursor-pointer"
                      aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                    >
                      <SafeImage
                        src={track.coverArt}
                        fallbackSrc={DEFAULT_ARTWORK_SVG}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                      <span
                        className={`absolute inset-0 flex items-center justify-center bg-black/45 transition ${
                          isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isCurrent && isPlaying ? (
                          <Pause className="w-4 h-4 text-white fill-white" />
                        ) : (
                          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        )}
                      </span>
                    </button>

                    {/* Track Title, Clickable Artist, Clickable Genre + Mood/Vibe Tags */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/tracks/${encodeURIComponent(track.id)}`)}
                          className={`text-sm font-bold truncate text-left hover:text-[var(--accent-text)] transition cursor-pointer ${
                            isCurrent ? 'text-[var(--accent-text)]' : 'text-[var(--text)]'
                          }`}
                        >
                          {track.title}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <button
                          type="button"
                          onClick={() => navigateArtist(track)}
                          className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text)] font-medium truncate max-w-[180px] cursor-pointer"
                        >
                          <span className="truncate">{track.artistName}</span>
                          {(artist?.verified || artist?.isVerified) && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                          )}
                        </button>

                        {track.genre && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/discover?genre=${encodeURIComponent(track.genre)}`)
                            }
                            className="px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[10.5px] font-semibold text-[var(--text-dim)] hover:text-[var(--accent-text)] hover:border-[var(--accent)] transition cursor-pointer whitespace-nowrap"
                          >
                            {translateGenreCategory(track.genre, language)}
                          </button>
                        )}

                        {subTags.slice(0, 2).map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              navigate(`/search?tag=${encodeURIComponent(tag)}`)
                            }
                            className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[10.5px] font-medium text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:border-[var(--accent)] transition cursor-pointer whitespace-nowrap"
                          >
                            #{tag}
                          </button>
                        ))}

                        {track.region && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/discover?region=${encodeURIComponent(track.region!)}`)
                            }
                            className="hidden md:inline-flex text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-text)] cursor-pointer"
                          >
                            · {track.region}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Real Plays / Momentum Stats */}
                    <div className="hidden sm:flex flex-col items-end text-right shrink-0 pr-1">
                      <span className="text-xs font-mono font-bold text-[var(--text)] tabular-nums">
                        {(track.plays || 0).toLocaleString()} {isNy ? 'masewera' : 'plays'}
                      </span>
                      <span className="text-[10.5px] font-mono text-[var(--text-muted)] tabular-nums">
                        {activeTab === 'trending'
                          ? `${engagementScore.toLocaleString()} ${isNy ? 'mphamvu' : 'score'}`
                          : `${getTrackLikeCount(track).toLocaleString()} ${isNy ? 'zikondedwa' : 'likes'}`}
                      </span>
                    </div>

                    {/* Row Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleLikeTrack(track.id)}
                        className={`p-2 rounded-xl border transition cursor-pointer ${
                          liked
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                            : 'border-transparent hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                        }`}
                        aria-label={liked ? 'Unlike track' : 'Like track'}
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                      </button>

                      {onOpenTrackDetails && (
                        <button
                          type="button"
                          onClick={() => onOpenTrackDetails(track)}
                          className="p-2 rounded-xl border border-transparent hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer hidden sm:inline-flex"
                          aria-label={t('details', 'Details')}
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveShareTrack(track)}
                        className="p-2 rounded-xl border border-transparent hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition cursor-pointer"
                        aria-label={t('share', 'Share')}
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Rising Regions Breakdown (Every Region Clickable) */}
      {regionalBreakdown.length > 0 && (
        <section className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold font-heading text-[var(--text)] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--accent-text)]" />
              <span>{isNy ? 'Mayiko & Madera Otchuka' : 'Top Music Scenes & Regions'}</span>
            </h3>
            <span className="text-[11px] text-[var(--text-muted)]">
              {isNy ? 'Dinani dziko kuti muone nyimbo' : 'Select a region to filter'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {regionalBreakdown.map((item) => (
              <button
                key={item.region}
                type="button"
                onClick={() =>
                  navigate(`/discover?region=${encodeURIComponent(item.region)}`)
                }
                className="text-left p-3 rounded-xl bg-[var(--surface-2)] hover:border-[var(--accent)] border border-[var(--border)] transition cursor-pointer space-y-0.5"
              >
                <div className="text-xs font-bold text-[var(--text)] truncate">{item.region}</div>
                <div className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                  {item.tracksCount} {isNy ? 'nyimbo' : 'tracks'} · {item.totalPlays.toLocaleString()}{' '}
                  {isNy ? 'masewera' : 'plays'}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
