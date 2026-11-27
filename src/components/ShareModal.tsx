import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  MessageCircle,
  Send,
  Share2,
  ShieldCheck,
  Twitter,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { Artist, Track } from '../types';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG } from '../utils/artworkFallback';
import { translateGenreCategory } from '../utils/genreCategories';
import { exportReleasePromoCard } from '../utils/promoBannerExport';
import {
  getArtistShareUrl,
  getShortArtistShareUrl,
  getShortTrackShareUrl,
  getTrackShareUrl,
} from '../utils/shareLinks';
import { SafeImage } from './SafeImage';

export interface PromoSharePayload {
  title: string;
  subtitle: string;
  eyebrow: string;
  artworkUrl?: string;
  shareUrl: string;
  shortUrl: string;
  caption: string;
  badgeText?: string;
  ctaLabel?: string;
  trackId?: string;
  tab?: string;
  genre?: string;
}

interface VerifiedServerPreview {
  ok: boolean;
  found?: boolean;
  isDraft?: boolean;
  id?: string;
  title?: string;
  artistName?: string;
  shareTitle?: string;
  description?: string;
  imageUrl?: string;
  coverEndpointUrl?: string;
  shortUrl?: string;
  canonicalUrl?: string;
}

interface ShareModalProps {
  track: Track | null;
  artist?: Artist | null;
  promoShare?: PromoSharePayload | null;
  onClose: () => void;
}

