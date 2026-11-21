import {
  browserLocalPersistence,
  browserSessionPersistence,
  ConfirmationResult,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  linkWithPopup,
  PhoneAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  RecaptchaVerifier,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  unlink,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { LEGAL_CONFIG } from '../config/legalConfig';
import { auth, db, formatFirebaseError, googleAuthProvider } from './firebase';
import { durableSetDoc, durableUpdateDoc } from './reliableSync';
import { ActiveSessionRecord, AdminConfig, ArtistApplication, User, UserRole } from '../types';
import { DEFAULT_AVATAR_SVG } from '../utils/artworkFallback';

export const PRIMARY_ADMIN_EMAIL = 'odulamw@gmail.com';
const ADMIN_CONFIG_DOC = 'setup';

export function isVerifiedAdminGoogleSession(fbUser = auth.currentUser): boolean {
  if (!fbUser) return false;
  const emailMatches = (fbUser.email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
  const verified = Boolean(fbUser.emailVerified);
  const viaGoogle = fbUser.providerData.some((p) => p.providerId === 'google.com');
  return emailMatches && verified && viaGoogle;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  errorCode?: string;
  needsVerification?: boolean;
  isFirebaseUser?: boolean;
}

// Client-side rate limiter to protect login/OTP/reset endpoints
const attemptMap = new Map<string, { count: number; lockedUntil: number }>();

function checkClientRateLimit(bucket: string, maxAttempts = 5, windowMs = 60_000): string | null {
  const now = Date.now();
  const entry = attemptMap.get(bucket);
  if (entry && entry.lockedUntil > now) {
    const secs = Math.ceil((entry.lockedUntil - now) / 1000);
    return `Too many attempts. Please wait ${secs}s and try again.`;
  }
  if (entry && now - entry.lockedUntil > windowMs && entry.lockedUntil !== 0) {
    attemptMap.delete(bucket);
  }
  return null;
}

function recordFailedAttempt(bucket: string, maxAttempts = 5, cooldownMs = 60_000) {
  const entry = attemptMap.get(bucket) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= maxAttempts) {
    entry.lockedUntil = Date.now() + cooldownMs;
    entry.count = 0;
  }
  attemptMap.set(bucket, entry);
}

function clearRateLimit(bucket: string) {
  attemptMap.delete(bucket);
}

export function extractAuthErrorCode(err: unknown): string {
  return (err as { code?: string })?.code || '';
}

export function mapFirebaseAuthError(err: unknown): string {
  const code = extractAuthErrorCode(err);
  const message = (err as { message?: string })?.message || '';
  console.warn('[Auth]', code || 'unknown', message);

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password. Double-check and try again.';
    case 'auth/user-not-found':
      return 'No account uses this email yet. Try creating a new account.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Sign in instead.';
    case 'auth/weak-password':
      return 'Use a stronger password (at least 8 characters with letters and a number).';
    case 'auth/invalid-email':
      return 'That does not look like a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many tries right now. Wait a few minutes and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support for help.';
    case 'auth/network-request-failed':
      return 'Connection problem. Check your internet and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in window was closed before finishing.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not turned on in Firebase Console yet.';
    case 'auth/invalid-phone-number':
      return 'Enter a valid phone number including your country code (for example +265...).';
    case 'auth/invalid-verification-code':
      return 'That 6-digit code does not match. Check your SMS and try again.';
    case 'auth/code-expired':
      return 'That code expired. Tap resend to get a fresh code.';
    case 'auth/requires-recent-login':
      return 'Please confirm your sign-in again before making this change.';
    case 'auth/credential-already-in-use':
      return 'That Google account is already linked to another LOWERVIBE profile.';
    case 'auth/unauthorized-domain':
      return 'This domain needs to be added to Firebase Authorized Domains in the console.';
    default:
      return message || 'Something went wrong while signing in. Please try again.';
  }
}

export function detectCurrentSessionRecord(): ActiveSessionRecord {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  let deviceLabel = 'Desktop';
  if (/Android/i.test(ua)) deviceLabel = 'Android phone';
  else if (/iPhone|iPad|iPod/i.test(ua)) deviceLabel = 'iPhone / iPad';
  else if (/Mac/i.test(ua)) deviceLabel = 'Mac';
  else if (/Windows/i.test(ua)) deviceLabel = 'Windows PC';
  else if (/Linux/i.test(ua)) deviceLabel = 'Linux';

  let sessionId = '';
  try {
    sessionId = sessionStorage.getItem('lowervibe_session_id') || '';
    if (!sessionId) {
      sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      sessionStorage.setItem('lowervibe_session_id', sessionId);
    }
  } catch {
    sessionId = `sess-${Date.now()}`;
  }

  return {
    id: sessionId,
    deviceLabel,
    browser,
    lastActiveAt: new Date().toISOString(),
    isCurrent: true,
  };
}

function stripUndefinedFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean as Partial<T>;
}

export async function syncUserRecord(user: User): Promise<{ success: boolean; error?: string }> {
  try {
    if (!auth.currentUser || auth.currentUser.uid !== user.id) {
      return {
        success: false,
        error: 'Permission denied: you can only edit your own profile.',
      };
    }
    const cleanPayload = stripUndefinedFields({
      ...user,
      updatedAt: new Date().toISOString(),
    });
    const res = await durableSetDoc('users', user.id, cleanPayload, {
      merge: true,
      mirrorBackup: true,
    });
    if (!res.ok && !res.queued) {
      return { success: false, error: res.error || 'Profile save failed' };
    }
    return { success: true };
  } catch (err) {
    const formatted = formatFirebaseError(err, 'Profile save failed');
    console.warn('Firestore user record write note:', formatted);
    return { success: false, error: formatted };
  }
}

export async function updateUserProfileFields(
  userId: string,
  updates: Partial<User>
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      return {
        success: false,
        error: 'Permission denied: you can only edit your own profile.',
      };
    }
    const cleanUpdates = stripUndefinedFields({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    const res = await durableUpdateDoc('users', userId, cleanUpdates, {
      mirrorBackup: true,
    });
    if (!res.ok && !res.queued) {
      return { success: false, error: res.error || 'Profile update failed' };
    }
    return { success: true };
  } catch (err) {
    const formatted = formatFirebaseError(err, 'Profile update failed');
    console.warn('Firestore user profile patch note:', formatted);
    return { success: false, error: formatted };
  }
}

