import { ConfirmationResult } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  Mail,
  Music,
  Phone,
  RefreshCw,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { LANGUAGES, useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { detectDefaultCountry } from '../../data/regions';
import { DEFAULT_AVATAR_SVG } from '../../utils/artworkFallback';
import { translateGenreCategory } from '../../utils/genreCategories';
import { LowerVibeLogo } from '../brand/LowerVibeLogo';
import { RegionSelect } from '../common/RegionSelect';

const SIGNUP_STARTER_GENRES = [
  'Afrobeats',
  'Amapiano',
  'Malawi Afro-Pop',
  'Gospel',
  'Hip-Hop',
  'Afro-Soul',
  'Dancehall',
  'Acoustic',
  'Lo-Fi',
  'Highlife',
  'Reggae',
  'R&B',
];

type GenderOption = 'male' | 'female' | 'non-binary' | 'prefer_not_to_say';

const getGenderOptions = (isNy: boolean): Array<{ value: GenderOption; label: string }> => [
  { value: 'male', label: isNy ? 'Mwamuna' : 'Male' },
  { value: 'female', label: isNy ? 'Mkazi' : 'Female' },
  { value: 'non-binary', label: isNy ? 'Zina' : 'Non-binary' },
  { value: 'prefer_not_to_say', label: isNy ? 'Osafuna kunena' : 'Prefer not to say' },
];

const DIAL_CODES = [
  { code: '+265', label: 'Malawi (+265)' },
  { code: '+234', label: 'Nigeria (+234)' },
  { code: '+27', label: 'South Africa (+27)' },
  { code: '+254', label: 'Kenya (+254)' },
  { code: '+233', label: 'Ghana (+233)' },
  { code: '+255', label: 'Tanzania (+255)' },
  { code: '+260', label: 'Zambia (+260)' },
  { code: '+263', label: 'Zimbabwe (+263)' },
  { code: '+256', label: 'Uganda (+256)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+1', label: 'US / Canada (+1)' },
];

export type AuthScreen =
  | 'welcome'
  | 'email_signin'
  | 'email_signup'
  | 'verify_inbox'
  | 'phone_entry'
  | 'phone_otp'
  | 'forgot_password';

interface AuthFlowCardProps {
  initialMode?: 'welcome' | 'login' | 'register' | 'forgot_password';
  promptReason?: string | null;
  onSuccess?: () => void;
  onBrowseGuest?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
}

function getPasswordChecks(pw: string) {
  const lengthOk = pw.length >= 8;
  const letterOk = /[a-zA-Z]/.test(pw);
  const numberOk = /\d/.test(pw);
  const score = (lengthOk ? 1 : 0) + (letterOk ? 1 : 0) + (numberOk ? 1 : 0) + (pw.length >= 12 ? 1 : 0);
  const label =
    pw.length === 0 ? '' : score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  return { lengthOk, letterOk, numberOk, score, label, isValid: lengthOk && letterOk && numberOk };
}

export const AuthFlowCard: React.FC<AuthFlowCardProps> = ({
  initialMode = 'welcome',
  promptReason,
  onSuccess,
  onBrowseGuest,
  showCloseButton = false,
  onClose,
}) => {
  const {
    loginWithEmail,
    registerWithEmail,
    signInWithGoogle,
    sendPhoneVerificationCode,
    verifyPhoneCode,
    resetPassword,
    resendVerification,
    refreshEmailVerification,
    enterGuestMode,
  } = useAuth();
  const { artists, tracks, setSelectedCountry } = useAudio();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const isNy = language === 'ny';
  const genderOptions = getGenderOptions(isNy);

  const [screen, setScreen] = useState<AuthScreen>(() => {
    if (initialMode === 'login') return 'email_signin';
    if (initialMode === 'register') return 'email_signup';
    if (initialMode === 'forgot_password') return 'forgot_password';
    return 'welcome';
  });

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [info, setInfo] = useState('');

  // Email Sign-In / Multi-step Sign-Up
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [role, setRole] = useState<'listener' | 'artist'>('listener');
  const [stageName, setStageName] = useState('');
  const [country, setCountry] = useState(() => detectDefaultCountry() || 'Malawi');
  const [gender, setGender] = useState<GenderOption | ''>('');
  const [age, setAge] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(60);

  // Phone OTP
  const [dialCode, setDialCode] = useState('+265');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpResendSeconds, setOtpResendSeconds] = useState(60);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const passwordChecks = useMemo(() => {
    const raw = getPasswordChecks(password);
    const labelMap: Record<string, string> = {
      Weak: isNy ? 'Yofooka' : 'Weak',
      Fair: isNy ? 'Yapakatikati' : 'Fair',
      Good: isNy ? 'Yabwino' : 'Good',
      Strong: isNy ? 'Yolimba' : 'Strong',
    };
    return { ...raw, label: raw.label ? labelMap[raw.label] || raw.label : '' };
  }, [password, isNy]);

  const genrePool = useMemo(() => {
    const liveGenres = Array.from(
      new Set(tracks.filter((t) => !t.isDraft && !t.isDeranked).map((t) => (t.genre || '').trim()).filter(Boolean))
    );
    return Array.from(new Set([...liveGenres, ...SIGNUP_STARTER_GENRES])).slice(0, 15);
  }, [tracks]);

  const artistSuggestions = useMemo(() => {
    return artists
      .slice()
      .sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0))
      .slice(0, 12);
  }, [artists]);

  const toggleSignupGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleSignupArtist = (artistId: string) => {
    setSelectedArtistIds((prev) =>
      prev.includes(artistId) ? prev.filter((id) => id !== artistId) : [...prev, artistId]
    );
  };

  // Verification email countdown
  useEffect(() => {
    if (screen !== 'verify_inbox' || resendSeconds <= 0) return;
    const id = window.setInterval(() => {
      setResendSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen, resendSeconds]);

  // Phone OTP resend countdown
  useEffect(() => {
    if (screen !== 'phone_otp' || otpResendSeconds <= 0) return;
    const id = window.setInterval(() => {
      setOtpResendSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen, otpResendSeconds]);

  // WebOTP auto-fill listener when on phone_otp screen
  useEffect(() => {
    if (screen !== 'phone_otp' || !('OTPCredential' in window)) return;
    const ac = new AbortController();
    (navigator.credentials as unknown as {
      get: (opts: { otp: { transport: string[] }; signal: AbortSignal }) => Promise<{ code?: string } | null>;
    })
      ?.get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then((otp) => {
        if (otp?.code) {
          const clean = otp.code.replace(/\D/g, '').slice(0, 6);
          if (clean.length === 6) {
            setOtpDigits(clean.split(''));
          }
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, [screen]);

  const finishAuthSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      navigate('/');
    }
  };

  const handleBrowseWithoutAccount = () => {
    enterGuestMode();
    if (onBrowseGuest) {
      onBrowseGuest();
    } else {
      navigate('/');
    }
  };

  const handleGoogle = async () => {
    setError('');
    setErrorCode('');
    setInfo('');
    setLoading(true);
    const res = await signInWithGoogle(true);
    setLoading(false);
    if (res.success) {
      showToast(isNy ? 'Mwalowa ndi Google' : 'Signed in with Google');
      finishAuthSuccess();
    } else if (res.error) {
      setError(res.error);
      setErrorCode(res.errorCode || '');
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorCode('');
    setInfo('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(isNy ? 'Lembani imelo yolondola.' : 'Enter a valid email address.');
      return;
    }
    if (!password) {
      setError(isNy ? 'Lembani mawu achinsinsi anu.' : 'Enter your password.');
      return;
    }

    setLoading(true);
    const res = await loginWithEmail(cleanEmail, password, rememberMe);
    setLoading(false);

    if (res.success) {
      if (res.needsVerification) {
        setResendSeconds(60);
        setScreen('verify_inbox');
        setInfo(
          isNy
            ? 'Chonde tsimikizirani imelo yanu kuti mugwiritse ntchito zinthu zonse.'
            : 'Please verify your email address to unlock all actions.'
        );
        return;
      }
      showToast(isNy ? 'Takulandirani kachiwiri' : 'Welcome back');
      finishAuthSuccess();
    } else {
      setError(res.error || (isNy ? 'Sitinathe kulowa.' : 'Could not sign in.'));
      setErrorCode(res.errorCode || '');
    }
  };

  const handleAdvanceSignupStep1 = () => {
    setError('');
    setErrorCode('');
    setInfo('');
    const cleanEmail = email.trim();
    const displayName = role === 'artist' ? stageName.trim() || name.trim() : name.trim();
    if (!displayName) {
      setError(
        role === 'artist'
          ? isNy
            ? 'Lembani dzina lanu la woimba kapena la pasiteji.'
            : 'Enter your artist or stage name.'
          : isNy
          ? 'Lembani dzina lanu.'
          : 'Enter your name.'
      );
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(isNy ? 'Lembani imelo yolondola.' : 'Enter a valid email address.');
      return;
    }
    if (!passwordChecks.isValid) {
      setError(
        isNy
          ? 'Mawu achinsinsi ayenera kukhala ndi zilembo zosachepera 8 ndi nambala.'
          : 'Password needs at least 8 characters with letters and a number.'
      );
      return;
    }
    if (password !== confirmPassword) {
      setError(isNy ? 'Mawu achinsinsi sakufanana.' : 'Passwords do not match.');
      return;
    }
    setSignupStep(2);
  };

  const handleAdvanceSignupStep2 = () => {
    setError('');
    setErrorCode('');
    if (!gender) {
      setError(isNy ? 'Sankhani jenda yanu kuti mupitilize.' : 'Choose your gender option to continue.');
      return;
    }
    const parsedAge = Number(age);
    if (!age.trim() || !Number.isFinite(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      setError(isNy ? 'Lembani zaka zolondola (zosachepera 13).' : 'Enter a valid age (minimum 13 years old).');
      return;
    }
    setSignupStep(3);
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorCode('');
    setInfo('');

    const cleanEmail = email.trim();
    const displayName = role === 'artist' ? stageName.trim() || name.trim() : name.trim();
    const parsedAge = Math.floor(Number(age));

    if (!displayName) {
      setSignupStep(1);
      setError(
        role === 'artist'
          ? isNy
            ? 'Lembani dzina lanu la woimba kapena la pasiteji.'
            : 'Enter your artist or stage name.'
          : isNy
          ? 'Lembani dzina lanu.'
          : 'Enter your name.'
      );
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setSignupStep(1);
      setError(isNy ? 'Lembani imelo yolondola.' : 'Enter a valid email address.');
      return;
    }
    if (!passwordChecks.isValid || password !== confirmPassword) {
      setSignupStep(1);
      setError(isNy ? 'Yang\'anani mawu achinsinsi anu.' : 'Check your password details.');
      return;
    }
    if (!gender || !Number.isFinite(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      setSignupStep(2);
      setError(isNy ? 'Sankhani jenda ndi zaka zolondola (13+).' : 'Select your gender and enter a valid age (13+).');
      return;
    }
    if (selectedGenres.length === 0 && selectedArtistIds.length === 0) {
      setError(
        isNy
          ? 'Sankhani mtundu umodzi kapena woimba mmodzi yemwe mumakonda.'
          : 'Pick at least 1 favourite genre or artist to personalize your feed.'
      );
      return;
    }
    if (!termsAccepted) {
      setError(
        isNy
          ? 'Chonde vomerezani Malamulo Ogwiritsira Ntchito ndi Chinsinsi cha Deta.'
          : 'Please accept the Terms of Service and Privacy Policy to continue.'
      );
      return;
    }

    setLoading(true);
    const res = await registerWithEmail(
      displayName,
      cleanEmail,
      password,
      'listener',
      {
        country,
        gender,
        age: parsedAge,
        preferredGenres: selectedGenres,
        favoriteArtistIds: selectedArtistIds,
        onboarded: true,
        termsAccepted: true,
        ...(role === 'artist'
          ? {
              application: {
                userId: '',
                userEmail: cleanEmail,
                stageName: displayName,
                legalName: name.trim() || displayName,
                country,
                primaryGenre: selectedGenres[0] || 'Afro-Fusion',
                bio: '',
                avatarUrl: '',
                rightsConfirmed: true,
              },
            }
          : {}),
      }
    );
    setLoading(false);

    if (res.success) {
      setSelectedCountry(country);
      try {
        localStorage.setItem('lowervibe_onboarded', 'true');
        if (res.user?.id) {
          localStorage.setItem(`lowervibe_onboarded_${res.user.id}`, 'true');
        }
        if (selectedGenres.length > 0) {
          localStorage.setItem('lowervibe_preferred_genres', JSON.stringify(selectedGenres));
        }
      } catch {}
      setResendSeconds(60);
      setScreen('verify_inbox');
      showToast(
        isNy
          ? 'Akaunti yapangidwa! Tsimikizirani imelo yanu kapena lowani pa LOWERVIBE.'
          : 'Account created! Verify your inbox or enter LOWERVIBE.'
      );
    } else {
      setError(res.error || (isNy ? 'Sitinathe kupanga akaunti yanu.' : 'Could not create your account.'));
      setErrorCode(res.errorCode || '');
    }
  };

  const handleCheckEmailVerified = async () => {
    setError('');
    setLoading(true);
    const res = await refreshEmailVerification();
    setLoading(false);
    if (res.verified) {
      showToast(isNy ? 'Imelo yatsimikiziridwa' : 'Email verified');
      finishAuthSuccess();
    } else {
      setError(
        res.error ||
          (isNy
            ? 'Sinatsimikiziridwebe. Tsegulani ulalo m\'bokosi lanu la imelo, kenako dinaninso batani ili.'
            : 'Not verified yet. Open the link in your inbox, then tap this button again.')
      );
    }
  };

  const handleResendVerification = async () => {
    if (resendSeconds > 0) return;
    setError('');
    setLoading(true);
    const res = await resendVerification();
    setLoading(false);
    if (res.success) {
      setResendSeconds(60);
      setInfo(isNy ? 'Ulalo watsopano watumizidwa ku imelo yanu.' : 'Fresh verification link sent to your inbox.');
    } else {
      setError(res.error || (isNy ? 'Sitinathe kutumizanso imelo yotsimikizira.' : 'Could not resend verification email.'));
    }
  };

  const handleSendPhoneOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setErrorCode('');
    const digits = phoneDigits.replace(/\D/g, '').replace(/^0+/, '');
    if (digits.length < 7) {
      setError(isNy ? 'Lembani nambala ya foni yolondola.' : 'Enter a valid phone number.');
      return;
    }
    const fullE164 = `${dialCode}${digits}`;
    setLoading(true);
    const res = await sendPhoneVerificationCode(fullE164, 'lv-recaptcha-container');
    setLoading(false);
    if (res.success && res.confirmation) {
      setConfirmationResult(res.confirmation);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpResendSeconds(60);
      setScreen('phone_otp');
      window.setTimeout(() => otpInputsRef.current[0]?.focus(), 80);
    } else {
      setError(res.error || (isNy ? 'Sitinathe kutumiza kodi ya SMS.' : 'Could not send SMS code.'));
      setErrorCode(res.errorCode || '');
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorCode('');
    if (!confirmationResult) {
      setError(isNy ? 'Pemphani kodi yatsopano choyamba.' : 'Request a fresh verification code first.');
      return;
    }
    const code = otpDigits.join('');
    if (code.length < 6) {
      setError(isNy ? 'Lembani manambala onse 6 ochokera mu SMS yanu.' : 'Enter all 6 digits from your SMS.');
      return;
    }
    setLoading(true);
    const res = await verifyPhoneCode(confirmationResult, code, true);
    setLoading(false);
    if (res.success) {
      showToast(isNy ? 'Mwalowa' : 'Signed in');
      finishAuthSuccess();
    } else {
      setError(res.error || (isNy ? 'Kodi imeneyo sinafanane.' : 'That code did not match.'));
      setErrorCode(res.errorCode || '');
    }
  };

  const handleOtpDigitChange = (idx: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < 6; i++) next[i] = clean[i] || '';
      setOtpDigits(next);
      otpInputsRef.current[Math.min(clean.length, 5)]?.focus();
      return;
    }
    const next = [...otpDigits];
    next[idx] = clean;
    setOtpDigits(next);
    if (clean && idx < 5) {
      otpInputsRef.current[idx + 1]?.focus();
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email.trim() || !email.includes('@')) {
      setError(isNy ? 'Lembani imelo yolondola.' : 'Enter a valid email address.');
      return;
    }
    setLoading(true);
    const res = await resetPassword(email.trim());
    setLoading(false);
    setInfo(res.message);
  };

  return (
    <div className="w-full max-w-[440px] mx-auto space-y-6 text-[var(--text)]">
      {/* Recaptcha anchor for Firebase Phone Auth */}
      <div id="lv-recaptcha-container" />

      {/* Brand Header + Language Switcher */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <LowerVibeLogo size="md" />
          <div className="flex items-center gap-1.5">
            <div className="inline-flex items-center p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              {LANGUAGES.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setLanguage(opt.code)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    language === opt.code
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {showCloseButton && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('close', 'Close')}
                className="w-9 h-9 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer shrink-0"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">
            {isNy ? 'Nyimbo zanu. Anthu anu.' : 'Your music. Your people.'}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {promptReason ||
              (isNy
                ? 'Mverani nyimbo za oimba odziyimira okha a ku Malawi ndi Africa yonse.'
                : 'Stream independent music from Malawi and across Africa.')}
          </p>
        </div>
      </div>

      {/* Main Card Surface */}
      <div className="rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-7 shadow-xl space-y-5">
        {screen !== 'welcome' && (
          <button
            type="button"
            onClick={() => {
              setError('');
              setErrorCode('');
              setInfo('');
              if (screen === 'email_signup' && signupStep > 1) {
                setSignupStep((s) => (s === 3 ? 2 : 1));
                return;
              }
              setScreen(screen === 'phone_otp' ? 'phone_entry' : 'welcome');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('back', 'Back')}</span>
          </button>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/35 text-[var(--danger)] text-xs space-y-2.5">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold leading-relaxed">{error}</p>
                {errorCode === 'auth/operation-not-allowed' && (
                  <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
                    {isNy ? 'Kulowa ndi Google kuli wokonzeka tsopano, kapena yatsani njirayi mu ' : 'Google Sign-In is ready right now, or enable this provider under '}
                    <strong>Firebase Console → Authentication → Sign-in method</strong>.
                  </p>
                )}
              </div>
            </div>
            {errorCode === 'auth/operation-not-allowed' && (
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogle}
                className="w-full h-11 px-4 rounded-xl bg-white text-neutral-900 border border-neutral-300 font-bold text-xs flex items-center justify-center gap-2.5 hover:bg-neutral-50 transition cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isNy ? 'Pitirizani ndi Google m\'malo mwake' : 'Continue with Google instead'}</span>
              </button>
            )}
          </div>
        )}

        {info && (
          <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)] shrink-0 mt-0.5" />
            <span>{info}</span>
          </div>
        )}

        {/* SCREEN 1: WELCOME */}
        {screen === 'welcome' && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogle}
              className="w-full h-13 px-4 rounded-2xl bg-white text-neutral-900 border border-neutral-200 font-bold text-sm flex items-center justify-center gap-3 hover:bg-neutral-50 transition cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{t('auth_continue_google', 'Continue with Google')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setError('');
                setScreen('phone_entry');
              }}
              className="w-full h-13 px-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text)] font-semibold text-sm flex items-center justify-center gap-2.5 transition cursor-pointer"
            >
              <Phone className="w-4 h-4 text-[var(--accent-text)]" />
              <span>{isNy ? 'Pitirizani ndi foni' : 'Continue with phone'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setError('');
                setScreen('email_signin');
              }}
              className="w-full h-13 px-4 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2.5 hover:brightness-95 transition cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>{isNy ? 'Pitirizani ndi imelo' : 'Continue with email'}</span>
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleBrowseWithoutAccount}
                className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] underline underline-offset-4 cursor-pointer py-2"
              >
                {t('auth_continue_guest', 'Browse without account')}
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 2: EMAIL SIGN-IN */}
        {screen === 'email_signin' && (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold">
              <button
                type="button"
                onClick={() => setScreen('email_signin')}
                className="py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] cursor-pointer"
              >
                {t('auth_sign_in_tab', 'Sign in')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSignupStep(1);
                  setScreen('email_signup');
                }}
                className="py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                {t('auth_sign_up_tab', 'Create account')}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                {isNy ? 'Imelo' : 'Email'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-14 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  {t('auth_password', 'Password')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setInfo('');
                    setScreen('forgot_password');
                  }}
                  className="text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  {t('auth_forgot_password', 'Forgot password?')}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isNy ? 'Lembani mawu achinsinsi' : 'Enter your password'}
                  className="w-full h-14 pl-4 pr-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? (isNy ? 'Bisani mawu achinsinsi' : 'Hide password') : isNy ? 'Onetsani mawu achinsinsi' : 'Show password'}
                  className="absolute right-3.5 top-4 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span>{t('auth_remember_device', 'Remember me on this device')}</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-95 transition cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? (isNy ? 'Ikulowa...' : 'Signing in...') : t('sign_in', 'Sign in')}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-[var(--surface)] px-2.5 text-[var(--text-muted)] font-semibold">
                  {isNy ? 'kapena' : 'or'}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleGoogle}
              className="w-full h-12 px-4 rounded-2xl bg-white text-neutral-900 border border-neutral-300 font-bold text-xs flex items-center justify-center gap-2.5 hover:bg-neutral-50 transition cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{t('auth_continue_google', 'Continue with Google')}</span>
            </button>
          </form>
        )}

        {/* SCREEN 3: CREATE ACCOUNT (3-STEP ONBOARDING) */}
        {screen === 'email_signup' && (
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSignupStep(1);
                  setScreen('email_signin');
                }}
                className="py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                {t('auth_sign_in_tab', 'Sign in')}
              </button>
              <button
                type="button"
                onClick={() => setScreen('email_signup')}
                className="py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] cursor-pointer"
              >
                {t('auth_sign_up_tab', 'Create account')}
              </button>
            </div>

            {/* Step Progress Header */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                <span>{isNy ? `Gawo ${signupStep} pa 3` : `Step ${signupStep} of 3`}</span>
                <span className="text-[var(--accent-text)]">
                  {signupStep === 1
                    ? isNy
                      ? 'Zambiri za akaunti'
                      : 'Account details'
                    : signupStep === 2
                    ? isNy
                      ? 'Jenda, zaka ndi dziko'
                      : 'Gender, age & country'
                    : isNy
                    ? 'Mitundu & oimba omwe mumakonda'
                    : 'Your favourite genres & artists'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3].map((stepIdx) => (
                  <div
                    key={stepIdx}
                    className={`h-1.5 rounded-full transition-colors ${
                      signupStep >= stepIdx ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* STEP 1: CREDENTIALS */}
            {signupStep === 1 && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('listener')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      role === 'listener'
                        ? 'border-[var(--accent)] bg-[var(--surface-2)] text-[var(--text)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)]/50 text-[var(--text-muted)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Headphones className="w-4 h-4 text-[var(--accent-text)]" />
                      <span>{t('listener', 'Listener')}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('artist')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      role === 'artist'
                        ? 'border-[var(--accent)] bg-[var(--surface-2)] text-[var(--text)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)]/50 text-[var(--text-muted)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Music className="w-4 h-4 text-[var(--accent-text)]" />
                      <span>{t('artist', 'Artist')}</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {isNy ? 'Pamafunika kuvomerezedwa' : 'Requires approval'}
                    </div>
                  </button>
                </div>

                {role === 'artist' && (
                  <p className="text-[11px] text-[var(--text-muted)] bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2 leading-relaxed">
                    {isNy
                      ? 'Akaunti yanu itseguka ngati ya womvera kaye kuti muyambe kumvera nyimbo ndi kuika LOWERVIBE, pamene pempho lanu la Artist Creator likuwonedwa ndi oyang\'anira.'
                      : 'Your account opens as a listener immediately so you can install LOWERVIBE & explore music, while your Artist Creator application is reviewed by Admin.'}
                  </p>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    {role === 'artist'
                      ? isNy
                        ? 'Dzina lanu lonse'
                        : 'Your full name'
                      : isNy
                      ? 'Dzina lowonekera'
                      : 'Display name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chikumbutso Banda"
                    className="w-full h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                  />
                </div>

                {role === 'artist' && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      {isNy ? 'Dzina la woimba / pasiteji' : 'Artist / stage name'}
                    </label>
                    <input
                      type="text"
                      required
                      value={stageName}
                      onChange={(e) => setStageName(e.target.value)}
                      placeholder={isNy ? 'Mmene omvera adzakudziwireni' : 'How listeners see you'}
                      className="w-full h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    {isNy ? 'Imelo' : 'Email'}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[var(--text-muted)]">
                    {t('auth_password', 'Password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isNy ? 'Pangani mawu achinsinsi' : 'Create password'}
                      className="w-full h-12 pl-4 pr-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? (isNy ? 'Bisani mawu achinsinsi' : 'Hide password') : isNy ? 'Onetsani mawu achinsinsi' : 'Show password'}
                      className="absolute right-3.5 top-3 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {password.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4].map((bar) => (
                          <div
                            key={bar}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              passwordChecks.score >= bar
                                ? passwordChecks.score >= 3
                                  ? 'bg-[var(--accent)]'
                                  : 'bg-amber-400'
                                : 'bg-[var(--border)]'
                            }`}
                          />
                        ))}
                        <span className="text-[11px] font-semibold text-[var(--text-muted)] ml-1">
                          {passwordChecks.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
                        <span className={passwordChecks.lengthOk ? 'text-[var(--accent-text)] font-medium' : ''}>
                          {passwordChecks.lengthOk ? '✓ ' : '• '}
                          {isNy ? 'Zilembo 8+' : '8+ characters'}
                        </span>
                        <span className={passwordChecks.letterOk ? 'text-[var(--accent-text)] font-medium' : ''}>
                          {passwordChecks.letterOk ? '✓ ' : '• '}
                          {isNy ? 'Chilembo' : 'Letter'}
                        </span>
                        <span className={passwordChecks.numberOk ? 'text-[var(--accent-text)] font-medium' : ''}>
                          {passwordChecks.numberOk ? '✓ ' : '• '}
                          {isNy ? 'Nambala' : 'Number'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    {isNy ? 'Tsimikizirani mawu achinsinsi' : 'Confirm password'}
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={isNy ? 'Lembaninso mawu achinsinsi' : 'Repeat password'}
                    className="w-full h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAdvanceSignupStep1}
                  className="w-full h-12 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-95 transition cursor-pointer"
                >
                  <span>{isNy ? 'Pitilizani: Zambiri za inu' : 'Next: About you'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--border)]" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-[var(--surface)] px-2.5 text-[var(--text-muted)] font-semibold">
                      {isNy ? 'kapena' : 'or'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogle}
                  className="w-full h-12 px-4 rounded-2xl bg-white text-neutral-900 border border-neutral-300 font-bold text-xs flex items-center justify-center gap-2.5 hover:bg-neutral-50 transition cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{t('auth_continue_google', 'Continue with Google')}</span>
                </button>
              </div>
            )}

            {/* STEP 2: GENDER, AGE & COUNTRY */}
            {signupStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    <Users className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span>{isNy ? 'Jenda' : 'Gender'}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {genderOptions.map((opt) => {
                      const active = gender === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setGender(opt.value)}
                          className={`px-3 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                            active
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {active && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    <Calendar className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span>{isNy ? 'Zaka' : 'Age'}</span>
                  </label>
                  <input
                    type="number"
                    min={13}
                    max={120}
                    inputMode="numeric"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 22"
                    className="w-full h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                  />
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {isNy ? 'Muyenera kukhala ndi zaka 13 kapena kuposerapo kuti mulowe pa LOWERVIBE.' : 'You must be at least 13 years old to join LOWERVIBE.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    {isNy ? 'Dziko' : 'Country'}
                  </label>
                  <RegionSelect
                    value={country}
                    onChange={setCountry}
                    includeGlobal={false}
                    className="w-full h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setSignupStep(1);
                    }}
                    className="h-12 px-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer"
                  >
                    {t('back', 'Back')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAdvanceSignupStep2}
                    className="flex-1 h-12 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-95 transition cursor-pointer"
                  >
                    <span>{isNy ? 'Pitilizani: Sankhani nyimbo' : 'Next: Pick your vibe'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: FAVOURITE GENRES & ARTISTS */}
            {signupStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                      <Music className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      <span>{isNy ? 'Mitundu yomwe mumakonda' : 'Favourite genres'}</span>
                    </label>
                    <span className="text-[11px] font-mono text-[var(--accent-text)]">
                      {isNy ? `Zasankhidwa ${selectedGenres.length}` : `${selectedGenres.length} picked`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {genrePool.map((g) => {
                      const active = selectedGenres.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => toggleSignupGenre(g)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                            active
                              ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
                              : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          {active && <Check className="w-3 h-3 stroke-[3]" />}
                          <span>{translateGenreCategory(g, language)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                      <UserPlus className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      <span>{isNy ? 'Oimba omwe mumakonda' : 'Favourite artists'}</span>
                    </label>
                    <span className="text-[11px] font-mono text-[var(--accent-text)]">
                      {isNy ? `Mukutsatira ${selectedArtistIds.length}` : `${selectedArtistIds.length} following`}
                    </span>
                  </div>
                  {artistSuggestions.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
                      {isNy
                        ? 'Zomwe mwasankha zikuthandizani kukupezirani nyimbo zabwino.'
                        : 'Your genre picks will tailor your home feed immediately while artists publish.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                      {artistSuggestions.map((artist) => {
                        const isPicked = selectedArtistIds.includes(artist.id);
                        return (
                          <button
                            key={artist.id}
                            type="button"
                            onClick={() => toggleSignupArtist(artist.id)}
                            className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                              isPicked
                                ? 'bg-[var(--surface-2)] border-[var(--accent)]'
                                : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--border-strong)]'
                            }`}
                          >
                            <img
                              src={artist.avatar || DEFAULT_AVATAR_SVG}
                              alt={artist.name}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover shrink-0 bg-[var(--surface)]"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-[var(--text)] truncate">{artist.name}</div>
                              <div className="text-[10px] text-[var(--text-muted)] truncate">
                                {artist.country || 'Malawi'}
                              </div>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                isPicked
                                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                                  : 'border border-[var(--border-strong)] text-transparent'
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-2.5 text-xs text-[var(--text-muted)] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span>
                    {isNy ? 'Ndikuvomereza ' : 'I agree to the '}
                    <button
                      type="button"
                      onClick={() => navigate('/terms')}
                      className="underline text-[var(--text)] hover:text-[var(--accent-text)] cursor-pointer"
                    >
                      {t('footer_terms', 'Terms of Service')}
                    </button>{' '}
                    {isNy ? 'ndi ' : 'and '}
                    <button
                      type="button"
                      onClick={() => navigate('/privacy')}
                      className="underline text-[var(--text)] hover:text-[var(--accent-text)] cursor-pointer"
                    >
                      {t('footer_privacy', 'Privacy Policy')}
                    </button>
                    .
                  </span>
                </label>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setSignupStep(2);
                    }}
                    className="h-12 px-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer"
                  >
                    {t('back', 'Back')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-12 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-95 transition cursor-pointer disabled:opacity-50"
                  >
                    <span>
                      {loading
                        ? isNy
                          ? 'Ikupanga akaunti...'
                          : 'Creating account...'
                        : isNy
                        ? 'Pangani akaunti & Lowani'
                        : 'Create account & Enter'}
                    </span>
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}

        {/* SCREEN 4: CHECK YOUR INBOX (EMAIL VERIFICATION) */}
        {screen === 'verify_inbox' && (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--accent-text)]">
              <Mail className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[var(--text)]">
                {isNy ? 'Yang\'anani imelo yanu' : 'Check your inbox'}
              </h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {isNy ? (
                  <>
                    Tatumiza ulalo wotsimikizira ku <strong>{email}</strong>. Dinani ulalowo, kenako pitirizani pansipa.
                  </>
                ) : (
                  <>
                    We sent a verification link to <strong>{email}</strong>. Tap the link in that email, then continue below.
                  </>
                )}
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleCheckEmailVerified}
                className="w-full h-12 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {loading
                    ? isNy
                      ? 'Ikuyang\'ana...'
                      : 'Checking...'
                    : isNy
                    ? 'Ndatsimikizira & Lowani'
                    : "I've verified & enter"}
                </span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  showToast(
                    isNy
                      ? 'Takulandirani ku LOWERVIBE! Tsimikizirani imelo yanu nthawi ina mu Akaunti.'
                      : 'Welcome to LOWERVIBE! Verify your email anytime from Account.'
                  );
                  finishAuthSuccess();
                }}
                className="w-full h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] flex items-center justify-center gap-2 hover:border-[var(--border-strong)] transition cursor-pointer"
              >
                <span>{isNy ? 'Lowani tsopano' : 'Enter platform now'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                disabled={resendSeconds > 0 || loading}
                onClick={handleResendVerification}
                className="w-full py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  {resendSeconds > 0
                    ? isNy
                      ? `Tumizaninso patatha ${resendSeconds}s`
                      : `Resend link in ${resendSeconds}s`
                    : isNy
                    ? 'Tumizaninso imelo yotsimikizira'
                    : 'Resend verification email'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 5: PHONE NUMBER ENTRY */}
        {screen === 'phone_entry' && (
          <form onSubmit={handleSendPhoneOtp} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[var(--text)]">
                {isNy ? 'Lowani ndi nambala ya foni' : 'Sign in with phone'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isNy
                  ? 'Titumiza kodi ya SMS ya manambala 6 kuti titsimikizire nambala yanu.'
                  : 'We will send a 6-digit SMS code to confirm your number.'}
              </p>
            </div>

            <div className="grid grid-cols-[140px_1fr] gap-2">
              <select
                value={dialCode}
                onChange={(e) => setDialCode(e.target.value)}
                aria-label={isNy ? 'Kodi ya dziko' : 'Country code'}
                className="h-14 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
              >
                {DIAL_CODES.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.label}
                  </option>
                ))}
              </select>

              <input
                type="tel"
                required
                value={phoneDigits}
                onChange={(e) => setPhoneDigits(e.target.value)}
                placeholder="999 123 456"
                className="h-14 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-95 transition cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? (isNy ? 'Ikutumiza SMS...' : 'Sending SMS...') : isNy ? 'Tumizani kodi' : 'Send code'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* SCREEN 6: PHONE 6-DIGIT OTP */}
        {screen === 'phone_otp' && (
          <form onSubmit={handleVerifyPhoneOtp} className="space-y-5">
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-bold text-[var(--text)]">
                {isNy ? 'Lembani kodi ya manambala 6' : 'Enter 6-digit code'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isNy ? 'Yatumizidwa ku' : 'Sent to'} {dialCode} {phoneDigits}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2">
              {otpDigits.map((d, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    otpInputsRef.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
                      otpInputsRef.current[idx - 1]?.focus();
                    }
                  }}
                  className="w-11 h-14 text-center text-lg font-mono font-bold rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm cursor-pointer disabled:opacity-50"
            >
              {loading
                ? isNy
                  ? 'Ikutsimikizira...'
                  : 'Verifying...'
                : isNy
                ? 'Tsimikizirani & Pitilizani'
                : 'Verify & continue'}
            </button>

            <button
              type="button"
              disabled={otpResendSeconds > 0 || loading}
              onClick={() => handleSendPhoneOtp()}
              className="w-full text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50 cursor-pointer"
            >
              {otpResendSeconds > 0
                ? isNy
                  ? `Tumizaninso kodi patatha ${otpResendSeconds}s`
                  : `Resend code in ${otpResendSeconds}s`
                : isNy
                ? 'Tumizaninso kodi ya SMS'
                : 'Resend SMS code'}
            </button>
          </form>
        )}

        {/* SCREEN 7: FORGOT PASSWORD */}
        {screen === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[var(--text)]">
                {isNy ? 'Bwezeretsani mawu achinsinsi' : 'Reset your password'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isNy
                  ? 'Lembani imelo yanu kuti mulandire ulalo wokonzera mawu achinsinsi.'
                  : 'Enter your email address to receive a password reset link.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                {isNy ? 'Imelo' : 'Email'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-14 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm cursor-pointer disabled:opacity-50"
            >
              {loading
                ? isNy
                  ? 'Ikutumiza...'
                  : 'Sending...'
                : isNy
                ? 'Tumizani ulalo'
                : 'Send reset link'}
            </button>
          </form>
        )}
      </div>

      {/* Clean Legal Footer */}
      <div className="text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/terms')}
          className="hover:text-[var(--text)] underline underline-offset-4 cursor-pointer"
        >
          {isNy ? 'Malamulo' : 'Terms'}
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => navigate('/privacy')}
          className="hover:text-[var(--text)] underline underline-offset-4 cursor-pointer"
        >
          {isNy ? 'Chinsinsi' : 'Privacy'}
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => navigate('/copyright')}
          className="hover:text-[var(--text)] underline underline-offset-4 cursor-pointer"
        >
          {isNy ? 'Ufulu' : 'Copyright'}
        </button>
      </div>
    </div>
  );
};
