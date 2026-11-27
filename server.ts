import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

const MEDIA_DIR = path.resolve(__dirname, '.lowervibe_media');
const MEDIA_PARTS_DIR = path.resolve(MEDIA_DIR, '.parts');
fs.mkdirSync(MEDIA_PARTS_DIR, { recursive: true });

const LEDGER_DIR = path.resolve(__dirname, '.lowervibe_ledger');
fs.mkdirSync(LEDGER_DIR, { recursive: true });

const APPROVAL_LEDGER_PATH = path.join(LEDGER_DIR, 'approval_tokens.json');
const PAYOUT_LEDGER_PATH = path.join(LEDGER_DIR, 'payout_tokens.json');
const SYNC_LEDGER_PATH = path.join(LEDGER_DIR, 'sync_events.json');
const ANALYTICS_LEDGER_PATH = path.join(LEDGER_DIR, 'analytics_events.json');
const PLAYS_LEDGER_PATH = path.join(LEDGER_DIR, 'plays_ledger.json');
const SIGNING_KEY_PATH = path.join(LEDGER_DIR, '.server_signing_key');

const PRIMARY_ADMIN_EMAIL = 'odulamw@gmail.com';

let FIREBASE_API_KEY = '';
let FIREBASE_PROJECT_ID = 'lowervibemusic';
let FIRESTORE_DATABASE_ID = 'ai-studio-lowervibe-b2e45d28-38e1-4e03-bbe9-11eddd11a756';
try {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const parsedCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (parsedCfg.apiKey) FIREBASE_API_KEY = parsedCfg.apiKey;
    if (parsedCfg.projectId) FIREBASE_PROJECT_ID = parsedCfg.projectId;
    if (parsedCfg.firestoreDatabaseId) FIRESTORE_DATABASE_ID = parsedCfg.firestoreDatabaseId;
  }
} catch {}

function getServerSigningSecret(): string {
  const envSecret = process.env.PAYOUT_TOKEN_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) return envSecret;
  try {
    if (fs.existsSync(SIGNING_KEY_PATH)) {
      const existing = fs.readFileSync(SIGNING_KEY_PATH, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SIGNING_KEY_PATH, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.createHash('sha256').update(`${FIREBASE_PROJECT_ID}:${FIRESTORE_DATABASE_ID}`).digest('hex');
  }
}

const SERVER_SIGNING_SECRET = getServerSigningSecret();

function readJsonArray<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(filePath: string, rows: T[]) {
  try {
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(rows, null, 2));
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.warn('[LOWERVIBE] Failed to persist ledger file:', err);
  }
}

const MAX_SEO_CACHE_ENTRIES = 5000;

function setBoundedMapEntry<K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number = MAX_SEO_CACHE_ENTRIES) {
  if (map.has(key)) {
    map.delete(key);
  } else if (map.size >= maxEntries) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) {
      map.delete(oldestKey);
    }
  }
  map.set(key, value);
}

function createBufferedJsonRingBuffer<T>(filePath: string, maxItems: number, flushIntervalMs: number = 3000) {
  let buffer: T[] = readJsonArray<T>(filePath).slice(0, maxItems);
  let dirty = false;
  let flushing = false;
  let flushTimer: NodeJS.Timeout | null = null;

  const flush = async () => {
    if (!dirty || flushing) return;
    flushing = true;
    dirty = false;
    const snapshot = buffer.slice(0, maxItems);
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    try {
      await fs.promises.writeFile(tmpPath, JSON.stringify(snapshot));
      await fs.promises.rename(tmpPath, filePath);
    } catch (err) {
      console.warn('[LOWERVIBE] Async buffered ledger flush failed:', err);
    } finally {
      flushing = false;
      if (dirty) {
        scheduleFlush();
      }
    }
  };

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, flushIntervalMs);
    if (typeof flushTimer.unref === 'function') {
      flushTimer.unref();
    }
  };

  return {
    push(item: T) {
      buffer.unshift(item);
      if (buffer.length > maxItems) {
        buffer.length = maxItems;
      }
      dirty = true;
      scheduleFlush();
    },
    getAll(): T[] {
      return buffer;
    },
  };
}

const syncEventRing = createBufferedJsonRingBuffer<Record<string, unknown>>(SYNC_LEDGER_PATH, 1500, 3000);
const analyticsEventRing = createBufferedJsonRingBuffer<Record<string, unknown>>(ANALYTICS_LEDGER_PATH, 2000, 3000);

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  isGoogleProvider: boolean;
  idToken: string;
}

function decodeJwtSignInProvider(idToken: string): string {
  try {
    const parts = idToken.split('.');
    if (parts.length < 2) return '';
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const parsed = JSON.parse(payloadJson) as { firebase?: { sign_in_provider?: string } };
    return String(parsed.firebase?.sign_in_provider || '').toLowerCase();
  } catch {
    return '';
  }
}

async function verifyFirebaseBearerToken(req: express.Request): Promise<VerifiedFirebaseUser | null> {
  const authHeader = req.header('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match || !FIREBASE_API_KEY) return null;
  const idToken = match[1].trim();
  if (!idToken) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        emailVerified?: boolean;
        providerUserInfo?: Array<{ providerId?: string }>;
      }>;
    };
    const u = json.users?.[0];
    if (!u?.localId) return null;
    const signInProvider = decodeJwtSignInProvider(idToken);
    const hasGoogleProviderInfo = Boolean(
      u.providerUserInfo?.some((p) => p.providerId === 'google.com')
    );
    return {
      uid: u.localId,
      email: (u.email || '').toLowerCase(),
      emailVerified: Boolean(u.emailVerified),
      isGoogleProvider: signInProvider === 'google.com' && hasGoogleProviderInfo,
      idToken,
    };
  } catch {
    return null;
  }
}

type FirestoreRestValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  timestampValue?: string;
  arrayValue?: { values?: FirestoreRestValue[] };
  mapValue?: { fields?: Record<string, FirestoreRestValue> };
};

function decodeFirestoreValue(val?: FirestoreRestValue): unknown {
  if (!val) return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue?.values || []).map((v) => decodeFirestoreValue(v));
  }
  if ('mapValue' in val) {
    return decodeFirestoreFields(val.mapValue?.fields);
  }
  return undefined;
}

function decodeFirestoreFields(fields?: Record<string, FirestoreRestValue>): Record<string, any> {
  const out: Record<string, any> = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeFirestoreValue(v);
  }
  return out;
}

function encodeFirestoreValue(val: unknown): FirestoreRestValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => encodeFirestoreValue(item)) } };
  }
  if (typeof val === 'object') {
    return { mapValue: { fields: encodeFirestoreFields(val as Record<string, unknown>) } };
  }
  return { stringValue: String(val) };
}

function encodeFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreRestValue> {
  const fields: Record<string, FirestoreRestValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = encodeFirestoreValue(v);
    }
  }
  return fields;
}

async function firestoreCreateDocRest(
  collectionId: string,
  docId: string,
  data: Record<string, unknown>,
  idToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${getFirestoreBaseUrl()}/${encodeURIComponent(collectionId)}/${encodeURIComponent(docId)}?currentDocument.exists=false`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ fields: encodeFirestoreFields(data) }),
        signal: AbortSignal.timeout(4000),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function firestoreIncrementFieldsRest(
  writes: Array<{ collection: string; docId: string; increments: Record<string, number> }>,
  idToken: string
): Promise<boolean> {
  try {
    const docBase = `projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;
    const commitWrites = writes.map((w) => ({
      transform: {
        document: `${docBase}/${w.collection}/${w.docId}`,
        fieldTransforms: Object.entries(w.increments).map(([fieldPath, amount]) => ({
          fieldPath,
          increment: { integerValue: String(Math.round(amount)) },
        })),
      },
    }));
    const res = await fetch(`${getFirestoreBaseUrl()}:commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ writes: commitWrites }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function getFirestoreBaseUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;
}

function withFirestoreApiKey(url: string, idToken?: string): string {
  if (idToken || !FIREBASE_API_KEY) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}key=${encodeURIComponent(FIREBASE_API_KEY)}`;
}

const DEMO_ARTIST_COMPACT_KEYS = new Set([
  'dontoliver',
  'zezekingston',
  'emkay',
  'artistdontoliver',
  'artistzezekingston',
  'artistemkay',
]);

function isExcludedDemoArtistRecord(artist: Record<string, any> | null | undefined): boolean {
  if (!artist) return false;
  const candidates = [artist.name, artist.slug, artist.id];
  return candidates.some((val) => {
    if (typeof val !== 'string') return false;
    const compact = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    return DEMO_ARTIST_COMPACT_KEYS.has(compact);
  });
}

async function firestoreGetDocRest(docPath: string, idToken?: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(withFirestoreApiKey(`${getFirestoreBaseUrl()}/${docPath}`, idToken), {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      name?: string;
      fields?: Record<string, FirestoreRestValue>;
    };
    if (!json.fields) return null;
    const docId = json.name?.split('/').pop() || docPath.split('/').pop() || '';
    return { id: docId, ...decodeFirestoreFields(json.fields) };
  } catch {
    return null;
  }
}

async function firestoreQueryEqualsRest(
  collectionId: string,
  fieldPath: string,
  value: string,
  idToken?: string
): Promise<Array<Record<string, any>>> {
  try {
    const res = await fetch(withFirestoreApiKey(`${getFirestoreBaseUrl()}:runQuery`, idToken), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath },
              op: 'EQUAL',
              value: { stringValue: value },
            },
          },
          limit: 500,
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      document?: { name?: string; fields?: Record<string, FirestoreRestValue> };
    }>;
    return rows
      .filter((r) => Boolean(r.document?.fields))
      .map((r) => {
        const docId = r.document?.name?.split('/').pop() || '';
        return { id: docId, ...decodeFirestoreFields(r.document?.fields) };
      });
  } catch {
    return [];
  }
}

async function firestoreRunListQueryRest(
  collectionId: string,
  limitCount: number = 250
): Promise<Array<Record<string, any>>> {
  try {
    const res = await fetch(withFirestoreApiKey(`${getFirestoreBaseUrl()}:runQuery`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          limit: limitCount,
        },
      }),
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      document?: {
        name?: string;
        updateTime?: string;
        fields?: Record<string, FirestoreRestValue>;
      };
    }>;
    return rows
      .filter((r) => Boolean(r.document?.fields))
      .map((r) => {
        const docId = r.document?.name?.split('/').pop() || '';
        return {
          id: docId,
          __updateTime: r.document?.updateTime,
          ...decodeFirestoreFields(r.document?.fields),
        };
      });
  } catch {
    return [];
  }
}

const seoArtistCache = new Map<
  string,
  { expiresAt: number; artist: Record<string, any> | null; tracksCount: number }
>();

async function lookupPublicArtistForSeo(
  slugOrId: string
): Promise<{ artist: Record<string, any> | null; tracksCount: number }> {
  const cleanKey = slugOrId.trim();
  const cacheKey = cleanKey.toLowerCase();
  const cached = seoArtistCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { artist: cached.artist, tracksCount: cached.tracksCount };
  }

  let artist: Record<string, any> | null = await firestoreGetDocRest(`artists/${encodeURIComponent(cleanKey)}`);

  if (!artist) {
    const bySlug = await firestoreQueryEqualsRest('artists', 'slug', cleanKey);
    if (bySlug.length > 0) artist = bySlug[0];
  }

  if (!artist && cleanKey !== cacheKey) {
    const byLowerSlug = await firestoreQueryEqualsRest('artists', 'slug', cacheKey);
    if (byLowerSlug.length > 0) artist = byLowerSlug[0];
  }

  if (!artist) {
    const docs = await firestoreRunListQueryRest('artists', 200);
    artist =
      docs.find(
        (a) =>
          (typeof a.slug === 'string' && a.slug.toLowerCase() === cacheKey) ||
          String(a.id || '').toLowerCase() === cacheKey ||
          (typeof a.name === 'string' &&
            a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === cacheKey)
      ) || null;
  }

  if (isExcludedDemoArtistRecord(artist)) {
    artist = null;
  }

  let tracksCount = 0;
  if (artist?.id) {
    try {
      const artistTracks = await firestoreQueryEqualsRest('tracks', 'artistId', String(artist.id));
      tracksCount = artistTracks.filter((t) => !t.isDraft && !t.isDeranked).length;
    } catch {}
  }

  setBoundedMapEntry(seoArtistCache, cacheKey, {
    expiresAt: Date.now() + (artist ? 30_000 : 5_000),
    artist,
    tracksCount,
  });

  return { artist, tracksCount };
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function isInternalOrLocalHost(hostHeader: string): boolean {
  const hostOnly = hostHeader.split(':')[0].trim().toLowerCase();
  return (
    !hostOnly ||
    hostOnly === 'localhost' ||
    hostOnly === '127.0.0.1' ||
    hostOnly === '0.0.0.0' ||
    hostOnly === '::1' ||
    hostOnly.endsWith('.local') ||
    hostOnly.endsWith('.internal')
  );
}

