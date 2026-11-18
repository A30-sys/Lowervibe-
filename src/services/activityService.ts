import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Artist, FriendActivityItem, Track } from '../types';

export type { FriendActivityItem };

/**
 * Streams real-time activities exclusively from the Firestore /activities collection.
 */
export function subscribeToFirestoreActivities(
  _tracks: Track[],
  _artists: Artist[],
  onUpdate: (activities: FriendActivityItem[]) => void
): () => void {
  const activitiesRef = collection(db, 'activities');
  const q = query(activitiesRef, orderBy('timeAgoNumber', 'asc'), limit(20));

  try {
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: FriendActivityItem[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as FriendActivityItem);
        });
        onUpdate(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'activities');
        } catch {}
        onUpdate([]);
      }
    );

    return unsubscribe;
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, 'activities');
    } catch {}
    onUpdate([]);
    return () => {};
  }
}
