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
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { detectDefaultCountry } from '../../data/regions';
import { DEFAULT_AVATAR_SVG } from '../../utils/artworkFallback';
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

const GENDER_OPTIONS: Array<{ value: GenderOption; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
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

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);

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
      showToast('Signed in with Google');
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
      setError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setLoading(true);
    const res = await loginWithEmail(cleanEmail, password, rememberMe);
    setLoading(false);

    if (res.success) {
      if (res.needsVerification) {
        setResendSeconds(60);
        setScreen('verify_inbox');
        setInfo('Please verify your email address to unlock all actions.');
        return;
      }
      showToast('Welcome back');
      finishAuthSuccess();
    } else {
      setError(res.error || 'Could not sign in.');
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
      setError(role === 'artist' ? 'Enter your artist or stage name.' : 'Enter your name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (!passwordChecks.isValid) {
      setError('Password needs at least 8 characters with letters and a number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSignupStep(2);
  };

  const handleAdvanceSignupStep2 = () => {
    setError('');
    setErrorCode('');
    if (!gender) {
      setError('Choose your gender option to continue.');
      return;
    }
    const parsedAge = Number(age);
    if (!age.trim() || !Number.isFinite(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      setError('Enter a valid age (minimum 13 years old).');
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
      setError(role === 'artist' ? 'Enter your artist or stage name.' : 'Enter your name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setSignupStep(1);
      setError('Enter a valid email address.');
      return;
    }
    if (!passwordChecks.isValid || password !== confirmPassword) {
      setSignupStep(1);
      setError('Check your password details.');
      return;
    }
    if (!gender || !Number.isFinite(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      setSignupStep(2);
      setError('Select your gender and enter a valid age (13+).');
      return;
    }
    if (selectedGenres.length === 0 && selectedArtistIds.length === 0) {
      setError('Pick at least 1 favourite genre or artist to personalize your feed.');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
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
      showToast('Account created! Verify your inbox or enter LOWERVIBE.');
    } else {
      setError(res.error || 'Could not create your account.');
      setErrorCode(res.errorCode || '');
    }
  };

  const handleCheckEmailVerified = async () => {
    setError('');
    setLoading(true);
    const res = await refreshEmailVerification();
    setLoading(false);
    if (res.verified) {
      showToast('Email verified');
      finishAuthSuccess();
    } else {
      setError(res.error || 'Not verified yet. Open the link in your inbox, then tap this button again.');
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
      setInfo('Fresh verification link sent to your inbox.');
    } else {
      setError(res.error || 'Could not resend verification email.');
    }
  };

  const handleSendPhoneOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setErrorCode('');
    const digits = phoneDigits.replace(/\D/g, '').replace(/^0+/, '');
    if (digits.length < 7) {
      setError('Enter a valid phone number.');
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
      setError(res.error || 'Could not send SMS code.');
      setErrorCode(res.errorCode || '');
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorCode('');
    if (!confirmationResult) {
      setError('Request a fresh verification code first.');
      return;
    }
    const code = otpDigits.join('');
    if (code.length < 6) {
      setError('Enter all 6 digits from your SMS.');
      return;
    }
    setLoading(true);
    const res = await verifyPhoneCode(confirmationResult, code, true);
    setLoading(false);
    if (res.success) {
      showToast('Signed in');
      finishAuthSuccess();
    } else {
      setError(res.error || 'That code did not match.');
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
      setError('Enter a valid email address.');
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

      {/* Brand Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <LowerVibeLogo size="md" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">
            Your music. Your people.
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {promptReason || 'Stream independent music from Malawi and across Africa.'}
          </p>
        </div>

        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer shrink-0"
          >
            ✕
          </button>
        )}
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
            <span>Back</span>
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
                    Google Sign-In is ready right now, or enable this provider under{' '}
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
                <span>Continue with Google instead</span>
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
              <span>Continue with Google</span>
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
              <span>Continue with phone</span>
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
              <span>Continue with email</span>
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleBrowseWithoutAccount}
                className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] underline underline-offset-4 cursor-pointer py-2"
              >
                Browse without account
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
                Sign in
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
                Create account
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Email</label>
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
                <label className="text-xs font-semibold text-[var(--text-muted)]">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setInfo('');
                    setScreen('forgot_password');
                  }}
                  className="text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-14 pl-4 pr-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
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
              <span>Remember me on this device</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-95 transition cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Signing in...' : 'Sign in'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-[var(--surface)] px-2.5 text-[var(--text-muted)] font-semibold">or</span>
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
              <span>Continue with Google</span>
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
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setScreen('email_signup')}
                className="py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] cursor-pointer"
              >
                Create account
              </button>
            </div>

            {/* Step Progress Header */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                <span>Step {signupStep} of 3</span>
                <span className="text-[var(--accent-text)]">
                  {signupStep === 1
                    ? 'Account details'
                    : signupStep === 2
                    ? 'Gender, age & country'
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
                      <span>Listener</span>
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
                      <span>Artist</span>
                    </div>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    {role === 'artist' ? 'Your full name' : 'Display name'}
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
                      Artist / stage name
                    </label>
                    <input
                      type="text"
                      required
                      value={stageName}
                      onChange={(e) => setStageName(e.target.value)}
                      placeholder="How listeners see you"
                      className="w-full h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Email</label>
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
                  <label className="block text-xs font-semibold text-[var(--text-muted)]">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create password"
                      className="w-full h-12 pl-4 pr-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                          {passwordChecks.lengthOk ? '✓ ' : '• '}8+ characters
                        </span>
                        <span className={passwordChecks.letterOk ? 'text-[var(--accent-text)] font-medium' : ''}>
                          {passwordChecks.letterOk ? '✓ ' : '• '}Letter
                        </span>
                        <span className={passwordChecks.numberOk ? 'text-[var(--accent-text)] font-medium' : ''}>
                          {passwordChecks.numberOk ? '✓ ' : '• '}Number
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Confirm password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--focus-ring)]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAdvanceSignupStep1}
                  className="w-full h-12 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-95 transition cursor-pointer"
                >
                  <span>Next: About you</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--border)]" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-[var(--surface)] px-2.5 text-[var(--text-muted)] font-semibold">or</span>
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
                  <span>Continue with Google</span>
                </button>
              </div>
            )}

            {/* STEP 2: GENDER, AGE & COUNTRY */}
            {signupStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    <Users className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span>Gender</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {GENDER_OPTIONS.map((opt) => {
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
                    <span>Age</span>
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
                    You must be at least 13 years old to join LOWERVIBE.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Country</label>
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
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleAdvanceSignupStep2}
                    className="flex-1 h-12 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-95 transition cursor-pointer"
                  >
                    <span>Next: Pick your vibe</span>
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
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      <span>Favourite genres</span>
                    </label>
                    <span className="text-[11px] font-mono text-[var(--accent-text)]">
                      {selectedGenres.length} picked
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
                          <span>{g}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                      <UserPlus className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      <span>Favourite artists</span>
                    </label>
                    <span className="text-[11px] font-mono text-[var(--accent-text)]">
                      {selectedArtistIds.length} following
                    </span>
                  </div>
                  {artistSuggestions.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
                      Your genre picks will tailor your home feed immediately while artists publish.
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
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/terms')}
                      className="underline text-[var(--text)] hover:text-[var(--accent-text)] cursor-pointer"
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/privacy')}
                      className="underline text-[var(--text)] hover:text-[var(--accent-text)] cursor-pointer"
                    >
                      Privacy Policy
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
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-12 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-95 transition cursor-pointer disabled:opacity-50"
                  >
                    <span>{loading ? 'Creating account...' : 'Create account & Enter'}</span>
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
              <h2 className="text-lg font-bold text-[var(--text)]">Check your inbox</h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                We sent a verification link to <strong>{email}</strong>. Tap the link in that email, then continue
                below.
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
                <span>{loading ? 'Checking...' : "I've verified & enter"}</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  showToast('Welcome to LOWERVIBE! Verify your email anytime from Account.');
                  finishAuthSuccess();
                }}
                className="w-full h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] flex items-center justify-center gap-2 hover:border-[var(--border-strong)] transition cursor-pointer"
              >
                <span>Enter platform now</span>
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
                  {resendSeconds > 0 ? `Resend link in ${resendSeconds}s` : 'Resend verification email'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 5: PHONE NUMBER ENTRY */}
        {screen === 'phone_entry' && (
          <form onSubmit={handleSendPhoneOtp} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[var(--text)]">Sign in with phone</h2>
              <p className="text-xs text-[var(--text-muted)]">
                We will send a 6-digit SMS code to confirm your number.
              </p>
            </div>

            <div className="grid grid-cols-[140px_1fr] gap-2">
              <select
                value={dialCode}
                onChange={(e) => setDialCode(e.target.value)}
                aria-label="Country code"
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
              <span>{loading ? 'Sending SMS...' : 'Send code'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* SCREEN 6: PHONE 6-DIGIT OTP */}
        {screen === 'phone_otp' && (
          <form onSubmit={handleVerifyPhoneOtp} className="space-y-5">
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-bold text-[var(--text)]">Enter 6-digit code</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Sent to {dialCode} {phoneDigits}
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
              {loading ? 'Verifying...' : 'Verify & continue'}
            </button>

            <button
              type="button"
              disabled={otpResendSeconds > 0 || loading}
              onClick={() => handleSendPhoneOtp()}
              className="w-full text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50 cursor-pointer"
            >
              {otpResendSeconds > 0 ? `Resend code in ${otpResendSeconds}s` : 'Resend SMS code'}
            </button>
          </form>
        )}

        {/* SCREEN 7: FORGOT PASSWORD */}
        {screen === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[var(--text)]">Reset your password</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Enter your email address to receive a password reset link.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Email</label>
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
              {loading ? 'Sending...' : 'Send reset link'}
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
          Terms
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => navigate('/privacy')}
          className="hover:text-[var(--text)] underline underline-offset-4 cursor-pointer"
        >
          Privacy
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => navigate('/copyright')}
          className="hover:text-[var(--text)] underline underline-offset-4 cursor-pointer"
        >
          Copyright
        </button>
      </div>
    </div>
  );
};
