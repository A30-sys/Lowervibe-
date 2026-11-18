import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { NotificationItem, NotificationType, PayoutRequest } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface CreateNotificationInput {
  userId: string; // 'all' for broadcast or specific user ID
  userEmail?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionRoute?: string;
  createdBy?: string;
  payoutRequestId?: string;
  payoutStatus?: PayoutRequest['status'];
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isNotificationRead: (item: NotificationItem) => boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  sendNotification: (input: CreateNotificationInput) => Promise<NotificationItem | null>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIF_STORAGE_KEY = 'lowervibe_notifications_v1';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
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

  const knownIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef<boolean>(true);

  useEffect(() => {
    try {
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(allNotifications.slice(0, 100)));
    } catch {}
  }, [allNotifications]);

  useEffect(() => {
    const fbUser = auth.currentUser;
    if (!currentUser || !fbUser || fbUser.uid !== currentUser.id) {
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'notifications'),
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => ({ ...d.data(), id: d.id } as NotificationItem))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setAllNotifications(items);

        // Toast incoming real-time notifications for the active user after initial hydration
        if (!initialLoadRef.current) {
          const userEmail = currentUser.email?.toLowerCase();
          for (const item of items) {
            if (!knownIdsRef.current.has(item.id)) {
              const isForUser =
                item.userId === 'all' ||
                item.userId === currentUser.id ||
                (item.userEmail && userEmail && item.userEmail.toLowerCase() === userEmail);
              const isUnread = !(item.readBy || []).includes(currentUser.id);
              if (isForUser && isUnread) {
                showToast(`${item.title}: ${item.message}`);
                break;
              }
            }
          }
        }

        knownIdsRef.current = new Set(items.map((i) => i.id));
        initialLoadRef.current = false;
      },
      (err) => {
        console.warn('Firestore notifications listener note:', err);
      }
    );

    return () => unsub();
  }, [currentUser?.id, currentUser?.email]);

  const notifications = useMemo(() => {
    if (!currentUser) return [];
    const userEmail = currentUser.email?.toLowerCase();
    return allNotifications.filter((item) => {
      if (item.userId === 'all') return true;
      if (item.userId === currentUser.id) return true;
      if (item.userEmail && userEmail && item.userEmail.toLowerCase() === userEmail) return true;
      return false;
    });
  }, [allNotifications, currentUser]);

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
    const newItem: NotificationItem = {
      id: notifId,
      userId: input.userId,
      ...(input.userEmail ? { userEmail: input.userEmail.toLowerCase() } : {}),
      type: input.type,
      title: input.title.trim(),
      message: input.message.trim(),
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

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isNotificationRead,
        markAsRead,
        markAllAsRead,
        sendNotification,
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
