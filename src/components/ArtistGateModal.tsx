import { CheckCircle2, Music, Sparkles, Upload, UserCheck, X } from 'lucide-react';
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRouter } from '../context/RouterContext';

interface ArtistGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenArtistAuth: () => void;
  onOpenLogin: () => void;
  onSuccessUpgrade: () => void;
}

export const ArtistGateModal: React.FC<ArtistGateModalProps> = ({
  isOpen,
  onClose,
  onOpenArtistAuth,
  onOpenLogin,
}) => {
  const { currentUser } = useAuth();
  const { language, t } = useLanguage();
  const { navigate } = useRouter();
  const isNy = language === 'ny';

  if (!isOpen) return null;

  const handleGoApplyInStudio = () => {
    onClose();
    navigate('/artistcreator');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden p-6 text-slate-900 dark:text-zinc-100">
        {/* Top green/gold accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-lime-500 to-amber-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          aria-label={t('close')}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center pt-2 pb-4 space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/10 to-amber-500/15 border border-emerald-500/30 flex items-center justify-center shadow-inner">
            <Music className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Sparkles className="w-3.5 h-3.5" />
              {isNy ? 'Akaunti ya Woimba Ikufunika' : 'Artist Account Required'}
            </span>
            <h3 className="text-xl font-black font-heading text-slate-900 dark:text-white pt-1">
              {isNy ? 'Gawani Nyimbo Ngati Woimba' : 'Share Music as an Artist'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
              {isNy
                ? 'Kukweza nyimbo ndi kwa oimba ovomerezeka. Lembani dzina lanu la woimba kuti mugawane nyimbo zanu ndi omvera padziko lonse.'
                : 'Uploading songs and albums is reserved for registered artists and creators. Sign up with your artist stage name to share your music with listeners worldwide.'}
            </p>
          </div>
        </div>

        {/* Benefits List */}
        <div className="bg-slate-50 dark:bg-zinc-950/60 rounded-2xl p-3.5 mb-5 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {isNy
                ? 'Kwezani nyimbo za MP3 / WAV, zithunzi ndi ma alibamu'
                : 'Upload MP3 / WAV songs, cover artwork & albums'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {isNy
                ? '100% Ufulu wa nyimbo zanu ndi uwa woimba yekha'
                : '100% Artist retained copyright & master rights'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {isNy
                ? 'Lowani pa Top Charts ndi kuona chiwerengero cha nyimbo'
                : 'Rank on Top 10 Music Chart & track downloads'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          {currentUser ? (
            <>
              <button
                onClick={handleGoApplyInStudio}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  {currentUser.applicationStatus === 'pending'
                    ? isNy
                      ? 'Onani Ngati Mwavomerezedwa'
                      : 'Check Artist Approval Status'
                    : isNy
                    ? 'Lembani mu Situdiyo ya Woimba'
                    : 'Apply in Artist Creator Studio'}
                </span>
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                {isNy ? 'Pitirizani Ngati Womvera' : 'Stay as Listener'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onClose();
                  onOpenArtistAuth();
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {isNy ? 'Lembani Ngati Woimba & Kwezani' : 'Sign Up as Artist & Upload Music'}
                </span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenLogin();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-200 font-semibold text-xs border border-slate-200 dark:border-zinc-700 transition flex items-center justify-center gap-1.5"
              >
                <span>{isNy ? 'Muli ndi akaunti ya woimba? Lowani' : 'Already an Artist? Sign In'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