function resolveRequestOrigin(req: express.Request): string {
  const forwardedHost = (req.header('x-forwarded-host') || '').split(',')[0].trim();
  const rawHost = forwardedHost || (req.get('host') || '').trim();
  const protoHeader = (req.header('x-forwarded-proto') || '').split(',')[0].trim();
  const proto = protoHeader || req.protocol || 'https';
  if (rawHost && !isInternalOrLocalHost(rawHost)) {
    return `${proto}://${rawHost}`;
  }
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  return `${proto}://${rawHost || `localhost:${PORT}`}`;
}

function isSafePublicHttpUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^fe80:/i.test(host) ||
      /^fc00:/i.test(host) ||
      /^fd00:/i.test(host)
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function toShareableSocialImageUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const cldMatch = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i.exec(trimmed);
  if (!cldMatch) return trimmed;
  const prefix = cldMatch[1];
  let rest = cldMatch[2];
  if (!/^f_(?:jpg|jpeg|png)/i.test(rest)) {
    rest = `f_jpg,q_90,w_1200,h_1200,c_limit/${rest}`;
  }
  rest = rest.replace(/\.(?:webp|avif)(\?.*)?$/i, '.jpg$1');
  return `${prefix}${rest}`;
}

function inferImageMimeType(imageUrl: string, fallback: string = 'image/jpeg'): string {
  const lower = imageUrl.toLowerCase().split('?')[0];
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return fallback;
}

function resolveSeoPublicImage(
  rawUrl: unknown,
  origin: string,
  coverEndpointPath?: string
): string {
  const fallback = `${origin}/icons/pwa-512x512.png`;
  if (typeof rawUrl !== 'string') return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('data:image/svg+xml') || trimmed.startsWith('blob:')) {
    return fallback;
  }
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('/api/media/')) {
    return coverEndpointPath ? `${origin}${coverEndpointPath}` : fallback;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const shareable = toShareableSocialImageUrl(trimmed);
    return isSafePublicHttpUrl(shareable) || fallback;
  }
  if (trimmed.startsWith('/')) return `${origin}${trimmed}`;
  return `${origin}/${trimmed}`;
}

function pickFirstValidArtworkCandidate(candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (
      !trimmed ||
      trimmed.startsWith('data:image/svg+xml') ||
      trimmed.startsWith('blob:') ||
      trimmed.includes('pwa-512x512.png')
    ) {
      continue;
    }
    return trimmed;
  }
  return undefined;
}

function truncateSeoText(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${(lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}

function formatTrackShareTitle(trackTitle: string, artistName: string): string {
  const safeTrack = String(trackTitle || 'Track').replace(/\s+/g, ' ').trim();
  const safeArtist = String(artistName || 'Independent Artist').replace(/\s+/g, ' ').trim();
  const full = `${safeTrack} by ${safeArtist} – LOWERVIBE`;
  if (full.length <= 70) return full;

  const trimmedTrack = safeTrack.length > 28 ? `${safeTrack.slice(0, 27).trim()}…` : safeTrack;
  const trimmedArtist = safeArtist.length > 22 ? `${safeArtist.slice(0, 21).trim()}…` : safeArtist;
  return `${trimmedTrack} by ${trimmedArtist} – LOWERVIBE`;
}

function resolveSeoPublicAudio(rawUrl: unknown, origin: string): string | undefined {
  if (typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${origin}${trimmed}`;
  return undefined;
}

function inferAudioMimeType(audioUrl: string): string {
  const lower = audioUrl.toLowerCase().split('?')[0];
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  return 'audio/mpeg';
}

function formatIsoDuration(secondsValue: unknown): string | undefined {
  const totalSeconds = Math.round(Number(secondsValue || 0));
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return undefined;
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  let out = 'PT';
  if (hours > 0) out += `${hours}H`;
  if (mins > 0) out += `${mins}M`;
  if (secs > 0 || (hours === 0 && mins === 0)) out += `${secs}S`;
  return out;
}

function stripExistingSeoTags(html: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '')
    .replace(/<meta\s+property="profile:[^"]+"[^>]*>/gi, '')
    .replace(/<meta\s+property="music:[^"]+"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, '')
    .replace(/<script\s+id="lv-structured-data"[\s\S]*?<\/script>/gi, '');
}

function injectArtistSeoHtml(
  html: string,
  artist: Record<string, any> | null,
  tracksCount: number,
  req: express.Request
): string {
  const origin = resolveRequestOrigin(req);
  const cleanPath = req.path || '/';
  const canonicalUrl = `${origin}${cleanPath}`;

  if (!artist) {
    const defaultImg = `${origin}/icons/pwa-512x512.png`;
    const withoutCanonical = html
      .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
      .replace(/<meta\s+property="og:url"[^>]*>/gi, '')
      .replace(/<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${escapeHtmlAttr(defaultImg)}" />`)
      .replace(/<meta\s+name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${escapeHtmlAttr(defaultImg)}" />`);
    return withoutCanonical.replace(
      '</head>',
      `    <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />\n    <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />\n  </head>`
    );
  }

  const safeName = String(artist.name || 'Independent Artist').trim();
  const locationText =
    [artist.city, artist.country].filter(Boolean).join(', ') || String(artist.location || '');

  let title = `${safeName} – Listen on LOWERVIBE`;
  if (title.length < 30) {
    title = `${safeName} – Stream Music on LOWERVIBE`;
  }
  if (title.length > 60) {
    const shortName = safeName.length > 42 ? `${safeName.slice(0, 41).trim()}…` : safeName;
    title = `${shortName} – LOWERVIBE`;
  }

  const rawBio = typeof artist.bio === 'string' ? artist.bio.replace(/\s+/g, ' ').trim() : '';
  const trackLabel =
    tracksCount > 0 ? `${tracksCount} track${tracksCount === 1 ? '' : 's'}` : 'original releases';
  const locClause = locationText ? ` from ${locationText}` : '';
  const rawDescription = rawBio
    ? `${rawBio} Stream ${trackLabel} by ${safeName}${locClause} on LOWERVIBE.`
    : `Listen to ${safeName}${locClause} on LOWERVIBE. Stream ${trackLabel}, explore top songs, and support independent African music creators directly.`;
  const description = truncateSeoText(rawDescription, 160);

  const artistCoverPath = artist.id || artist.slug
    ? `/og/artist/${encodeURIComponent(String(artist.slug || artist.id))}/cover`
    : undefined;
  const rawArtistImg = pickFirstValidArtworkCandidate([artist.avatar, artist.banner]);
  const image = resolveSeoPublicImage(rawArtistImg, origin, artistCoverPath);
  const imageMime = inferImageMimeType(image, image.includes('/og/') ? 'image/jpeg' : 'image/png');
  const genres = Array.isArray(artist.genres)
    ? artist.genres.filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
    : [];
  const socialsMap = (artist.socials && typeof artist.socials === 'object' ? artist.socials : {}) as Record<
    string,
    unknown
  >;
  const sameAs = Object.values(socialsMap)
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.startsWith('https://') || v.startsWith('http://'));

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: safeName,
    description,
    image,
    url: canonicalUrl,
    ...(genres.length > 0 ? { genre: genres } : {}),
    ...(locationText ? { foundingLocation: { '@type': 'Place', name: locationText } } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(typeof artist.followersCount === 'number' && artist.followersCount > 0
      ? {
          interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/FollowAction',
            userInteractionCount: artist.followersCount,
          },
        }
      : {}),
  };

  const imageAlt = `${safeName} on LOWERVIBE`;
  const headInject = [
    `<title>${escapeHtmlAttr(title)}</title>`,
    `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta name="description" content="${escapeHtmlAttr(description)}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:site_name" content="LOWERVIBE" />`,
    `<meta property="og:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(image)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtmlAttr(image)}" />`,
    `<meta property="og:image:type" content="${escapeHtmlAttr(imageMime)}" />`,
    `<meta property="og:image:width" content="512" />`,
    `<meta property="og:image:height" content="512" />`,
    `<meta property="og:image:alt" content="${escapeHtmlAttr(imageAlt)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta property="profile:username" content="${escapeHtmlAttr(String(artist.slug || artist.id || safeName))}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(image)}" />`,
    `<meta name="twitter:image:src" content="${escapeHtmlAttr(image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtmlAttr(imageAlt)}" />`,
    `<script id="lv-structured-data" type="application/ld+json">${escapeJsonLd(structuredData)}</script>`,
  ].join('\n    ');

  const stripped = stripExistingSeoTags(html);
  return stripped.replace('</head>', `    ${headInject}\n  </head>`);
}

const seoTrackCache = new Map<
  string,
  { expiresAt: number; track: Record<string, any> | null; artist: Record<string, any> | null }
>();

const SERVER_GENRE_ALIAS_MAP: Record<string, string> = {
  'afro pop': 'Afro-Pop',
  afropop: 'Afro-Pop',
  'afro-pop': 'Afro-Pop',
  'malawi afro pop': 'Afro-Pop',
  'afro fusion': 'Afro-Fusion',
  'afro-fusion': 'Afro-Fusion',
  afrofusion: 'Afro-Fusion',
  afrobeats: 'Afrobeats',
  'afro beats': 'Afrobeats',
  afrobeat: 'Afrobeats',
  danceall: 'Dancehall',
  dancehall: 'Dancehall',
  'dance hall': 'Dancehall',
  zimdancehall: 'Dancehall',
  'trap music': 'Trap',
  trap: 'Trap',
  'hip hop': 'Hip-Hop',
  'hip-hop': 'Hip-Hop',
  hiphop: 'Hip-Hop',
  rap: 'Hip-Hop',
  amapiano: 'Amapiano',
  'ama piano': 'Amapiano',
  gospel: 'Gospel',
  'r&b': 'R&B',
  rnb: 'R&B',
  'r & b': 'R&B',
  'afro-soul': 'Afro-Soul',
  'afro soul': 'Afro-Soul',
  afrosoul: 'Afro-Soul',
  soul: 'Afro-Soul',
  reggae: 'Reggae',
  acoustic: 'Acoustic',
  'lo-fi': 'Lo-Fi',
  lofi: 'Lo-Fi',
  'lo fi': 'Lo-Fi',
  chillout: 'Chill & Ambient',
  'afro chillout': 'Chill & Ambient',
  ambient: 'Chill & Ambient',
  chill: 'Chill & Ambient',
};