export async function claimHandleRecord(cleanHandle: string, userId: string): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== userId) return;
  const safe = cleanHandle.replace(/^@/, '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!safe) return;
  try {
    await setDoc(
      doc(db, 'handles', safe),
      {
        handle: safe,
        userId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Handle claim note:', err);
  }
}

export async function checkHandleAvailability(handle: string, currentUserId?: string): Promise<{ available: boolean; error?: string; cleanHandle: string }> {
  const cleanHandle = handle.replace(/^@/, '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanHandle.length < 3 || cleanHandle.length > 20) {
    return {
      available: false,
      cleanHandle,
      error: 'Username must be 3 to 20 letters, numbers, or underscores.',
    };
  }
  try {
    const snap = await getDoc(doc(db, 'handles', cleanHandle));
    if (snap.exists()) {
      const ownerId = (snap.data() as { userId?: string })?.userId;
      if (ownerId && ownerId !== currentUserId) {
        return { available: false, cleanHandle, error: `@${cleanHandle} is already taken.` };
      }
    }
    return { available: true, cleanHandle };
  } catch {
    return { available: true, cleanHandle };
  }
}

/**
 * Real Firebase Auth sign-up with verification email dispatch and mandatory Terms acceptance
 */
export async function registerUserAccount(
  name: string,
  email: string,
  password: string,
  role: UserRole = 'listener',
  extra?: {
    avatar?: string;
    bio?: string;
    handle?: string;
    country?: string;
    gender?: 'male' | 'female' | 'non-binary' | 'prefer_not_to_say';
    age?: number;
    preferredGenres?: string[];
    favoriteArtistIds?: string[];
    onboarded?: boolean;
    termsAccepted?: boolean;
    application?: Omit<ArtistApplication, 'id' | 'status' | 'submittedAt'>;
  }
): Promise<AuthResponse> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  if (!cleanName) return { success: false, error: 'Please enter your name.' };
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!extra?.termsAccepted) {
    return { success: false, error: 'You must agree to the Terms and Privacy Policy.' };
  }

  const rateError = checkClientRateLimit('register', 5, 60_000);
  if (rateError) return { success: false, error: rateError };

  const isPlatformAdmin = false;
  const assignedRole: UserRole = role === 'artist' ? 'artist' : 'listener';
  const applicationStatus: 'none' | 'pending' | 'approved' | 'rejected' = extra?.application ? 'pending' : 'none';

  try {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const fbUser = cred.user;

    await updateProfile(fbUser, {
      displayName: cleanName,
      photoURL: extra?.avatar || undefined,
    });

    try {
      await sendEmailVerification(fbUser);
    } catch (verifyErr) {
      console.warn('Verification email note:', verifyErr);
    }

    const baseHandle = (extra?.handle || cleanName)
      .replace(/^@/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 16) || 'listener';
    const uniqueSuffix = fbUser.uid.slice(0, 4).toLowerCase();
    const handleCheck = await checkHandleAvailability(baseHandle, fbUser.uid);
    const finalHandle = handleCheck.available ? handleCheck.cleanHandle : `${baseHandle}_${uniqueSuffix}`;

    const nowIso = new Date().toISOString();
    const currentSession = detectCurrentSessionRecord();

    const cleanPreferredGenres = Array.isArray(extra?.preferredGenres)
      ? extra.preferredGenres.map((g) => g.trim()).filter(Boolean).slice(0, 30)
      : [];
    const cleanFavoriteArtistIds = Array.isArray(extra?.favoriteArtistIds)
      ? Array.from(new Set(extra.favoriteArtistIds.filter(Boolean))).slice(0, 30)
      : [];

    const newUser: User = {
      id: fbUser.uid,
      name: cleanName,
      username: finalHandle,
      email: cleanEmail,
      emailVerified: fbUser.emailVerified,
      role: assignedRole,
      isAdmin: isPlatformAdmin,
      avatar: extra?.avatar || DEFAULT_AVATAR_SVG,
      bio: extra?.bio || '',
      country: extra?.country || 'Malawi',
      ...(extra?.gender ? { gender: extra.gender } : {}),
      ...(typeof extra?.age === 'number' && extra.age >= 13 && extra.age <= 120 ? { age: Math.floor(extra.age) } : {}),
      ...(cleanPreferredGenres.length > 0 ? { preferredGenres: cleanPreferredGenres } : {}),
      ...(typeof extra?.onboarded === 'boolean' ? { onboarded: extra.onboarded } : {}),
      likedTrackIds: [],
      likedArtistIds: [],
      followingArtistIds: cleanFavoriteArtistIds,
      playlists: [],
      applicationStatus,
      termsAcceptedAt: nowIso,
      termsVersion: LEGAL_CONFIG.currentTermsVersion,
      sessions: [currentSession],
    };

    // If registering directly as an Artist, create canonical artist profile right away
    if (assignedRole === 'artist') {
      const artistId = `artist-${fbUser.uid.slice(0, 10)}`;
      newUser.artistId = artistId;
      await setDoc(
        doc(db, 'artists', artistId),
        {
          id: artistId,
          ownerId: fbUser.uid,
          ownerUserId: fbUser.uid,
          claimedByUserId: fbUser.uid,
          name: cleanName,
          handle: `@${finalHandle}`,
          country: newUser.country || 'Malawi',
          location: newUser.country || 'Malawi',
          genres: cleanPreferredGenres.length > 0 ? cleanPreferredGenres.slice(0, 3) : ['Afro-Fusion'],
          bio: extra?.bio || '',
          avatar: newUser.avatar,
          banner: '',
          followersCount: 0,
          likesCount: 0,
          likedByUserIds: [],
          monthlyListeners: 0,
          verified: false,
          isCertified: false,
          isMonetized: false,
          monetizationStatus: 'locked',
          earningsBalance: 0,
          joinedDate: nowIso,
          socials: {},
          contactEmail: cleanEmail,
        },
        { merge: true }
      );
    }

    await syncUserRecord(newUser);
    await claimHandleRecord(finalHandle, fbUser.uid);
    if (cleanFavoriteArtistIds.length > 0) {
      await Promise.all(
        cleanFavoriteArtistIds.map((favArtistId) =>
          updateDoc(doc(db, 'artists', favArtistId), {
            followersCount: increment(1),
          }).catch(() => {})
        )
      );
    }
    clearRateLimit('register');

    return {
      success: true,
      user: newUser,
      needsVerification: !fbUser.emailVerified,
      isFirebaseUser: true,
    };
  } catch (err) {
    recordFailedAttempt('register');
    return {
      success: false,
      error: mapFirebaseAuthError(err),
      errorCode: extractAuthErrorCode(err),
    };
  }
}

/**
 * Real Firebase Auth Email & Password sign-in (NO silent local bypass)
 */
