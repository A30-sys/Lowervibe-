import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { isVerifiedAdminGoogleSession } from '../services/authService';
import { auth, db } from '../services/firebase';
import {
  NotificationCategory,
  NotificationItem,
  NotificationType,
  PayoutRequest,
  PlatformBanner,
} from '../types';
import {
  initNotificationAudioUnlock,
  playNotificationSound,
  showDeviceNotification,
} from '../utils/notificationSound';
import {
  FcmRegistrationStatus,
  hasConfiguredVapidKey,
  registerFcmPushToken,
  subscribeForegroundFcmMessages,
  syncRegisteredFcmTokenMetadata,
  unregisterFcmPushToken,
} from '../services/fcmService';
import { useAuth } from './AuthContext';
import { useRouter } from './RouterContext';
import { useToast } from './ToastContext';

interface CreateNotificationInput {
  userId: string; // 'all' for broadcast or specific user ID
  userEmail?: string;
  type: NotificationType;
  category?: NotificationCategory;
  title: string;
  message: string;
  artworkUrl?: string;
  actionLabel?: string;
  actionRoute?: string;
  createdBy?: string;
  payoutRequestId?: string;
  payoutStatus?: PayoutRequest['status'];
}

export interface TransientBannerInput {
  id?: string;
  type: NotificationType;
  category?: NotificationCategory;
  title: string;
  message: string;
  artworkUrl?: string;
  actionLabel?: string;
  actionRoute?: string;
  dismissible?: boolean;
  tone?: 'light' | 'dark';
  onAction?: () => void;
}