function normalizeServerGenreCategory(raw?: unknown): string {
  const cleaned = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Other';
  const key = cleaned.toLowerCase();
  if (SERVER_GENRE_ALIAS_MAP[key]) return SERVER_GENRE_ALIAS_MAP[key];
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function getServerTrackEngagementScore(track: Record<string, any>): number {
  const plays = Number(track.plays || 0);
  const likes = Number(track.likes || (Array.isArray(track.likedByUserIds) ? track.likedByUserIds.length : 0) || 0);
  const downloads = Number(track.downloads || 0);
  const comments = Array.isArray(track.comments) ? track.comments.length : 0;
  return plays + likes * 4 + downloads * 3 + comments * 5;
}

async function lookupPublicTrackForSeo(
  trackId: string,
  options?: { includeDrafts?: boolean }
): Promise<{ track: Record<string, any> | null; artist: Record<string, any> | null }> {
  const cleanId = trackId.trim();
  const includeDrafts = Boolean(options?.includeDrafts);
  const cacheKey = `${includeDrafts ? 'draft:' : 'pub:'}${cleanId}`;
  const cached = seoTrackCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { track: cached.track, artist: cached.artist };
  }

  let track = await firestoreGetDocRest(`tracks/${encodeURIComponent(cleanId)}`);
  if (!track) {
    const allTracks = await firestoreRunListQueryRest('tracks', 300);
    const lowerTarget = cleanId.toLowerCase();
    track =
      allTracks.find(
        (t) =>
          String(t.id || '').trim() === cleanId ||
          String(t.id || '').trim().toLowerCase() === lowerTarget
      ) || null;
  }

  if (
    track &&
    ((!includeDrafts && (track.isDraft || track.moderationStatus === 'rejected')) ||
      track.isDeranked ||
      isExcludedDemoArtistRecord({ id: track.artistId, name: track.artistName }))
  ) {
    track = null;
  }

  let artist: Record<string, any> | null = null;
  if (track?.artistId) {
    artist = await firestoreGetDocRest(`artists/${encodeURIComponent(String(track.artistId))}`);
    if (isExcludedDemoArtistRecord(artist)) {
      artist = null;
      track = null;
    }
  }
  if (track && !artist && track.uploadedByUserId) {
    const byOwner = await firestoreQueryEqualsRest('artists', 'ownerId', String(track.uploadedByUserId));
    if (byOwner.length > 0 && !isExcludedDemoArtistRecord(byOwner[0])) {
      artist = byOwner[0];
    }
  }

  setBoundedMapEntry(seoTrackCache, cacheKey, {
    expiresAt: Date.now() + (track ? 30_000 : 5_000),
    track,
    artist,
  });
  return { track, artist };
}

interface ChartSeoLookupOptions {
  tab?: string;
  genre?: string;
  trackId?: string;
}

const seoChartsCache = new Map<
  string,
  {
    expiresAt: number;
    topTrack: Record<string, any> | null;
    artist: Record<string, any> | null;
    totalCount: number;
    resolvedGenre?: string;
  }
>();

async function lookupTopChartsForSeo(options?: ChartSeoLookupOptions): Promise<{
  topTrack: Record<string, any> | null;
  artist: Record<string, any> | null;
  totalCount: number;
  resolvedGenre?: string;
}> {
  const tab = options?.tab === 'trending' || options?.tab === 'genres' ? options.tab : 'most-played';
  const rawGenre = String(options?.genre || '').trim();
  const normalizedGenre = rawGenre ? normalizeServerGenreCategory(rawGenre) : '';
  const requestedTrackId = String(options?.trackId || '').trim();
  const cacheKey = `${tab}|${normalizedGenre.toLowerCase()}|${requestedTrackId}`;

  const cached = seoChartsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      topTrack: cached.topTrack,
      artist: cached.artist,
      totalCount: cached.totalCount,
      resolvedGenre: cached.resolvedGenre,
    };
  }

  let topTrack: Record<string, any> | null = null;
  let artist: Record<string, any> | null = null;
  let totalCount = 0;

  try {
    const docs = await firestoreRunListQueryRest('tracks', 300);
    let valid = docs.filter(
      (t) =>
        !t.isDraft &&
        !t.isDeranked &&
        t.moderationStatus !== 'rejected' &&
        !isExcludedDemoArtistRecord({ id: t.artistId, name: t.artistName })
    );

    if (normalizedGenre) {
      const genreMatches = valid.filter(
        (t) => normalizeServerGenreCategory(t.genre).toLowerCase() === normalizedGenre.toLowerCase()
      );
      if (genreMatches.length > 0) {
        valid = genreMatches;
      }
    }

    if (tab === 'trending') {
      valid.sort((a, b) => {
        const diff = getServerTrackEngagementScore(b) - getServerTrackEngagementScore(a);
        if (diff !== 0) return diff;
        return Number(b.plays || 0) - Number(a.plays || 0);
      });
    } else {
      valid.sort((a, b) => {
        const playDiff = Number(b.plays || 0) - Number(a.plays || 0);
        if (playDiff !== 0) return playDiff;
        return Number(b.likes || 0) - Number(a.likes || 0);
      });
    }

    totalCount = valid.length;
    topTrack =
      (requestedTrackId
        ? valid.find((t) => String(t.id || '').trim() === requestedTrackId)
        : undefined) ||
      valid[0] ||
      null;

    if (topTrack?.artistId) {
      artist = await firestoreGetDocRest(`artists/${encodeURIComponent(String(topTrack.artistId))}`);
      if (isExcludedDemoArtistRecord(artist)) {
        artist = null;
      }
    }
  } catch {}

  const entry = {
    expiresAt: Date.now() + 30_000,
    topTrack,
    artist,
    totalCount,
    resolvedGenre: normalizedGenre || undefined,
  };
  setBoundedMapEntry(seoChartsCache, cacheKey, entry, 200);

  return {
    topTrack,
    artist,
    totalCount,
    resolvedGenre: normalizedGenre || undefined,
  };
}

function buildChartQueryString(options?: ChartSeoLookupOptions): string {
  const params = new URLSearchParams();
  if (options?.tab && options.tab !== 'most-played') {
    params.set('tab', options.tab);
  }
  if (options?.genre && options.genre.trim()) {
    params.set('genre', options.genre.trim());
  }
  if (options?.trackId && options.trackId.trim()) {
    params.set('track', options.trackId.trim());
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function injectChartsSeoHtml(
  html: string,
  topTrack: Record<string, any> | null,
  artist: Record<string, any> | null,
  totalCount: number,
  req: express.Request,
  options?: ChartSeoLookupOptions
): string {
  const origin = resolveRequestOrigin(req);
  const qs = buildChartQueryString(options);
  const canonicalUrl = `${origin}/charts${qs}`;
  const safeTrack = String(topTrack?.title || '').trim();
  const safeArtist = String(topTrack?.artistName || artist?.name || '').trim();
  const activeGenre = String(options?.genre || '').trim();
  const activeTab = options?.tab || 'most-played';

  const chartLabel = activeGenre
    ? `Top ${normalizeServerGenreCategory(activeGenre)} Chart`
    : activeTab === 'trending'
    ? 'Most Trending Chart'
    : 'Most Played & Trending Charts';

  const title = safeTrack
    ? `${chartLabel} (#1: ${safeTrack} by ${safeArtist || 'Artist'}) – LOWERVIBE`
    : `${chartLabel} – LOWERVIBE`;
  const description = truncateSeoText(
    safeTrack
      ? `Explore ${totalCount || 'all'} tracks on LOWERVIBE ${chartLabel}. #1 right now: "${safeTrack}" by ${safeArtist || 'Independent Artist'}. Stream free and share.`
      : 'Explore and share the most played songs, fastest-rising trending tracks, and top genres across LOWERVIBE.',
    160
  );

  const rawImg = topTrack
    ? pickFirstValidArtworkCandidate([
        topTrack.coverArt,
        artist?.avatar,
        topTrack.artistAvatar,
        artist?.banner,
      ])
    : undefined;
  const coverPath = `/og/charts/cover${qs}`;
  const image = rawImg ? `${origin}${coverPath}` : `${origin}/icons/pwa-512x512.png`;
  const imageMime = inferImageMimeType(
    rawImg ? toShareableSocialImageUrl(rawImg) : image,
    rawImg ? 'image/jpeg' : 'image/png'
  );
  const imageAlt = safeTrack ? `#1 Charting: ${safeTrack} by ${safeArtist}` : 'LOWERVIBE Top Charts';

  const headInject = [
    `<title>${escapeHtmlAttr(title)}</title>`,
    `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta name="description" content="${escapeHtmlAttr(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:site_name" content="LOWERVIBE" />`,
    `<meta property="og:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(image)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtmlAttr(image)}" />`,
    `<meta property="og:image:type" content="${escapeHtmlAttr(imageMime)}" />`,
    `<meta property="og:image:width" content="512" />`,
    `<meta property="og:image:height" content="512" />`,
    `<meta property="og:image:alt" content="${escapeHtmlAttr(imageAlt)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(image)}" />`,
    `<meta name="twitter:image:src" content="${escapeHtmlAttr(image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtmlAttr(imageAlt)}" />`,
  ].join('\n    ');

  const stripped = stripExistingSeoTags(html);
  return stripped.replace('</head>', `    ${headInject}\n  </head>`);
}

function injectTrackSeoHtml(
  html: string,
  track: Record<string, any> | null,
  artist: Record<string, any> | null,
  req: express.Request
): string {
  const origin = resolveRequestOrigin(req);
  const cleanPath = req.path || '/';
  const canonicalUrl = `${origin}${cleanPath}`;

  if (!track) {
    return injectArtistSeoHtml(html, null, 0, req);
  }

  const safeTrack = String(track.title || 'Track').trim();
  const safeArtist = String(track.artistName || artist?.name || 'Independent Artist').trim();
  const title = formatTrackShareTitle(safeTrack, safeArtist);

  const rawStory = typeof track.story === 'string' ? track.story.replace(/\s+/g, ' ').trim() : '';
  const description = truncateSeoText(
    rawStory ||
      `Stream "${safeTrack}" by ${safeArtist} (${track.genre || 'Independent Music'}) on LOWERVIBE. Listen offline, share, and support creators directly.`,
    160
  );
  const trackCoverPath = track.id
    ? `/og/track/${encodeURIComponent(String(track.id))}/cover`
    : undefined;
  const rawTrackImg = pickFirstValidArtworkCandidate([
    track.coverArt,
    artist?.avatar,
    track.artistAvatar,
    artist?.banner,
  ]);
  const image = resolveSeoPublicImage(rawTrackImg, origin, trackCoverPath);
  const imageMime = inferImageMimeType(image, image.includes('/og/') ? 'image/jpeg' : 'image/png');
  const durationSeconds = Math.round(
    Number(track.durationSeconds || track.metadata?.duration || track.metadata?.Duration || 0)
  );
  const isoDuration = formatIsoDuration(durationSeconds);
  const artistSlugOrId = String(artist?.slug || track.artistId || '').trim();
  const artistUrl = artistSlugOrId ? `${origin}/artists/${encodeURIComponent(artistSlugOrId)}` : '';
  const audioUrl = resolveSeoPublicAudio(track.audioUrl, origin);
  const datePublished =
    typeof track.releaseDate === 'string' && track.releaseDate.trim()
      ? track.releaseDate.trim().slice(0, 10)
      : undefined;

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: safeTrack,
    byArtist: {
      '@type': 'MusicGroup',
      name: safeArtist,
      ...(artistUrl ? { url: artistUrl } : {}),
    },
    genre: track.genre || 'Independent',
    url: canonicalUrl,
    image,
    description,
    ...(isoDuration ? { duration: isoDuration } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(typeof track.plays === 'number' && track.plays > 0
      ? {
          interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/ListenAction',
            userInteractionCount: track.plays,
          },
        }
      : {}),
  };

  const imageAlt = `${safeTrack} cover artwork`;
  const headTags: string[] = [
    `<title>${escapeHtmlAttr(title)}</title>`,
    `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta name="description" content="${escapeHtmlAttr(description)}" />`,
    `<meta property="og:type" content="music.song" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:site_name" content="LOWERVIBE" />`,
    `<meta property="og:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(image)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtmlAttr(image)}" />`,
    `<meta property="og:image:type" content="${escapeHtmlAttr(imageMime)}" />`,
    `<meta property="og:image:width" content="512" />`,
    `<meta property="og:image:height" content="512" />`,
    `<meta property="og:image:alt" content="${escapeHtmlAttr(imageAlt)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`,
  ];

  if (artistUrl) {
    headTags.push(`<meta property="music:musician" content="${escapeHtmlAttr(artistUrl)}" />`);
  }
  if (durationSeconds > 0) {
    headTags.push(`<meta property="music:duration" content="${durationSeconds}" />`);
  }
  if (audioUrl) {
    headTags.push(`<meta property="og:audio" content="${escapeHtmlAttr(audioUrl)}" />`);
    headTags.push(`<meta property="og:audio:type" content="${inferAudioMimeType(audioUrl)}" />`);
  }

  headTags.push(
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(image)}" />`,
    `<meta name="twitter:image:src" content="${escapeHtmlAttr(image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtmlAttr(imageAlt)}" />`,
    `<script id="lv-structured-data" type="application/ld+json">${escapeJsonLd(structuredData)}</script>`
  );

  const stripped = stripExistingSeoTags(html);
  return stripped.replace('</head>', `    ${headTags.join('\n    ')}\n  </head>`);
}

