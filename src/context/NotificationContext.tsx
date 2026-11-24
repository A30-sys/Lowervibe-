import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
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
import { useAuth } from './AuthContext';
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

interface ActiveTransientBanner extends PlatformBanner {
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
  visibleBanners: ActiveTransientBanner[];
  dismissBanner: (bannerId: string) => void;
  pushTransientBanner: (input: TransientBannerInput) => string;
  clearTransientBanner: (bannerId: string) => void;
  savePlatformBanner: (banner: Omit<PlatformBanner, 'id' | 'createdAt'> & { id?: string }) => Promise<{ success: boolean; error?: string }>;
  togglePlatformBanner: (bannerId: string, active: boolean) => Promise<void>;
  deletePlatformBanner: (bannerId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIF_STORAGE_KEY = 'lowervibe_notifications_v1';
const LAST_SEEN_TS_PREFIX = 'lowervibe_last_notif_seen_at_';
const DISMISSED_BANNERS_KEY = 'lowervibe_dismissed_banners_v1';

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

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userSettings, isArtist, isAdmin } = useAuth();
  const { showToast } = useToast();

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

  const [platformBanners, setPlatformBanners] = useState<PlatformBanner[]>([]);
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
  const initialLoadRef = useRef<boolean>(true);
  const soundEnabledRef = useRef<boolean>(userSettings.notifications.soundEnabled !== false);
  const pushPrefsRef = useRef(userSettings.notifications);

  useEffect(() => {
    soundEnabledRef.current = userSettings.notifications.soundEnabled !== false;
    pushPrefsRef.current = userSettings.notifications;
  }, [userSettings.notifications]);

  useEffect(() => {
    return initNotificationAudioUnlock();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(allNotifications.slice(0, 100)));
    } catch {}
  }, [allNotifications]);

  // Real-time platform banners subscription (publicly readable)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'banners'),
      (snap) => {
        const now = Date.now();
        const loaded = snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as PlatformBanner))
          .filter((b) => !b.expiresAt || new Date(b.expiresAt).getTime() > now)
          .sort((a, b) => (b.priority || 0) - (a.priority || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPlatformBanners(loaded);
      },
      () => {}
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const fbUser = auth.currentUser;
    if (!currentUser || !fbUser || fbUser.uid !== currentUser.id) {
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
        if ((item.type === 'news' || item.type === 'platform_announcement' || item.type === 'new_feature') && prefs.productNewsInApp === false) {
          return;
        }
      }

      showToast(`${item.title}: ${item.message}`);

      if (soundEnabledRef.current) {
        void playNotificationSound(isArtistUpdate ? 'artist' : 'admin');
      }

      const pushAllowed = isEssential
        ? prefs.payoutUpdatesPush !== false
        : isArtistUpdate
        ? prefs.newReleasesPush !== false
        : prefs.productNewsPush !== false;

      if (pushAllowed) {
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
        const resolvedRoute =
          (item.actionRoute && item.actionRoute.trim()) ||
          fallbackRouteByType[item.type] ||
          '/';
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
      [...buckets.broadcast, ...buckets.personal, ...buckets.byEmail, ...buckets.adminAll].forEach((n) => {
        if (n?.id) map.set(n.id, n);
      });
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
            buckets.adminAll = snap.docs.map((d) => ({ ...d.data(), id: d.id } as NotificationItem));
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
            buckets.broadcast = snap.docs.map((d) => ({ ...d.data(), id: d.id } as NotificationItem));
            mergeAndPublish();
          },
          (err) => console.warn('Broadcast notifications listener note:', err)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('userId', '==', currentUser.id)),
          (snap) => {
            buckets.personal = snap.docs.map((d) => ({ ...d.data(), id: d.id } as NotificationItem));
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
              buckets.byEmail = snap.docs.map((d) => ({ ...d.data(), id: d.id } as NotificationItem));
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
  }, [currentUser?.id, currentUser?.email]);

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
      if ((item.type === 'news' || item.type === 'platform_announcement' || item.type === 'new_feature') && prefs.productNewsInApp === false) {
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

  const sendNotification = async (input: CreateNotificationInput): Promise<NotificationItem | null> => {
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
      category: input.category || (isEssentialNotificationType(input.type) ? 'essential' : 'promotional'),
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

  const visibleBanners = useMemo<ActiveTransientBanner[]>(() => {
    const allowPromo = userSettings.notifications.promotionalBanners !== false;
    const roleAudience = isArtist || isAdmin ? 'artists' : 'listeners';

    const activeRemote = platformBanners.filter((b) => {
      if (!b.active) return false;
      if (b.dismissible && dismissedBannerIds.includes(b.id)) return false;
      if (b.audience && b.audience !== 'all' && b.audience !== roleAudience) return false;
      const isEssential = b.category === 'essential' || isEssentialNotificationType(b.type);
      if (!isEssential && !allowPromo) return false;
      return true;
    });

    const filteredTransient = transientBanners.filter((b) => !b.dismissible || !dismissedBannerIds.includes(b.id));
    const combined: ActiveTransientBanner[] = [...filteredTransient, ...activeRemote];
    // Never bombard users: display at most 2 active banners in the banner slot (essential first)
    return combined
      .sort((a, b) => {
        const aEss = a.category === 'essential' || isEssentialNotificationType(a.type) ? 1 : 0;
        const bEss = b.category === 'essential' || isEssentialNotificationType(b.type) ? 1 : 0;
        if (aEss !== bEss) return bEss - aEss;
        return (b.priority || 0) - (a.priority || 0);
      })
      .slice(0, 2);
  }, [platformBanners, transientBanners, dismissedBannerIds, userSettings.notifications.promotionalBanners, isArtist, isAdmin]);

  const savePlatformBanner = async (
    banner: Omit<PlatformBanner, 'id' | 'createdAt'> & { id?: string }
  ): Promise<{ success: boolean; error?: string }> => {
    const id = banner.id || `banner-${Date.now()}`;
    const docData: PlatformBanner = {
      ...banner,
      id,
      category: banner.category || (isEssentialNotificationType(banner.type) ? 'essential' : 'promotional'),
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
        visibleBanners,
        dismissBanner,
        pushTransientBanner,
        clearTransientBanner,
        savePlatformBanner,
        togglePlatformBanner,
        deletePlatformBanner,
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