export interface ActiveTransientBanner extends PlatformBanner {
  onAction?: () => void;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isNotificationRead: (item: NotificationItem) => boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  sendNotification: (input: CreateNotificationInput) => Promise<NotificationItem | null>;
  banners: PlatformBanner[];
  activePlatformBanners: ActiveTransientBanner[];
  visibleBanners: ActiveTransientBanner[];
  dismissBanner: (bannerId: string) => void;
  pushTransientBanner: (input: TransientBannerInput) => string;
  clearTransientBanner: (bannerId: string) => void;
  refreshBanners: () => Promise<void>;
  savePlatformBanner: (
    banner: Omit<PlatformBanner, 'id' | 'createdAt'> & { id?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  togglePlatformBanner: (bannerId: string, active: boolean) => Promise<void>;
  deletePlatformBanner: (bannerId: string) => Promise<void>;
  fcmStatus: FcmRegistrationStatus;
  fcmError: string | null;
  hasVapidKey: boolean;
  enablePushNotifications: () => Promise<{ ok: boolean; status: FcmRegistrationStatus; error?: string }>;
  disablePushNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIF_STORAGE_KEY = 'lowervibe_notifications_v1';
const BANNERS_STORAGE_KEY = 'lowervibe_platform_banners_v1';
const LAST_SEEN_TS_PREFIX = 'lowervibe_last_notif_seen_at_';
const DISMISSED_BANNERS_KEY = 'lowervibe_dismissed_banners_v1';

function isStandaloneWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.location.search.includes('pwa=main') ||
    window.location.search.includes('standalone=artist')
  );
}

export function isEssentialNotificationType(type: NotificationType): boolean {
  return (
    type === 'account_security' ||
    type === 'maintenance' ||
    type === 'artist_approved' ||
    type === 'artist_pending' ||
    type === 'artist_rejected' ||
    type === 'upload_completed' ||
    type === 'upload_failed' ||
    type === 'withdrawal_status' ||
    type === 'system'
  );
}

function getDefaultRouteForNotification(type: NotificationType): string {
  const fallbackRouteByType: Record<NotificationType, string> = {
    new_release: '/discover',
    artist_approved: '/artistcreator',
    artist_pending: '/artistcreator',
    artist_rejected: '/artistcreator',
    upload_completed: '/artistcreator',
    upload_failed: '/artistcreator',
    withdrawal_status: '/artistcreator',
    new_follower: '/artists',
    playlist_update: '/library',
    account_security: '/account',
    maintenance: '/',
    new_feature: '/discover',
    platform_announcement: '/',
    news: '/discover',
    system: '/',
  };
  return fallbackRouteByType[type] || '/';
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userSettings, isArtist, isAdmin, authReady } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [firebaseAuthUid, setFirebaseAuthUid] = useState<string | null>(
    () => auth.currentUser?.uid || null
  );
  const hasVapidKey = hasConfiguredVapidKey();
  const [fcmStatus, setFcmStatus] = useState<FcmRegistrationStatus>(() => {
    if (!hasVapidKey) return 'missing_vapid';
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return 'denied';
    return 'idle';
  });
  const [fcmError, setFcmError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseAuthUid(fbUser?.uid || null);
    });
    return () => unsub();
  }, []);

  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [platformBanners, setPlatformBanners] = useState<PlatformBanner[]>(() => {
    try {
      const saved = localStorage.getItem(BANNERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const now = Date.now();
          return parsed.filter(
            (b: PlatformBanner) => !b.expiresAt || new Date(b.expiresAt).getTime() > now
          );
        }
      }
    } catch {}
    return [];
  });

  const [transientBanners, setTransientBanners] = useState<ActiveTransientBanner[]>([]);
  const [dismissedBannerIds, setDismissedBannerIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_BANNERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const knownIdsRef = useRef<Set<string>>(new Set());
  const knownBannerIdsRef = useRef<Set<string>>(new Set());
  const bannersInitialSyncedRef = useRef<boolean>(false);
  const initialLoadRef = useRef<boolean>(true);
  const soundEnabledRef = useRef<boolean>(userSettings.notifications.soundEnabled !== false);
  const pushPrefsRef = useRef(userSettings.notifications);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    soundEnabledRef.current = userSettings.notifications.soundEnabled !== false;
    pushPrefsRef.current = userSettings.notifications;
  }, [userSettings.notifications]);

  useEffect(() => {
    return initNotificationAudioUnlock();
  }, []);

  const enablePushNotifications = useCallback(async () => {
    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      return {
        ok: false,
        status: 'idle' as FcmRegistrationStatus,
        error: 'Sign in to connect lock-screen push notifications.',
      };
    }
    setFcmStatus('registering');
    setFcmError(null);
    const res = await registerFcmPushToken({
      userId: currentUser.id,
      followingArtistIds: currentUser.followingArtistIds || [],
      notifications: userSettings.notifications,
      requestPermission: true,
    });
    setFcmStatus(res.status);
    setFcmError(res.error || null);
    return { ok: res.ok, status: res.status, error: res.error };
  }, [currentUser, userSettings.notifications]);

  const disablePushNotifications = useCallback(async () => {
    await unregisterFcmPushToken(currentUser?.id);
    setFcmStatus(hasVapidKey ? 'idle' : 'missing_vapid');
    setFcmError(null);
  }, [currentUser?.id, hasVapidKey]);

  // Silently register FCM push token when user has already granted OS permission
  useEffect(() => {
    const fbUser = auth.currentUser;
    if (!authReady || !currentUser || !fbUser || fbUser.uid !== currentUser.id) {
      return;
    }
    if (typeof Notification === 'undefined') {
      setFcmStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setFcmStatus('denied');
      return;
    }
    if (!hasVapidKey) {
      setFcmStatus('missing_vapid');
      return;
    }
    const anyPushEnabled =
      userSettings.notifications.newReleasesPush !== false ||
      userSettings.notifications.payoutUpdatesPush !== false ||
      Boolean(userSettings.notifications.productNewsPush) ||
      Boolean(userSettings.notifications.likesFollowsPush) ||
      Boolean(userSettings.notifications.playlistUpdatesPush);

    if (Notification.permission === 'granted' && anyPushEnabled) {
      let cancelled = false;
      void registerFcmPushToken({
        userId: currentUser.id,
        followingArtistIds: currentUser.followingArtistIds || [],
        notifications: userSettings.notifications,
        requestPermission: false,
      }).then((res) => {
        if (!cancelled) {
          setFcmStatus(res.status);
          setFcmError(res.error || null);
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [authReady, firebaseAuthUid, currentUser?.id, hasVapidKey]);

  // Keep followed artists and push notification preferences synchronized on the active FCM token
  useEffect(() => {
    if (fcmStatus !== 'registered' || !currentUser?.id) return;
    void syncRegisteredFcmTokenMetadata({
      userId: currentUser.id,
      followingArtistIds: currentUser.followingArtistIds || [],
      notifications: userSettings.notifications,
    });
  }, [fcmStatus, currentUser?.id, currentUser?.followingArtistIds, userSettings.notifications]);

  // Listen for foreground FCM Web Push messages when app is open
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    void subscribeForegroundFcmMessages((payload) => {
      const title =
        payload.notification?.title || String(payload.data?.title || 'LOWERVIBE');
      const body =
        payload.notification?.body || String(payload.data?.body || 'New update on LOWERVIBE');
      const artworkUrl =
        payload.notification?.image ||
        (typeof payload.data?.artworkUrl === 'string' ? payload.data.artworkUrl : undefined);
      const clickUrl = typeof payload.data?.url === 'string' ? payload.data.url : undefined;

      showToast(body, 'info', {
        title,
        artworkUrl,
        duration: 5400,
        action: clickUrl
          ? {
              label: 'Open',
              onClick: () => navigateRef.current(clickUrl),
            }
          : undefined,
      });
      if (soundEnabledRef.current) {
        void playNotificationSound(payload.data?.type === 'new_release' ? 'artist' : 'admin');
      }
    }).then((unsub) => {
      if (cancelled) {
        unsub();
      } else {
        cleanup = unsub;
      }
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [showToast]);

  useEffect(() => {
    try {
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(allNotifications.slice(0, 100)));
    } catch {}
  }, [allNotifications]);

  useEffect(() => {
    try {
      localStorage.setItem(BANNERS_STORAGE_KEY, JSON.stringify(platformBanners.slice(0, 30)));
    } catch {}
  }, [platformBanners]);

  const dismissBanner = useCallback((bannerId: string) => {
    setTransientBanners((prev) => prev.filter((b) => b.id !== bannerId));
    setDismissedBannerIds((prev) => {
      if (prev.includes(bannerId)) return prev;
      const next = [bannerId, ...prev].slice(0, 60);
      try {
        localStorage.setItem(DISMISSED_BANNERS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const clearTransientBanner = useCallback((bannerId: string) => {
    setTransientBanners((prev) => prev.filter((b) => b.id !== bannerId));
  }, []);

  const pushTransientBanner = useCallback((input: TransientBannerInput): string => {
    const id = input.id || `transient-${Date.now()}`;
    const banner: ActiveTransientBanner = {
      id,
      type: input.type,
      category:
        input.category || (isEssentialNotificationType(input.type) ? 'essential' : 'promotional'),
      title: input.title,
      message: input.message,
      artworkUrl: input.artworkUrl,
      actionLabel: input.actionLabel,
      actionRoute: input.actionRoute,
      dismissible: input.dismissible ?? true,
      active: true,
      priority: 100,
      audience: 'all',
      tone: input.tone,
      createdAt: new Date().toISOString(),
      onAction: input.onAction,
    };
    setDismissedBannerIds((prev) => prev.filter((d) => d !== id));
    setTransientBanners((prev) => [banner, ...prev.filter((b) => b.id !== id)].slice(0, 3));
    return id;
  }, []);

  const applyLoadedBanners = useCallback(
    (loaded: PlatformBanner[]) => {
      setPlatformBanners(loaded);

      if (!bannersInitialSyncedRef.current) {
        bannersInitialSyncedRef.current = true;
        knownBannerIdsRef.current = new Set(loaded.map((b) => b.id));
        return;
      }

      const newlyPublished = loaded.filter(
        (b) => b.active && !knownBannerIdsRef.current.has(b.id)
      );
      knownBannerIdsRef.current = new Set(loaded.map((b) => b.id));

      const firstNew = newlyPublished[0];
      if (firstNew) {
        const isEssential =
          firstNew.category === 'essential' || isEssentialNotificationType(firstNew.type);
        showToast(firstNew.message, isEssential ? 'info' : 'success', {
          title: firstNew.title,
          artworkUrl: firstNew.artworkUrl,
          duration: 5200,
          action: firstNew.actionRoute
            ? {
                label: firstNew.actionLabel || 'Open',
                onClick: () => navigateRef.current(firstNew.actionRoute!),
              }
            : undefined,
        });
        if (soundEnabledRef.current) {
          void playNotificationSound(firstNew.type === 'new_release' ? 'artist' : 'admin');
        }
      }
    },
    [showToast]
  );

  const refreshBanners = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'banners'));
      const now = Date.now();
      const loaded = snap.docs
        .map((d) => ({ ...d.data(), id: d.id } as PlatformBanner))
        .filter((b) => !b.expiresAt || new Date(b.expiresAt).getTime() > now)
        .sort(
          (a, b) =>
            (b.priority || 0) - (a.priority || 0) ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      applyLoadedBanners(loaded);
    } catch {}
  }, [applyLoadedBanners]);

  // Real-time platform banners subscription + standalone PWA foreground resume sync
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'banners'),
      (snap) => {
        const now = Date.now();
        const loaded = snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as PlatformBanner))
          .filter((b) => !b.expiresAt || new Date(b.expiresAt).getTime() > now)
          .sort(
            (a, b) =>
              (b.priority || 0) - (a.priority || 0) ||
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        applyLoadedBanners(loaded);
      },
      () => {}
    );

    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        void refreshBanners();
      }
    };
    const handleOnline = () => {
      void refreshBanners();
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleOnline);
    window.addEventListener('online', handleOnline);

    return () => {
      unsub();
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleOnline);
      window.removeEventListener('online', handleOnline);
    };
  }, [applyLoadedBanners, refreshBanners]);

  useEffect(() => {
    const fbUser = auth.currentUser;
    if (!authReady || !currentUser || !fbUser || fbUser.uid !== currentUser.id) {
      initialLoadRef.current = true;
      knownIdsRef.current = new Set();
      return;
    }

    const lastSeenKey = `${LAST_SEEN_TS_PREFIX}${currentUser.id}`;
    let lastSeenMs = 0;
    try {
      const rawTs = localStorage.getItem(lastSeenKey);
      if (rawTs) lastSeenMs = Number(rawTs) || 0;
      else localStorage.setItem(lastSeenKey, String(Date.now()));
    } catch {}

    const triggerAlertForItem = (item: NotificationItem) => {
      const isArtistUpdate = item.type === 'new_release';
      const prefs = pushPrefsRef.current;
      const isEssential = item.category === 'essential' || isEssentialNotificationType(item.type);

      if (!isEssential) {
        if (item.type === 'new_release' && prefs.newReleasesInApp === false) return;
        if (item.type === 'new_follower' && prefs.likesFollowsInApp === false) return;
        if (item.type === 'playlist_update' && prefs.playlistUpdatesInApp === false) return;
        if (
          (item.type === 'news' ||
            item.type === 'platform_announcement' ||
            item.type === 'new_feature') &&
          prefs.productNewsInApp === false
        ) {
          return;
        }
      }

      const resolvedRoute =
        (item.actionRoute && item.actionRoute.trim()) ||
        getDefaultRouteForNotification(item.type);

      showToast(item.message, isEssential ? 'info' : 'success', {
        title: item.title,
        artworkUrl: item.artworkUrl,
        duration: 5200,
        action: {
          label: item.actionLabel || 'Open',
          onClick: () => navigateRef.current(resolvedRoute),
        },
      });

      // Ensure alerts also appear cleanly as an interactive banner in both Browser and installed WebApp
      if (
        isEssential ||
        item.type === 'platform_announcement' ||
        item.type === 'new_release' ||
        isStandaloneWebApp()
      ) {
        pushTransientBanner({
          id: `notif-banner-${item.id}`,
          type: item.type,
          category: isEssential ? 'essential' : 'promotional',
          title: item.title,
          message: item.message,
          artworkUrl: item.artworkUrl,
          actionLabel: item.actionLabel || 'Open',
          actionRoute: resolvedRoute,
          dismissible: true,
        });
      }

      if (soundEnabledRef.current) {
        void playNotificationSound(isArtistUpdate ? 'artist' : 'admin');
      }

      const pushAllowed = isEssential
        ? prefs.payoutUpdatesPush !== false
        : isArtistUpdate
        ? prefs.newReleasesPush !== false
        : prefs.productNewsPush !== false;

      if (pushAllowed) {
        void showDeviceNotification({
          title: item.title,
          body: item.message,
          url: resolvedRoute,
          image: item.artworkUrl,
          tag: `lv-${item.id}`,
        });
      }
    };

    const userEmail = currentUser.email?.toLowerCase();
    const isItemForCurrentUser = (item: NotificationItem): boolean =>
      item.userId === 'all' ||
      item.userId === currentUser.id ||
      Boolean(item.userEmail && userEmail && item.userEmail.toLowerCase() === userEmail);

    const checkAndAlertLatest = (items: NotificationItem[], isFirstLoad: boolean) => {
      const latestItem = items.find((item) => {
        if (!isItemForCurrentUser(item)) return false;
        const isUnread = !(item.readBy || []).includes(currentUser.id);
        if (!isUnread) return false;
        if (!isFirstLoad) return !knownIdsRef.current.has(item.id);
        if (lastSeenMs > 0) {
          const createdMs = new Date(item.createdAt).getTime();
          return createdMs > lastSeenMs && !knownIdsRef.current.has(item.id);
        }
        return false;
      });

      if (latestItem) {
        triggerAlertForItem(latestItem);
        try {
          const latestMs = Math.max(Date.now(), new Date(latestItem.createdAt).getTime());
          localStorage.setItem(lastSeenKey, String(latestMs));
          lastSeenMs = latestMs;
        } catch {}
      }
    };

    const buckets = {
      broadcast: [] as NotificationItem[],
      personal: [] as NotificationItem[],
      byEmail: [] as NotificationItem[],
      adminAll: [] as NotificationItem[],
    };

    const mergeAndPublish = () => {
      const map = new Map<string, NotificationItem>();
      [...buckets.broadcast, ...buckets.personal, ...buckets.byEmail, ...buckets.adminAll].forEach(
        (n) => {
          if (n?.id) map.set(n.id, n);
        }
      );
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAllNotifications(merged);
      checkAndAlertLatest(merged, initialLoadRef.current);
      knownIdsRef.current = new Set(merged.map((i) => i.id));
      initialLoadRef.current = false;
    };

    const unsubs: Array<() => void> = [];

    if (isVerifiedAdminGoogleSession(fbUser)) {
      unsubs.push(
        onSnapshot(
          collection(db, 'notifications'),
          (snap) => {
            buckets.adminAll = snap.docs.map(
              (d) => ({ ...d.data(), id: d.id } as NotificationItem)
            );
            mergeAndPublish();
          },
          (err) => console.warn('Admin notifications listener note:', err)
        )
      );
    } else {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('userId', '==', 'all')),
          (snap) => {
            buckets.broadcast = snap.docs.map(
              (d) => ({ ...d.data(), id: d.id } as NotificationItem)
            );
            mergeAndPublish();
          },
          (err) => console.warn('Broadcast notifications listener note:', err)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('userId', '==', currentUser.id)),
          (snap) => {
            buckets.personal = snap.docs.map(
              (d) => ({ ...d.data(), id: d.id } as NotificationItem)
            );
            mergeAndPublish();
          },
          (err) => console.warn('Personal notifications listener note:', err)
        )
      );

      if (userEmail) {
        unsubs.push(
          onSnapshot(
            query(collection(db, 'notifications'), where('userEmail', '==', userEmail)),
            (snap) => {
              buckets.byEmail = snap.docs.map(
                (d) => ({ ...d.data(), id: d.id } as NotificationItem)
              );
              mergeAndPublish();
            },
            () => {}
          )
        );
      }
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, firebaseAuthUid, currentUser?.id, currentUser?.email, showToast, pushTransientBanner]);

  const notifications = useMemo(() => {
    if (!currentUser) return [];
    const userEmail = currentUser.email?.toLowerCase();
    const prefs = userSettings.notifications;

    return allNotifications.filter((item) => {
      const targeted =
        item.userId === 'all' ||
        item.userId === currentUser.id ||
        Boolean(item.userEmail && userEmail && item.userEmail.toLowerCase() === userEmail);
      if (!targeted) return false;

      const isEssential = item.category === 'essential' || isEssentialNotificationType(item.type);
      if (isEssential) return true;

      if (item.type === 'new_release' && prefs.newReleasesInApp === false) return false;
      if (item.type === 'new_follower' && prefs.likesFollowsInApp === false) return false;
      if (item.type === 'playlist_update' && prefs.playlistUpdatesInApp === false) return false;
      if (
        (item.type === 'news' ||
          item.type === 'platform_announcement' ||
          item.type === 'new_feature') &&
        prefs.productNewsInApp === false
      ) {
        return false;
      }
      return true;
    });
  }, [allNotifications, currentUser, userSettings.notifications]);

  const isNotificationRead = (item: NotificationItem): boolean => {
    if (!currentUser) return true;
    return Array.isArray(item.readBy) && item.readBy.includes(currentUser.id);
  };

  const unreadCount = useMemo(() => {
    if (!currentUser) return 0;
    return notifications.filter((item) => !isNotificationRead(item)).length;
  }, [notifications, currentUser]);

  const markAsRead = async (notificationId: string) => {
    if (!currentUser) return;
    setAllNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId
          ? {
              ...item,
              readBy: item.readBy?.includes(currentUser.id)
                ? item.readBy
                : [...(item.readBy || []), currentUser.id],
            }
          : item
      )
    );
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        readBy: arrayUnion(currentUser.id),
      });
    } catch (err) {
      console.warn('Mark notification read note:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!currentUser) return;
    const unreadItems = notifications.filter((n) => !isNotificationRead(n));
    if (unreadItems.length === 0) return;

    const unreadSet = new Set(unreadItems.map((n) => n.id));
    setAllNotifications((prev) =>
      prev.map((item) =>
        unreadSet.has(item.id)
          ? {
              ...item,
              readBy: item.readBy?.includes(currentUser.id)
                ? item.readBy
                : [...(item.readBy || []), currentUser.id],
            }
          : item
      )
    );

    try {
      const batch = writeBatch(db);
      unreadItems.forEach((item) => {
        batch.update(doc(db, 'notifications', item.id), {
          readBy: arrayUnion(currentUser.id),
        });
      });
      await batch.commit();
    } catch (err) {
      console.warn('Mark all notifications read note:', err);
    }
  };

  const sendNotification = async (
    input: CreateNotificationInput
  ): Promise<NotificationItem | null> => {
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const category: NotificationCategory =
      input.category || (isEssentialNotificationType(input.type) ? 'essential' : 'promotional');

    const newItem: NotificationItem = {
      id: notifId,
      userId: input.userId,
      ...(input.userEmail ? { userEmail: input.userEmail.toLowerCase() } : {}),
      type: input.type,
      category,
      title: input.title.trim(),
      message: input.message.trim(),
      ...(input.artworkUrl ? { artworkUrl: input.artworkUrl } : {}),
      ...(input.actionLabel ? { actionLabel: input.actionLabel } : {}),
      readBy: [],
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy || currentUser?.email || 'system',
      ...(input.actionRoute ? { actionRoute: input.actionRoute } : {}),
      ...(input.payoutRequestId ? { payoutRequestId: input.payoutRequestId } : {}),
      ...(input.payoutStatus ? { payoutStatus: input.payoutStatus } : {}),
    };

    knownIdsRef.current.add(notifId);
    setAllNotifications((prev) => [newItem, ...prev]);

    try {
      await setDoc(doc(db, 'notifications', notifId), newItem);
      return newItem;
    } catch (err) {
      console.warn('Send notification write note:', err);
      return newItem;
    }
  };

  const activePlatformBanners = useMemo<ActiveTransientBanner[]>(() => {
    const allowPromo = userSettings.notifications.promotionalBanners !== false;
    const isCreatorAppMode =
      typeof window !== 'undefined' && window.location.search.includes('standalone=artist');
    const roleAudience = isArtist || isAdmin || isCreatorAppMode ? 'artists' : 'listeners';

    const activeRemote = platformBanners.filter((b) => {
      if (!b.active) return false;
      if (!isAdmin && b.audience && b.audience !== 'all' && b.audience !== roleAudience) {
        return false;
      }
      const isEssential = b.category === 'essential' || isEssentialNotificationType(b.type);
      if (!isEssential && !allowPromo) return false;
      return true;
    });

    const combined: ActiveTransientBanner[] = [...transientBanners, ...activeRemote];
    return combined.sort((a, b) => {
      const aEss = a.category === 'essential' || isEssentialNotificationType(a.type) ? 1 : 0;
      const bEss = b.category === 'essential' || isEssentialNotificationType(b.type) ? 1 : 0;
      if (aEss !== bEss) return bEss - aEss;
      return (b.priority || 0) - (a.priority || 0);
    });
  }, [
    platformBanners,
    transientBanners,
    userSettings.notifications.promotionalBanners,
    isArtist,
    isAdmin,
  ]);

  const visibleBanners = useMemo<ActiveTransientBanner[]>(() => {
    return activePlatformBanners
      .filter((b) => !b.dismissible || !dismissedBannerIds.includes(b.id))
      .slice(0, 2);
  }, [activePlatformBanners, dismissedBannerIds]);

  const savePlatformBanner = async (
    banner: Omit<PlatformBanner, 'id' | 'createdAt'> & { id?: string }
  ): Promise<{ success: boolean; error?: string }> => {
    const id = banner.id || `banner-${Date.now()}`;
    const docData: PlatformBanner = {
      ...banner,
      id,
      category:
        banner.category || (isEssentialNotificationType(banner.type) ? 'essential' : 'promotional'),
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.email || 'admin',
    };
    try {
      await setDoc(doc(db, 'banners', id), docData, { merge: true });
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Could not save banner.',
      };
    }
  };

  const togglePlatformBanner = async (bannerId: string, active: boolean) => {
    try {
      await updateDoc(doc(db, 'banners', bannerId), { active });
    } catch {}
  };

  const deletePlatformBanner = async (bannerId: string) => {
    try {
      await deleteDoc(doc(db, 'banners', bannerId));
    } catch {}
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isNotificationRead,
        markAsRead,
        markAllAsRead,
        sendNotification,
        banners: platformBanners,
        activePlatformBanners,
        visibleBanners,
        dismissBanner,
        pushTransientBanner,
        clearTransientBanner,
        refreshBanners,
        savePlatformBanner,
        togglePlatformBanner,
        deletePlatformBanner,
        fcmStatus,
        fcmError,
        hasVapidKey,
        enablePushNotifications,
        disablePushNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
