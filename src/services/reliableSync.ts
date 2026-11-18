import {
  deleteDoc,
  doc,
  increment,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, formatFirebaseError } from './firebase';

export type SyncMode = 'set' | 'update' | 'delete';

export interface QueuedSyncOperation {
  id: string;
  collection: string;
  docId: string;
  mode: SyncMode;
  data?: Record<string, unknown>;
  merge?: boolean;
  increments?: Record<string, number>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const OUTBOX_STORAGE_KEY = 'lowervibe_firestore_outbox_v1';

type SyncListener = (ops: QueuedSyncOperation[]) => void;
const listeners = new Set<SyncListener>();

function notifyListeners(ops: QueuedSyncOperation[]) {
  listeners.forEach((cb) => {
    try {
      cb(ops);
    } catch {}
  });
}

export function readSyncOutbox(): QueuedSyncOperation[] {
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSyncOutbox(ops: QueuedSyncOperation[]) {
  try {
    if (ops.length === 0) {
      localStorage.removeItem(OUTBOX_STORAGE_KEY);
    } else {
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(ops.slice(-150)));
    }
  } catch {}
  notifyListeners(ops);
}

export function subscribeSyncOutbox(cb: SyncListener): () => void {
  listeners.add(cb);
  cb(readSyncOutbox());
  return () => listeners.delete(cb);
}

function isRetryableNetworkOrTransientError(err: unknown): boolean {
  const code = ((err as { code?: string })?.code || '').toLowerCase();
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  if (code === 'permission-denied' || code === 'unauthenticated' || code === 'invalid-argument') {
    return false;
  }
  return (
    !navigator.onLine ||
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'aborted' ||
    code === 'resource-exhausted' ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('backend') ||
    msg.includes('timeout') ||
    msg.includes('unavailable')
  );
}

function enqueueSyncOperation(op: Omit<QueuedSyncOperation, 'id' | 'createdAt' | 'retryCount'>) {
  const current = readSyncOutbox();
  const existingIdx = current.findIndex(
    (item) =>
      item.collection === op.collection &&
      item.docId === op.docId &&
      item.mode === op.mode &&
      !op.increments
  );

  const entry: QueuedSyncOperation = {
    ...op,
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    retryCount: existingIdx >= 0 ? current[existingIdx].retryCount + 1 : 0,
  };

  const next =
    existingIdx >= 0
      ? current.map((item, idx) => (idx === existingIdx ? entry : item))
      : [...current, entry];

  writeSyncOutbox(next);
}

async function mirrorEventToServer(
  collection: string,
  docId: string,
  mode: SyncMode,
  summary?: Record<string, unknown>
) {
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
    await fetch('/api/sync/record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        collection,
        docId,
        mode,
        timestamp: new Date().toISOString(),
        ...(summary ? { summary } : {}),
      }),
    });
  } catch {
    // Non-blocking audit backup
  }
}

function buildFirestorePayload(
  data?: Record<string, unknown>,
  increments?: Record<string, number>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        payload[k] = v;
      }
    }
  }
  if (increments) {
    for (const [k, delta] of Object.entries(increments)) {
      if (typeof delta === 'number' && Number.isFinite(delta) && delta !== 0) {
        payload[k] = increment(delta);
      }
    }
  }
  return payload;
}

export async function durableSetDoc(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>,
  options?: { merge?: boolean; mirrorBackup?: boolean }
): Promise<{ ok: boolean; queued: boolean; error?: string }> {
  const cleanPayload = buildFirestorePayload(data);
  if (options?.mirrorBackup) {
    void mirrorEventToServer(collectionName, docId, 'set', {
      keys: Object.keys(cleanPayload).slice(0, 12),
    });
  }

  try {
    await setDoc(doc(db, collectionName, docId), cleanPayload, options?.merge ? { merge: true } : {});
    return { ok: true, queued: false };
  } catch (err) {
    const formatted = formatFirebaseError(err, `Sync set ${collectionName}/${docId}`);
    if (isRetryableNetworkOrTransientError(err)) {
      enqueueSyncOperation({
        collection: collectionName,
        docId,
        mode: 'set',
        data: cleanPayload,
        merge: Boolean(options?.merge),
        lastError: formatted,
      });
      return { ok: false, queued: true, error: formatted };
    }
    console.warn(`[ReliableSync] Non-retryable write error (${collectionName}/${docId}):`, formatted);
    return { ok: false, queued: false, error: formatted };
  }
}