let sitemapCache: { expiresAt: number; xml: string; origin: string } | null = null;

async function buildDynamicSitemapXml(origin: string): Promise<string> {
  if (sitemapCache && sitemapCache.expiresAt > Date.now() && sitemapCache.origin === origin) {
    return sitemapCache.xml;
  }

  const today = new Date().toISOString().split('T')[0];
  const seenLocs = new Set<string>();
  const urls: Array<{ loc: string; changefreq: string; priority: string; lastmod?: string }> = [];

  const pushUrl = (entry: { loc: string; changefreq: string; priority: string; lastmod?: string }) => {
    if (seenLocs.has(entry.loc)) return;
    seenLocs.add(entry.loc);
    urls.push(entry);
  };

  [
    { loc: `${origin}/`, changefreq: 'daily', priority: '1.0', lastmod: today },
    { loc: `${origin}/charts`, changefreq: 'daily', priority: '0.95', lastmod: today },
    { loc: `${origin}/discover`, changefreq: 'daily', priority: '0.9', lastmod: today },
    { loc: `${origin}/artists`, changefreq: 'daily', priority: '0.9', lastmod: today },
    { loc: `${origin}/search`, changefreq: 'weekly', priority: '0.7', lastmod: today },
    { loc: `${origin}/library`, changefreq: 'weekly', priority: '0.6', lastmod: today },
    { loc: `${origin}/artistcreator`, changefreq: 'weekly', priority: '0.7', lastmod: today },
    { loc: `${origin}/terms`, changefreq: 'monthly', priority: '0.4', lastmod: today },
    { loc: `${origin}/privacy`, changefreq: 'monthly', priority: '0.4', lastmod: today },
    { loc: `${origin}/copyright`, changefreq: 'monthly', priority: '0.4', lastmod: today },
    { loc: `${origin}/thank-you`, changefreq: 'monthly', priority: '0.3', lastmod: today },
  ].forEach(pushUrl);

  try {
    const [artistDocs, trackDocs] = await Promise.all([
      firestoreRunListQueryRest('artists', 200),
      firestoreRunListQueryRest('tracks', 300),
    ]);

    for (const artist of artistDocs) {
      if (isExcludedDemoArtistRecord(artist)) continue;
      const slugOrId = String(artist.slug || artist.id || '').trim();
      if (!slugOrId) continue;
      pushUrl({
        loc: `${origin}/artists/${encodeURIComponent(slugOrId)}`,
        changefreq: 'weekly',
        priority: '0.8',
        lastmod: String(artist.__updateTime || today).slice(0, 10),
      });
    }

    for (const track of trackDocs) {
      if (track.isDraft || track.isDeranked) continue;
      if (isExcludedDemoArtistRecord({ id: track.artistId, name: track.artistName })) continue;
      const docId = String(track.id || '').trim();
      if (!docId) continue;
      pushUrl({
        loc: `${origin}/tracks/${encodeURIComponent(docId)}`,
        changefreq: 'weekly',
        priority: '0.7',
        lastmod: String(track.__updateTime || today).slice(0, 10),
      });
    }
  } catch {}

  const entries = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${escapeHtmlAttr(u.loc)}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  sitemapCache = {
    expiresAt: Date.now() + 60_000,
    xml,
    origin,
  };
  return xml;
}

