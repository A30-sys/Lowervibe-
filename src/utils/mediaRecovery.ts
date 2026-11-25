import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const recoveredDataUrlCache = new Map<string, string>();
const inFlightRecoveries = new Map<string, Promise<string | null>>();

/**
 * Recovers `/api/media/<assetId>` images directly from Firestore `mediaAssets/<assetId>`
 * when running on static hosting without the Express media proxy.
 */
export async function resolveMediaAssetFallbackUrl(rawSrc?: string): Promise<string | null> {
  if (!rawSrc || typeof rawSrc !== 'string') return null;
  const match = rawSrc.trim().match(/^\/api\/media\/([a-zA-Z0-9_-]{4,128})(?:\?.*)?$/);
  if (!match) return null;
  const assetId = match[1];

  const cached = recoveredDataUrlCache.get(assetId);
  if (cached) return cached;

  const existing = inFlightRecoveries.get(assetId);
  if (existing) return existing;

  const promise = (async (): Promise<string | null> => {
    try {
      const snap = await getDoc(doc(db, 'mediaAssets', assetId));
      if (!snap.exists()) return null;
      const data = snap.data() as {
        contentType?: string;
        dataBase64?: string;
      };
      if (data.dataBase64 && typeof data.dataBase64 === 'string') {
        const mime = data.contentType && data.contentType.startsWith('image/') ? data.contentType : 'image/webp';
        const dataUrl = `data:${mime};base64,${data.dataBase64}`;
        if (recoveredDataUrlCache.size > 150) {
          const oldest = recoveredDataUrlCache.keys().next().value;
          if (oldest) recoveredDataUrlCache.delete(oldest);
        }
        recoveredDataUrlCache.set(assetId, dataUrl);
        return dataUrl;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlightRecoveries.delete(assetId);
    }
  })();

  inFlightRecoveries.set(assetId, promise);
  return promise;
}
