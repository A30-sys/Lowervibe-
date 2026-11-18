import { UploadMetadata } from 'firebase/storage';
import {
  compressImage,
  createResumableUpload,
  deleteUploadedStoragePaths,
  ResumableUploadResult,
  uploadTrackCoverArtwork,
  uploadValidatedTrackAudio,
} from './uploadService';

export type FirebaseStorageUploadResult = ResumableUploadResult;

export async function uploadBlobToFirebaseStorage(
  storagePath: string,
  fileOrBlob: Blob | File,
  metadata?: UploadMetadata,
  onProgress?: (percent: number) => void
): Promise<FirebaseStorageUploadResult> {
  const controller = createResumableUpload({
    storagePath,
    fileOrBlob,
    metadata,
    onProgress: onProgress ? (snap) => onProgress(snap.percent) : undefined,
  });
  return controller.promise;
}

export async function uploadTrackAudioToFirebaseStorage(params: {
  ownerId: string;
  trackId: string;
  file: File;
  checksum?: string;
  onProgress?: (percent: number) => void;
}): Promise<FirebaseStorageUploadResult> {
  const onProgress = params.onProgress;
  return uploadValidatedTrackAudio({
    ownerId: params.ownerId,
    trackId: params.trackId,
    file: params.file,
    checksum: params.checksum,
    onProgress: onProgress ? (snap) => onProgress(snap.percent) : undefined,
  });
}

export async function uploadTrackCoverToFirebaseStorage(params: {
  ownerId: string;
  trackId: string;
  blob: Blob;
  originalFilename?: string;
  contentType?: string;
  onProgress?: (percent: number) => void;
}): Promise<FirebaseStorageUploadResult> {
  const onProgress = params.onProgress;
  let blobToUpload = params.blob;
  let contentType = params.contentType || params.blob.type || 'image/webp';
  if (params.blob instanceof File) {
    try {
      const compressed = await compressImage(params.blob, 'cover');
      blobToUpload = compressed.blob;
      contentType = compressed.contentType;
      URL.revokeObjectURL(compressed.previewUrl);
    } catch {
      // Proceed with original blob if already pre-cropped
    }
  }
  return uploadTrackCoverArtwork({
    ownerId: params.ownerId,
    trackId: params.trackId,
    blob: blobToUpload,
    originalFilename: params.originalFilename,
    contentType,
    onProgress: onProgress ? (snap) => onProgress(snap.percent) : undefined,
  });
}

export async function deleteFirebaseStoragePaths(
  paths: Array<string | undefined | null>
): Promise<void> {
  return deleteUploadedStoragePaths(paths);
}