function signTokenPayload(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SERVER_SIGNING_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyTokenSignature(tokenSignature: string): { valid: boolean; payload?: Record<string, unknown> } {
  if (!tokenSignature || !tokenSignature.includes('.')) return { valid: false };
  const [encoded, sig] = tokenSignature.split('.');
  if (!encoded || !sig) return { valid: false };
  const expectedSig = crypto
    .createHmac('sha256', SERVER_SIGNING_SECRET)
    .update(encoded)
    .digest('base64url');
  if (sig.length !== expectedSig.length) return { valid: false };
  const matches = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  if (!matches) return { valid: false };
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

function isSafeMediaId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{4,128}$/.test(id);
}

interface MediaMeta {
  id: string;
  contentType: string;
  sizeBytes: number;
  ownerId?: string;
  createdAt: string;
}

async function fetchMediaFromFirestoreRest(assetId: string): Promise<{ buffer: Buffer; meta: MediaMeta } | null> {
  try {
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;
    const docRes = await fetch(`${baseUrl}/mediaAssets/${encodeURIComponent(assetId)}`);
    if (!docRes.ok) return null;
    const docJson = (await docRes.json()) as {
      fields?: {
        contentType?: { stringValue?: string };
        dataBase64?: { stringValue?: string };
        chunkCount?: { integerValue?: string; doubleValue?: number };
        sizeBytes?: { integerValue?: string; doubleValue?: number };
        ownerId?: { stringValue?: string };
        createdAt?: { stringValue?: string };
      };
    };
    const fields = docJson.fields;
    if (!fields) return null;

    const contentType = fields.contentType?.stringValue || 'application/octet-stream';
    const createdAt = fields.createdAt?.stringValue || new Date().toISOString();
    const ownerId = fields.ownerId?.stringValue;

    let buffer: Buffer | null = null;
    if (fields.dataBase64?.stringValue) {
      buffer = Buffer.from(fields.dataBase64.stringValue, 'base64');
    } else {
      const chunkCountRaw = fields.chunkCount?.integerValue ?? fields.chunkCount?.doubleValue ?? 0;
      const chunkCount = Number(chunkCountRaw);
      if (chunkCount > 0) {
        const parts: Buffer[] = [];
        const batchSize = 6;
        for (let start = 0; start < chunkCount; start += batchSize) {
          const end = Math.min(chunkCount, start + batchSize);
          const indices = Array.from({ length: end - start }, (_, k) => start + k);
          const batchBuffers = await Promise.all(
            indices.map(async (idx) => {
              const cRes = await fetch(
                `${baseUrl}/mediaAssets/${encodeURIComponent(assetId)}/chunks/${idx}`
              );
              if (!cRes.ok) {
                throw new Error(`Missing chunk ${idx}`);
              }
              const cJson = (await cRes.json()) as {
                fields?: { dataBase64?: { stringValue?: string } };
              };
              const b64 = cJson.fields?.dataBase64?.stringValue;
              if (!b64) throw new Error(`Empty chunk ${idx}`);
              return Buffer.from(b64, 'base64');
            })
          );
          parts.push(...batchBuffers);
        }
        buffer = Buffer.concat(parts);
      }
    }

    if (!buffer || buffer.length === 0) return null;

    const meta: MediaMeta = {
      id: assetId,
      contentType,
      sizeBytes: buffer.length,
      ownerId,
      createdAt,
    };

    try {
      fs.writeFileSync(path.join(MEDIA_DIR, `${assetId}.bin`), buffer);
      fs.writeFileSync(path.join(MEDIA_DIR, `${assetId}.meta.json`), JSON.stringify(meta));
    } catch {}

    return { buffer, meta };
  } catch {
    return null;
  }
}

interface OtpRecord {
  hash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const otpStore = new Map<string, OtpRecord>();
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

type EmailTransporter = ReturnType<typeof nodemailer.createTransport>;

let cachedTransporter: EmailTransporter | null = null;
let cachedMode: 'smtp' | 'ethereal' = 'ethereal';

async function getEmailTransporter(): Promise<{
  transporter: EmailTransporter;
  mode: 'smtp' | 'ethereal';
}> {
  if (cachedTransporter) {
    return { transporter: cachedTransporter, mode: cachedMode };
  }

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  if (host && user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    cachedMode = 'smtp';
    return { transporter: cachedTransporter, mode: cachedMode };
  }

  const testAccount = await nodemailer.createTestAccount();
  cachedTransporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  cachedMode = 'ethereal';
  return { transporter: cachedTransporter, mode: cachedMode };
}

function hashOtp(email: string, code: string): string {
  return crypto.createHash('sha256').update(`${email.toLowerCase()}:${code}`).digest('hex');
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '1mb' }));

  // Sliding-window bounded per-IP rate limiter for API routes
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const MAX_RATE_BUCKETS = 25000;
  const bucketCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateBuckets.entries()) {
      if (entry.resetAt <= now) {
        rateBuckets.delete(key);
      }
    }
  }, 60_000);
  if (typeof bucketCleanupTimer.unref === 'function') {
    bucketCleanupTimer.unref();
  }

  app.use('/api', (req, res, next) => {
    // Allow media chunk streaming / GET fetches high throughput while bounding abuse
    const isStrictSensitive =
      req.path.startsWith('/auth/') || req.path.startsWith('/payouts/') || req.path.startsWith('/monetization/');
    const windowMs = 60_000;
    const maxReq = isStrictSensitive ? 30 : req.method === 'GET' ? 240 : 120;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const bucketKey = `${isStrictSensitive ? 'strict' : 'std'}:${clientIp}`;
    const now = Date.now();

    let bucket = rateBuckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 1, resetAt: now + windowMs };
      setBoundedMapEntry(rateBuckets, bucketKey, bucket, MAX_RATE_BUCKETS);
      return next();
    }

    bucket.count += 1;
    if (bucket.count > maxReq) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        ok: false,
        error: 'Too many requests. Please wait a moment and try again.',
      });
      return;
    }
    return next();
  });

  // 1. Health check endpoint
  app.get('/health', (_req, res) => {
    const mem = process.memoryUsage();
    res.status(200).json({
      ok: true,
      status: 'healthy',
      db: 'firestore',
      auth: 'firebase+otp',
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssMb: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
      cacheEntries: {
        seoArtists: seoArtistCache.size,
        seoTracks: seoTrackCache.size,
        rateBuckets: rateBuckets.size,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 2. API Status endpoint (clean runtime metadata — zero demo data)
  app.get('/api/status', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'LOWERVIBE Audio Engine',
      version: '2026.5.0',
      environment: isProduction ? 'production' : 'development',
      catalog: {
        bitDepth: '24-bit / 96kHz Lossless FLAC',
        storage: 'firestore+media',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 2b. Fast Chunked Resumable Media Upload Endpoint
  app.post(
    '/api/media/upload-chunk',
    express.raw({ type: 'application/octet-stream', limit: '4mb' }),
    (req, res) => {
      try {
        const assetId = String(req.query.assetId || req.header('x-asset-id') || '').trim();
        const chunkIndex = parseInt(String(req.query.chunkIndex ?? req.header('x-chunk-index') ?? '0'), 10);
        const totalChunks = parseInt(String(req.query.totalChunks ?? req.header('x-total-chunks') ?? '1'), 10);
        const contentType = String(
          req.query.contentType || req.header('x-media-content-type') || 'application/octet-stream'
        ).slice(0, 120);
        const ownerId = String(req.query.ownerId || req.header('x-owner-id') || '').slice(0, 128);

        if (!isSafeMediaId(assetId)) {
          res.status(400).json({ ok: false, error: 'Invalid media asset identifier.' });
          return;
        }
        if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || !Number.isInteger(totalChunks) || totalChunks < 1 || chunkIndex >= totalChunks) {
          res.status(400).json({ ok: false, error: 'Invalid chunk index or count.' });
          return;
        }

        const chunkBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (chunkBuffer.length === 0) {
          res.status(400).json({ ok: false, error: 'Empty upload chunk received.' });
          return;
        }

        const finalFilePath = path.join(MEDIA_DIR, `${assetId}.bin`);
        const metaPath = path.join(MEDIA_DIR, `${assetId}.meta.json`);

        if (totalChunks === 1) {
          fs.writeFileSync(finalFilePath, chunkBuffer);
          const meta: MediaMeta = {
            id: assetId,
            contentType,
            sizeBytes: chunkBuffer.length,
            ownerId,
            createdAt: new Date().toISOString(),
          };
          fs.writeFileSync(metaPath, JSON.stringify(meta));
          res.status(200).json({
            ok: true,
            completed: true,
            assetId,
            url: `/api/media/${assetId}`,
            bytes: chunkBuffer.length,
            contentType,
          });
          return;
        }

        const partDir = path.join(MEDIA_PARTS_DIR, assetId);
        fs.mkdirSync(partDir, { recursive: true });
        fs.writeFileSync(path.join(partDir, `${chunkIndex}.part`), chunkBuffer);

        const parts = fs.readdirSync(partDir);
        if (parts.length < totalChunks) {
          res.status(200).json({
            ok: true,
            completed: false,
            assetId,
            chunkIndex,
            receivedParts: parts.length,
            totalChunks,
          });
          return;
        }

        // Assemble all chunks cleanly in order into a temp file then atomically rename
        const tmpFinalPath = path.join(MEDIA_DIR, `.assembling_${assetId}.bin`);
        const fd = fs.openSync(tmpFinalPath, 'w');
        let totalSize = 0;
        try {
          for (let i = 0; i < totalChunks; i++) {
            const partFile = path.join(partDir, `${i}.part`);
            const data = fs.readFileSync(partFile);
            fs.writeSync(fd, data, 0, data.length, totalSize);
            totalSize += data.length;
          }
        } finally {
          fs.closeSync(fd);
        }
        fs.renameSync(tmpFinalPath, finalFilePath);

        const meta: MediaMeta = {
          id: assetId,
          contentType,
          sizeBytes: totalSize,
          ownerId,
          createdAt: new Date().toISOString(),
        };
        try {
          fs.writeFileSync(metaPath, JSON.stringify(meta));
          fs.rmSync(partDir, { recursive: true, force: true });
        } catch {}

        res.status(200).json({
          ok: true,
          completed: true,
          assetId,
          url: `/api/media/${assetId}`,
          bytes: totalSize,
          contentType,
        });
      } catch (err) {
        console.error('[LOWERVIBE] Media chunk upload error:', err);
        res.status(500).json({
          ok: false,
          error: err instanceof Error ? err.message : 'Media upload failed on server.',
        });
      }
    }
  );

  // 2c. Serve Media with HTTP Range (206 Partial Content) + Firestore REST Fallback
  app.get('/api/media/:assetId', async (req, res) => {
    const assetId = String(req.params.assetId || '').trim();
    if (!isSafeMediaId(assetId)) {
      res.status(400).send('Invalid media identifier.');
      return;
    }

    const filePath = path.join(MEDIA_DIR, `${assetId}.bin`);
    const metaPath = path.join(MEDIA_DIR, `${assetId}.meta.json`);

    let meta: MediaMeta | null = null;
    if (fs.existsSync(filePath) && fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as MediaMeta;
      } catch {}
    }

    if (!meta || !fs.existsSync(filePath)) {
      const recovered = await fetchMediaFromFirestoreRest(assetId);
      if (!recovered) {
        res.status(404).send('Media asset not found.');
        return;
      }
      meta = recovered.meta;
    }

    const stat = fs.statSync(filePath);
    const totalSize = stat.size;
    const contentType = meta.contentType || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(totalSize - 1, parseInt(match[2], 10)) : totalSize - 1;
        if (start >= totalSize || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
          return;
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', String(end - start + 1));
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.status(200);
    res.setHeader('Content-Length', String(totalSize));
    fs.createReadStream(filePath).pipe(res);
  });

  app.delete('/api/media/:assetId', (req, res) => {
    const assetId = String(req.params.assetId || '').trim();
    if (!isSafeMediaId(assetId)) {
      res.status(400).json({ ok: false });
      return;
    }
    try {
      fs.rmSync(path.join(MEDIA_DIR, `${assetId}.bin`), { force: true });
      fs.rmSync(path.join(MEDIA_DIR, `${assetId}.meta.json`), { force: true });
      fs.rmSync(path.join(MEDIA_PARTS_DIR, assetId), { recursive: true, force: true });
    } catch {}
    res.status(200).json({ ok: true });
  });

  // 3. Real Test-Email OTP Dispatch (never exposes raw OTP in JSON response)
  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const cleanEmail = rawEmail.toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ ok: false, error: 'Please provide a valid email address.' });
        return;
      }

      const existing = otpStore.get(cleanEmail);
      const now = Date.now();
      if (existing && now - existing.lastSentAt < 10_000) {
        res.status(429).json({
          ok: false,
          error: 'Please wait a few seconds before requesting another verification email.',
        });
        return;
      }

      const code = crypto.randomInt(100000, 1000000).toString();
      setBoundedMapEntry(
        otpStore,
        cleanEmail,
        {
          hash: hashOtp(cleanEmail, code),
          expiresAt: now + OTP_TTL_MS,
          attempts: 0,
          lastSentAt: now,
        },
        10000
      );

      const { transporter, mode } = await getEmailTransporter();
      const fromAddress = process.env.SMTP_FROM || 'LOWERVIBE <no-reply@lowervibe.fm>';

      const info = await transporter.sendMail({
        from: fromAddress,
        to: rawEmail,
        subject: 'Your LOWERVIBE Verification Code',
        text: `Your LOWERVIBE 6-digit verification code is: ${code}\n\nThis code expires in 10 minutes. If you did not request this, you can ignore this email.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#08080B; color:#F5F5FA; padding:32px; border-radius:16px; max-width:480px; margin:0 auto;">
            <p style="font-size:12px; letter-spacing:0.14em; color:#C6FF4A; text-transform:uppercase; font-weight:700; margin:0 0 8px;">LOWERVIBE SECURITY</p>
            <h1 style="font-size:22px; margin:0 0 12px; color:#FFFFFF;">Verify your email address</h1>
            <p style="font-size:14px; line-height:1.6; color:#A0A0A8; margin:0 0 24px;">
              Enter the 6-digit security code below to complete your sign-in on LOWERVIBE:
            </p>
            <div style="background:#121218; border:1px solid rgba(198,255,74,0.35); border-radius:12px; padding:18px; text-align:center; margin:0 0 24px;">
              <span style="font-family:monospace; font-size:32px; font-weight:800; letter-spacing:0.25em; color:#C6FF4A;">${code}</span>
            </div>
            <p style="font-size:12px; color:#7A7A88; margin:0;">
              Valid for 10 minutes. Never share this code with anyone.
            </p>
          </div>
        `,
      });

      const rawPreviewUrl = nodemailer.getTestMessageUrl(info);
      const previewUrl = typeof rawPreviewUrl === 'string' ? rawPreviewUrl : null;

      if (previewUrl) {
        console.log(`[LOWERVIBE OTP] Ethereal inbox preview for ${cleanEmail}: ${previewUrl}`);
      }

      res.status(200).json({
        ok: true,
        mode,
        previewUrl,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      });
    } catch (err) {
      console.error('[LOWERVIBE] Failed to send OTP email:', err);
      res.status(500).json({
        ok: false,
        error: 'Unable to dispatch verification email right now. Please try again.',
      });
    }
  });

  // 4. Server-Side OTP Verification
  app.post('/api/auth/verify-otp', (req, res) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

    if (!rawEmail || !/^\d{6}$/.test(rawCode)) {
      res.status(400).json({ ok: false, verified: false, error: 'Enter the 6-digit code from your email.' });
      return;
    }

    const record = otpStore.get(rawEmail);
    if (!record) {
      res.status(400).json({ ok: false, verified: false, error: 'No active verification code found. Request a new email.' });
      return;
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(rawEmail);
      res.status(400).json({ ok: false, verified: false, error: 'Verification code expired. Request a new code.' });
      return;
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      otpStore.delete(rawEmail);
      res.status(429).json({ ok: false, verified: false, error: 'Too many incorrect attempts. Request a new email.' });
      return;
    }

    const candidateHash = hashOtp(rawEmail, rawCode);
    const matches = crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(record.hash));
    if (!matches) {
      record.attempts += 1;
      otpStore.set(rawEmail, record);
      res.status(401).json({
        ok: false,
        verified: false,
        error: `Invalid code. ${MAX_VERIFY_ATTEMPTS - record.attempts} attempt(s) remaining.`,
      });
      return;
    }

    otpStore.delete(rawEmail);
    res.status(200).json({ ok: true, verified: true });
  });

  // 4b. Real Backend Monetization Approval Token Generator
  app.post('/api/monetization/approve-token', async (req, res) => {
    try {
      const authUser = await verifyFirebaseBearerToken(req);
      if (!authUser) {
        res.status(401).json({ ok: false, error: 'Unauthorized: valid Firebase sign-in token required.' });
        return;
      }

      const artistId = String(req.body?.artistId || '').trim();
      if (!isSafeMediaId(artistId)) {
        res.status(400).json({ ok: false, error: 'Invalid artistId.' });
        return;
      }

      const [artistDoc, configDoc, artistTracks] = await Promise.all([
        firestoreGetDocRest(`artists/${encodeURIComponent(artistId)}`, authUser.idToken),
        firestoreGetDocRest('config/platform', authUser.idToken),
        firestoreQueryEqualsRest('tracks', 'artistId', artistId, authUser.idToken),
      ]);

      if (!artistDoc) {
        res.status(404).json({ ok: false, error: 'Artist record not found in Firestore.' });
        return;
      }

      const isAdmin =
        authUser.email === PRIMARY_ADMIN_EMAIL &&
        authUser.emailVerified &&
        authUser.isGoogleProvider;
      const isArtistOwner =
        artistDoc.ownerId === authUser.uid ||
        artistDoc.ownerUserId === authUser.uid ||
        artistDoc.claimedByUserId === authUser.uid;

      if (!isAdmin && !isArtistOwner) {
        res.status(403).json({
          ok: false,
          error: 'Forbidden: only the artist owner or verified administrator can request an approval token.',
        });
        return;
      }

      if (artistDoc.monetizationStatus === 'suspended' && !isAdmin) {
        res.status(403).json({
          ok: false,
          error: artistDoc.monetizationRevokedReason || 'Monetization is suspended.',
        });
        return;
      }

      const reqPublishedTracks = Number(configDoc?.requiredPublishedTracks ?? 3);
      const reqPlays30d = Number(configDoc?.requiredPlays30d ?? 500);
      const reqFollowers = Number(configDoc?.requiredFollowers ?? 50);
      const maxStrikes = Number(configDoc?.maxActiveStrikes ?? 0);

      const publishedTracks = artistTracks.filter((t) => !t.isDraft && !t.isDeranked);
      const totalPlays = publishedTracks.reduce((sum, t) => sum + Number(t.plays || 0), 0);
      const followersCount = Number(artistDoc.followersCount || 0);
      const copyrightStrikes = Number(artistDoc.copyrightStrikes || 0);

      if (!isAdmin) {
        if (
          publishedTracks.length < reqPublishedTracks ||
          totalPlays < reqPlays30d ||
          followersCount < reqFollowers ||
          copyrightStrikes > maxStrikes
        ) {
          res.status(403).json({
            ok: false,
            error: `Eligibility criteria not met yet (${publishedTracks.length}/${reqPublishedTracks} tracks, ${totalPlays}/${reqPlays30d} plays, ${followersCount}/${reqFollowers} followers, ${copyrightStrikes} strikes).`,
          });
          return;
        }
      }

      const issuedAt = new Date().toISOString();
      const shortHex = crypto.randomBytes(4).toString('hex').toUpperCase();
      const artistTag = artistId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'LV';
      const approvalToken = `LV-APP-${artistTag}-${shortHex}`;
      const approvedBy = isAdmin ? authUser.email : 'auto-eligibility';

      const payload = {
        v: 1,
        kind: 'LV_MON_APPROVAL',
        jti: approvalToken,
        artistId,
        uid: authUser.uid,
        approvedBy,
        issuedAt,
        criteriaSnapshot: {
          publishedTracks: publishedTracks.length,
          totalPlays,
          followersCount,
          copyrightStrikes,
        },
      };
      const tokenSignature = signTokenPayload(payload);

      const existingLedger = readJsonArray<Record<string, unknown>>(APPROVAL_LEDGER_PATH).filter(
        (row) => row.artistId !== artistId
      );
      existingLedger.unshift({
        approvalToken,
        tokenSignature,
        ...payload,
      });
      writeJsonArray(APPROVAL_LEDGER_PATH, existingLedger.slice(0, 1000));

      res.status(200).json({
        ok: true,
        approvalToken,
        tokenSignature,
        issuedAt,
        approvedBy,
        criteriaSnapshot: payload.criteriaSnapshot,
      });
    } catch (err) {
      console.error('[LOWERVIBE] Approve token error:', err);
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Approval token generation failed.',
      });
    }
  });

  // 4c. Real Backend Payout Settlement Token Generator (Server-Verified Balance & Eligibility)
  app.post('/api/payouts/generate-token', async (req, res) => {
    try {
      const authUser = await verifyFirebaseBearerToken(req);
      if (!authUser) {
        res.status(401).json({ ok: false, error: 'Unauthorized: valid Firebase sign-in token required.' });
        return;
      }

      const artistId = String(req.body?.artistId || '').trim();
      const payoutMethodId = String(req.body?.payoutMethodId || '').trim();
      const grossAmountMwk = Math.round(Number(req.body?.grossAmountMwk || 0));

      if (!isSafeMediaId(artistId) || !isSafeMediaId(payoutMethodId)) {
        res.status(400).json({ ok: false, error: 'Invalid artist or payout method identifier.' });
        return;
      }
      if (!Number.isFinite(grossAmountMwk) || grossAmountMwk <= 0) {
        res.status(400).json({ ok: false, error: 'Enter a valid positive withdrawal amount.' });
        return;
      }

      const [artistDoc, methodDoc, configDoc, artistTracks, priorRequests] = await Promise.all([
        firestoreGetDocRest(`artists/${encodeURIComponent(artistId)}`, authUser.idToken),
        firestoreGetDocRest(`payoutMethods/${encodeURIComponent(payoutMethodId)}`, authUser.idToken),
        firestoreGetDocRest('config/platform', authUser.idToken),
        firestoreQueryEqualsRest('tracks', 'artistId', artistId, authUser.idToken),
        firestoreQueryEqualsRest('payoutRequests', 'artistId', artistId, authUser.idToken),
      ]);

      if (!artistDoc) {
        res.status(404).json({ ok: false, error: 'Artist profile not found.' });
        return;
      }
      if (!methodDoc) {
        res.status(404).json({ ok: false, error: 'Payout method not found.' });
        return;
      }

      const isAdmin =
        authUser.email === PRIMARY_ADMIN_EMAIL &&
        authUser.emailVerified &&
        authUser.isGoogleProvider;
      const isArtistOwner =
        artistDoc.ownerId === authUser.uid ||
        artistDoc.ownerUserId === authUser.uid ||
        artistDoc.claimedByUserId === authUser.uid;
      if ((!isArtistOwner && !isAdmin) || (methodDoc.userId !== authUser.uid && !isAdmin)) {
        res.status(403).json({ ok: false, error: 'Forbidden: ownership check failed.' });
        return;
      }

      if (!artistDoc.isMonetized && artistDoc.monetizationStatus !== 'approved') {
        res.status(403).json({ ok: false, error: 'Artist monetization is not approved yet.' });
        return;
      }

      if (
        methodDoc.status !== 'accepted' &&
        methodDoc.payoutHoldUntil &&
        new Date(String(methodDoc.payoutHoldUntil)).getTime() > Date.now()
      ) {
        res.status(403).json({ ok: false, error: 'Selected payout method is still in security hold.' });
        return;
      }

      const ratePerPlayMwk = Number(configDoc?.ratePerPlayMwk ?? 4.5);
      const minWithdrawalMwk = Number(configDoc?.minWithdrawalMwk ?? 20000);
      const payoutFeePercent = Number(configDoc?.payoutFeePercent ?? 2.5);
      const providerConfigured = Boolean(
        configDoc?.payoutProviderConfigured || process.env.PAYOUT_WEBHOOK_URL?.trim()
      );

      if (grossAmountMwk < minWithdrawalMwk) {
        res.status(400).json({
          ok: false,
          error: `Minimum withdrawal is ${minWithdrawalMwk.toLocaleString()} MWK.`,
        });
        return;
      }

      // Compute verified server-side balance from non-draft track plays and prior withdrawals
      const verifiedPlays = artistTracks
        .filter((t) => !t.isDraft && !t.isDeranked)
        .reduce((sum, t) => sum + Number(t.plays || 0), 0);
      const computedGrossLifetime = Math.round(verifiedPlays * ratePerPlayMwk);
      const storedLifetime = Number(artistDoc.lifetimeEarningsMwk ?? artistDoc.earningsBalanceMwk ?? 0);
      const effectiveLifetime = Math.max(computedGrossLifetime, storedLifetime);

      const priorCommittedMwk = priorRequests
        .filter((r) => r.status !== 'failed')
        .reduce((sum, r) => sum + Number(r.grossAmountMwk || 0), 0);

      const availableBalanceBeforeMwk = Math.max(0, Math.round(effectiveLifetime - priorCommittedMwk));
      if (grossAmountMwk > availableBalanceBeforeMwk) {
        res.status(400).json({
          ok: false,
          error: `Insufficient verified balance. Available to withdraw: ${availableBalanceBeforeMwk.toLocaleString()} MWK.`,
        });
        return;
      }

      const feeMwk = Math.round((grossAmountMwk * payoutFeePercent) / 100);
      const netAmountMwk = Math.max(0, grossAmountMwk - feeMwk);
      const issuedAt = new Date().toISOString();
      const requestId = `po-${Date.now()}`;
      const payHex = crypto.randomBytes(4).toString('hex').toUpperCase();
      const payoutToken = `LV-PAY-${payHex}`;
      const txRef = `TXN-LV-${Date.now().toString().slice(-6)}-${payHex.slice(0, 4)}`;

      let finalStatus: 'awaiting_review' | 'processing' = providerConfigured
        ? 'processing'
        : 'awaiting_review';
      let settlementVerified = false;

      const payload = {
        v: 1,
        kind: 'LV_PAYOUT_SETTLEMENT',
        jti: payoutToken,
        requestId,
        txRef,
        artistId,
        uid: authUser.uid,
        payoutMethodId,
        payoutProvider: methodDoc.type || 'mobile_money',
        grossAmountMwk,
        feeMwk,
        netAmountMwk,
        issuedAt,
      };
      const tokenSignature = signTokenPayload(payload);

      // Optional real disbursement webhook dispatch if configured via environment secret
      const webhookUrl = process.env.PAYOUT_WEBHOOK_URL?.trim();
      if (webhookUrl) {
        try {
          const hookRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Lowervibe-Signature': tokenSignature,
            },
            body: JSON.stringify({
              ...payload,
              destination: methodDoc.rawDestination || methodDoc.maskedIdentifier,
              accountHolderName: methodDoc.accountHolderName,
            }),
          });
          if (hookRes.ok) {
            finalStatus = 'processing';
            settlementVerified = true;
          }
        } catch (hookErr) {
          console.warn('[LOWERVIBE] External disbursement webhook warning:', hookErr);
        }
      }

      const payoutLedger = readJsonArray<Record<string, unknown>>(PAYOUT_LEDGER_PATH);
      payoutLedger.unshift({
        ...payload,
        tokenSignature,
        status: finalStatus,
        settlementVerified,
        providerConfigured,
        availableBalanceBeforeMwk,
      });
      writeJsonArray(PAYOUT_LEDGER_PATH, payoutLedger.slice(0, 2000));

      res.status(200).json({
        ok: true,
        requestId,
        payoutToken,
        tokenSignature,
        txRef,
        grossAmountMwk,
        feeMwk,
        netAmountMwk,
        availableBalanceBeforeMwk,
        status: finalStatus,
        settlementVerified,
        providerConfigured,
        issuedAt,
      });
    } catch (err) {
      console.error('[LOWERVIBE] Payout token generator error:', err);
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to generate payout token.',
      });
    }
  });

  // 4d. Cryptographic Token Verification Endpoint (verifies LV-APP & LV-PAY HMAC signatures)
  app.post('/api/payouts/verify-token', (req, res) => {
    const tokenSignature = String(req.body?.tokenSignature || '').trim();
    if (!tokenSignature) {
      res.status(400).json({ ok: false, valid: false, error: 'Missing tokenSignature.' });
      return;
    }

    const result = verifyTokenSignature(tokenSignature);
    if (!result.valid || !result.payload) {
      res.status(200).json({ ok: true, valid: false, error: 'Invalid or tampered token signature.' });
      return;
    }

    res.status(200).json({
      ok: true,
      valid: true,
      payload: result.payload,
    });
  });

  // 4e. Durable Write-Ahead Sync Event Mirror (async buffered for zero event-loop blocking)
  app.post('/api/sync/record', (req, res) => {
    try {
      const collection = String(req.body?.collection || '').slice(0, 64);
      const docId = String(req.body?.docId || '').slice(0, 128);
      const mode = String(req.body?.mode || 'set').slice(0, 16);
      const timestamp = String(req.body?.timestamp || new Date().toISOString()).slice(0, 40);

      if (!collection || !docId) {
        res.status(400).json({ ok: false });
        return;
      }

      syncEventRing.push({
        collection,
        docId,
        mode,
        timestamp,
        summary: req.body?.summary || null,
      });
      res.status(200).json({ ok: true });
    } catch {
      res.status(200).json({ ok: true });
    }
  });

  // 4e-2. Server-Validated Real Plays Recording (30s or 50% rule + 1-hour per-user dedupe)
  const playsLedgerCache = readJsonArray<Record<string, unknown>>(PLAYS_LEDGER_PATH);
  const recordedPlayDedupeKeys = new Map<string, number>();
  for (const row of playsLedgerCache) {
    if (typeof row.dedupeKey === 'string' && typeof row.windowKey === 'number') {
      recordedPlayDedupeKeys.set(row.dedupeKey, row.windowKey);
    }
  }

  app.post('/api/plays/record', async (req, res) => {
    try {
      const authUser = await verifyFirebaseBearerToken(req);
      if (!authUser) {
        res.status(401).json({ ok: false, error: 'Unauthorized: sign in required to count real plays.' });
        return;
      }

      const trackId = String(req.body?.trackId || '').trim();
      const listenedSecondsRaw = Number(req.body?.listenedSeconds ?? 0);
      const durationSecondsRaw = Number(req.body?.durationSeconds ?? 0);
      const requestedCountry = String(req.body?.country || '').trim().slice(0, 64);

      if (!isSafeMediaId(trackId)) {
        res.status(400).json({ ok: false, error: 'Invalid trackId.' });
        return;
      }
      if (!Number.isFinite(listenedSecondsRaw) || listenedSecondsRaw < 0 || listenedSecondsRaw > 86400) {
        res.status(400).json({ ok: false, error: 'Invalid listenedSeconds.' });
        return;
      }

      const trackDoc = await firestoreGetDocRest(`tracks/${encodeURIComponent(trackId)}`, authUser.idToken);
      if (!trackDoc) {
        res.status(404).json({ ok: false, error: 'Track not found.' });
        return;
      }
      if (trackDoc.isDraft || trackDoc.isDeranked) {
        res.status(403).json({ ok: false, error: 'Unpublished tracks cannot accrue real plays.' });
        return;
      }

      const authoritativeDuration =
        Number(trackDoc.durationSeconds || 0) > 0
          ? Number(trackDoc.durationSeconds)
          : Number.isFinite(durationSecondsRaw) && durationSecondsRaw > 0
          ? durationSecondsRaw
          : 0;

      const minRequiredSeconds =
        authoritativeDuration > 0
          ? Math.min(30, Math.max(1, Math.floor(authoritativeDuration * 0.5)))
          : 30;

      const listenedSeconds = Math.round(listenedSecondsRaw);
      if (listenedSeconds < minRequiredSeconds) {
        res.status(200).json({
          ok: true,
          counted: false,
          reason: 'threshold_not_met',
          minRequiredSeconds,
        });
        return;
      }

      const currentHourWindow = Math.floor(Date.now() / (60 * 60 * 1000));
      const dedupeKey = `${authUser.uid}_${trackId}_${currentHourWindow}`;
      if (recordedPlayDedupeKeys.has(dedupeKey)) {
        res.status(200).json({
          ok: true,
          counted: false,
          reason: 'rate_limited_1h',
          windowKey: currentHourWindow,
        });
        return;
      }

      const artistId = String(trackDoc.artistId || '').trim();
      let isArtistSelfPlay = trackDoc.uploadedByUserId === authUser.uid;
      if (!isArtistSelfPlay && artistId && isSafeMediaId(artistId)) {
        const artistDoc = await firestoreGetDocRest(`artists/${encodeURIComponent(artistId)}`, authUser.idToken);
        if (
          artistDoc &&
          (artistDoc.ownerId === authUser.uid ||
            artistDoc.ownerUserId === authUser.uid ||
            artistDoc.claimedByUserId === authUser.uid)
        ) {
          isArtistSelfPlay = true;
        }
      }

      const regionKey =
        requestedCountry && requestedCountry !== 'Global'
          ? requestedCountry
          : String(trackDoc.region || 'Malawi');
      const safeRegionField = regionKey.replace(/[^a-zA-Z0-9_]/g, '_') || 'Malawi';
      const playId = `play-${dedupeKey}-${Date.now()}`;
      const playedAt = new Date().toISOString();

      const playPayload = {
        id: playId,
        trackId,
        artistId,
        userId: authUser.uid,
        country: regionKey,
        listenedSeconds: Math.max(minRequiredSeconds, listenedSeconds),
        windowKey: currentHourWindow,
        isArtistSelfPlay,
        qualifiesForPayout: !isArtistSelfPlay,
        playedAt,
      };

      const incrementWrites: Array<{ collection: string; docId: string; increments: Record<string, number> }> = [
        {
          collection: 'tracks',
          docId: trackId,
          increments: {
            plays: 1,
            [`regionStats.${safeRegionField}`]: 1,
          },
        },
      ];
      if (artistId && isSafeMediaId(artistId)) {
        incrementWrites.push({
          collection: 'artists',
          docId: artistId,
          increments: {
            totalStreams: 1,
            [`regionStats.${safeRegionField}`]: 1,
          },
        });
      }

      const [playCreated, countersUpdated] = await Promise.all([
        firestoreCreateDocRest('plays', playId, playPayload, authUser.idToken),
        firestoreIncrementFieldsRest(incrementWrites, authUser.idToken),
      ]);

      // Prune stale window keys > 2 hours old from memory
      for (const [k, win] of recordedPlayDedupeKeys.entries()) {
        if (win < currentHourWindow - 1) {
          recordedPlayDedupeKeys.delete(k);
        }
      }
      setBoundedMapEntry(recordedPlayDedupeKeys, dedupeKey, currentHourWindow, 10000);

      const ledgerRows = readJsonArray<Record<string, unknown>>(PLAYS_LEDGER_PATH);
      ledgerRows.unshift({ ...playPayload, dedupeKey });
      writeJsonArray(PLAYS_LEDGER_PATH, ledgerRows.slice(0, 5000));

      res.status(200).json({
        ok: true,
        counted: true,
        playId,
        windowKey: currentHourWindow,
        minRequiredSeconds,
        isArtistSelfPlay,
        firestorePersisted: playCreated && countersUpdated,
      });
    } catch (err) {
      console.error('[LOWERVIBE] Play record error:', err);
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to record play.',
      });
    }
  });

  // 4f. First-Party Analytics Event Ingestion & Summary (async buffered)
  app.post('/api/analytics/event', (req, res) => {
    try {
      const eventName = String(req.body?.event || '').trim().slice(0, 64);
      if (!eventName) {
        res.status(400).json({ ok: false, error: 'Missing event name' });
        return;
      }
      analyticsEventRing.push({
        event: eventName,
        path: String(req.body?.path || '/').slice(0, 160),
        title: String(req.body?.title || '').slice(0, 140),
        sessionId: String(req.body?.sessionId || 'anon').slice(0, 64),
        params:
          req.body?.params && typeof req.body.params === 'object' ? req.body.params : {},
        timestamp: String(req.body?.timestamp || new Date().toISOString()).slice(0, 40),
      });
      res.status(200).json({ ok: true });
    } catch {
      res.status(200).json({ ok: true });
    }
  });

  app.get('/api/analytics/summary', (_req, res) => {
    const events = analyticsEventRing.getAll() as Array<{
      event?: string;
      path?: string;
      sessionId?: string;
    }>;
    const sessions = new Set<string>();
    const byEvent: Record<string, number> = {};
    const byPath: Record<string, number> = {};
    for (const row of events) {
      if (row.sessionId) sessions.add(row.sessionId);
      if (row.event) byEvent[row.event] = (byEvent[row.event] || 0) + 1;
      if (row.path) byPath[row.path] = (byPath[row.path] || 0) + 1;
    }
    res.status(200).json({
      ok: true,
      totalEvents: events.length,
      uniqueSessions: sessions.size,
      byEvent,
      topPaths: Object.entries(byPath)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15),
    });
  });

  // 4g. Dynamic robots.txt and sitemap.xml for Search Indexing
  app.get('/robots.txt', (req, res) => {
    const origin = resolveRequestOrigin(req);
    const body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /administrationside',
      'Disallow: /administrationside/',
      'Disallow: /administration',
      'Disallow: /administration/',
      'Disallow: /admin',
      'Disallow: /admin/',
      'Disallow: /api/',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n');
    res.status(200).set({ 'Content-Type': 'text/plain; charset=utf-8' }).send(body);
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const origin = resolveRequestOrigin(req);
      const xml = await buildDynamicSitemapXml(origin);
      res
        .status(200)
        .set({
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        })
        .send(xml);
    } catch {
      const fallbackPath = path.resolve(__dirname, 'public', 'sitemap.xml');
      if (fs.existsSync(fallbackPath)) {
        res.status(200).set({ 'Content-Type': 'application/xml; charset=utf-8' }).sendFile(fallbackPath);
      } else {
        res.status(500).send('Unable to generate sitemap');
      }
    }
  });

  // 4h. Binary Social OG Cover Artwork Endpoints (serves exact song/artist cover for WhatsApp, Facebook, X crawlers)
  async function serveCoverFromCandidates(res: express.Response, candidates: unknown[]) {
    const raw = pickFirstValidArtworkCandidate(candidates);

    if (raw) {
      const dataMatch = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw);
      if (dataMatch) {
        const mimeType = dataMatch[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : dataMatch[1].toLowerCase();
        const buffer = Buffer.from(dataMatch[2].replace(/\s+/g, ''), 'base64');
        if (buffer.length > 0) {
          res
            .status(200)
            .set({
              'Content-Type': mimeType,
              'Content-Length': String(buffer.length),
              'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
              'Access-Control-Allow-Origin': '*',
            })
            .send(buffer);
          return;
        }
      }

      const mediaMatch = /\/api\/media\/([a-zA-Z0-9_-]{4,128})(?:\?.*)?$/.exec(raw);
      if (mediaMatch && isSafeMediaId(mediaMatch[1])) {
        const assetId = mediaMatch[1];
        const filePath = path.join(MEDIA_DIR, `${assetId}.bin`);
        const metaPath = path.join(MEDIA_DIR, `${assetId}.meta.json`);
        let meta: MediaMeta | null = null;
        if (fs.existsSync(filePath) && fs.existsSync(metaPath)) {
          try {
            meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as MediaMeta;
          } catch {}
        }
        if (!meta || !fs.existsSync(filePath)) {
          const recovered = await fetchMediaFromFirestoreRest(assetId);
          if (recovered) meta = recovered.meta;
        }
        if (meta && fs.existsSync(filePath) && String(meta.contentType || '').startsWith('image/')) {
          res.setHeader('Content-Type', meta.contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
          res.setHeader('Access-Control-Allow-Origin', '*');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }

      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const safeExternal = isSafePublicHttpUrl(toShareableSocialImageUrl(raw));
        if (safeExternal) {
          try {
            const upstream = await fetch(safeExternal, {
              headers: { Accept: 'image/jpeg,image/png,image/*;q=0.8' },
              signal: AbortSignal.timeout(4000),
            });
            if (upstream.ok) {
              const contentType = upstream.headers.get('content-type') || inferImageMimeType(safeExternal);
              if (contentType.startsWith('image/')) {
                const arrayBuf = await upstream.arrayBuffer();
                const buffer = Buffer.from(arrayBuf);
                if (buffer.length > 0 && buffer.length <= 10 * 1024 * 1024) {
                  res
                    .status(200)
                    .set({
                      'Content-Type': contentType,
                      'Content-Length': String(buffer.length),
                      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
                      'Access-Control-Allow-Origin': '*',
                    })
                    .send(buffer);
                  return;
                }
              }
            }
          } catch {}
          res.redirect(302, safeExternal);
          return;
        }
      }
    }

    const fallbackPaths = [
      path.resolve(__dirname, 'dist', 'icons', 'pwa-512x512.png'),
      path.resolve(__dirname, 'public', 'icons', 'pwa-512x512.png'),
    ];
    for (const p of fallbackPaths) {
      if (fs.existsSync(p)) {
        res.status(200).set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' }).sendFile(p);
        return;
      }
    }
    res.status(404).send('Cover artwork not found.');
  }

  app.get(['/og/track/:id/cover', '/api/og/track/:id/cover'], async (req, res) => {
    try {
      const trackId = String(req.params.id || '').trim();
      const includeDrafts = req.query.preview === '1';
      const { track, artist } = await lookupPublicTrackForSeo(trackId, { includeDrafts });
      await serveCoverFromCandidates(res, [
        track?.coverArt,
        artist?.avatar,
        track?.artistAvatar,
        artist?.banner,
      ]);
    } catch {
      await serveCoverFromCandidates(res, []);
    }
  });

  app.get(['/og/artist/:slug/cover', '/api/og/artist/:slug/cover'], async (req, res) => {
    try {
      const slug = String(req.params.slug || '').trim();
      const { artist } = await lookupPublicArtistForSeo(slug);
      await serveCoverFromCandidates(res, [artist?.avatar, artist?.banner]);
    } catch {
      await serveCoverFromCandidates(res, []);
    }
  });

  app.get(['/og/charts/cover', '/api/og/charts/cover'], async (req, res) => {
    try {
      const tab = typeof req.query.tab === 'string' ? req.query.tab : undefined;
      const genre = typeof req.query.genre === 'string' ? req.query.genre : undefined;
      const trackId = typeof req.query.track === 'string' ? req.query.track : undefined;
      const { topTrack, artist } = await lookupTopChartsForSeo({ tab, genre, trackId });
      await serveCoverFromCandidates(res, [
        topTrack?.coverArt,
        artist?.avatar,
        topTrack?.artistAvatar,
        artist?.banner,
      ]);
    } catch {
      await serveCoverFromCandidates(res, []);
    }
  });

  // Live Share Preview Inspection Endpoint (lets ShareModal verify exact OG artwork, title, artist & link status)
  app.get('/api/share-preview', async (req, res) => {
    try {
      const origin = resolveRequestOrigin(req);
      const type = String(req.query.type || 'track').trim();
      const id = String(req.query.id || '').trim();
      const includeDrafts = req.query.includeDraft === '1';

      if (type === 'track') {
        if (!id) {
          res.status(400).json({ ok: false, error: 'Missing track id' });
          return;
        }
        const { track, artist } = await lookupPublicTrackForSeo(id, { includeDrafts });
        if (!track) {
          res.status(404).json({ ok: false, found: false, error: 'Track not found or unpublished' });
          return;
        }
        const safeTrack = String(track.title || 'Track').trim();
        const safeArtist = String(track.artistName || artist?.name || 'Independent Artist').trim();
        const rawImg = pickFirstValidArtworkCandidate([
          track.coverArt,
          artist?.avatar,
          track.artistAvatar,
          artist?.banner,
        ]);
        const coverEndpoint = `${origin}/og/track/${encodeURIComponent(track.id)}/cover${
          track.isDraft ? '?preview=1' : ''
        }`;
        const imageUrl = resolveSeoPublicImage(rawImg, origin, `/og/track/${encodeURIComponent(track.id)}/cover`);
        res.status(200).json({
          ok: true,
          found: true,
          type: 'track',
          id: track.id,
          isDraft: Boolean(track.isDraft),
          title: safeTrack,
          artistName: safeArtist,
          shareTitle: formatTrackShareTitle(safeTrack, safeArtist),
          description: truncateSeoText(
            typeof track.story === 'string' && track.story.trim()
              ? track.story
              : `Stream "${safeTrack}" by ${safeArtist} (${track.genre || 'Independent Music'}) on LOWERVIBE.`,
            160
          ),
          imageUrl,
          coverEndpointUrl: coverEndpoint,
          shortUrl: `${origin}/s/${encodeURIComponent(track.id)}`,
          canonicalUrl: `${origin}/tracks/${encodeURIComponent(track.id)}`,
        });
        return;
      }

      if (type === 'artist') {
        if (!id) {
          res.status(400).json({ ok: false, error: 'Missing artist id' });
          return;
        }
        const { artist, tracksCount } = await lookupPublicArtistForSeo(id);
        if (!artist) {
          res.status(404).json({ ok: false, found: false, error: 'Artist not found' });
          return;
        }
        const safeName = String(artist.name || 'Independent Artist').trim();
        const slugOrId = String(artist.slug || artist.id || id).trim();
        const rawImg = pickFirstValidArtworkCandidate([artist.avatar, artist.banner]);
        const coverEndpoint = `${origin}/og/artist/${encodeURIComponent(slugOrId)}/cover`;
        const imageUrl = resolveSeoPublicImage(rawImg, origin, `/og/artist/${encodeURIComponent(slugOrId)}/cover`);
        res.status(200).json({
          ok: true,
          found: true,
          type: 'artist',
          id: artist.id,
          isDraft: false,
          title: safeName,
          artistName: safeName,
          shareTitle: `${safeName} – Listen on LOWERVIBE`,
          description: truncateSeoText(
            typeof artist.bio === 'string' && artist.bio.trim()
              ? artist.bio
              : `Listen to ${safeName} (${tracksCount} tracks) on LOWERVIBE.`,
            160
          ),
          imageUrl,
          coverEndpointUrl: coverEndpoint,
          shortUrl: `${origin}/a/${encodeURIComponent(slugOrId)}`,
          canonicalUrl: `${origin}/artists/${encodeURIComponent(slugOrId)}`,
        });
        return;
      }

      const tab = typeof req.query.tab === 'string' ? req.query.tab : undefined;
      const genre = typeof req.query.genre === 'string' ? req.query.genre : undefined;
      const trackId = typeof req.query.track === 'string' ? req.query.track : undefined;
      const { topTrack, artist, totalCount, resolvedGenre } = await lookupTopChartsForSeo({
        tab,
        genre,
        trackId,
      });
      const qs = buildChartQueryString({ tab, genre: resolvedGenre || genre, trackId });
      const safeTrack = String(topTrack?.title || '').trim();
      const safeArtist = String(topTrack?.artistName || artist?.name || '').trim();
      const rawImg = topTrack
        ? pickFirstValidArtworkCandidate([
            topTrack.coverArt,
            artist?.avatar,
            topTrack.artistAvatar,
            artist?.banner,
          ])
        : undefined;
      const coverEndpoint = `${origin}/og/charts/cover${qs}`;
      const imageUrl = rawImg ? resolveSeoPublicImage(rawImg, origin, `/og/charts/cover${qs}`) : coverEndpoint;

      res.status(200).json({
        ok: true,
        found: Boolean(topTrack),
        type: 'charts',
        id: topTrack?.id || 'charts',
        isDraft: false,
        title: safeTrack || 'LOWERVIBE Top Charts',
        artistName: safeArtist || 'LOWERVIBE',
        shareTitle: safeTrack
          ? `${resolvedGenre ? `Top ${resolvedGenre} Chart` : tab === 'trending' ? 'Most Trending Chart' : 'Most Played & Trending Charts'} (#1: ${safeTrack} by ${safeArtist || 'Artist'}) – LOWERVIBE`
          : 'Most Played & Trending Charts – LOWERVIBE',
        description: safeTrack
          ? `Explore ${totalCount} tracks on LOWERVIBE Charts. #1 right now: "${safeTrack}" by ${safeArtist}.`
          : 'Explore the most played songs and trending charts on LOWERVIBE.',
        imageUrl,
        coverEndpointUrl: coverEndpoint,
        shortUrl: `${origin}/charts${qs}`,
        canonicalUrl: `${origin}/charts${qs}`,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to resolve share preview',
      });
    }
  });

  // 5. Dynamic SEO / OpenGraph SSR pre-injection for Track, Artist, Charts, Short & Legacy Query Pages + Vite / Production serving
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });

    app.get(['/charts', '/trending', '/promo'], async (req, res, next) => {
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        const rawTemplate = fs.readFileSync(indexPath, 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        const tab = typeof req.query.tab === 'string' ? req.query.tab : undefined;
        const genre = typeof req.query.genre === 'string' ? req.query.genre : undefined;
        const trackId = typeof req.query.track === 'string' ? req.query.track : undefined;
        const { topTrack, artist, totalCount, resolvedGenre } = await lookupTopChartsForSeo({
          tab,
          genre,
          trackId,
        });
        const seoHtml = injectChartsSeoHtml(transformed, topTrack, artist, totalCount, req, {
          tab,
          genre: resolvedGenre || genre,
          trackId,
        });
        res.status(200).set({ 'Content-Type': 'text/html' }).end(seoHtml);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });

    app.get(['/artists/:slug', '/a/:slug', '/artist/:slug'], async (req, res, next) => {
      try {
        const slug = String(req.params.slug || '').trim();
        if (!slug || slug.includes('.')) {
          return next();
        }
        const indexPath = path.resolve(__dirname, 'index.html');
        const rawTemplate = fs.readFileSync(indexPath, 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        const { artist, tracksCount } = await lookupPublicArtistForSeo(slug);
        const seoHtml = injectArtistSeoHtml(transformed, artist, tracksCount, req);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(seoHtml);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });

    app.get(['/tracks/:id', '/s/:id', '/song/:id'], async (req, res, next) => {
      try {
        const trackId = String(req.params.id || '').trim();
        if (!trackId || trackId.includes('.')) {
          return next();
        }
        const indexPath = path.resolve(__dirname, 'index.html');
        const rawTemplate = fs.readFileSync(indexPath, 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        const { track, artist } = await lookupPublicTrackForSeo(trackId);
        const seoHtml = injectTrackSeoHtml(transformed, track, artist, req);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(seoHtml);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });

    app.get('/', async (req, res, next) => {
      const legacyTrack = typeof req.query.track === 'string' ? req.query.track.trim() : '';
      const legacyArtist = typeof req.query.artist === 'string' ? req.query.artist.trim() : '';
      if (!legacyTrack && !legacyArtist) {
        return next();
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        const rawTemplate = fs.readFileSync(indexPath, 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        if (legacyTrack) {
          const { track, artist } = await lookupPublicTrackForSeo(legacyTrack);
          const seoHtml = injectTrackSeoHtml(transformed, track, artist, req);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(seoHtml);
          return;
        }
        const { artist, tracksCount } = await lookupPublicArtistForSeo(legacyArtist);
        const seoHtml = injectArtistSeoHtml(transformed, artist, tracksCount, req);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(seoHtml);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const distIndexPath = path.resolve(distPath, 'index.html');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, { index: false }));

      app.get(['/charts', '/trending', '/promo'], async (req, res) => {
        try {
          const rawHtml = fs.readFileSync(distIndexPath, 'utf8');
          const tab = typeof req.query.tab === 'string' ? req.query.tab : undefined;
          const genre = typeof req.query.genre === 'string' ? req.query.genre : undefined;
          const trackId = typeof req.query.track === 'string' ? req.query.track : undefined;
          const { topTrack, artist, totalCount, resolvedGenre } = await lookupTopChartsForSeo({
            tab,
            genre,
            trackId,
          });
          const seoHtml = injectChartsSeoHtml(rawHtml, topTrack, artist, totalCount, req, {
            tab,
            genre: resolvedGenre || genre,
            trackId,
          });
          res
            .status(200)
            .set({
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
            })
            .end(seoHtml);
        } catch {
          res.sendFile(distIndexPath);
        }
      });

      app.get(['/artists/:slug', '/a/:slug', '/artist/:slug'], async (req, res) => {
        try {
          const rawHtml = fs.readFileSync(distIndexPath, 'utf8');
          const slug = String(req.params.slug || '').trim();
          const { artist, tracksCount } = await lookupPublicArtistForSeo(slug);
          const seoHtml = injectArtistSeoHtml(rawHtml, artist, tracksCount, req);
          res
            .status(200)
            .set({
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
            })
            .end(seoHtml);
        } catch {
          res.sendFile(distIndexPath);
        }
      });

      app.get(['/tracks/:id', '/s/:id', '/song/:id'], async (req, res) => {
        try {
          const rawHtml = fs.readFileSync(distIndexPath, 'utf8');
          const trackId = String(req.params.id || '').trim();
          const { track, artist } = await lookupPublicTrackForSeo(trackId);
          const seoHtml = injectTrackSeoHtml(rawHtml, track, artist, req);
          res
            .status(200)
            .set({
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
            })
            .end(seoHtml);
        } catch {
          res.sendFile(distIndexPath);
        }
      });

      app.get('/', async (req, res) => {
        const legacyTrack = typeof req.query.track === 'string' ? req.query.track.trim() : '';
        const legacyArtist = typeof req.query.artist === 'string' ? req.query.artist.trim() : '';
        if (legacyTrack || legacyArtist) {
          try {
            const rawHtml = fs.readFileSync(distIndexPath, 'utf8');
            if (legacyTrack) {
              const { track, artist } = await lookupPublicTrackForSeo(legacyTrack);
              const seoHtml = injectTrackSeoHtml(rawHtml, track, artist, req);
              res
                .status(200)
                .set({
                  'Content-Type': 'text/html',
                  'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
                })
                .end(seoHtml);
              return;
            }
            const { artist, tracksCount } = await lookupPublicArtistForSeo(legacyArtist);
            const seoHtml = injectArtistSeoHtml(rawHtml, artist, tracksCount, req);
            res
              .status(200)
              .set({
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
              })
              .end(seoHtml);
            return;
          } catch {}
        }
        res.sendFile(distIndexPath);
      });

      app.get('*', (_req, res) => {
        res.sendFile(distIndexPath);
      });
    } else {
      app.get('*', (_req, res) => {
        res.status(404).send('LOWERVIBE Build output not found. Please run npm run build.');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LOWERVIBE] Audio platform server running on http://0.0.0.0:${PORT}`);
    console.log(`[LOWERVIBE] Health check available at http://0.0.0.0:${PORT}/health`);
    console.log(`[LOWERVIBE] System status available at http://0.0.0.0:${PORT}/api/status`);
  });
}

process.on('unhandledRejection', (reason) => {
  console.warn('[LOWERVIBE] Unhandled rejection captured safely:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[LOWERVIBE] Uncaught exception captured:', err);
});

startServer().catch(err => {
  console.error('[LOWERVIBE] Failed to start server:', err);
  process.exit(1);
});
