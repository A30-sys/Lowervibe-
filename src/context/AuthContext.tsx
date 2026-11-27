import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  ConfirmationResult,
  indexedDBLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { LEGAL_CONFIG } from '../config/legalConfig';
import {
  adminGoogleAuthProvider,
  auth,
  db,
  formatFirebaseError,
  googleAuthProvider,
} from '../services/firebase';
import { durableSetDoc, durableUpdateDoc, flushPendingSyncOperations } from '../services/reliableSync';
import {
  changeUserPassword,
  checkEmailVerifiedNow,
  checkHandleAvailability,
  claimHandleRecord,
  deleteCurrentUserAccount,
  detectCurrentSessionRecord,
  extractAuthErrorCode,
  isVerifiedAdminGoogleSession,
  linkGoogleAccount,
  loginUserAccount,
  mapFirebaseAuthError,
  PRIMARY_ADMIN_EMAIL,
  reauthenticateUser,
  registerUserAccount,
  resendVerificationEmail,
  sendPasswordReset,
  sendPhoneOtp,
  syncUserRecord,
  unlinkSignInProvider,
  updateUserProfileFields,
} from '../services/authService';
import {
  ArtistApplication,
  DEFAULT_USER_SETTINGS,
  PayoutRecord,
  Playlist,
  User,
  UserRole,
  UserSettings,
} from '../types';
import { DEFAULT_AVATAR_SVG, DEFAULT_ARTWORK_SVG, DEFAULT_BANNER_SVG } from '../utils/artworkFallback';
import { setBatterySaverMode } from '../utils/batterySaver';
import { LANG_STORAGE_KEY, useLanguage } from './LanguageContext';
import { THEME_MODE_KEY, useTheme } from './ThemeContext';
import { useToast } from './ToastContext';

interface AuthContextType {
  currentUser: User | null;
  firebaseProviders: string[];
  emailVerified: boolean;
  isGuestMode: boolean;
  isAuthenticated: boolean;
  isArtist: boolean;
  isAdmin: boolean;
  authReady: boolean;

  // Settings (persisted to users/{uid}/settings/preferences)
  userSettings: UserSettings;
  updateUserSettings: (partial: Partial<{
    playback: Partial<UserSettings['playback']>;
    dataSaver: Partial<UserSettings['dataSaver']>;
    notifications: Partial<UserSettings['notifications']>;
    privacy: Partial<UserSettings['privacy']>;
    appearance: Partial<UserSettings['appearance']>;
  }>) => Promise<void>;

  // Guest browsing toggle
  enterGuestMode: () => void;
  exitGuestMode: () => void;

