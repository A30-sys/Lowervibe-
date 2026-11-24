import { ArrowRight, Compass, Disc3, Home, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';

export const NotFoundView: React.FC = () => {
  const { navigate } = useRouter();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    } else {
      navigate('/discover');
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-12 animate-fadeIn max-w-lg mx-auto">
      <div className="w-20 h-20 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)] mb-6 shadow-md relative">
        <Disc3 className="w-10 h-10 animate-spin" style={{ animationDuration: '8s' }} />
        <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-[var(--violet)] text-[10px] font-mono font-bold text-white">
          404
        </span>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)] mb-2 font-heading">
        {isNy ? 'Tsambali silinapezeke' : 'Page not found'}
      </h1>
      <p className="text-sm text-[var(--text-muted)] max-w-md mb-8 leading-relaxed">
        {isNy
          ? 'Nyimbo, woimba, kapena tsamba lomwe mukufuna kulipeza palibe pano. Sakani pansipa kapena bwererani kunyumba.'
          : 'The song, artist, or page you requested is not here. Search below or head back home.'}
      </p>

      <form onSubmit={handleSearch} className="w-full max-w-sm mb-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full pl-10 pr-24 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs sm:text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs cursor-pointer"
          >
            {t('search')}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-full bg-[var(--surface)] text-[var(--text)] font-medium text-xs sm:text-sm hover:bg-[var(--surface-2)] border border-[var(--border)] transition flex items-center gap-2 cursor-pointer min-h-[44px]"
        >
          <Home className="w-4 h-4" />
          <span>{t('studio_back_home')}</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/artists')}
          className="px-5 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer min-h-[44px]"
        >
          <Compass className="w-4 h-4" />
          <span>{isNy ? 'Onani Oimba' : 'Browse Artists'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
