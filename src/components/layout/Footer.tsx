import { Globe, Instagram, Music2, Twitter, Youtube } from 'lucide-react';
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LANGUAGES, useLanguage } from '../../context/LanguageContext';
import { LowerVibeLogo } from '../brand/LowerVibeLogo';

interface FooterProps {
  onOpenLegal?: (type: 'terms' | 'privacy') => void;
  onNavigate?: (path: string) => void;
}

const SOCIAL_LINKS = [
  { name: 'Instagram', url: 'https://instagram.com/lowervibe', icon: Instagram },
  { name: 'X', url: 'https://x.com/lowervibe_fm', icon: Twitter },
  { name: 'YouTube', url: 'https://youtube.com/@lowervibe', icon: Youtube },
];

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { language, setLanguage, t } = useLanguage();
  const { updateUserSettings } = useAuth();

  return (
    <footer className="mt-16 pt-10 pb-4 border-t border-[var(--border)] text-[var(--text-muted)] transition-colors duration-200">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-md">
            <LowerVibeLogo size="md" showTagline={false} />
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              {t(
                'footer_tagline',
                'Independent music from Malawi, Nigeria, and across Africa. Built for listeners and artists everywhere.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

            {SOCIAL_LINKS.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text)] text-xs font-semibold transition-all active:scale-95 min-h-[44px]"
                >
                  <Icon className="w-4 h-4" />
                  <span>{s.name}</span>
                </a>
              );
            })}
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
          <div className="flex items-center gap-2">
            <Music2 className="w-3.5 h-3.5 text-[var(--violet)]" />
            <span>&copy; {new Date().getFullYear()} LOWERVIBE</span>
          </div>
          <span>{t('footer_built_by', 'Built by brownjnr')}</span>
        </div>
      </div>
    </footer>
  );
};
