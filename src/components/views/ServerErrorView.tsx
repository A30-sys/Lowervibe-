import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';

export const ServerErrorView: React.FC = () => {
  const { navigate } = useRouter();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-12 animate-fadeIn max-w-lg mx-auto">
      <div className="w-20 h-20 rounded-3xl bg-[var(--surface)] border border-[var(--danger)]/40 flex items-center justify-center text-[var(--danger)] mb-6 shadow-md relative">
        <AlertTriangle className="w-10 h-10" />
        <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-[var(--danger)] text-[10px] font-mono font-bold text-white">
          500
        </span>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)] mb-2 font-heading">
        {isNy ? 'Chinachake chalakwika' : 'Something went wrong'}
      </h1>
      <p className="text-sm text-[var(--text-muted)] max-w-md mb-8 leading-relaxed">
        {isNy
          ? 'Papezeka vuto polowetsa tsambali. Yesani kutsitsimutsanso kapena kubwerera kunyumba.'
          : 'We hit an unexpected problem loading this page. Try reloading the app or returning home.'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleReload}
          className="px-5 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer min-h-[44px]"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{isNy ? 'Tsitsimutsani' : 'Reload App'}</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-full bg-[var(--surface)] text-[var(--text)] font-medium text-xs sm:text-sm hover:bg-[var(--surface-2)] border border-[var(--border)] transition flex items-center gap-2 cursor-pointer min-h-[44px]"
        >
          <Home className="w-4 h-4" />
          <span>{t('studio_back_home')}</span>
        </button>
      </div>
    </div>
  );
};
