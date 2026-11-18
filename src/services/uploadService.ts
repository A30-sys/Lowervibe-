import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  UploadMetadata,
  UploadTask,
} from 'firebase/storage';
import {
  extractAudioMetadata,
  ExtractedAudioMetadata,
  optimizeArtistCoverPhoto,
  optimizeArtistProfilePhoto,
  optimizeCoverImageForStorage,
} from './audioStorage';
import { auth, db, storage } from './firebase';

export const MAX_TRACK_AUDIO_BYTES = 120 * 1024 * 1024; // 120 MB (matches storage.rules)
export const MAX_TRACK_COVER_BYTES = 10 * 1024 * 1024; // 10 MB (matches storage.rules)
export const MAX_AVATAR_OR_BANNER_BYTES = 5 * 1024 * 1024; // 5 MB (matches storage.rules)
export const MAX_RAW_IMAGE_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB raw pre-compression ceiling

// Server chunked upload & Firestore persistent mirror limits
const MEDIA_CHUNK_BYTES = 384 * 1024; // 384 KB raw (~512 KB base64, well under Firestore 1 MB doc cap)
const MAX_FIRESTORE_MIRROR_BYTES = 12 * 1024 * 1024; // Persist up to 12 MB directly in Firestore chunks

const ALLOWED_AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'flac',
  'm4a',
  'mp4',
  'aac',
  'ogg',
  'oga',
  'webm',
  'aiff',
  'aif',
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'bmp',
  'heic',
  'heif',
]);

export type UploadTaskState = 'running' | 'paused' | 'success' | 'canceled' | 'error';

export interface UploadProgressSnapshot {
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
  state: UploadTaskState;
}

export interface ResumableUploadResult {
  downloadUrl: string;
  storagePath: string;
  bytes: number;
  contentType: string;
}

export interface ResumableUploadController {
  task: UploadTask | null;
  promise: Promise<ResumableUploadResult>;
  pause: () => boolean;
  resume: () => boolean;
  cancel: () => boolean;
}

export interface ValidatedTrackResult {
  file: File;
  contentType: string;
  metadata: ExtractedAudioMetadata;
}

export interface CompressedImageResult {
  blob: Blob;
  previewUrl: string;
  contentType: string;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
  compressionRatio: number;
}

export type ImageCompressionPreset = 'cover' | 'avatar' | 'banner';

let cachedStorageBucketAvailable: boolean | null = null;
let bucketProbePromise: Promise<boolean> | null = null;

/**
 * Fast cached check to verify whether Firebase Storage bucket is actually provisioned.
 * Prevents Firebase SDK from entering a 45s+ exponential retry stall on HTTP 404 unprovisioned buckets.
 */
async function isFirebaseStorageBucketReady(): Promise<boolean> {
  if (cachedStorageBucketAvailable !== null) {
    return cachedStorageBucketAvailable;
  }
  if (bucketProbePromise) {
    return bucketProbePromise;
  }

  bucketProbePromise = (async () => {
    try {
      const bucket = storage?.app?.options?.storageBucket;
      if (!bucket) {
        cachedStorageBucketAvailable = false;
        return false;
      }
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 1600);
      try {
        const res = await fetch(
          `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?name=__probe__`,
          {
            method: 'GET',
            signal: controller.signal,
          }
        );
        // 404 means the bucket does not exist; 200/401/403 means bucket exists and rules apply
        cachedStorageBucketAvailable = res.status !== 404;
        return cachedStorageBucketAvailable;
      } finally {
        window.clearTimeout(timer);
      }
    } catch {
      cachedStorageBucketAvailable = false;
      return false;
    } finally {
      bucketProbePromise = null;
    }
  })();

  return bucketProbePromise;
}

function sanitizeFilename(name: string, fallback: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned || fallback;
}

function makeAssetId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'asset';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${cleanPrefix}_${Date.now()}_${rand}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function inferAudioContentType(file: File): string {
  if (file.type && file.type.startsWith('audio/')) {
    return file.type;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'flac':
      return 'audio/flac';
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'ogg':
    case 'oga':
      return 'audio/ogg';
    case 'webm':
      return 'audio/webm';
    case 'aiff':
    case 'aif':
      return 'audio/aiff';
    default:
      return 'audio/mpeg';
  }
}

