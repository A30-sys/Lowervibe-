import { Globe, Mail, Share2 } from 'lucide-react';
import React from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { LANGUAGES, useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { getPlatformShareUrl } from '../../utils/shareLinks';
import { sanitizeSocialUrl } from '../../utils/socialLinks';
import { LowerVibeLogo, LowerVibeMark } from '../brand/LowerVibeLogo';

interface FooterProps {
  onOpenLegal?: (type: 'terms' | 'privacy') => void;
  onNavigate?: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { language, setLanguage, t } = useLanguage();
  const { monetizationConfig } = useAudio();
  const { updateUserSettings } = useAuth();
  const { showToast } = useToast();
  const isNy = language === 'ny';

  const siteUrl = getPlatformShareUrl();
  const shareText = isNy
    ? 'Mverani nyimbo za oimba odziyimira okha a ku Malawi ndi Africa yonse pa LOWERVIBE!'
    : 'Stream independent African music from Malawi and beyond on LOWERVIBE.';

  const handleSharePlatform = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'LOWERVIBE',
          text: shareText,
          url: siteUrl,
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(siteUrl);
      showToast(t('link_copied', 'Link copied!'));
    } catch {
      showToast(siteUrl);
    }
  };

  const configuredSocials = monetizationConfig?.socialLinks || {};
  const officialWhatsapp = sanitizeSocialUrl(configuredSocials.whatsapp);
  const officialFacebook = sanitizeSocialUrl(configuredSocials.facebook);
  const officialInstagram = sanitizeSocialUrl(configuredSocials.instagram);
  const officialTiktok = sanitizeSocialUrl(configuredSocials.tiktok);
  const officialYoutube = sanitizeSocialUrl(configuredSocials.youtube);
  const officialX = sanitizeSocialUrl(configuredSocials.x);

  const socialLinks = [
    {
      name: 'WhatsApp',
      href:
        officialWhatsapp ||
        `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${siteUrl}`)}`,
      title: officialWhatsapp
        ? isNy
          ? 'LOWERVIBE pa WhatsApp'
          : 'LOWERVIBE on WhatsApp'
        : isNy
        ? 'Gawani pa WhatsApp'
        : 'Share on WhatsApp',
      svg: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M12.04 2C6.52 2 2.04 6.48 2.04 12c0 1.77.46 3.5 1.34 5.02L2 22l5.12-1.34A9.94 9.94 0 0 0 12.04 22c5.52 0 10-4.48 10-10S17.56 2 12.04 2Zm5.82 14.12c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.66-.61-2.92-1.26-4.82-4.2-4.96-4.39-.15-.2-1.18-1.57-1.18-3s.75-2.12 1.02-2.41c.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.24.59.82 2.02.9 2.17.07.15.12.32.02.52-.1.2-.15.32-.3.49-.15.17-.31.38-.44.51-.15.15-.3.31-.13.61.17.3.76 1.26 1.63 2.03 1.12 1 2.06 1.31 2.36 1.46.3.15.47.13.65-.08.17-.2.74-.86.94-1.16.2-.3.39-.25.66-.15.27.1 1.72.81 2.01.96.3.15.49.22.56.34.08.12.08.7-.16 1.38Z" />
        </svg>
      ),
    },
    {
      name: 'Facebook',
      href:
        officialFacebook ||
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteUrl)}`,
      title: officialFacebook
        ? isNy
          ? 'LOWERVIBE pa Facebook'
          : 'LOWERVIBE on Facebook'
        : isNy
        ? 'Gawani pa Facebook'
        : 'Share on Facebook',
      svg: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.25-1.5 1.54-1.5H16.7V4.9c-.29-.04-1.27-.12-2.42-.12-2.4 0-4.04 1.46-4.04 4.15V11H7.5v3h2.74v8h3.26Z" />
        </svg>
      ),
    },
    ...(officialInstagram
      ? [
          {
            name: 'Instagram',
            href: officialInstagram,
            title: isNy ? 'LOWERVIBE pa Instagram' : 'LOWERVIBE on Instagram',
            svg: (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Zm9.75 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(officialTiktok
      ? [
          {
            name: 'TikTok',
            href: officialTiktok,
            title: isNy ? 'LOWERVIBE pa TikTok' : 'LOWERVIBE on TikTok',
            svg: (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(officialYoutube
      ? [
          {
            name: 'YouTube',
            href: officialYoutube,
            title: isNy ? 'LOWERVIBE pa YouTube' : 'LOWERVIBE on YouTube',
            svg: (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42a2.5 2.5 0 0 0-1.76 1.77C2 8.76 2 12 2 12s0 3.24.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.24 22 12 22 12s0-3.24-.42-4.81ZM10 15V9l5.2 3-5.2 3Z" />
              </svg>
            ),
          },
        ]
      : []),
    {
      name: 'X',
      href:
        officialX ||
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(siteUrl)}`,
      title: officialX
        ? isNy
          ? 'LOWERVIBE pa X'
          : 'LOWERVIBE on X'
        : isNy
        ? 'Gawani pa X'
        : 'Share on X',
      svg: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M18.24 2H21l-6.56 7.5L22 22h-6.06l-4.74-6.2L5.77 22H3l7.02-8.02L2.6 2h6.21l4.29 5.67L18.24 2Zm-1.06 18h1.68L7.29 3.9H5.49L17.18 20Z" />
        </svg>
      ),
    },
    {
      name: 'Email',
      href: 'mailto:odulamw@gmail.com?subject=LOWERVIBE%20Music',
      title: isNy ? 'Tumizani Imelo' : 'Email LOWERVIBE',
      svg: <Mail className="w-4 h-4" />,
    },
  ];

  return (
    <footer className="mt-16 pt-10 pb-6 border-t border-[var(--border)] text-[var(--text-muted)] transition-colors duration-200">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-md">
            <LowerVibeLogo size="md" showTagline={false} />
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              {t(
                'footer_tagline',
                'Independent music from Malawi, Nigeria, and across Africa. Built for listeners and artists everywhere.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Official LOWERVIBE Community & Social Actions */}
            <div className="flex items-center gap-1.5" aria-label="LOWERVIBE Social & Share">
              {socialLinks.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target={item.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel={item.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                  title={item.title}
                  aria-label={item.title}
                  className="w-10 h-10 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-center transition active:scale-95"
                >
                  {item.svg}
                </a>
              ))}
              <button
                type="button"
                onClick={handleSharePlatform}
                title={isNy ? 'Gawani LOWERVIBE' : 'Share LOWERVIBE'}
                aria-label={isNy ? 'Gawani LOWERVIBE' : 'Share LOWERVIBE'}
                className="w-10 h-10 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-muted)] hover:text-[var(--accent-text)] flex items-center justify-center transition active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {/* 1-Tap Language Switcher (English / Chichewa) */}
            <div
              className="flex items-center gap-1 p-1 rounded-2xl bg-[var(--surface)] border border-[var(--border)] min-h-[44px]"
              role="group"
              aria-label={t('footer_language', 'Language')}
            >
              <Globe className="w-3.5 h-3.5 text-[var(--accent-text)] ml-2 mr-1 shrink-0" />
              {LANGUAGES.map((opt) => {
                const active = language === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => {
                      setLanguage(opt.code);
                      void updateUserSettings({ appearance: { language: opt.code } });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[36px] whitespace-nowrap ${
                      active
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-[var(--border)] text-xs">
          <div className="space-y-2.5">
            <h4 className="font-semibold text-[var(--text)] text-xs">
              {t('footer_explore', 'Explore')}
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/')}
                  className="hover:text-[var(--text)] transition cursor-pointer text-left"
                >
                  {t('home', 'Home')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/search')}
                  className="hover:text-[var(--text)] transition cursor-pointer text-left"
                >
                  {t('footer_search_music', 'Search music')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/artists')}
                  className="hover:text-[var(--text)] transition cursor-pointer text-left"
                >
                  {t('artists', 'Artists')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/library')}
                  className="hover:text-[var(--text)] transition cursor-pointer text-left"
                >
                  {t('footer_your_library', 'Your Library')}
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-semibold text-[var(--text)] text-xs">
              {t('footer_artists', 'Artists')}
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/artistcreator')}
                  className="hover:text-[var(--text)] transition cursor-pointer text-left"
                >
                  {t('artist_creator', 'Artist Creator')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/account')}
                  className="hover:text-[var(--text)] transition cursor-pointer text-left"
                >
                  {t('footer_your_profile', 'Your Profile')}
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-semibold text-[var(--text)] text-xs">
              {t('footer_legal', 'Legal')}
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/about')}
                  className="hover:text-[var(--text)] transition cursor-pointer text-left"
                >
                  {t('footer_about', 'About LOWERVIBE')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/terms')}
                  className="hover:text-[var(--text)] transition cursor-pointer text-left"
                >
                  {t('footer_terms', 'Terms of Service')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/privacy')}
                  className="hover:text-[var(--text)] transition cursor-pointer text-left"
                >
                  {t('footer_privacy', 'Privacy Policy')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/copyright')}
                  className="hover:text-[var(--text)] transition cursor-pointer text-left"
                >
                  {t('footer_copyright', 'Copyright & Takedown')}
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-semibold text-[var(--text)] text-xs">
              {t('footer_contact', 'Contact')}
            </h4>
            <address className="not-italic space-y-1.5 leading-relaxed text-[var(--text-muted)]">
              <div className="font-semibold text-[var(--text)]">LOWERVIBE Media House</div>
              <div>Nsanje, M1 Road</div>
              <div>Malawi</div>
              <div>
                <a
                  href="mailto:odulamw@gmail.com"
                  className="hover:text-[var(--accent-text)] underline"
                >
                  odulamw@gmail.com
                </a>
              </div>
            </address>
          </div>
        </div>

        <div className="pt-5 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2.5">
            <LowerVibeMark className="w-5 h-5 shrink-0" />
            <span className="font-semibold text-[var(--text)]">
              &copy; {new Date().getFullYear()} LOWERVIBE
            </span>
          </div>
          <span>{t('footer_built_by', 'Built by brownjnr')}</span>
        </div>
      </div>
    </footer>
  );
};
