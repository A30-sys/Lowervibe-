import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  Send,
  Share2,
  ShieldCheck,
  Twitter,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
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

interface ShareModalProps {
  track: Track | null;
  artist?: Artist | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ track, artist, onClose }) => {
  const { language, t } = useLanguage();
  const isNy = language === 'ny';
  const [activeTab, setActiveTab] = useState<'card' | 'socials' | 'embed'>('card');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedShortLink, setCopiedShortLink] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [exportingCard, setExportingCard] = useState<'square' | 'story' | null>(null);

  if (!track && !artist) return null;

  const isTrackShare = Boolean(track);
  const shareTitle = track
    ? `${track.title} — ${track.artistName} | LOWERVIBE`
    : `${artist!.name} | LOWERVIBE`;
  const shareDescription = track
    ? isNy
      ? `Mverani "${track.title}" ya ${track.artistName} pa LOWERVIBE`
      : `Listen to "${track.title}" by ${track.artistName} on LOWERVIBE`
    : isNy
    ? `Pezani ${artist!.name} ndikutsitsa nyimbo zawo pa LOWERVIBE`
    : `Discover ${artist!.name} and stream their tracks on LOWERVIBE`;

  const shareUrl = track ? getTrackShareUrl(track.id) : getArtistShareUrl(artist!);
  const shortUrl = track ? getShortTrackShareUrl(track.id) : getShortArtistShareUrl(artist!);
  const embedCode = `<iframe src="${shareUrl}" width="100%" height="${isTrackShare ? 160 : 220}" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleCopyShortLink = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopiedShortLink(true);
    setTimeout(() => setCopiedShortLink(false), 2200);
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2200);
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
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  const viralCaption = track
    ? isNy
      ? `Nyimbo yatsopano pa LOWERVIBE! Mverani "${track.title}" ya ${track.artistName} kwaulere tsopano: ${shortUrl} #LOWERVIBE #MalawiMusic #AfricanMusic`
      : `Out now on LOWERVIBE! Stream "${track.title}" by ${track.artistName} free on any phone: ${shortUrl} #LOWERVIBE #MalawiMusic #AfroPop`
    : isNy
    ? `Tsatirani ${artist!.name} pa LOWERVIBE ndikumvera nyimbo zawo zonse kwaulere: ${shortUrl} #LOWERVIBE #MalawiMusic`
    : `Discover ${artist!.name} on LOWERVIBE — stream their latest tracks free: ${shortUrl} #LOWERVIBE #MalawiMusic`;

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(viralCaption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2200);
  };

  const handleDownloadPromoCard = async (aspect: 'square' | 'story') => {
    setExportingCard(aspect);
    await exportReleasePromoCard({
      title: track ? track.title : artist!.name,
      subtitle: track
        ? `${track.artistName}${track.genre ? ` · ${translateGenreCategory(track.genre, language)}` : ''}`
        : `${artist!.country || artist!.location || 'Malawi'} · Verified Artist`,
      eyebrow: track
        ? isNy
          ? 'Nyimbo Yoyenera Kumvera'
          : 'Now Streaming'
        : isNy
        ? 'Woimba wa LOWERVIBE'
        : 'Artist Spotlight',
      artworkUrl: track ? track.coverArt : artist!.avatar,
      shortUrl,
      aspect,
    });
    setExportingCard(null);
  };

  const encodedText = encodeURIComponent(shareDescription);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodeURIComponent(shortUrl)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}%20${encodeURIComponent(shortUrl)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shortUrl)}&text=${encodedText}`;
  const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodedText}`;

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
              {isTrackShare
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

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {activeTab === 'card' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)] inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isNy ? 'Ulalo Wovomerezeka wa LOWERVIBE' : 'Official LOWERVIBE Link'}</span>
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {track
                      ? `${translateGenreCategory(track.genre, language)}${track.region ? ` · ${track.region}` : ''}`
                      : artist!.country || artist!.location || t('artist')}
                  </span>
                </div>

                <div className="flex gap-4 items-center">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-[var(--border)] bg-[var(--surface)]">
                    <img
                      src={
                        track
                          ? track.coverArt || DEFAULT_ARTWORK_SVG
                          : artist!.avatar || DEFAULT_AVATAR_SVG
                      }
                      alt={track ? track.title : artist!.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-bold text-[var(--text)] truncate font-heading">
                      {track ? track.title : artist!.name}
                    </h4>
                    <p className="text-sm text-[var(--text-muted)] font-medium truncate mt-0.5">
                      {track
                        ? track.artistName
                        : `${artist!.followersCount || 0} ${
                            (artist!.followersCount || 0) === 1
                              ? t('follower_singular')
                              : t('follower_plural')
                          }`}
                    </p>
                    <p className="text-[11px] font-mono text-[var(--accent-text)] truncate mt-2">
                      {shortUrl}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyShortLink}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--accent)] hover:brightness-95 text-[var(--accent-contrast)] font-bold text-sm transition cursor-pointer"
                >
                  {copiedShortLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>
                    {copiedShortLink
                      ? t('link_copied')
                      : isNy
                      ? 'Koperani ulalo wachidule'
                      : 'Copy short link'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] text-[var(--text)] text-sm font-semibold transition border border-[var(--border)] cursor-pointer"
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
                    {isNy ? 'WhatsApp · TikTok · Facebook' : 'WhatsApp · TikTok · Facebook'}
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
                    <span>{exportingCard === 'square' ? '...' : isNy ? 'Post Card (1:1)' : 'Post Card (1:1)'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={exportingCard !== null}
                    onClick={() => handleDownloadPromoCard('story')}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-[var(--violet)]" />
                    <span>{exportingCard === 'story' ? '...' : isNy ? 'Status / Story (9:16)' : 'Story / Status (9:16)'}</span>
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
                    ? `Ulalo wachidule (umatsegula mwachindunji ${isTrackShare ? 'nyimboyi' : 'woimbayu'})`
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
                  ? 'Koperani code iyi ya HTML kuti muike nyimbo kapena woimba wa LOWERVIBE pa tsamba lanu.'
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
