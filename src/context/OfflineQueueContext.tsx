import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  flushPendingSyncOperations,
  QueuedSyncOperation,
  subscribeSyncOutbox,
} from '../services/reliableSync';
import { useToast } from './ToastContext';

export interface QueuedAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

interface OfflineQueueContextType {
  isOnline: boolean;
  queuedActions: QueuedAction[];
  pendingSyncOps: QueuedSyncOperation[];
  queueAction: (type: string, payload: any) => void;
  replayQueuedActions: () => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueContextType | undefined>(undefined);

const QUEUE_STORAGE_KEY = 'lowervibe_offline_actions_queue';

export const OfflineQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>(() => {
    try {
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [pendingSyncOps, setPendingSyncOps] = useState<QueuedSyncOperation[]>([]);

  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribe = subscribeSyncOutbox((ops) => {
      setPendingSyncOps(ops);
    });

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void flushPendingSyncOperations();
    }

    const handleOnline = () => {
      setIsOnline(true);
      void replayQueuedActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('You are currently offline. Changes are saved locally and will sync automatically when connection returns.', 'info', { duration: 4000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueAction = (type: string, payload: any) => {
    const newAction: QueuedAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      payload,
      timestamp: Date.now(),
    };

    setQueuedActions(prev => {
      const updated = [...prev, newAction];
      try {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    showToast(`Action queued: ${type.replace(/_/g, ' ')}`, 'info');
  };

  const replayQueuedActions = async () => {
    try {
      const syncResult = await flushPendingSyncOperations();
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
      const queue: QueuedAction[] = saved ? JSON.parse(saved) : queuedActions;
      const totalSynced = syncResult.syncedCount + queue.length;

      if (queue.length > 0) {
        setQueuedActions([]);
        localStorage.removeItem(QUEUE_STORAGE_KEY);
      }
      if (totalSynced > 0) {
        showToast(
          `Back online! Synced ${totalSynced} queued ${totalSynced === 1 ? 'change' : 'changes'} with backend.`,
          'success'
        );
      }
    } catch {}
  };

  return (
    <OfflineQueueContext.Provider
      value={{
        isOnline,
        queuedActions,
        pendingSyncOps,
        queueAction,
        replayQueuedActions,
      }}
    >
      {children}
    </OfflineQueueContext.Provider>
  );
};

export const useOfflineQueue = () => {
  const context = useContext(OfflineQueueContext);
  if (!context) {
    throw new Error('useOfflineQueue must be used within an OfflineQueueProvider');
  }
  return context;
};