export async function durableUpdateDoc(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>,
  options?: { increments?: Record<string, number>; mirrorBackup?: boolean }
): Promise<{ ok: boolean; queued: boolean; error?: string }> {
  const payload = buildFirestorePayload(data, options?.increments);
  if (options?.mirrorBackup) {
    void mirrorEventToServer(collectionName, docId, 'update', {
      keys: Object.keys(data).slice(0, 12),
    });
  }

  try {
    await updateDoc(doc(db, collectionName, docId), payload);
    return { ok: true, queued: false };
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'not-found' && !options?.increments) {
      try {
        await setDoc(doc(db, collectionName, docId), buildFirestorePayload(data), { merge: true });
        return { ok: true, queued: false };
      } catch {}
    }

    const formatted = formatFirebaseError(err, `Sync update ${collectionName}/${docId}`);
    if (isRetryableNetworkOrTransientError(err)) {
      enqueueSyncOperation({
        collection: collectionName,
        docId,
        mode: 'update',
        data: buildFirestorePayload(data),
        increments: options?.increments,
        lastError: formatted,
      });
      return { ok: false, queued: true, error: formatted };
    }
    console.warn(`[ReliableSync] Non-retryable update error (${collectionName}/${docId}):`, formatted);
    return { ok: false, queued: false, error: formatted };
  }
}

export async function durableDeleteDoc(
  collectionName: string,
  docId: string
): Promise<{ ok: boolean; queued: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, collectionName, docId));
    return { ok: true, queued: false };
  } catch (err) {
    const formatted = formatFirebaseError(err, `Sync delete ${collectionName}/${docId}`);
    if (isRetryableNetworkOrTransientError(err)) {
      enqueueSyncOperation({
        collection: collectionName,
        docId,
        mode: 'delete',
        lastError: formatted,
      });
      return { ok: false, queued: true, error: formatted };
    }
    console.warn(`[ReliableSync] Non-retryable delete error (${collectionName}/${docId}):`, formatted);
    return { ok: false, queued: false, error: formatted };
  }
}

let flushInFlight: Promise<{ syncedCount: number; remainingCount: number }> | null = null;

export async function flushPendingSyncOperations(): Promise<{
  syncedCount: number;
  remainingCount: number;
}> {
  if (flushInFlight) return flushInFlight;

  flushInFlight = (async () => {
    const queue = readSyncOutbox();
    if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { syncedCount: 0, remainingCount: queue.length };
    }

    let syncedCount = 0;
    const remaining: QueuedSyncOperation[] = [];

    for (const op of queue) {
      try {
        const ref = doc(db, op.collection, op.docId);
        if (op.mode === 'set') {
          await setDoc(ref, op.data || {}, op.merge ? { merge: true } : {});
        } else if (op.mode === 'update') {
          await updateDoc(ref, buildFirestorePayload(op.data, op.increments));
        } else if (op.mode === 'delete') {
          await deleteDoc(ref);
        }
        syncedCount += 1;
      } catch (err) {
        if (isRetryableNetworkOrTransientError(err) && op.retryCount < 8) {
          remaining.push({
            ...op,
            retryCount: op.retryCount + 1,
            lastError: formatFirebaseError(err),
          });
        } else {
          console.warn(
            `[ReliableSync] Dropped permanently rejected queued write ${op.collection}/${op.docId}:`,
            formatFirebaseError(err)
          );
        }
      }
    }

    writeSyncOutbox(remaining);
    return { syncedCount, remainingCount: remaining.length };
  })().finally(() => {
    flushInFlight = null;
  });

  return flushInFlight;
}
