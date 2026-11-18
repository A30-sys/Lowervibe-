import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  MessageCircle,
  Send,
  Share2,
  Twitter,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { Track } from '../types';
import { DEFAULT_ARTWORK_SVG } from '../utils/artworkFallback';

interface ShareModalProps {
  track: Track | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ track, onClose }) => {
  const [activeTab, setActiveTab] = useState<'card' | 'socials' | 'embed'>('card');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  if (!track) return null;

  const shareUrl = `${window.location.origin}/tracks/${track.id}`;
  const embedCode = `<iframe src="${window.location.origin}/tracks/${track.id}" width="100%" height="160" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
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
          title: `${track.title} by ${track.artistName} on LOWERVIBE`,
          text: `Listen to "${track.title}" by ${track.artistName} on LOWERVIBE`,
          url: shareUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  const shareText = encodeURIComponent(`Listen to "${track.title}" by ${track.artistName} on LOWERVIBE`);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}%20${encodeURIComponent(shareUrl)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${shareText}`;
  const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${shareText}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-[24px] shadow-2xl overflow-hidden flex flex-col text-[var(--text)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[var(--accent-text)]" />
            <h3 className="text-base font-bold text-[var(--text)] font-heading">Share song</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-xl transition cursor-pointer"
            aria-label="Close share dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)] bg-[var(--surface-2)]">
          {[
            { id: 'card', label: 'Preview card' },
            { id: 'socials', label: 'Link & apps' },
            { id: 'embed', label: 'Embed' },
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

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {activeTab === 'card' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                    LOWERVIBE
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {track.genre}
                    {track.region ? ` · ${track.region}` : ''}
                  </span>
                </div>

                <div className="flex gap-4 items-center">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-[var(--border)] bg-[var(--surface)]">
                    <img
                      src={track.coverArt || DEFAULT_ARTWORK_SVG}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-bold text-[var(--text)] truncate font-heading">
                      {track.title}
                    </h4>
                    <p className="text-sm text-[var(--text-muted)] font-medium truncate mt-0.5">
                      {track.artistName}
                    </p>
                    {track.vibeTags && track.vibeTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {track.vibeTags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-lg text-[10px] bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--accent)] hover:brightness-95 text-[var(--accent-contrast)] font-bold text-sm transition cursor-pointer"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link copied' : 'Copy link'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--bg)] text-[var(--text)] text-sm font-semibold transition border border-[var(--border)] cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'socials' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1.5">
                  Song link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-xl text-xs font-mono text-[var(--text)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2.5 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-dim)] mb-2">
                  Share to apps
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
                Copy this HTML snippet to add the song link to your website or blog.
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
                  <span>{copiedEmbed ? 'Copied' : 'Copy HTML'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