async function copyTextSafely(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to textarea copy below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export const ShareModal: React.FC<ShareModalProps> = ({
  track,
  artist,
  promoShare,
  onClose,
}) => {
  const { language, t } = useLanguage();
  const { artists } = useAudio();
  const { currentUser } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const isNy = language === 'ny';

  const [activeTab, setActiveTab] = useState<'card' | 'socials' | 'embed'>('card');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedShortLink, setCopiedShortLink] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [exportingCard, setExportingCard] = useState<'square' | 'story' | null>(null);
  const [serverPreview, setServerPreview] = useState<VerifiedServerPreview | null>(null);
  const [isVerifyingPreview, setIsVerifyingPreview] = useState(false);
  const [previewEndpointMissing, setPreviewEndpointMissing] = useState(false);

  const resolvedArtist =
    artist ||
    (track ? artists.find((a) => a.id === track.artistId) : undefined) ||
    null;

  useEffect(() => {
    if (!track && !artist && !promoShare) {
      setServerPreview(null);
      setPreviewEndpointMissing(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setIsVerifyingPreview(true);
    setPreviewEndpointMissing(false);

    let endpoint = '';
    if (promoShare) {
      const qs = new URLSearchParams({ type: 'charts' });
      try {
        const parsed = new URL(promoShare.shareUrl, window.location.origin);
        const tabParam = promoShare.tab || parsed.searchParams.get('tab');
        const genreParam = promoShare.genre || parsed.searchParams.get('genre');
        const trackParam = promoShare.trackId || parsed.searchParams.get('track');
        if (tabParam) qs.set('tab', tabParam);
        if (genreParam) qs.set('genre', genreParam);
        if (trackParam) qs.set('track', trackParam);
      } catch {}
      endpoint = `/api/share-preview?${qs.toString()}`;
    } else if (track) {
      const qs = new URLSearchParams({ type: 'track', id: track.id });
      if (track.isDraft) qs.set('includeDraft', '1');
      endpoint = `/api/share-preview?${qs.toString()}`;
    } else if (artist) {
      const qs = new URLSearchParams({
        type: 'artist',
        id: (artist.slug || artist.id).trim(),
      });
      endpoint = `/api/share-preview?${qs.toString()}`;
    }

    fetch(endpoint, { signal: controller.signal })
      .then(async (res) => {
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (res.status === 404 && !contentType.includes('application/json')) {
          if (!cancelled) setPreviewEndpointMissing(true);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data: VerifiedServerPreview | null) => {
        if (!cancelled) {
          setServerPreview(data && data.ok ? data : null);
        }
      })
      .catch(() => {
        if (!cancelled) setServerPreview(null);
      })
      .finally(() => {
        if (!cancelled) setIsVerifyingPreview(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [track, artist, promoShare]);

  if (!track && !artist && !promoShare) return null;

  const isPromoShare = Boolean(promoShare);
  const isTrackShare = Boolean(track);

  const displayTitle = promoShare
    ? promoShare.title
    : track
    ? serverPreview?.title || track.title
    : serverPreview?.title || artist!.name;

  const displayArtistName = promoShare
    ? promoShare.subtitle
    : track
    ? serverPreview?.artistName || track.artistName || resolvedArtist?.name || 'Independent Artist'
    : `${artist!.followersCount || 0} ${
        (artist!.followersCount || 0) === 1
          ? t('follower_singular')
          : t('follower_plural')
      }`;

  const shareTitle = promoShare
    ? `${promoShare.title} | LOWERVIBE`
    : track
    ? `${displayTitle} by ${displayArtistName} | LOWERVIBE`
    : `${displayTitle} | LOWERVIBE`;

  const shareDescription = promoShare
    ? promoShare.caption
    : track
    ? isNy
      ? `Mverani "${displayTitle}" ya ${displayArtistName} pa LOWERVIBE`
      : `Listen to "${displayTitle}" by ${displayArtistName} on LOWERVIBE`
    : isNy
    ? `Pezani ${displayTitle} ndikutsitsa nyimbo zawo pa LOWERVIBE`
    : `Discover ${displayTitle} and stream their tracks on LOWERVIBE`;

  const shareUrl = promoShare
    ? promoShare.shareUrl
    : track
    ? getTrackShareUrl(track.id)
    : getArtistShareUrl(artist!);

  const shortUrl = promoShare
    ? promoShare.shortUrl
    : track
    ? getShortTrackShareUrl(track.id)
    : getShortArtistShareUrl(artist!);

  const embedCode = `<iframe src="${shareUrl}" width="100%" height="${isTrackShare ? 160 : 240}" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;

  const handleCopyLink = async () => {
    const ok = await copyTextSafely(shareUrl);
    if (ok) {
      setCopiedLink(true);
      showToast(t('link_copied', 'Link copied to clipboard'));
      window.setTimeout(() => setCopiedLink(false), 2200);
    } else {
      showToast(isNy ? 'Sitinathe kukopera ulalo' : 'Could not copy link');
    }
  };

  const handleCopyShortLink = async () => {
    const ok = await copyTextSafely(shortUrl);
    if (ok) {
      setCopiedShortLink(true);
      showToast(t('link_copied', 'Link copied to clipboard'));
      window.setTimeout(() => setCopiedShortLink(false), 2200);
    } else {
      showToast(isNy ? 'Sitinathe kukopera ulalo' : 'Could not copy link');
    }
  };

  const handleCopyEmbed = async () => {
    const ok = await copyTextSafely(embedCode);
    if (ok) {
      setCopiedEmbed(true);
      showToast(isNy ? 'Code ya HTML yakopedwa' : 'Embed snippet copied');
      window.setTimeout(() => setCopiedEmbed(false), 2200);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareDescription,
          url: shortUrl,
        });
      } catch {
        // User cancelled native share sheet
      }
    } else {
      await handleCopyShortLink();
    }
  };

  const viralCaption = promoShare
    ? promoShare.caption
    : track
    ? isNy
      ? `Nyimbo yatsopano pa LOWERVIBE! Mverani "${displayTitle}" ya ${displayArtistName} kwaulere tsopano: ${shortUrl} #LOWERVIBE #MalawiMusic #AfricanMusic`
      : `Out now on LOWERVIBE! Stream "${displayTitle}" by ${displayArtistName} free on any phone: ${shortUrl} #LOWERVIBE #MalawiMusic #AfroPop`
    : isNy
    ? `Tsatirani ${displayTitle} pa LOWERVIBE ndikumvera nyimbo zawo zonse kwaulere: ${shortUrl} #LOWERVIBE #MalawiMusic`
    : `Discover ${displayTitle} on LOWERVIBE — stream their latest tracks free: ${shortUrl} #LOWERVIBE #MalawiMusic`;

  const handleCopyCaption = async () => {
    const ok = await copyTextSafely(viralCaption);
    if (ok) {
      setCopiedCaption(true);
      showToast(isNy ? 'Mau otsatsa akopedwa' : 'Promo caption copied');
      window.setTimeout(() => setCopiedCaption(false), 2200);
    }
  };

  const previewImage = promoShare
    ? promoShare.artworkUrl || serverPreview?.imageUrl || serverPreview?.coverEndpointUrl || DEFAULT_ARTWORK_SVG
    : track
    ? track.coverArt ||
      resolvedArtist?.avatar ||
      track.artistAvatar ||
      serverPreview?.imageUrl ||
      serverPreview?.coverEndpointUrl ||
      DEFAULT_ARTWORK_SVG
    : artist!.avatar || artist!.banner || serverPreview?.imageUrl || serverPreview?.coverEndpointUrl || DEFAULT_AVATAR_SVG;

  const handleDownloadPromoCard = async (aspect: 'square' | 'story') => {
    setExportingCard(aspect);
    await exportReleasePromoCard({
      title: displayTitle,
      subtitle: promoShare
        ? promoShare.subtitle
        : track
        ? `${displayArtistName}${track.genre ? ` · ${translateGenreCategory(track.genre, language)}` : ''}`
        : `${artist!.country || artist!.location || 'Malawi'} · Verified Artist`,
      eyebrow: promoShare
        ? promoShare.eyebrow
        : track
        ? isNy
          ? 'Nyimbo Yoyenera Kumvera'
          : 'Now Streaming'
        : isNy
        ? 'Woimba wa LOWERVIBE'
        : 'Artist Spotlight',
      artworkUrl: serverPreview?.coverEndpointUrl || previewImage,
      shortUrl,
      aspect,
      ctaLabel: promoShare?.ctaLabel,
    });
    setExportingCard(null);
  };

  const handleOpenPreviewPage = () => {
    try {
      const target = new URL(shareUrl, window.location.origin);
      onClose();
      navigate(`${target.pathname}${target.search}`);
    } catch {
      onClose();
    }
  };

  const encodedText = encodeURIComponent(shareDescription);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodeURIComponent(shortUrl)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}%20${encodeURIComponent(shortUrl)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shortUrl)}&text=${encodedText}`;
  const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(shortUrl)}&title=${encodedText}`;

  const isOwnerOfTrack = Boolean(
    track &&
      currentUser &&
      (track.uploadedByUserId === currentUser.id ||
        resolvedArtist?.ownerId === currentUser.id ||
        resolvedArtist?.ownerUserId === currentUser.id ||
        resolvedArtist?.claimedByUserId === currentUser.id)
  );
  const isVerifiedArtist = Boolean(resolvedArtist?.verified || resolvedArtist?.isVerified);
  const previewDomainLabel = shortUrl.replace(/^https?:\/\//, '').split('/')[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-[24px] shadow-2xl overflow-hidden flex flex-col text-[var(--text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[var(--accent-text)]" />
            <h3 className="text-base font-bold text-[var(--text)] font-heading">
              {isPromoShare
                ? isNy
                  ? 'Gawani Tchati & Kutsatsa'
                  : 'Share Chart & Promo'
                : isTrackShare
                ? isNy
                  ? 'Gawani nyimbo'
                  : 'Share song'
                : isNy
                ? 'Gawani woimba'
                : 'Share artist'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-xl transition cursor-pointer"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-[var(--border)] bg-[var(--surface-2)]">
          {[
            { id: 'card', label: isNy ? 'Chithunzi' : 'Preview card' },
            { id: 'socials', label: isNy ? 'Maulalo odalirika' : 'Trusted links' },
            { id: 'embed', label: isNy ? 'Ikani patsamba' : 'Embed' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'card' | 'socials' | 'embed')}
              className={`flex-1 py-3 text-xs font-semibold transition border-b-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[var(--accent-text)] text-[var(--text)] bg-[var(--surface)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {activeTab === 'card' && (
            <div className="space-y-4">
              {previewEndpointMissing && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-amber-400">
                      {isNy ? 'Ma Cloud Functions sanayikidwe' : 'Social crawler endpoint not deployed on this host'}
                    </div>
                    <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                      {isNy
                        ? 'Ikani Firebase Hosting ndi Cloud Functions (firebase deploy --only hosting,functions) kuti Facebook ndi WhatsApp zione chithunzi ndi dzina la nyimbo m’malo mwa 404.'
                        : 'Deploy Cloud Functions (firebase deploy --only hosting,functions) so Facebook and WhatsApp crawlers receive live OpenGraph song cards instead of 404.'}
                    </p>
                  </div>
                </div>
              )}

              {track?.isDraft && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-amber-400">
                      {isNy ? 'Nyimbo ikali m\'zolembedwa (Draft)' : 'Draft Track Preview'}
                    </div>
                    <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                      {isOwnerOfTrack
                        ? isNy
                          ? 'Inu ngati mwini nyimbo mukuona chithunzi ndi dzina lenileni tsopano, koma falitsani nyimboyi mu Studio kuti aliyense atsegule link.'
                          : 'You see the real artwork, title, and artist preview as the owner. Publish this track in Studio so listeners opening this link can stream it.'
                        : 'This track is still a draft and cannot be streamed publicly yet.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Trusted Social Link Unfurl Preview */}
              <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)] inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isNy ? 'Ulalo Wovomerezeka wa LOWERVIBE' : 'Official LOWERVIBE Preview'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-[var(--text-muted)]">
                    {isVerifyingPreview ? (
                      <span>{isNy ? 'Ikutsimikizira...' : 'Verifying OG...'}</span>
                    ) : serverPreview?.found ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isNy ? 'Chithunzi chatsimikizidwa' : 'OG Card Verified'}</span>
                      </span>
                    ) : (
                      <span>
                        {promoShare
                          ? promoShare.badgeText || promoShare.eyebrow
                          : track
                          ? `${translateGenreCategory(track.genre, language)}${track.region ? ` · ${track.region}` : ''}`
                          : artist!.country || artist!.location || t('artist')}
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex gap-4 items-center">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                    <SafeImage
                      src={previewImage}
                      fallbackSrc={
                        track || promoShare ? DEFAULT_ARTWORK_SVG : DEFAULT_AVATAR_SVG
                      }
                      alt={displayTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-muted)] truncate">
                      {previewDomainLabel}
                      {track ? ` · ID: ${track.id}` : ''}
                    </div>
                    <h4 className="text-base font-bold text-[var(--text)] truncate font-heading mt-0.5">
                      {displayTitle}
                    </h4>
                    <p className="text-sm text-[var(--text-muted)] font-medium truncate mt-0.5 inline-flex items-center gap-1 max-w-full">
                      <span className="truncate">{displayArtistName}</span>
                      {isVerifiedArtist && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                      )}
                    </p>
                    <p className="text-[11px] font-mono text-[var(--accent-text)] truncate mt-2">
                      {shortUrl}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)] text-[11px]">
                  <span className="text-[var(--text-muted)] truncate">
                    {serverPreview?.description || shareDescription}
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenPreviewPage}
                    className="inline-flex items-center gap-1 font-bold text-[var(--accent-text)] hover:underline shrink-0 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isNy ? 'Onani tsamba' : 'Open page'}</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyShortLink}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--accent)] hover:brightness-95 text-[var(--accent-contrast)] font-bold text-sm transition cursor-pointer min-h-[46px]"
                >
                  {copiedShortLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>
                    {copiedShortLink
                      ? t('link_copied')
                      : isNy
                      ? 'Koperani ulalo wachidule'
                      : 'Copy share link'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] text-[var(--text)] text-sm font-semibold transition border border-[var(--border)] cursor-pointer min-h-[46px]"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{t('share')}</span>
                </button>
              </div>

              {/* $0 Social Promo Kit: PNG Export + Ready-to-Post Caption */}
              <div className="pt-3 border-t border-[var(--border)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text)]">
                    {isNy ? 'Chithunzi & Mau Otsatsa (Zaulere)' : 'Free Social Promo Kit'}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    WhatsApp · TikTok · Facebook
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={exportingCard !== null}
                    onClick={() => handleDownloadPromoCard('square')}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span>{exportingCard === 'square' ? '...' : 'Post Card (1:1)'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={exportingCard !== null}
                    onClick={() => handleDownloadPromoCard('story')}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-[var(--violet)]" />
                    <span>
                      {exportingCard === 'story'
                        ? '...'
                        : isNy
                        ? 'Status / Story (9:16)'
                        : 'Story / Status (9:16)'}
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCaption}
                  className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-left transition cursor-pointer"
                >
                  <span className="text-[11px] text-[var(--text-muted)] truncate">{viralCaption}</span>
                  <span className="text-[11px] font-bold text-[var(--accent-text)] shrink-0 inline-flex items-center gap-1">
                    {copiedCaption ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCaption ? (isNy ? 'Wakopedwa' : 'Copied') : (isNy ? 'Koperani mau' : 'Copy caption')}</span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'socials' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1.5">
                  {isNy
                    ? 'Ulalo wachidule wodalirika'
                    : isPromoShare
                    ? 'Short promo link (opens straight to chart)'
                    : `Short direct link (opens straight to ${isTrackShare ? 'song' : 'artist'})`}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shortUrl}
                    className="flex-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-xl text-xs font-mono text-[var(--text)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyShortLink}
                    className="px-3.5 py-2.5 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedShortLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedShortLink ? (isNy ? 'Wakopedwa' : 'Copied') : (isNy ? 'Koperani' : 'Copy')}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1.5">
                  {isNy ? 'Ulalo wovomerezeka wathunthu' : 'Canonical trusted URL'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-xs font-mono text-[var(--text-muted)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? (isNy ? 'Wakopedwa' : 'Copied') : (isNy ? 'Koperani' : 'Copy')}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-dim)] mb-2">
                  {isNy ? 'Gawani m\'mapulogalamu' : 'Share to apps'}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs font-medium transition"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-500" />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href={twitterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs font-medium transition"
                  >
                    <Twitter className="w-4 h-4 text-sky-500" />
                    <span>X (Twitter)</span>
                  </a>
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs font-medium transition"
                  >
                    <Send className="w-4 h-4 text-cyan-500" />
                    <span>Telegram</span>
                  </a>
                  <a
                    href={redditUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs font-medium transition"
                  >
                    <ExternalLink className="w-4 h-4 text-orange-500" />
                    <span>Reddit</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {isNy
                  ? 'Koperani code iyi ya HTML kuti muike nyimbo kapena tchati cha LOWERVIBE pa tsamba lanu.'
                  : 'Copy this HTML snippet to embed this verified LOWERVIBE link on your website or blog.'}
              </p>
              <div className="relative">
                <textarea
                  readOnly
                  rows={4}
                  value={embedCode}
                  className="w-full p-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-xl text-xs font-mono text-[var(--text)] focus:outline-none resize-none"
                />
                <button
                  type="button"
                  onClick={handleCopyEmbed}
                  className="mt-2 px-3.5 py-2 bg-[var(--surface-2)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedEmbed ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Code2 className="w-3.5 h-3.5" />}
                  <span>{copiedEmbed ? (isNy ? 'Wakopedwa' : 'Copied') : (isNy ? 'Koperani HTML' : 'Copy HTML')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