export async function loginUserAccount(
  email: string,
  password: string,
  rememberMe: boolean = true
): Promise<AuthResponse> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!password) {
    return { success: false, error: 'Please enter your password.' };
  }

  const rateError = checkClientRateLimit(`login:${cleanEmail}`, 6, 60_000);
  if (rateError) return { success: false, error: rateError };

  const isPlatformAdmin = false;

  try {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const fbUser = userCredential.user;
    clearRateLimit(`login:${cleanEmail}`);

    const userRef = doc(db, 'users', fbUser.uid);
    const snap = await getDoc(userRef);
    const currentSession = detectCurrentSessionRecord();

    let existingUser: User;
    if (snap.exists()) {
      const data = snap.data() as User;
      const otherSessions = (data.sessions || []).filter((s) => s.id !== currentSession.id).slice(0, 6);
      existingUser = {
        ...data,
        id: fbUser.uid,
        email: cleanEmail,
        emailVerified: fbUser.emailVerified,
        role: isPlatformAdmin ? 'admin' : data.role || 'listener',
        isAdmin: isPlatformAdmin,
        sessions: [currentSession, ...otherSessions],
      };
    } else {
      const namePart = fbUser.displayName || cleanEmail.split('@')[0] || 'Listener';
      const display = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      existingUser = {
        id: fbUser.uid,
        name: display,
        username: `${namePart.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user'}_${fbUser.uid.slice(0, 4).toLowerCase()}`,
        email: cleanEmail,
        emailVerified: fbUser.emailVerified,
        role: isPlatformAdmin ? 'admin' : 'listener',
        isAdmin: isPlatformAdmin,
        avatar: fbUser.photoURL || DEFAULT_AVATAR_SVG,
        bio: '',
        likedTrackIds: [],
        likedArtistIds: [],
        followingArtistIds: [],
        playlists: [],
        applicationStatus: 'none',
        sessions: [currentSession],
      };
    }

    if (snap.exists()) {
      await updateUserProfileFields(fbUser.uid, {
        emailVerified: fbUser.emailVerified,
        sessions: existingUser.sessions,
      });
    } else {
      await syncUserRecord(existingUser);
    }

    return {
      success: true,
      user: existingUser,
      needsVerification: !fbUser.emailVerified,
      isFirebaseUser: true,
    };
  } catch (err) {
    recordFailedAttempt(`login:${cleanEmail}`);
    return {
      success: false,
      error: mapFirebaseAuthError(err),
      errorCode: extractAuthErrorCode(err),
    };
  }
}

export async function resendVerificationEmail(): Promise<{ success: boolean; error?: string }> {
  if (!auth.currentUser) {
    return { success: false, error: 'Sign in first so we know where to send the verification email.' };
  }
  const rateError = checkClientRateLimit(`resend:${auth.currentUser.uid}`, 3, 60_000);
  if (rateError) return { success: false, error: rateError };

  try {
    await sendEmailVerification(auth.currentUser);
    recordFailedAttempt(`resend:${auth.currentUser.uid}`, 3, 60_000);
    return { success: true };
  } catch (err) {
    console.warn('Resend verification note:', err);
    return { success: false, error: mapFirebaseAuthError(err) };
  }
}

export async function checkEmailVerifiedNow(): Promise<{ verified: boolean; error?: string }> {
  if (!auth.currentUser) {
    return { verified: false, error: 'Please sign in first.' };
  }
  try {
    await auth.currentUser.reload();
    const verified = Boolean(auth.currentUser.emailVerified);
    if (verified) {
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        { emailVerified: true, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }
    return { verified };
  } catch (err) {
    return { verified: false, error: mapFirebaseAuthError(err) };
  }
}

/**
 * Send password reset email with neutral non-enumerating confirmation copy
 */
export async function sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  const rateError = checkClientRateLimit(`reset:${cleanEmail}`, 3, 60_000);
  if (rateError) return { success: false, message: rateError };

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: any) {
    // Log warning but never expose whether an account exists, except invalid/rate-limit/network
    console.warn('Password reset note:', err);
    if (err?.code === 'auth/too-many-requests' || err?.code === 'auth/network-request-failed') {
      return { success: false, message: mapFirebaseAuthError(err) };
    }
  }
  return {
    success: true,
    message: 'If an account exists for that email, we sent a reset link.',
  };
}

/**
 * Phone Auth helpers (Invisible Recaptcha + OTP)
 */
let activeRecaptcha: RecaptchaVerifier | null = null;