function inferImageContentType(blob: Blob, filename?: string, explicit?: string): string {
  if (explicit && explicit.startsWith('image/')) return explicit;
  if (blob.type && blob.type.startsWith('image/')) return blob.type;
  const ext = filename?.split('.').pop()?.toLowerCase() || '';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function extensionFromImageContentType(contentType: string): string {
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/png') return 'png';
  return 'jpg';
}

function hasKnownAudioHeader(bytes: Uint8Array, ext: string): boolean {
  if (bytes.length < 4) return false;

  const isId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const isMpegOrAdtsSync = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  const isRiffWave =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45;
  const isFormAiff =
    bytes[0] === 0x46 && bytes[1] === 0x4f && bytes[2] === 0x52 && bytes[3] === 0x4d;
  const isFlac =
    bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43;
  const isOgg =
    bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
  const isIsoBmff =
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70;
  const isEbml =
    bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;

  if (ext === 'wav') return isRiffWave;
  if (ext === 'flac') return isFlac;
  if (ext === 'ogg' || ext === 'oga') return isOgg;
  if (ext === 'm4a' || ext === 'mp4') return isIsoBmff;
  if (ext === 'aiff' || ext === 'aif') return isFormAiff;
  if (ext === 'webm') return isEbml;
  if (ext === 'mp3' || ext === 'aac') return isId3 || isMpegOrAdtsSync;

  return (
    isId3 ||
    isMpegOrAdtsSync ||
    isRiffWave ||
    isFormAiff ||
    isFlac ||
    isOgg ||
    isIsoBmff ||
    isEbml
  );
}

function mapUploadStorageError(err: unknown): Error {
  const code = (err as { code?: string })?.code || '';
  const message = err instanceof Error ? err.message : String(err || '');

  if (code === 'storage/unauthorized') {
    return new Error(
      `Permission denied (${code}): Only the signed-in owner can upload to this storage path.`
    );
  }
  if (code === 'storage/canceled') {
    return new Error(`Upload canceled (${code}).`);
  }
  if (code === 'storage/quota-exceeded') {
    return new Error(`Storage quota exceeded (${code}): ${message}`);
  }
  if (code === 'storage/invalid-argument') {
    return new Error(`Invalid file payload (${code}): ${message}`);
  }
  if (code === 'storage/retry-limit-exceeded') {
    return new Error(
      `Network retry limit exceeded (${code}). Please retry your upload.`
    );
  }
  return new Error(code ? `Upload failed (${code}): ${message}` : `Upload failed: ${message}`);
}

/**
 * Validates audio file size, format, container magic-bytes integrity, and playable audio metadata
 * before initiating an upload.
 */
export async function validateTrack(file: File): Promise<ValidatedTrackResult> {
  if (!file || file.size <= 0) {
    throw new Error('Selected audio file is empty or unreadable.');
  }

  if (file.size > MAX_TRACK_AUDIO_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Audio file is ${sizeMb} MB, exceeding the 120 MB maximum limit.`);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const hasAudioMime = Boolean(
    file.type && (file.type.startsWith('audio/') || file.type === 'video/mp4')
  );
  const hasAllowedExt = ALLOWED_AUDIO_EXTENSIONS.has(ext);

  if (!hasAudioMime && !hasAllowedExt) {
    throw new Error(
      'Unsupported audio format. Choose an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file.'
    );
  }

  const headerSlice = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasKnownAudioHeader(headerSlice, ext)) {
    throw new Error(
      'Audio integrity check failed: this file does not have a valid audio header or may be corrupted.'
    );
  }

  const metadata = await extractAudioMetadata(file);
  if (!metadata.durationSeconds || metadata.durationSeconds <= 0) {
    throw new Error('Could not verify playable audio duration from this file.');
  }

  return {
    file,
    contentType: inferAudioContentType(file),
    metadata,
  };
}

export const validateTrackAudioFile = validateTrack;

/**
 * Validates and compresses artwork/avatars/banners client-side (WebP with JPEG fallback)
 * before uploading. Automatically crops and resizes smoothly for fast mobile/desktop uploads.
 */
export async function compressImage(
  file: File,
  preset: ImageCompressionPreset = 'cover'
): Promise<CompressedImageResult> {
  if (!file || file.size <= 0) {
    throw new Error('Selected image file is empty.');
  }

  if (file.size > MAX_RAW_IMAGE_INPUT_BYTES) {
    throw new Error('Image file is larger than 25 MB. Choose a smaller image.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.type && !file.type.startsWith('image/') && !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error('Please choose a valid image file (JPG, PNG, or WebP).');
  }

  const optimized =
    preset === 'cover'
      ? await optimizeCoverImageForStorage(file, {
          minDim: 200,
          requireSquare: false,
          targetSize: 1024,
        })
      : preset === 'avatar'
      ? await optimizeArtistProfilePhoto(file)
      : await optimizeArtistCoverPhoto(file);

  const maxAllowedBytes =
    preset === 'cover' ? MAX_TRACK_COVER_BYTES : MAX_AVATAR_OR_BANNER_BYTES;

  if (optimized.blob.size > maxAllowedBytes) {
    URL.revokeObjectURL(optimized.previewUrl);
    const limitMb = Math.round(maxAllowedBytes / (1024 * 1024));
    throw new Error(`Compressed image still exceeds the ${limitMb} MB storage limit.`);
  }

  return {
    blob: optimized.blob,
    previewUrl: optimized.previewUrl,
    contentType: optimized.contentType,
    width: optimized.width,
    height: optimized.height,
    originalBytes: file.size,
    compressedBytes: optimized.blob.size,
    compressionRatio: Number((optimized.blob.size / Math.max(1, file.size)).toFixed(2)),
  };
}

export const compressImageForUpload = compressImage;

function deriveAssetIdFromStoragePath(storagePath: string): string {
  const cleaned = storagePath.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  if (cleaned.length >= 6 && cleaned.length <= 96) {
    return `${cleaned}_${Math.random().toString(36).slice(2, 6)}`;
  }
  return makeAssetId('lv');
}

async function persistMediaToFirestore(params: {
  assetId: string;
  fileOrBlob: Blob;
  contentType: string;
  ownerId: string;
}): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  if (params.fileOrBlob.size > MAX_FIRESTORE_MIRROR_BYTES) return false;

  const nowIso = new Date().toISOString();
  try {
    if (params.fileOrBlob.size <= 550 * 1024) {
      const dataBase64 = await blobToBase64(params.fileOrBlob);
      await setDoc(doc(db, 'mediaAssets', params.assetId), {
        id: params.assetId,
        ownerId: uid,
        contentType: params.contentType,
        sizeBytes: params.fileOrBlob.size,
        chunkCount: 0,
        dataBase64,
        createdAt: nowIso,
      });
      return true;
    }

    const totalChunks = Math.ceil(params.fileOrBlob.size / MEDIA_CHUNK_BYTES);
    await setDoc(doc(db, 'mediaAssets', params.assetId), {
      id: params.assetId,
      ownerId: uid,
      contentType: params.contentType,
      sizeBytes: params.fileOrBlob.size,
      chunkCount: totalChunks,
      createdAt: nowIso,
    });

    const batchSize = 5;
    for (let start = 0; start < totalChunks; start += batchSize) {
      const end = Math.min(totalChunks, start + batchSize);
      const indices = Array.from({ length: end - start }, (_, idx) => start + idx);
      await Promise.all(
        indices.map(async (chunkIndex) => {
          const byteStart = chunkIndex * MEDIA_CHUNK_BYTES;
          const byteEnd = Math.min(params.fileOrBlob.size, byteStart + MEDIA_CHUNK_BYTES);
          const slice = params.fileOrBlob.slice(byteStart, byteEnd);
          const b64 = await blobToBase64(slice);
          await setDoc(doc(db, 'mediaAssets', params.assetId, 'chunks', String(chunkIndex)), {
            index: chunkIndex,
            ownerId: uid,
            dataBase64: b64,
          });
        })
      );
    }
    return true;
  } catch (err) {
    console.warn('Firestore media persistence note:', err);
    return false;
  }
}

function createServerChunkedUploadController(params: {
  storagePath: string;
  fileOrBlob: Blob | File;
  metadata?: UploadMetadata;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
}): ResumableUploadController {
  const assetId = deriveAssetIdFromStoragePath(params.storagePath);
  const contentType =
    params.metadata?.contentType || params.fileOrBlob.type || 'application/octet-stream';
  const totalBytes = Math.max(1, params.fileOrBlob.size);
  const totalChunks = Math.max(1, Math.ceil(totalBytes / MEDIA_CHUNK_BYTES));
  const ownerId =
    auth.currentUser?.uid || params.metadata?.customMetadata?.ownerId || 'creator';

  let paused = false;
  let canceled = false;
  let activeXhr: XMLHttpRequest | null = null;
  let resumeResolver: (() => void) | null = null;

  const waitWhilePaused = async () => {
    while (paused && !canceled) {
      await new Promise<void>((resolve) => {
        resumeResolver = resolve;
      });
    }
  };

  const uploadSingleChunk = (chunkIndex: number, chunkBlob: Blob, baseBytesSent: number) =>
    new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      activeXhr = xhr;
      const query = new URLSearchParams({
        assetId,
        chunkIndex: String(chunkIndex),
        totalChunks: String(totalChunks),
        contentType,
        ownerId,
      });

      xhr.open('POST', `/api/media/upload-chunk?${query.toString()}`, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.timeout = 25000;

      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable || canceled || paused) return;
        const transferred = Math.min(totalBytes, baseBytesSent + evt.loaded);
        const percent = Math.max(
          1,
          Math.min(95, Math.round((transferred / totalBytes) * 95))
        );
        params.onProgress?.({
          percent,
          bytesTransferred: transferred,
          totalBytes,
          state: 'running',
        });
      };

      xhr.onload = () => {
        activeXhr = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const parsed = JSON.parse(xhr.responseText || '{}') as { url?: string };
            resolve(parsed.url || `/api/media/${assetId}`);
          } catch {
            resolve(`/api/media/${assetId}`);
          }
        } else {
          reject(new Error(`Server upload failed (${xhr.status}): ${xhr.statusText || 'Error'}`));
        }
      };

      xhr.onerror = () => {
        activeXhr = null;
        reject(new Error('Network error sending upload chunk to media server.'));
      };

      xhr.ontimeout = () => {
        activeXhr = null;
        reject(new Error('Upload chunk timed out. Retrying or please check your connection.'));
      };

      xhr.onabort = () => {
        activeXhr = null;
        reject(new Error(canceled ? 'Upload canceled.' : 'Upload paused.'));
      };

      xhr.send(chunkBlob);
    });

  const promise = (async (): Promise<ResumableUploadResult> => {
    params.onProgress?.({
      percent: 4,
      bytesTransferred: 0,
      totalBytes,
      state: 'running',
    });

    let serverUrl = `/api/media/${assetId}`;
    let serverSucceeded = false;
    let serverError: unknown = null;

    // For compact assets (<= 550 KB, e.g. avatars & covers), mirror cleanly in a single Firestore doc
    // without competing with multi-chunk audio uploads.
    const smallAssetMirrorPromise =
      params.fileOrBlob.size <= 550 * 1024
        ? persistMediaToFirestore({
            assetId,
            fileOrBlob: params.fileOrBlob,
            contentType,
            ownerId,
          })
        : null;

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (canceled) {
          params.onProgress?.({
            percent: 0,
            bytesTransferred: 0,
            totalBytes,
            state: 'canceled',
          });
          throw new Error('Upload canceled.');
        }

        await waitWhilePaused();
        if (canceled) {
          throw new Error('Upload canceled.');
        }

        const start = chunkIndex * MEDIA_CHUNK_BYTES;
        const end = Math.min(totalBytes, start + MEDIA_CHUNK_BYTES);
        const slice = params.fileOrBlob.slice(start, end);

        let attempts = 0;
        while (attempts < 3) {
          try {
            serverUrl = await uploadSingleChunk(chunkIndex, slice, start);
            break;
          } catch (err) {
            if (canceled) throw err;
            if (paused) {
              await waitWhilePaused();
              continue;
            }
            attempts += 1;
            if (attempts >= 3) throw err;
            await new Promise((r) => window.setTimeout(r, 350 * attempts));
          }
        }

        const percent = Math.max(1, Math.min(96, Math.round((end / totalBytes) * 96)));
        params.onProgress?.({
          percent,
          bytesTransferred: end,
          totalBytes,
          state: 'running',
        });
      }
      serverSucceeded = true;
    } catch (err) {
      serverError = err;
    }

    if (canceled) {
      params.onProgress?.({
        percent: 0,
        bytesTransferred: 0,
        totalBytes,
        state: 'canceled',
      });
      throw new Error('Upload canceled.');
    }

    let firestoreSaved = false;
    if (smallAssetMirrorPromise) {
      firestoreSaved = await Promise.race([
        smallAssetMirrorPromise,
        new Promise<boolean>((resolve) =>
          window.setTimeout(() => resolve(false), serverSucceeded ? 3500 : 12000)
        ),
      ]);
    } else if (!serverSucceeded) {
      // Only push large chunked audio to Firestore if Express media endpoint could not save it
      firestoreSaved = await persistMediaToFirestore({
        assetId,
        fileOrBlob: params.fileOrBlob,
        contentType,
        ownerId,
      });
    } else if (params.fileOrBlob.size <= 4 * 1024 * 1024) {
      // Non-blocking gentle backup after server upload succeeded so Firestore listeners never stall
      void persistMediaToFirestore({
        assetId,
        fileOrBlob: params.fileOrBlob,
        contentType,
        ownerId,
      });
    }

    if (!serverSucceeded && !firestoreSaved) {
      params.onProgress?.({
        percent: 0,
        bytesTransferred: 0,
        totalBytes,
        state: 'error',
      });
      throw serverError instanceof Error
        ? serverError
        : new Error('Upload could not complete. Check your internet connection and retry.');
    }

    params.onProgress?.({
      percent: 100,
      bytesTransferred: totalBytes,
      totalBytes,
      state: 'success',
    });

    return {
      downloadUrl: serverUrl,
      storagePath: `mediaAssets/${assetId}`,
      bytes: totalBytes,
      contentType,
    };
  })();

  return {
    task: null,
    promise,
    pause: () => {
      if (canceled || paused) return false;
      paused = true;
      activeXhr?.abort();
      params.onProgress?.({
        percent: 0,
        bytesTransferred: 0,
        totalBytes,
        state: 'paused',
      });
      return true;
    },
    resume: () => {
      if (canceled || !paused) return false;
      paused = false;
      resumeResolver?.();
      resumeResolver = null;
      return true;
    },
    cancel: () => {
      if (canceled) return false;
      canceled = true;
      paused = false;
      activeXhr?.abort();
      resumeResolver?.();
      resumeResolver = null;
      return true;
    },
  };
}

/**
 * Creates a fast, resilient resumable upload task:
 * 1. Probes whether Firebase Storage bucket exists (cached 1.6s check).
 * 2. When Firebase Storage is not provisioned (404) or blocked, immediately uses our built-in
 *    chunked Express + Firestore media pipeline with real progress, pause/resume/cancel, and zero stalls.
 */
export function createResumableUpload(params: {
  storagePath: string;
  fileOrBlob: Blob | File;
  metadata?: UploadMetadata;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
  stallTimeoutMs?: number;
}): ResumableUploadController {
  let activeFallback: ResumableUploadController | null = null;
  let activeFirebaseTask: UploadTask | null = null;
  let canceled = false;
  let paused = false;

  const promise = (async (): Promise<ResumableUploadResult> => {
    const bucketReady = await isFirebaseStorageBucketReady();

    if (canceled) {
      throw new Error('Upload canceled.');
    }

    if (!bucketReady) {
      activeFallback = createServerChunkedUploadController(params);
      if (paused) activeFallback.pause();
      if (canceled) activeFallback.cancel();
      return activeFallback.promise;
    }

    // Firebase Storage bucket exists — try native Firebase Storage resumable upload with fast fallback
    try {
      return await new Promise<ResumableUploadResult>((resolve, reject) => {
        const storageRef = ref(storage, params.storagePath);
        const task = uploadBytesResumable(storageRef, params.fileOrBlob, {
          cacheControl: 'public,max-age=31536000',
          ...params.metadata,
        });
        activeFirebaseTask = task;

        let lastBytes = -1;
        let settled = false;
        const stallMs = params.stallTimeoutMs ?? 12000;

        const stallTimer = window.setInterval(() => {
          if (settled) return;
          const snap = task.snapshot;
          if (snap?.state === 'paused') return;
          const transferred = snap?.bytesTransferred ?? 0;
          if (transferred === lastBytes) {
            settled = true;
            window.clearInterval(stallTimer);
            task.cancel();
            reject(new Error('STORAGE_STALL_FALLBACK'));
          } else {
            lastBytes = transferred;
          }
        }, stallMs);

        const stopTimer = () => {
          settled = true;
          window.clearInterval(stallTimer);
        };

        task.on(
          'state_changed',
          (snapshot) => {
            lastBytes = snapshot.bytesTransferred;
            const total = snapshot.totalBytes || params.fileOrBlob.size || 1;
            const percent = Math.max(
              0,
              Math.min(100, Math.round((snapshot.bytesTransferred / total) * 100))
            );
            params.onProgress?.({
              percent,
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: total,
              state: snapshot.state === 'paused' ? 'paused' : 'running',
            });
          },
          (err) => {
            stopTimer();
            const code = (err as { code?: string })?.code || '';
            if (code === 'storage/canceled' && !canceled) {
              reject(new Error('STORAGE_STALL_FALLBACK'));
              return;
            }
            if (code === 'storage/unauthorized' || code === 'storage/canceled') {
              params.onProgress?.({
                percent: 0,
                bytesTransferred: 0,
                totalBytes: params.fileOrBlob.size ?? 0,
                state: code === 'storage/canceled' ? 'canceled' : 'error',
              });
              reject(mapUploadStorageError(err));
              return;
            }
            reject(new Error('STORAGE_STALL_FALLBACK'));
          },
          async () => {
            stopTimer();
            try {
              const downloadUrl = await getDownloadURL(task.snapshot.ref);
              const totalBytes = task.snapshot.totalBytes || params.fileOrBlob.size || 0;
              params.onProgress?.({
                percent: 100,
                bytesTransferred: totalBytes,
                totalBytes,
                state: 'success',
              });
              resolve({
                downloadUrl,
                storagePath: params.storagePath,
                bytes: totalBytes,
                contentType:
                  task.snapshot.metadata?.contentType ||
                  params.fileOrBlob.type ||
                  'application/octet-stream',
              });
            } catch {
              reject(new Error('STORAGE_STALL_FALLBACK'));
            }
          }
        );
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'STORAGE_STALL_FALLBACK' && !canceled) {
        cachedStorageBucketAvailable = false;
        activeFirebaseTask = null;
        activeFallback = createServerChunkedUploadController(params);
        if (paused) activeFallback.pause();
        return activeFallback.promise;
      }
      throw err;
    }
  })();

  return {
    get task() {
      return activeFirebaseTask;
    },
    promise,
    pause: () => {
      paused = true;
      if (activeFirebaseTask) return activeFirebaseTask.pause();
      if (activeFallback) return activeFallback.pause();
      return true;
    },
    resume: () => {
      paused = false;
      if (activeFirebaseTask) return activeFirebaseTask.resume();
      if (activeFallback) return activeFallback.resume();
      return true;
    },
    cancel: () => {
      canceled = true;
      if (activeFirebaseTask) return activeFirebaseTask.cancel();
      if (activeFallback) return activeFallback.cancel();
      return true;
    },
  };
}

export async function uploadValidatedTrackAudio(params: {
  ownerId: string;
  trackId: string;
  file: File;
  checksum?: string;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
  onControllerReady?: (controller: ResumableUploadController) => void;
}): Promise<ResumableUploadResult> {
  const safeName = sanitizeFilename(params.file.name, `${params.trackId}.mp3`);
  const safeOwner = sanitizeFilename(params.ownerId, 'creator');
  const storagePath = `tracks/${safeOwner}/${params.trackId}/audio/${Date.now()}_${safeName}`;
  const contentType = inferAudioContentType(params.file);

  const controller = createResumableUpload({
    storagePath,
    fileOrBlob: params.file,
    metadata: {
      contentType,
      customMetadata: {
        trackId: params.trackId,
        ownerId: safeOwner,
        originalName: params.file.name.slice(0, 120),
        ...(params.checksum ? { sha256: params.checksum } : {}),
      },
    },
    onProgress: params.onProgress,
  });

  params.onControllerReady?.(controller);
  return controller.promise;
}

export async function uploadTrackCoverArtwork(params: {
  ownerId: string;
  trackId: string;
  blob: Blob;
  originalFilename?: string;
  contentType?: string;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
}): Promise<ResumableUploadResult> {
  const resolvedType = inferImageContentType(
    params.blob,
    params.originalFilename,
    params.contentType
  );
  const ext = extensionFromImageContentType(resolvedType);
  const safeName = sanitizeFilename(params.originalFilename || `cover.${ext}`, `cover.${ext}`);
  const safeOwner = sanitizeFilename(params.ownerId, 'creator');
  const storagePath = `tracks/${safeOwner}/${params.trackId}/cover/${Date.now()}_${safeName}`;

  const controller = createResumableUpload({
    storagePath,
    fileOrBlob: params.blob,
    metadata: {
      contentType: resolvedType,
      customMetadata: {
        trackId: params.trackId,
        ownerId: safeOwner,
      },
    },
    onProgress: params.onProgress,
  });

  return controller.promise;
}

export async function uploadCompressedAvatar(params: {
  userId: string;
  file: File;
  artistId?: string;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
  onPreviewReady?: (previewUrl: string) => void;
}): Promise<ResumableUploadResult> {
  const compressed = await compressImageForUpload(params.file, 'avatar');
  params.onPreviewReady?.(compressed.previewUrl);

  const ext = extensionFromImageContentType(compressed.contentType);
  const safeOwner = sanitizeFilename(params.userId, 'user');
  const fileName = params.artistId
    ? `artist_${sanitizeFilename(params.artistId, 'profile')}_avatar_${Date.now()}.${ext}`
    : `avatar_${Date.now()}.${ext}`;
  const storagePath = `avatars/${safeOwner}/${fileName}`;

  const controller = createResumableUpload({
    storagePath,
    fileOrBlob: compressed.blob,
    metadata: {
      contentType: compressed.contentType,
      customMetadata: {
        ownerId: safeOwner,
        ...(params.artistId ? { artistId: params.artistId } : {}),
        assetType: params.artistId ? 'artist_profile_photo' : 'user_avatar',
      },
    },
    onProgress: params.onProgress,
  });

  return controller.promise;
}

export async function uploadCompressedCoverBanner(params: {
  userId: string;
  file: File;
  artistId?: string;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
  onPreviewReady?: (previewUrl: string) => void;
}): Promise<ResumableUploadResult> {
  const compressed = await compressImageForUpload(params.file, 'banner');
  params.onPreviewReady?.(compressed.previewUrl);

  const ext = extensionFromImageContentType(compressed.contentType);
  const safeOwner = sanitizeFilename(params.userId, 'user');
  const fileName = params.artistId
    ? `artist_${sanitizeFilename(params.artistId, 'profile')}_cover_${Date.now()}.${ext}`
    : `cover_${Date.now()}.${ext}`;
  const storagePath = `avatars/${safeOwner}/${fileName}`;

  const controller = createResumableUpload({
    storagePath,
    fileOrBlob: compressed.blob,
    metadata: {
      contentType: compressed.contentType,
      customMetadata: {
        ownerId: safeOwner,
        ...(params.artistId ? { artistId: params.artistId } : {}),
        assetType: params.artistId ? 'artist_cover_photo' : 'user_cover_photo',
      },
    },
    onProgress: params.onProgress,
  });

  return controller.promise;
}

export async function deleteUploadedStoragePaths(
  paths: Array<string | undefined | null>
): Promise<void> {
  const validPaths = paths.filter((p): p is string => Boolean(p && p.trim()));
  await Promise.all(
    validPaths.map(async (storagePath) => {
      try {
        if (storagePath.startsWith('mediaAssets/')) {
          const assetId = storagePath.slice('mediaAssets/'.length);
          if (assetId) {
            fetch(`/api/media/${encodeURIComponent(assetId)}`, { method: 'DELETE' }).catch(() => {});
            await deleteDoc(doc(db, 'mediaAssets', assetId)).catch(() => {});
          }
          return;
        }
        await deleteObject(ref(storage, storagePath));
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code !== 'storage/object-not-found') {
          console.warn(`Media cleanup notice for ${storagePath}:`, err);
        }
      }
    })
  );
}
