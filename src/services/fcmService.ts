import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  MessagePayload,
  Messaging,
  onMessage,
} from 'firebase/messaging';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { app, db } from './firebase';
import { UserSettings } from '../types';

export type FcmRegistrationStatus =
  | 'idle'
  | 'registering'
  | 'registered'
  | 'missing_vapid'
  | 'denied'
  | 'unsupported'
  | 'error';

const FCM_TOKEN_ID_STORAGE_KEY = 'lowervibe_fcm_token_id_v1';
const FCM_TOKEN_VAL_STORAGE_KEY = 'lowervibe_fcm_token_val_v1';

let cachedMessaging: Messaging | null = null;

export function getConfiguredVapidKey(): string {
  try {
    return String(import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
  } catch {
    return '';
  }
}

export function hasConfiguredVapidKey(): boolean {
  return getConfiguredVapidKey().length >= 20;
}

function detectPushPlatform(): 'web' | 'pwa-main' | 'pwa-creator' {
  if (typeof window === 'undefined') return 'web';
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!isStandalone) return 'web';
  return window.location.search.includes('standalone=artist') ? 'pwa-creator' : 'pwa-main';
}

async function computeSafeTokenDocId(rawToken: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoded = new TextEncoder().encode(rawToken);
      const digest = await crypto.subtle.digest('SHA-256', encoded);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 36);
      return `fcm_${hex}`;
    }
  } catch {}
  let hash = 2166136261;
  for (let i = 0; i < rawToken.length; i++) {
    hash ^= rawToken.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(36);
  const tail = rawToken.replace(/[^a-zA-Z0-9_-]/g, '').slice(-16);
  return `fcm_${suffix}_${tail}`.slice(0, 64);
}

async function resolveMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  if (!cachedMessaging) {
    cachedMessaging = getMessaging(app);
  }
  return cachedMessaging;
}

async function getActiveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    let reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<ServiceWorkerRegistration | null>((resolve) =>
        setTimeout(() => resolve(reg || null), 2500)
      ),
    ]);
    return readyReg || reg || null;
  } catch {
    return null;
  }
}

export interface RegisterFcmInput {
  userId: string;
  followingArtistIds: string[];
  notifications: UserSettings['notifications'];
  requestPermission?: boolean;
}

export interface RegisterFcmResult {
  ok: boolean;
  status: FcmRegistrationStatus;
  tokenId?: string;
  error?: string;
}

export async function registerFcmPushToken(input: RegisterFcmInput): Promise<RegisterFcmResult> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { ok: false, status: 'unsupported', error: 'Notifications are not supported in this browser.' };
  }

  const messaging = await resolveMessagingInstance();
  if (!messaging) {
    return { ok: false, status: 'unsupported', error: 'Firebase Cloud Messaging is not supported on this browser.' };
  }

  if (Notification.permission === 'denied') {
    return { ok: false, status: 'denied', error: 'Notifications are blocked in browser settings.' };
  }

  if (Notification.permission === 'default') {
    if (!input.requestPermission) {
      return { ok: false, status: 'idle' };
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        return {
          ok: false,
          status: perm === 'denied' ? 'denied' : 'idle',
          error: perm === 'denied' ? 'Notifications were blocked by the browser.' : undefined,
        };
      }
    } catch {
      return { ok: false, status: 'error', error: 'Could not request notification permission.' };
    }
  }

  const vapidKey = getConfiguredVapidKey();
  if (!vapidKey) {
    return {
      ok: false,
      status: 'missing_vapid',
      error: 'Web Push VAPID key is not configured yet.',
    };
  }

  const swReg = await getActiveServiceWorkerRegistration();
  if (!swReg) {
    return { ok: false, status: 'error', error: 'Service worker is not ready for push notifications.' };
  }

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });
    if (!token) {
      return { ok: false, status: 'error', error: 'Could not obtain Firebase Cloud Messaging token.' };
    }

    const tokenId = await computeSafeTokenDocId(token);
    const nowIso = new Date().toISOString();
    const cleanFollowing = Array.from(
      new Set((input.followingArtistIds || []).filter((id) => typeof id === 'string' && id.trim()))
    ).slice(0, 500);

    await setDoc(
      doc(db, 'fcmTokens', tokenId),
      {
        id: tokenId,
        userId: input.userId,
        token,
        platform: detectPushPlatform(),
        enabled: true,
        followingArtistIds: cleanFollowing,
        newReleasesPush: input.notifications.newReleasesPush !== false,
        payoutUpdatesPush: input.notifications.payoutUpdatesPush !== false,
        productNewsPush: Boolean(input.notifications.productNewsPush),
        likesFollowsPush: Boolean(input.notifications.likesFollowsPush),
        playlistUpdatesPush: Boolean(input.notifications.playlistUpdatesPush),
        userAgent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 190) : '',
        updatedAt: nowIso,
      },
      { merge: true }
    );

    try {
      localStorage.setItem(FCM_TOKEN_ID_STORAGE_KEY, tokenId);
      localStorage.setItem(FCM_TOKEN_VAL_STORAGE_KEY, token);
    } catch {}

    return { ok: true, status: 'registered', tokenId };
  } catch (err: unknown) {
    return {
      ok: false,
      status: 'error',
      error: err instanceof Error ? err.message : 'Push token registration failed.',
    };
  }
}

export async function syncRegisteredFcmTokenMetadata(input: {
  userId: string;
  followingArtistIds: string[];
  notifications: UserSettings['notifications'];
}): Promise<void> {
  try {
    const tokenId = localStorage.getItem(FCM_TOKEN_ID_STORAGE_KEY);
    const token = localStorage.getItem(FCM_TOKEN_VAL_STORAGE_KEY);
    if (!tokenId || !token) return;
    const cleanFollowing = Array.from(
      new Set((input.followingArtistIds || []).filter((id) => typeof id === 'string' && id.trim()))
    ).slice(0, 500);

    await setDoc(
      doc(db, 'fcmTokens', tokenId),
      {
        id: tokenId,
        userId: input.userId,
        token,
        platform: detectPushPlatform(),
        enabled: true,
        followingArtistIds: cleanFollowing,
        newReleasesPush: input.notifications.newReleasesPush !== false,
        payoutUpdatesPush: input.notifications.payoutUpdatesPush !== false,
        productNewsPush: Boolean(input.notifications.productNewsPush),
        likesFollowsPush: Boolean(input.notifications.likesFollowsPush),
        playlistUpdatesPush: Boolean(input.notifications.playlistUpdatesPush),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {}
}

export async function unregisterFcmPushToken(userId?: string): Promise<void> {
  try {
    const tokenId = localStorage.getItem(FCM_TOKEN_ID_STORAGE_KEY);
    if (tokenId && userId) {
      await deleteDoc(doc(db, 'fcmTokens', tokenId)).catch(() => {});
    }
    const messaging = await resolveMessagingInstance();
    if (messaging) {
      await deleteToken(messaging).catch(() => {});
    }
    localStorage.removeItem(FCM_TOKEN_ID_STORAGE_KEY);
    localStorage.removeItem(FCM_TOKEN_VAL_STORAGE_KEY);
  } catch {}
}

export async function subscribeForegroundFcmMessages(
  callback: (payload: MessagePayload) => void
): Promise<() => void> {
  const messaging = await resolveMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