export function clearRecaptchaVerifier() {
  if (activeRecaptcha) {
    try {
      activeRecaptcha.clear();
    } catch {}
    activeRecaptcha = null;
  }
}

export async function sendPhoneOtp(
  fullPhoneE164: string,
  containerId: string = 'lv-recaptcha-container'
): Promise<{ success: boolean; confirmation?: ConfirmationResult; error?: string; errorCode?: string }> {
  const clean = fullPhoneE164.replace(/\s+/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(clean)) {
    return { success: false, error: 'Enter a valid phone number with country code (e.g. +265991234567).' };
  }

  const rateError = checkClientRateLimit(`phone:${clean}`, 4, 60_000);
  if (rateError) return { success: false, error: rateError };

  try {
    clearRecaptchaVerifier();
    activeRecaptcha = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
    });
    const confirmation = await signInWithPhoneNumber(auth, clean, activeRecaptcha);
    return { success: true, confirmation };
  } catch (err) {
    clearRecaptchaVerifier();
    recordFailedAttempt(`phone:${clean}`, 4, 60_000);
    return {
      success: false,
      error: mapFirebaseAuthError(err),
      errorCode: extractAuthErrorCode(err),
    };
  }
}

/**
 * Reauthentication for sensitive changes (password, email, payout methods, delete account)
 */
export async function reauthenticateUser(options: {
  password?: string;
  useGoogle?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Please sign in first.' };

  try {
    if (options.useGoogle) {
      await reauthenticateWithPopup(user, googleAuthProvider);
      return { success: true };
    }
    if (options.password && user.email) {
      const cred = EmailAuthProvider.credential(user.email, options.password);
      await reauthenticateWithCredential(user, cred);
      return { success: true };
    }
    return { success: false, error: 'Enter your password or choose Google to confirm.' };
  } catch (err) {
    return { success: false, error: mapFirebaseAuthError(err) };
  }
}

export async function changeUserPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Please sign in first.' };
  try {
    await updatePassword(user, newPassword);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapFirebaseAuthError(err) };
  }
}

export async function linkGoogleAccount(): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Please sign in first.' };
  try {
    await linkWithPopup(user, googleAuthProvider);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapFirebaseAuthError(err) };
  }
}

export async function unlinkSignInProvider(providerId: string): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Please sign in first.' };
  if (user.providerData.length <= 1) {
    return { success: false, error: 'Keep at least one sign-in method on your account.' };
  }
  try {
    await unlink(user, providerId);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapFirebaseAuthError(err) };
  }
}

export async function deleteCurrentUserAccount(): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Please sign in first.' };
  const uid = user.uid;
  try {
    try {
      await deleteDoc(doc(db, 'users', uid, 'settings', 'preferences'));
    } catch {}
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch {}
    await deleteUser(user);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapFirebaseAuthError(err) };
  }
}

export async function linkPhoneNumberCredential(verificationId: string, code: string): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Please sign in first.' };
  try {
    const cred = PhoneAuthProvider.credential(verificationId, code);
    await reauthenticateWithCredential(user, cred);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapFirebaseAuthError(err) };
  }
}

/**
 * ADMIN CONFIGURATION & AUTH (Restricted strictly to odulamw@gmail.com)
 */
export interface AdminSetupStatus {
  isConfigured: boolean;
  adminEmail: string;
  config?: AdminConfig;
}

export async function fetchAdminSetupStatus(): Promise<AdminSetupStatus> {
  try {
    const ref = doc(db, 'admin_config', ADMIN_CONFIG_DOC);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        isConfigured: Boolean(data.isInitialized),
        adminEmail: PRIMARY_ADMIN_EMAIL,
        config: data as AdminConfig,
      };
    }
  } catch (e) {
    console.warn('Could not read admin_config doc:', e);
  }

  return {
    isConfigured: false,
    adminEmail: PRIMARY_ADMIN_EMAIL,
  };
}

export async function initializeAdminAccount(
  _password: string
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  return {
    success: false,
    error: `Administration uses Google Login Auth only (${PRIMARY_ADMIN_EMAIL}).`,
  };
}

export async function verifyAdminCredentials(
  _email: string,
  _password: string
): Promise<{ success: boolean; error?: string; errorCode?: string; user?: User }> {
  return {
    success: false,
    error: `Administration sign-in requires Google Login Auth with ${PRIMARY_ADMIN_EMAIL}.`,
  };
}
