import { CheckCircle2, Music, Upload, UserCheck, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-fadeIn">
      <div className="relative w-full max-w-md bg-[var(--surface)] border border-[var(--border-strong)] rounded-3xl shadow-2xl overflow-hidden p-6 text-[var(--text)]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          aria-label={t('close')}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center pt-2 pb-4 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/35 flex items-center justify-center">
            <Music className="w-7 h-7 text-[var(--accent-text)]" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-[var(--accent-text)]">
              {isNy ? 'Akaunti ya Woimba Ikufunika' : 'Artist Account Required'}
            </p>
            <h3 className="text-xl font-extrabold font-heading text-[var(--text)]">
              {isNy ? 'Gawani Nyimbo Ngati Woimba' : 'Share Music as an Artist'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-xs mx-auto">
              {isNy
                ? 'Kukweza nyimbo ndi kwa oimba ovomerezeka. Lembani dzina lanu la woimba kuti mugawane nyimbo zanu ndi omvera padziko lonse.'
                : 'Uploading songs and albums is reserved for registered artists and creators. Sign up with your artist stage name to share your music with listeners worldwide.'}
            </p>
          </div>
        </div>

        <div className="bg-[var(--surface-2)] rounded-2xl p-3.5 mb-5 border border-[var(--border)] space-y-2 text-xs">
          <div className="flex items-center gap-2 text-[var(--text)]">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
            <span>
              {isNy
                ? 'Kwezani nyimbo za MP3 / WAV, zithunzi ndi ma alibamu'
                : 'Upload MP3 / WAV songs, cover artwork & albums'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[var(--text)]">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
            <span>
              {isNy
                ? '100% Ufulu wa nyimbo zanu ndi uwa woimba yekha'
                : '100% Artist retained copyright & master rights'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[var(--text)]">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
            <span>
              {isNy
                ? 'Lowani pa Top Charts ndi kuona chiwerengero cha nyimbo'
                : 'Rank on Top 10 Music Chart & track downloads'}
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {currentUser ? (
            <>
              <button
                onClick={handleGoApplyInStudio}
                className="w-full py-3 px-4 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer min-h-[46px]"
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
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition cursor-pointer"
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
                className="w-full py-3.5 px-4 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer min-h-[48px]"
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
                className="w-full py-2.5 px-4 rounded-2xl bg-[var(--surface-2)] text-[var(--text)] font-semibold text-xs border border-[var(--border)] transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
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
