import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  getAuth,
  indexedDBLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import {
  doc,
  enableNetwork,
  Firestore,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

const FIRESTORE_CACHE_BYTES = 50 * 1024 * 1024;

function createFirestoreInstance(): Firestore {
  const databaseId = firebaseConfig.firestoreDatabaseId;
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true,
        localCache: persistentLocalCache({
          cacheSizeBytes: FIRESTORE_CACHE_BYTES,
          tabManager: persistentMultipleTabManager(),
        }),
      },
      databaseId
    );
  } catch {
    try {
      return initializeFirestore(
        app,
        {
          experimentalForceLongPolling: true,
          ignoreUndefinedProperties: true,
          localCache: memoryLocalCache(),
        },
        databaseId
      );
    } catch {
      return getFirestore(app, databaseId);
    }
  }
}

/**
 * CRITICAL: The database will fail if firestoreDatabaseId is omitted.
 */
export const db = createFirestoreInstance();
export const auth = getAuth(app);
if (typeof window !== 'undefined') {
  setPersistence(auth, indexedDBLocalPersistence).catch(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  });
}
export const storage = getStorage(app);
export const googleAuthProvider = new GoogleAuthProvider();
export const adminGoogleAuthProvider = new GoogleAuthProvider();
adminGoogleAuthProvider.setCustomParameters({
  prompt: 'select_account',
  login_hint: 'odulamw@gmail.com',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function formatFirebaseError(error: unknown, actionLabel?: string): string {
  const code = (error as { code?: string })?.code || '';
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const prefix = actionLabel ? `${actionLabel}: ` : '';

  // Extract inner error if wrapped by handleFirestoreError JSON string
  let cleanMessage = rawMessage;
  if (rawMessage.startsWith('{') && rawMessage.includes('"error"')) {
    try {
      const parsed = JSON.parse(rawMessage) as { error?: string };
      if (parsed?.error) cleanMessage = parsed.error;
    } catch {}
  }

  switch (code) {
    case 'permission-denied':
      return `${prefix}Permission denied (permission-denied). Only the verified owner can modify this data.`;
    case 'unauthenticated':
      return `${prefix}Authentication required (unauthenticated). Please sign in again.`;
    case 'not-found':
      return `${prefix}The requested record was not found (not-found).`;
    case 'already-exists':
      return `${prefix}A record with this identifier already exists (already-exists).`;
    case 'failed-precondition':
      return `${prefix}Operation rejected by database precondition (failed-precondition): ${cleanMessage}`;
    case 'unavailable':
      return `${prefix}Database temporarily unavailable (unavailable). Check your internet connection and try again.`;
    case 'deadline-exceeded':
      return `${prefix}Request timed out (deadline-exceeded). Please try again.`;
    case 'resource-exhausted':
      return `${prefix}Firebase quota exceeded (resource-exhausted): ${cleanMessage}`;
    case 'invalid-argument':
      return `${prefix}Invalid data submitted (invalid-argument): ${cleanMessage}`;
    default:
      if (cleanMessage) {
        return code ? `${prefix}${cleanMessage} (${code})` : `${prefix}${cleanMessage}`;
      }
      return `${prefix}Unexpected database error occurred.`;
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Automatically re-enables Firestore network transport when browser connectivity recovers
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    enableNetwork(db).catch(() => {});
  });
}

/**
 * Validates connection to the provisioned Firestore database on boot
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration or network connection.');
      return false;
    }
    // Expected permission denial on /test/connection still proves the server is reachable
    return true;
  }
}