  // Real Email / Password / Google / Phone Auth
  loginWithEmail: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string; errorCode?: string; needsVerification?: boolean }>;
  registerWithEmail: (
    name: string,
    email: string,
    password: string,
    role?: UserRole,
    extra?: {
      bio?: string;
      handle?: string;
      country?: string;
      gender?: 'male' | 'female' | 'non-binary' | 'prefer_not_to_say';
      age?: number;
      preferredGenres?: string[];
      favoriteArtistIds?: string[];
      onboarded?: boolean;
      termsAccepted?: boolean;
      artistId?: string;
      avatar?: string;
      application?: Omit<ArtistApplication, 'id' | 'status' | 'submittedAt'>;
    }
  ) => Promise<{ success: boolean; error?: string; errorCode?: string; user?: User; needsVerification?: boolean }>;
  signInWithGoogle: (termsAccepted?: boolean) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  sendPhoneVerificationCode: (
    fullPhoneE164: string,
    containerId?: string
  ) => Promise<{ success: boolean; confirmation?: ConfirmationResult; error?: string; errorCode?: string }>;
  verifyPhoneCode: (
    confirmation: ConfirmationResult,
    code: string,
    termsAccepted?: boolean
  ) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  resendVerification: () => Promise<{ success: boolean; error?: string }>;
  refreshEmailVerification: () => Promise<{ verified: boolean; error?: string }>;
  acceptLatestTerms: () => Promise<void>;
  needTermsUpdateAck: boolean;

  // Account & Security Actions
  updateHandleWithCooldown: (newHandle: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  linkGoogle: () => Promise<{ success: boolean; error?: string }>;
  unlinkProvider: (providerId: string) => Promise<{ success: boolean; error?: string }>;
  signOutOtherSessions: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  upgradeListenerToArtist: (stageName?: string, country?: string) => Promise<{ success: boolean; artistId?: string; error?: string }>;

  // Reauthentication Modal Hook
  reauthPromptOpen: boolean;
  reauthPromptReason: string | null;
  requireReauth: (reason: string) => Promise<boolean>;
  submitReauth: (opts: { password?: string; useGoogle?: boolean }) => Promise<{ success: boolean; error?: string }>;
  cancelReauth: () => void;

  // Dedicated Admin Auth (Google Login Auth strictly for odulamw@gmail.com)
  signInAdminWithGoogle: () => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  adminLogin: (password: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  adminInitialize: (password: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;

  logout: () => Promise<void>;
  toggleLikeTrack: (trackId: string) => void;
  toggleLikeArtist: (artistId: string) => void;
  toggleFollowArtist: (artistId: string) => void;
  createPlaylist: (
    name: string,
    description?: string,
    coverArt?: string,
    meta?: { country?: string; region?: string; genre?: string; isPublic?: boolean }
  ) => Playlist;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  updateCurrentUser: (updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;

  // Auth Gate
  requireAuth: (action: () => void, reason?: string) => boolean;
  authModalOpen: boolean;
  authPromptReason: string | null;
  openAuthGateModal: (reason?: string) => void;
  closeAuthGateModal: () => void;
  executePendingAction: () => void;

  // Artist Applications (retained cleanly for Admin review of legacy/submitted requests)
  applications: ArtistApplication[];
  submitArtistApplication: (data: Omit<ArtistApplication, 'id' | 'status' | 'submittedAt'>) => ArtistApplication;
  approveArtistApplication: (appId: string) => void;
  rejectArtistApplication: (appId: string, feedback: string) => void;
  celebrationModal: { isOpen: boolean; artistName: string } | null;
  dismissCelebrationModal: () => void;

  payoutRecords: PayoutRecord[];
  processPayout: (recordId: string) => void;
  processAllDuePayouts: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'lowervibe_user_settings_v1';
const GUEST_MODE_KEY = 'lowervibe_guest_mode_v1';
const CACHED_USER_STORAGE_KEY = 'lowervibe_cached_user_v1';

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (parsed && typeof parsed.id === 'string' && parsed.id.length > 0) {
      return parsed;
    }
  } catch {}
  return null;
}

function writeCachedUser(user: User | null): void {
  try {
    if (!user) {
      localStorage.removeItem(CACHED_USER_STORAGE_KEY);
      return;
    }
    const safeUser: User = {
      ...user,
      avatar:
        user.avatar && user.avatar.startsWith('data:') && user.avatar.length > 4096
          ? DEFAULT_AVATAR_SVG
          : user.avatar,
      banner:
        user.banner && user.banner.startsWith('data:') && user.banner.length > 4096
          ? ''
          : user.banner,
    };
    localStorage.setItem(CACHED_USER_STORAGE_KEY, JSON.stringify(safeUser));
  } catch {}
}

function mergeSettings(base: UserSettings, incoming?: Partial<UserSettings>): UserSettings {
  return {
    playback: { ...base.playback, ...(incoming?.playback || {}) },
    dataSaver: { ...base.dataSaver, ...(incoming?.dataSaver || {}) },
    notifications: { ...base.notifications, ...(incoming?.notifications || {}) },
    privacy: { ...base.privacy, ...(incoming?.privacy || {}) },
    appearance: { ...base.appearance, ...(incoming?.appearance || {}) },
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { themeMode, setThemeMode } = useTheme();
  const { setLanguage } = useLanguage();

  const [currentUser, setCurrentUser] = useState<User | null>(() => readCachedUser());
  const [firebaseProviders, setFirebaseProviders] = useState<string[]>([]);
  const [emailVerified, setEmailVerified] = useState<boolean>(() => Boolean(readCachedUser()?.emailVerified));
  const [authReady, setAuthReady] = useState(false);

  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GUEST_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      const merged = saved ? mergeSettings(DEFAULT_USER_SETTINGS, JSON.parse(saved)) : DEFAULT_USER_SETTINGS;
      const savedTheme = localStorage.getItem(THEME_MODE_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        merged.appearance = { ...merged.appearance, theme: savedTheme };
      }
      const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
      if (savedLang === 'en' || savedLang === 'ny') {
        merged.appearance = { ...merged.appearance, language: savedLang };
      }
      return merged;
    } catch {}
    return DEFAULT_USER_SETTINGS;
  });

  const [applications, setApplications] = useState<ArtistApplication[]>([]);
  const [payoutRecords, setPayoutRecords] = useState<PayoutRecord[]>([]);

  const pendingActionRef = useRef<(() => void) | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);
  const [celebrationModal, setCelebrationModal] = useState<{ isOpen: boolean; artistName: string } | null>(null);

  // Reauth Modal Resolver
  const reauthResolverRef = useRef<((ok: boolean) => void) | null>(null);
  const [reauthPromptOpen, setReauthPromptOpen] = useState(false);
  const [reauthPromptReason, setReauthPromptReason] = useState<string | null>(null);

  const enterGuestMode = () => {
    setIsGuestMode(true);
    try {
      localStorage.setItem(GUEST_MODE_KEY, 'true');
    } catch {}
  };

  const exitGuestMode = () => {
    setIsGuestMode(false);
    try {
      localStorage.removeItem(GUEST_MODE_KEY);
    } catch {}
  };

  // Sync settings, reduced-motion class, battery saver & persistent device login cache
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(userSettings));
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle(
        'reduced-motion',
        Boolean(userSettings.appearance?.reducedMotion)
      );
    }
    if (userSettings.appearance?.batterySaverMode) {
      setBatterySaverMode(userSettings.appearance.batterySaverMode);
    }
  }, [userSettings]);

  useEffect(() => {
    if (currentUser) {
      writeCachedUser(currentUser);
    }
  }, [currentUser]);

  // Firestore Real-time Applications (only when signed in and auth matches)
  useEffect(() => {
    const fbUser = auth.currentUser;
    if (!authReady || !currentUser || !fbUser || fbUser.uid !== currentUser.id) {
      setApplications([]);
      return;
    }
    const isVerifiedAdmin = isVerifiedAdminGoogleSession(fbUser);
    try {
      const appsTarget = isVerifiedAdmin
        ? collection(db, 'applications')
        : query(collection(db, 'applications'), where('userId', '==', fbUser.uid));
      const unsub = onSnapshot(
        appsTarget,
        (snapshot) => {
          const firestoreApps = snapshot.docs.map((docSnap) => ({
            ...docSnap.data(),
            id: docSnap.id,
          } as ArtistApplication));
          setApplications(firestoreApps);
        },
        () => {}
      );
      return () => unsub();
    } catch {}
  }, [authReady, currentUser?.id, emailVerified]);

  // Real Firebase Auth Listener + User Doc + Settings Subcollection Listener
  useEffect(() => {
    let userDocUnsub: (() => void) | null = null;
    let settingsDocUnsub: (() => void) | null = null;
    let didResolve = false;
    let isMounted = true;

    const timer = window.setTimeout(() => {
      if (!didResolve && isMounted) setAuthReady(true);
    }, 6000);

    if (typeof (auth as unknown as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
      (auth as unknown as { authStateReady: () => Promise<void> })
        .authStateReady()
        .then(() => {
          if (isMounted && !didResolve) {
            didResolve = true;
            setAuthReady(true);
          }
        })
        .catch(() => {});
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }
      if (settingsDocUnsub) {
        settingsDocUnsub();
        settingsDocUnsub = null;
      }

      if (fbUser) {
        setFirebaseProviders(fbUser.providerData.map((p) => p.providerId));
        setEmailVerified(Boolean(fbUser.emailVerified || fbUser.providerData.some((p) => p.providerId === 'phone')));

        const cleanEmail = (fbUser.email || '').toLowerCase();
        const isPlatformAdmin = isVerifiedAdminGoogleSession(fbUser);
        const userRef = doc(db, 'users', fbUser.uid);
        const settingsRef = doc(db, 'users', fbUser.uid, 'settings', 'preferences');

        const claimedHandleRef = { current: '' };
        userDocUnsub = onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as User;
              if (data.username && claimedHandleRef.current !== data.username) {
                claimedHandleRef.current = data.username;
                claimHandleRecord(data.username, fbUser.uid).catch(() => {});
              }
              const mergedUser: User = {
                ...data,
                id: fbUser.uid,
                email: cleanEmail || data.email || '',
                phoneNumber: fbUser.phoneNumber || data.phoneNumber,
                emailVerified: Boolean(fbUser.emailVerified),
                phoneVerified: Boolean(fbUser.phoneNumber || data.phoneVerified),
                isAdmin: isPlatformAdmin,
                role: isPlatformAdmin ? 'admin' : data.role || 'listener',
                likedTrackIds: Array.isArray(data.likedTrackIds) ? data.likedTrackIds : [],
                likedArtistIds: Array.isArray(data.likedArtistIds) ? data.likedArtistIds : [],
                followingArtistIds: Array.isArray(data.followingArtistIds) ? data.followingArtistIds : [],
                playlists: Array.isArray(data.playlists) ? data.playlists : [],
              };
              setCurrentUser(mergedUser);

              if (
                (mergedUser.role === 'artist' || mergedUser.applicationStatus === 'approved') &&
                !isPlatformAdmin
              ) {
                try {
                  const celebKey = `lowervibe_artist_celebrated_${fbUser.uid}`;
                  if (!localStorage.getItem(celebKey)) {
                    localStorage.setItem(celebKey, 'true');
                    setCelebrationModal({
                      isOpen: true,
                      artistName: mergedUser.artistApplication?.stageName || mergedUser.name || 'Artist',
                    });
                  }
                } catch {}
              }
            }
          },
          (err) => {
            console.warn('User profile snapshot note:', err);
          }
        );

        settingsDocUnsub = onSnapshot(
          settingsRef,
          (snap) => {
            if (snap.exists()) {
              const incoming = snap.data() as Partial<UserSettings>;
              const merged = mergeSettings(DEFAULT_USER_SETTINGS, incoming);
              let localTheme: string | null = null;
              let localLang: string | null = null;
              try {
                localTheme = localStorage.getItem(THEME_MODE_KEY);
                localLang = localStorage.getItem(LANG_STORAGE_KEY);
              } catch {}
              if (localTheme === 'light' || localTheme === 'dark' || localTheme === 'system') {
                merged.appearance.theme = localTheme;
              } else if (incoming?.appearance?.theme) {
                setThemeMode(incoming.appearance.theme);
              }
              if (localLang === 'en' || localLang === 'ny') {
                merged.appearance.language = localLang;
                setLanguage(localLang);
              } else if (incoming?.appearance?.language) {
                setLanguage(incoming.appearance.language);
              }
              setUserSettings(merged);
            }
          },
          () => {}
        );

        // Bootstrap user doc if first login (e.g. Google or Phone auth)
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            const name =
              fbUser.displayName ||
              (cleanEmail ? cleanEmail.split('@')[0] : '') ||
              (fbUser.phoneNumber ? `Listener ${fbUser.phoneNumber.slice(-4)}` : 'Listener');
            const newUser: User = {
              id: fbUser.uid,
              name,
              username: `${name.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user'}_${fbUser.uid.slice(0, 4).toLowerCase()}`,
              email: cleanEmail,
              phoneNumber: fbUser.phoneNumber || undefined,
              phoneVerified: Boolean(fbUser.phoneNumber),
              emailVerified: Boolean(fbUser.emailVerified),
              role: isPlatformAdmin ? 'admin' : 'listener',
              isAdmin: isPlatformAdmin,
              avatar: fbUser.photoURL || DEFAULT_AVATAR_SVG,
              bio: '',
              country: 'Malawi',
              likedTrackIds: [],
              likedArtistIds: [],
              followingArtistIds: [],
              playlists: [],
              applicationStatus: 'none',
              sessions: [detectCurrentSessionRecord()],
            };
            await syncUserRecord(newUser);
            setCurrentUser(newUser);
          }
        } catch (err) {
          console.warn('Bootstrap user profile note:', err);
        }
      } else {
        try {
          if (typeof (auth as unknown as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
            await (auth as unknown as { authStateReady: () => Promise<void> }).authStateReady();
          }
        } catch {}
        if (!auth.currentUser && isMounted) {
          setFirebaseProviders([]);
          setEmailVerified(false);
          setCurrentUser(null);
          writeCachedUser(null);
        }
      }

      didResolve = true;
      if (isMounted) setAuthReady(true);
    });

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
      unsubscribeAuth();
      if (userDocUnsub) userDocUnsub();
      if (settingsDocUnsub) settingsDocUnsub();
    };
  }, []);

  const updateUserSettings = async (
    partial: Partial<{
      playback: Partial<UserSettings['playback']>;
      dataSaver: Partial<UserSettings['dataSaver']>;
      notifications: Partial<UserSettings['notifications']>;
      privacy: Partial<UserSettings['privacy']>;
      appearance: Partial<UserSettings['appearance']>;
    }>
  ) => {
    const next = mergeSettings(userSettings, {
      playback: partial.playback ? { ...userSettings.playback, ...partial.playback } : userSettings.playback,
      dataSaver: partial.dataSaver ? { ...userSettings.dataSaver, ...partial.dataSaver } : userSettings.dataSaver,
      notifications: partial.notifications
        ? { ...userSettings.notifications, ...partial.notifications }
        : userSettings.notifications,
      privacy: partial.privacy ? { ...userSettings.privacy, ...partial.privacy } : userSettings.privacy,
      appearance: partial.appearance ? { ...userSettings.appearance, ...partial.appearance } : userSettings.appearance,
    });

    if (partial.appearance?.theme) {
      setThemeMode(partial.appearance.theme);
    }
    if (partial.appearance?.language) {
      setLanguage(partial.appearance.language);
    }

    setUserSettings(next);

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.id, 'settings', 'preferences'), next, { merge: true });
      } catch (err) {
        console.warn('Settings save note:', err);
      }
    }
  };

  const signInWithGoogle = async (
    termsAccepted?: boolean
  ): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    try {
      await setPersistence(auth, indexedDBLocalPersistence).catch(() =>
        setPersistence(auth, browserLocalPersistence)
      );
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const fbUser = cred.user;
      if (!fbUser) return { success: false, error: 'Google sign-in returned no user.' };

      const cleanEmail = (fbUser.email || '').toLowerCase();
      const isPlatformAdmin = isVerifiedAdminGoogleSession(fbUser);
      const userRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userRef);
      const session = detectCurrentSessionRecord();

      let userToSet: User;
      if (snap.exists()) {
        const data = snap.data() as User;
        const otherSessions = (data.sessions || []).filter((s) => s.id !== session.id).slice(0, 6);
        userToSet = {
          ...data,
          id: fbUser.uid,
          email: cleanEmail || data.email || '',
          emailVerified: fbUser.emailVerified,
          isAdmin: isPlatformAdmin,
          role: isPlatformAdmin ? 'admin' : data.role || 'listener',
          sessions: [session, ...otherSessions],
          ...(termsAccepted && !data.termsVersion
            ? { termsAcceptedAt: new Date().toISOString(), termsVersion: LEGAL_CONFIG.currentTermsVersion }
            : {}),
        };
      } else {
        const name = fbUser.displayName || cleanEmail.split('@')[0] || 'Listener';
        userToSet = {
          id: fbUser.uid,
          name,
          username: `${name.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user'}_${fbUser.uid.slice(0, 4).toLowerCase()}`,
          email: cleanEmail,
          emailVerified: fbUser.emailVerified,
          role: isPlatformAdmin ? 'admin' : 'listener',
          isAdmin: isPlatformAdmin,
          avatar: fbUser.photoURL || DEFAULT_AVATAR_SVG,
          bio: '',
          country: 'Malawi',
          likedTrackIds: [],
          likedArtistIds: [],
          followingArtistIds: [],
          playlists: [],
          applicationStatus: 'none',
          termsAcceptedAt: new Date().toISOString(),
          termsVersion: LEGAL_CONFIG.currentTermsVersion,
          sessions: [session],
        };
      }

      if (snap.exists()) {
        const patch: Partial<User> = {
          emailVerified: userToSet.emailVerified,
          sessions: userToSet.sessions,
          ...(userToSet.termsVersion ? { termsAcceptedAt: userToSet.termsAcceptedAt, termsVersion: userToSet.termsVersion } : {}),
        };
        await updateUserProfileFields(fbUser.uid, patch);
      } else {
        await syncUserRecord(userToSet);
      }
      setCurrentUser(userToSet);
      exitGuestMode();
      executePendingAction();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: mapFirebaseAuthError(err),
        errorCode: extractAuthErrorCode(err),
      };
    }
  };

  const sendPhoneVerificationCode = async (fullPhoneE164: string, containerId?: string) => {
    return await sendPhoneOtp(fullPhoneE164, containerId);
  };

  const verifyPhoneCode = async (
    confirmation: ConfirmationResult,
    code: string,
    termsAccepted: boolean = true
  ): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    try {
      await setPersistence(auth, indexedDBLocalPersistence).catch(() =>
        setPersistence(auth, browserLocalPersistence)
      );
      const cred = await confirmation.confirm(code);
      const fbUser = cred.user;
      const userRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userRef);
      const session = detectCurrentSessionRecord();

      if (!snap.exists()) {
        const suffix = (fbUser.phoneNumber || fbUser.uid).slice(-4);
        const newUser: User = {
          id: fbUser.uid,
          name: `Listener ${suffix}`,
          username: `user_${fbUser.uid.slice(0, 6).toLowerCase()}`,
          email: fbUser.email || '',
          phoneNumber: fbUser.phoneNumber || undefined,
          phoneVerified: true,
          emailVerified: fbUser.emailVerified,
          role: 'listener',
          isAdmin: false,
          avatar: DEFAULT_AVATAR_SVG,
          bio: '',
          country: 'Malawi',
          likedTrackIds: [],
          likedArtistIds: [],
          followingArtistIds: [],
          playlists: [],
          applicationStatus: 'none',
          ...(termsAccepted
            ? { termsAcceptedAt: new Date().toISOString(), termsVersion: LEGAL_CONFIG.currentTermsVersion }
            : {}),
          sessions: [session],
        };
        await syncUserRecord(newUser);
        setCurrentUser(newUser);
      } else {
        const data = snap.data() as User;
        const otherSessions = (data.sessions || []).filter((s) => s.id !== session.id).slice(0, 6);
        const updated: User = {
          ...data,
          phoneNumber: fbUser.phoneNumber || data.phoneNumber,
          phoneVerified: true,
          sessions: [session, ...otherSessions],
        };
        await updateUserProfileFields(fbUser.uid, {
          phoneNumber: updated.phoneNumber,
          phoneVerified: true,
          sessions: updated.sessions,
        });
        setCurrentUser(updated);
      }

      exitGuestMode();
      executePendingAction();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: mapFirebaseAuthError(err),
        errorCode: extractAuthErrorCode(err),
      };
    }
  };

  const loginWithEmail = async (
    email: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<{ success: boolean; error?: string; errorCode?: string; needsVerification?: boolean }> => {
    const res = await loginUserAccount(email, password, rememberMe);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      exitGuestMode();
      executePendingAction();
      return { success: true, needsVerification: res.needsVerification };
    }
    return {
      success: false,
      error: res.error || 'Could not sign in.',
      errorCode: res.errorCode,
    };
  };

  const registerWithEmail = async (
    name: string,
    email: string,
    password: string,
    role: UserRole = 'listener',
    extra?: {
      bio?: string;
      handle?: string;
      country?: string;
      gender?: 'male' | 'female' | 'non-binary' | 'prefer_not_to_say';
      age?: number;
      preferredGenres?: string[];
      favoriteArtistIds?: string[];
      onboarded?: boolean;
      termsAccepted?: boolean;
      artistId?: string;
      avatar?: string;
      application?: Omit<ArtistApplication, 'id' | 'status' | 'submittedAt'>;
    }
  ): Promise<{ success: boolean; error?: string; errorCode?: string; user?: User; needsVerification?: boolean }> => {
    const res = await registerUserAccount(name, email, password, role, extra);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      exitGuestMode();
      if (res.user.artistApplication) {
        setApplications((prev) => [res.user!.artistApplication!, ...prev]);
      }
      return { success: true, user: res.user, needsVerification: res.needsVerification };
    }
    return {
      success: false,
      error: res.error || 'Could not create account.',
      errorCode: res.errorCode,
    };
  };

  const resetPassword = async (email: string) => sendPasswordReset(email);
  const resendVerification = async () => resendVerificationEmail();
  const refreshEmailVerification = async () => {
    const res = await checkEmailVerifiedNow();
    if (res.verified) {
      setEmailVerified(true);
      setCurrentUser((prev) => (prev ? { ...prev, emailVerified: true } : null));
    }
    return res;
  };

  const acceptLatestTerms = async () => {
    if (!currentUser) return;
    const termsIso = new Date().toISOString();
    const updated: User = {
      ...currentUser,
      termsAcceptedAt: termsIso,
      termsVersion: LEGAL_CONFIG.currentTermsVersion,
    };
    setCurrentUser(updated);
    await updateUserProfileFields(currentUser.id, {
      termsAcceptedAt: termsIso,
      termsVersion: LEGAL_CONFIG.currentTermsVersion,
    });
  };

  const needTermsUpdateAck = Boolean(
    currentUser && currentUser.termsVersion !== LEGAL_CONFIG.currentTermsVersion
  );

  // Handle update with strict 30-day cooldown + uniqueness check
  const updateHandleWithCooldown = async (newHandle: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Please sign in first.' };

    if (currentUser.handleUpdatedAt) {
      const daysSince = (Date.now() - new Date(currentUser.handleUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        const remaining = Math.ceil(30 - daysSince);
        return {
          success: false,
          error: `You can change your @username once every 30 days. Try again in ${remaining} day${remaining === 1 ? '' : 's'}.`,
        };
      }
    }

    const check = await checkHandleAvailability(newHandle, currentUser.id);
    if (!check.available) {
      return { success: false, error: check.error || 'Username not available.' };
    }

    const previous = currentUser;
    const handleIso = new Date().toISOString();
    const updated: User = {
      ...currentUser,
      username: check.cleanHandle,
      handleUpdatedAt: handleIso,
    };
    setCurrentUser(updated);
    const syncRes = await updateUserProfileFields(currentUser.id, {
      username: check.cleanHandle,
      handleUpdatedAt: handleIso,
    });
    if (!syncRes.success) {
      setCurrentUser(previous);
      return { success: false, error: syncRes.error || 'Could not save username.' };
    }
    try {
      await claimHandleRecord(check.cleanHandle, currentUser.id);
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Handle reservation failed') };
    }
    return { success: true };
  };

  const requireReauth = (reason: string): Promise<boolean> => {
    return new Promise((resolve) => {
      reauthResolverRef.current = resolve;
      setReauthPromptReason(reason);
      setReauthPromptOpen(true);
    });
  };

  const submitReauth = async (opts: { password?: string; useGoogle?: boolean }) => {
    const res = await reauthenticateUser(opts);
    if (res.success) {
      setReauthPromptOpen(false);
      setReauthPromptReason(null);
      reauthResolverRef.current?.(true);
      reauthResolverRef.current = null;
    }
    return res;
  };

  const cancelReauth = () => {
    setReauthPromptOpen(false);
    setReauthPromptReason(null);
    reauthResolverRef.current?.(false);
    reauthResolverRef.current = null;
  };

  const changePassword = async (newPassword: string) => changeUserPassword(newPassword);

  const linkGoogle = async () => {
    const res = await linkGoogleAccount();
    if (res.success && auth.currentUser) {
      setFirebaseProviders(auth.currentUser.providerData.map((p) => p.providerId));
    }
    return res;
  };

  const unlinkProvider = async (providerId: string) => {
    const res = await unlinkSignInProvider(providerId);
    if (res.success && auth.currentUser) {
      setFirebaseProviders(auth.currentUser.providerData.map((p) => p.providerId));
    }
    return res;
  };

  const signOutOtherSessions = async () => {
    if (!currentUser) return;
    const cur = detectCurrentSessionRecord();
    const updated: User = { ...currentUser, sessions: [cur] };
    setCurrentUser(updated);
    await updateUserProfileFields(currentUser.id, { sessions: [cur] });
  };

  const deleteAccount = async () => {
    const res = await deleteCurrentUserAccount();
    if (res.success) {
      writeCachedUser(null);
      setCurrentUser(null);
      exitGuestMode();
    }
    return res;
  };

  const upgradeListenerToArtist = async (
    stageName?: string,
    country?: string
  ): Promise<{ success: boolean; artistId?: string; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Please sign in first.' };

    // Only already-approved artists or admin can enter Studio directly; listeners must apply & await admin approval.
    if (currentUser.isAdmin || currentUser.role === 'artist' || currentUser.applicationStatus === 'approved') {
      return { success: true, artistId: currentUser.artistId };
    }

    if (currentUser.applicationStatus === 'pending') {
      return {
        success: false,
        error: 'Your Creator Studio application is currently awaiting Admin approval.',
      };
    }

    const cleanStage = (stageName || currentUser.name || 'Artist').trim();
    submitArtistApplication({
      userId: currentUser.id,
      userEmail: currentUser.email,
      stageName: cleanStage,
      legalName: currentUser.name || cleanStage,
      country: country || currentUser.country || 'Malawi',
      primaryGenre: currentUser.preferredGenres?.[0] || 'Afro-Fusion',
      bio: currentUser.bio || '',
      avatarUrl: currentUser.avatar || DEFAULT_AVATAR_SVG,
      rightsConfirmed: true,
    });
    return {
      success: false,
      error: 'Your Creator Studio application has been submitted for Admin approval.',
    };
  };

  const requireAuth = (action: () => void, reason: string = 'Sign in to continue'): boolean => {
    if (currentUser) {
      action();
      return true;
    }
    pendingActionRef.current = action;
    setAuthPromptReason(reason);
    setAuthModalOpen(true);
    return false;
  };

  const openAuthGateModal = (reason?: string) => {
    setAuthPromptReason(reason || 'Sign in to LOWERVIBE');
    setAuthModalOpen(true);
  };

  const closeAuthGateModal = () => {
    setAuthModalOpen(false);
    setAuthPromptReason(null);
    pendingActionRef.current = null;
  };

  const executePendingAction = () => {
    if (pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      setAuthModalOpen(false);
      setAuthPromptReason(null);
      window.setTimeout(() => action(), 50);
    } else {
      setAuthModalOpen(false);
    }
  };

  const submitArtistApplication = (
    data: Omit<ArtistApplication, 'id' | 'status' | 'submittedAt'>
  ): ArtistApplication => {
    const newApp: ArtistApplication = {
      ...data,
      id: 'app-' + Date.now(),
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
    setApplications((prev) => [newApp, ...prev.filter((a) => a.userEmail !== data.userEmail)]);
    if (currentUser) {
      const updatedUser: User = {
        ...currentUser,
        applicationStatus: 'pending',
        artistApplication: newApp,
      };
      setCurrentUser(updatedUser);
      void updateUserProfileFields(currentUser.id, {
        applicationStatus: 'pending',
        artistApplication: newApp,
      });
    }
    void durableSetDoc('applications', newApp.id, newApp as unknown as Record<string, unknown>, {
      merge: true,
      mirrorBackup: true,
    });
    const pendingNotifId = `notif-app-pending-${newApp.id}`;
    void durableSetDoc(
      'notifications',
      pendingNotifId,
      {
        id: pendingNotifId,
        userId: data.userId,
        userEmail: data.userEmail?.toLowerCase(),
        type: 'artist_pending',
        category: 'essential',
        title: 'Creator Studio application received',
        message: `Your artist profile "${data.stageName}" is under review. You will be notified as soon as verification finishes.`,
        readBy: [],
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        actionRoute: '/artistcreator',
      },
      { mirrorBackup: false }
    );
    return newApp;
  };

  const approveArtistApplication = async (appId: string) => {
    const app = applications.find((a) => a.id === appId);
    if (!app) return;

    const assignedArtistId = `artist-${(app.stageName || 'creator').toLowerCase().replace(/[^a-z0-9]/g, '-') || Date.now()}`;
    const updatedApp: ArtistApplication = {
      ...app,
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: currentUser?.name || 'Administrator',
    };

    setApplications((prev) => prev.map((a) => (a.id === appId ? updatedApp : a)));

    if (currentUser && (currentUser.id === app.userId || currentUser.email.toLowerCase() === app.userEmail.toLowerCase())) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              role: 'artist',
              applicationStatus: 'approved',
              artistId: prev.artistId || assignedArtistId,
              artistApplication: updatedApp,
            }
          : null
      );
      setCelebrationModal({ isOpen: true, artistName: app.stageName });
    }

    try {
      await updateDoc(doc(db, 'applications', appId), {
        status: 'approved',
        reviewedAt: updatedApp.reviewedAt,
        reviewedBy: updatedApp.reviewedBy,
      });

      if (app.userId) {
        await updateDoc(doc(db, 'users', app.userId), {
          role: 'artist',
          applicationStatus: 'approved',
          artistId: assignedArtistId,
          artistApplication: updatedApp,
          updatedAt: new Date().toISOString(),
        });
      }

      await setDoc(
        doc(db, 'artists', assignedArtistId),
        {
          id: assignedArtistId,
          ownerId: app.userId,
          ownerUserId: app.userId,
          claimedByUserId: app.userId,
          name: app.stageName,
          handle: `@${(app.stageName || 'creator').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          country: app.country,
          location: app.country,
          genres: [app.primaryGenre || 'Afro-Fusion'],
          bio: app.bio || '',
          avatar: app.avatarUrl || DEFAULT_AVATAR_SVG,
          banner: DEFAULT_BANNER_SVG,
          followersCount: 0,
          likesCount: 0,
          likedByUserIds: [],
          monthlyListeners: 0,
          verified: true,
          isCertified: true,
          isMonetized: false,
          monetizationStatus: 'locked',
          earningsBalanceMwk: 0,
          joinedDate: new Date().toISOString(),
          socials: {},
          contactEmail: app.userEmail?.toLowerCase() || '',
        },
        { merge: true }
      );

      const notifId = `notif-app-approved-${appId}-${Date.now()}`;
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: app.userId || app.userEmail,
        userEmail: app.userEmail?.toLowerCase(),
        type: 'artist_approved',
        title: 'Creator Studio approved',
        message: `Your artist profile "${app.stageName}" is approved. You can now upload music in Studio.`,
        readBy: [],
        createdAt: new Date().toISOString(),
        createdBy: PRIMARY_ADMIN_EMAIL,
        actionRoute: '/artistcreator',
      });
    } catch {}
  };

  const rejectArtistApplication = async (appId: string, feedback: string) => {
    const app = applications.find((a) => a.id === appId);
    if (!app) return;

    const updatedApp: ArtistApplication = {
      ...app,
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: currentUser?.name || 'Administrator',
      adminFeedback: feedback,
    };

    setApplications((prev) => prev.map((a) => (a.id === appId ? updatedApp : a)));

    try {
      await updateDoc(doc(db, 'applications', appId), {
        status: 'rejected',
        reviewedAt: updatedApp.reviewedAt,
        reviewedBy: updatedApp.reviewedBy,
        adminFeedback: feedback,
      });
      if (app.userId) {
        await updateDoc(doc(db, 'users', app.userId), {
          applicationStatus: 'rejected',
          artistApplication: updatedApp,
        });
      }

      const notifId = `notif-app-rejected-${appId}-${Date.now()}`;
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: app.userId || app.userEmail,
        userEmail: app.userEmail?.toLowerCase(),
        type: 'artist_rejected',
        title: 'Artist request not approved',
        message: `${app.stageName}: ${feedback}`,
        readBy: [],
        createdAt: new Date().toISOString(),
        createdBy: PRIMARY_ADMIN_EMAIL,
        actionRoute: '/artistcreator',
      });
    } catch {}
  };

  const dismissCelebrationModal = () => setCelebrationModal(null);

  const processPayout = (recordId: string) => {
    setPayoutRecords((prev) =>
      prev.map((rec) =>
        rec.id === recordId
          ? {
              ...rec,
              status: 'paid',
              processedAt: new Date().toISOString(),
              txRef: `TXN-LV-${Date.now().toString().slice(-7)}`,
            }
          : rec
      )
    );
  };

  const processAllDuePayouts = () => {
    setPayoutRecords((prev) =>
      prev.map((rec) =>
        rec.status !== 'paid'
          ? {
              ...rec,
              status: 'paid',
              processedAt: new Date().toISOString(),
              txRef: `TXN-LV-${Date.now().toString().slice(-7)}`,
            }
          : rec
      )
    );
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {}
    writeCachedUser(null);
    setCurrentUser(null);
    exitGuestMode();
    pendingActionRef.current = null;
  };

  const { showToast } = useToast();
  const likeInFlightRef = useRef<Set<string>>(new Set());
  const toggleLikeTrack = (trackId: string) => {
    if (!currentUser) {
      requireAuth(() => toggleLikeTrack(trackId), 'Sign in to like this song');
      return;
    }
    if (likeInFlightRef.current.has(trackId)) return;

    const prevUser = currentUser;
    const exists = currentUser.likedTrackIds.includes(trackId);
    const updated = exists
      ? currentUser.likedTrackIds.filter((id) => id !== trackId)
      : Array.from(new Set([...currentUser.likedTrackIds, trackId]));

    const updatedUser = { ...currentUser, likedTrackIds: updated };
    setCurrentUser(updatedUser);

    likeInFlightRef.current.add(trackId);
    const trackRef = doc(db, 'tracks', trackId);
    const userRef = doc(db, 'users', currentUser.id);
    Promise.all([
      updateDoc(userRef, { likedTrackIds: updated, updatedAt: new Date().toISOString() }),
      runTransaction(db, async (tx) => {
        const snap = await tx.get(trackRef);
        if (!snap.exists()) return;
        const data = snap.data() as { likedByUserIds?: string[]; likes?: number };
        const existingIds = Array.isArray(data.likedByUserIds) ? data.likedByUserIds.filter(Boolean) : [];
        const nextSet = new Set(existingIds);
        if (exists) nextSet.delete(prevUser.id);
        else nextSet.add(prevUser.id);
        const nextLikedBy = Array.from(nextSet);
        tx.update(trackRef, {
          likedByUserIds: nextLikedBy,
          likes: nextLikedBy.length,
        });
      }),
    ])
      .catch((err) => {
        console.warn('toggleLikeTrack failed, rolling back:', formatFirebaseError(err, 'Like failed'));
        setCurrentUser((cur) => (cur && cur.id === prevUser.id ? { ...cur, likedTrackIds: prevUser.likedTrackIds } : cur));
        void updateUserProfileFields(prevUser.id, { likedTrackIds: prevUser.likedTrackIds });
        showToast('Could not update like. Reverted.', 'error');
      })
      .finally(() => {
        likeInFlightRef.current.delete(trackId);
      });
  };

  const artistLikeInFlightRef = useRef<Set<string>>(new Set());
  const toggleLikeArtist = (artistId: string) => {
    if (!currentUser) {
      requireAuth(() => toggleLikeArtist(artistId), 'Sign in to like this artist');
      return;
    }
    if (artistLikeInFlightRef.current.has(artistId)) return;

    const prevUser = currentUser;
    const currentLiked = currentUser.likedArtistIds || [];
    const exists = currentLiked.includes(artistId);
    const updated = exists ? currentLiked.filter((id) => id !== artistId) : Array.from(new Set([...currentLiked, artistId]));

    const updatedUser = { ...currentUser, likedArtistIds: updated };
    setCurrentUser(updatedUser);

    artistLikeInFlightRef.current.add(artistId);
    const artistRef = doc(db, 'artists', artistId);
    const userRef = doc(db, 'users', currentUser.id);
    Promise.all([
      updateDoc(userRef, { likedArtistIds: updated, updatedAt: new Date().toISOString() }),
      runTransaction(db, async (tx) => {
        const snap = await tx.get(artistRef);
        if (!snap.exists()) return;
        const data = snap.data() as { likedByUserIds?: string[] };
        const existingIds = Array.isArray(data.likedByUserIds) ? data.likedByUserIds.filter(Boolean) : [];
        const nextSet = new Set(existingIds);
        if (exists) nextSet.delete(prevUser.id);
        else nextSet.add(prevUser.id);
        const nextLikedBy = Array.from(nextSet);
        tx.update(artistRef, {
          likedByUserIds: nextLikedBy,
          likesCount: nextLikedBy.length,
        });
      }),
    ])
      .catch((err) => {
        console.warn('toggleLikeArtist failed, rolling back:', formatFirebaseError(err, 'Artist like failed'));
        setCurrentUser((cur) => (cur && cur.id === prevUser.id ? { ...cur, likedArtistIds: prevUser.likedArtistIds || [] } : cur));
        void updateUserProfileFields(prevUser.id, { likedArtistIds: prevUser.likedArtistIds || [] });
        showToast('Could not update artist like. Reverted.', 'error');
      })
      .finally(() => {
        artistLikeInFlightRef.current.delete(artistId);
      });
  };

  const followInFlightRef = useRef<Set<string>>(new Set());
  const toggleFollowArtist = (artistId: string) => {
    if (!currentUser) {
      requireAuth(() => toggleFollowArtist(artistId), 'Sign in to follow this artist');
      return;
    }
    if (followInFlightRef.current.has(artistId)) return;

    const prevUser = currentUser;
    const exists = currentUser.followingArtistIds.includes(artistId);
    const updated = exists
      ? currentUser.followingArtistIds.filter((id) => id !== artistId)
      : [...currentUser.followingArtistIds, artistId];

    const updatedUser = { ...currentUser, followingArtistIds: updated };
    setCurrentUser(updatedUser);
    followInFlightRef.current.add(artistId);

    // Sync follower count atomically & notify artist owner on follow
    Promise.all([
      updateDoc(doc(db, 'users', currentUser.id), {
        followingArtistIds: updated,
        updatedAt: new Date().toISOString(),
      }),
      runTransaction(db, async (tx) => {
        const aRef = doc(db, 'artists', artistId);
        const snap = await tx.get(aRef);
        if (!snap.exists()) return;
        const data = snap.data() as {
          followersCount?: number;
          ownerId?: string;
          ownerUserId?: string;
          claimedByUserId?: string;
          name?: string;
        };
        const prevCount = typeof data.followersCount === 'number' ? data.followersCount : 0;
        tx.update(aRef, {
          followersCount: Math.max(0, prevCount + (exists ? -1 : 1)),
        });
        const targetOwnerId = data.ownerId || data.ownerUserId || data.claimedByUserId;
        if (!exists && targetOwnerId && targetOwnerId !== prevUser.id) {
          const notifId = `notif-follow-${artistId}-${prevUser.id}-${Date.now()}`;
          void setDoc(doc(db, 'notifications', notifId), {
            id: notifId,
            userId: targetOwnerId,
            type: 'new_follower',
            category: 'promotional',
            title: `New follower for ${data.name || 'your artist page'}`,
            message: `${prevUser.name || 'A listener'} started following you on LOWERVIBE.`,
            readBy: [],
            createdAt: new Date().toISOString(),
            createdBy: prevUser.id,
            actionRoute: `/artists/${artistId}`,
          }).catch(() => {});
        }
      }),
    ])
      .catch((err) => {
        console.warn('toggleFollowArtist failed, rolling back:', formatFirebaseError(err, 'Follow failed'));
        setCurrentUser((cur) =>
          cur && cur.id === prevUser.id ? { ...cur, followingArtistIds: prevUser.followingArtistIds } : cur
        );
        void updateUserProfileFields(prevUser.id, { followingArtistIds: prevUser.followingArtistIds });
        showToast('Could not update follow status. Reverted.', 'error');
      })
      .finally(() => {
        followInFlightRef.current.delete(artistId);
      });
  };

  const createPlaylist = (
    name: string,
    description: string = '',
    coverArt?: string,
    meta?: { country?: string; region?: string; genre?: string; isPublic?: boolean }
  ): Playlist => {
    if (!currentUser) throw new Error('Must be logged in');
    const nowIso = new Date().toISOString();
    const resolvedCountry = meta?.country || meta?.region || currentUser.country || 'Malawi';
    const newPl: Playlist = {
      id: 'pl-' + Date.now(),
      name: name.trim(),
      description: description.trim(),
      coverArt: coverArt || DEFAULT_ARTWORK_SVG,
      trackIds: [],
      createdBy: currentUser.id,
      creatorName: currentUser.name,
      isPublic: meta?.isPublic ?? true,
      followers: 1,
      country: resolvedCountry,
      region: resolvedCountry,
      genre: meta?.genre || 'Mixed',
      plays: 0,
      likes: 0,
      likedByUserIds: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const updatedPlaylists = [newPl, ...(currentUser.playlists || [])];
    const updatedUser = {
      ...currentUser,
      playlists: updatedPlaylists,
    };
    setCurrentUser(updatedUser);
    updateUserProfileFields(currentUser.id, { playlists: updatedPlaylists });
    if (newPl.isPublic) {
      void durableSetDoc('playlists', newPl.id, newPl as unknown as Record<string, unknown>, {
        merge: true,
        mirrorBackup: true,
      });
    }
    return newPl;
  };

  const addTrackToPlaylist = (playlistId: string, trackId: string) => {
    if (!currentUser) return;
    let targetTrackIds: string[] | null = null;
    const updatedPls = (currentUser.playlists || []).map((pl) => {
      if (pl.id === playlistId && !pl.trackIds.includes(trackId)) {
        targetTrackIds = [...pl.trackIds, trackId];
        return { ...pl, trackIds: targetTrackIds, updatedAt: new Date().toISOString() };
      }
      return pl;
    });

    const updatedUser = { ...currentUser, playlists: updatedPls };
    setCurrentUser(updatedUser);
    void updateUserProfileFields(currentUser.id, { playlists: updatedPls });

    if (targetTrackIds) {
      void durableUpdateDoc('playlists', playlistId, {
        trackIds: targetTrackIds,
        updatedAt: new Date().toISOString(),
      });
    }
    void flushPendingSyncOperations();
  };

  const updateCurrentUser = async (updates: Partial<User>): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      return { success: false, error: 'Permission denied: you can only edit your own profile.' };
    }
    const {
      id: _ignoreId,
      email: _ignoreEmail,
      isAdmin: _ignoreAdmin,
      role: _ignoreRole,
      isDeactivated: _ignoreDeactivated,
      ...safeUpdates
    } = updates;
    const previous = currentUser;
    const updated = { ...currentUser, ...safeUpdates };
    setCurrentUser(updated);
    const res = await updateUserProfileFields(currentUser.id, safeUpdates);
    if (!res.success) {
      setCurrentUser(previous);
      return { success: false, error: res.error };
    }
    return { success: true };
  };

  const signInAdminWithGoogle = async (): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
  }> => {
    try {
      await setPersistence(auth, indexedDBLocalPersistence).catch(() =>
        setPersistence(auth, browserLocalPersistence)
      );
      const cred = await signInWithPopup(auth, adminGoogleAuthProvider);
      const fbUser = cred.user;
      if (!fbUser || !isVerifiedAdminGoogleSession(fbUser)) {
        const attemptedEmail = fbUser?.email || 'another account';
        await signOut(auth).catch(() => {});
        writeCachedUser(null);
        setCurrentUser(null);
        return {
          success: false,
          error: `Access Denied: Signed in as ${attemptedEmail}, but Administration requires Google Sign-In with ${PRIMARY_ADMIN_EMAIL}.`,
        };
      }

      const cleanEmail = (fbUser.email || '').toLowerCase();
      const userRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userRef);
      const session = detectCurrentSessionRecord();

      let userToSet: User;
      if (snap.exists()) {
        const data = snap.data() as User;
        const otherSessions = (data.sessions || []).filter((s) => s.id !== session.id).slice(0, 6);
        userToSet = {
          ...data,
          id: fbUser.uid,
          email: cleanEmail,
          emailVerified: true,
          isAdmin: true,
          role: 'admin',
          sessions: [session, ...otherSessions],
          ...(!data.termsVersion
            ? { termsAcceptedAt: new Date().toISOString(), termsVersion: LEGAL_CONFIG.currentTermsVersion }
            : {}),
        };
        await updateUserProfileFields(fbUser.uid, {
          emailVerified: true,
          sessions: userToSet.sessions,
        });
      } else {
        const name = fbUser.displayName || 'Platform Administrator';
        userToSet = {
          id: fbUser.uid,
          name,
          username: 'odula_admin',
          email: cleanEmail,
          emailVerified: true,
          role: 'admin',
          isAdmin: true,
          avatar: fbUser.photoURL || DEFAULT_AVATAR_SVG,
          bio: 'Platform owner & administrator.',
          country: 'Malawi',
          likedTrackIds: [],
          likedArtistIds: [],
          followingArtistIds: [],
          playlists: [],
          applicationStatus: 'none',
          termsAcceptedAt: new Date().toISOString(),
          termsVersion: LEGAL_CONFIG.currentTermsVersion,
          sessions: [session],
        };
        await syncUserRecord(userToSet);
      }

      setCurrentUser(userToSet);
      exitGuestMode();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: mapFirebaseAuthError(err),
        errorCode: extractAuthErrorCode(err),
      };
    }
  };

  const adminLogin = async (
    _password: string
  ): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    return {
      success: false,
      error: `Administration sign-in requires Google Login Auth with ${PRIMARY_ADMIN_EMAIL}.`,
    };
  };

  const adminInitialize = async (
    _password: string
  ): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    return {
      success: false,
      error: `Administration uses Google Login Auth only (${PRIMARY_ADMIN_EMAIL}).`,
    };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseProviders,
        emailVerified,
        isGuestMode,
        isAuthenticated: Boolean(currentUser),
        isArtist: currentUser?.role === 'artist',
        isAdmin: isVerifiedAdminGoogleSession() && currentUser?.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL,
        authReady,
        userSettings,
        updateUserSettings,
        enterGuestMode,
        exitGuestMode,
        loginWithEmail,
        registerWithEmail,
        signInWithGoogle,
        signInAdminWithGoogle,
        sendPhoneVerificationCode,
        verifyPhoneCode,
        resetPassword,
        resendVerification,
        refreshEmailVerification,
        acceptLatestTerms,
        needTermsUpdateAck,
        updateHandleWithCooldown,
        changePassword,
        linkGoogle,
        unlinkProvider,
        signOutOtherSessions,
        deleteAccount,
        upgradeListenerToArtist,
        reauthPromptOpen,
        reauthPromptReason,
        requireReauth,
        submitReauth,
        cancelReauth,
        adminLogin,
        adminInitialize,
        logout,
        toggleLikeTrack,
        toggleLikeArtist,
        toggleFollowArtist,
        createPlaylist,
        addTrackToPlaylist,
        updateCurrentUser,
        requireAuth,
        authModalOpen,
        authPromptReason,
        openAuthGateModal,
        closeAuthGateModal,
        executePendingAction,
        applications,
        submitArtistApplication,
        approveArtistApplication,
        rejectArtistApplication,
        celebrationModal,
        dismissCelebrationModal,
        payoutRecords,
        processPayout,
        processAllDuePayouts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
