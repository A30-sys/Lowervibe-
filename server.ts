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
const SIGNING_KEY_PATH = path.join(LEDGER_DIR, '.server_signing_key');

const PRIMARY_ADMIN_EMAIL = 'odulamw@gmail.com';

let FIREBASE_API_KEY = '';
let FIREBASE_PROJECT_ID = 'intelligent-exchange-x3rp2';
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

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  idToken: string;
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
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
    };
    const u = json.users?.[0];
    if (!u?.localId) return null;
    return {
      uid: u.localId,
      email: (u.email || '').toLowerCase(),
      emailVerified: Boolean(u.emailVerified),
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

function getFirestoreBaseUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;
}

async function firestoreGetDocRest(docPath: string, idToken?: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${getFirestoreBaseUrl()}/${docPath}`, {
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
    const res = await fetch(`${getFirestoreBaseUrl()}:runQuery`, {
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
    try {
      const listRes = await fetch(`${getFirestoreBaseUrl()}/artists?pageSize=100`, {
        signal: AbortSignal.timeout(2500),
      });
      if (listRes.ok) {
        const listJson = (await listRes.json()) as {
          documents?: Array<{ name?: string; fields?: Record<string, FirestoreRestValue> }>;
        };
        const docs: Array<Record<string, any>> = (listJson.documents || []).map((d) => ({
          id: d.name?.split('/').pop() || '',
          ...decodeFirestoreFields(d.fields),
        }));
        artist =
          docs.find(
            (a) =>
              (typeof a.slug === 'string' && a.slug.toLowerCase() === cacheKey) ||
              a.id.toLowerCase() === cacheKey ||
              (typeof a.name === 'string' &&
                a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === cacheKey)
          ) || null;
      }
    } catch {}
  }

  let tracksCount = 0;
  if (artist?.id) {
    try {
      const artistTracks = await firestoreQueryEqualsRest('tracks', 'artistId', String(artist.id));
      tracksCount = artistTracks.filter((t) => !t.isDraft && !t.isDeranked).length;
    } catch {}
  }

  seoArtistCache.set(cacheKey, {
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

function resolveRequestOrigin(req: express.Request): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  const protoHeader = (req.header('x-forwarded-proto') || '').split(',')[0].trim();
  const proto = protoHeader || req.protocol || 'https';
  const host = req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function resolveSeoPublicImage(rawUrl: unknown, origin: string): string {
  const fallback = `${origin}/icons/pwa-512x512.png`;
  if (typeof rawUrl !== 'string') return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('data:')) return fallback;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${origin}${trimmed}`;
  return `${origin}/${trimmed}`;
}

function truncateSeoText(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${(lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
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

  const image = resolveSeoPublicImage(artist.avatar || artist.banner, origin);
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

  const headInject = [
    `<title>${escapeHtmlAttr(title)}</title>`,
    `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta name="description" content="${escapeHtmlAttr(description)}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:site_name" content="LOWERVIBE" />`,
    `<meta property="og:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(image)}" />`,
    `<meta property="og:image:alt" content="${escapeHtmlAttr(`${safeName} on LOWERVIBE`)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta property="profile:username" content="${escapeHtmlAttr(String(artist.slug || artist.id || safeName))}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(image)}" />`,
    `<script id="lv-structured-data" type="application/ld+json">${escapeJsonLd(structuredData)}</script>`,
  ].join('\n    ');

  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '')
    .replace(/<meta\s+property="profile:[^"]+"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, '')
    .replace(/<script\s+id="lv-structured-data"[\s\S]*?<\/script>/gi, '');

  return stripped.replace('</head>', `    ${headInject}\n  </head>`);
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

  app.use(express.json());

  // 1. Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      status: 'healthy',
      db: 'firestore',
      auth: 'firebase+otp',
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
      otpStore.set(cleanEmail, {
        hash: hashOtp(cleanEmail, code),
        expiresAt: now + OTP_TTL_MS,
        attempts: 0,
        lastSentAt: now,
      });

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

      const isAdmin = authUser.email === PRIMARY_ADMIN_EMAIL && authUser.emailVerified;
      const isArtistOwner =
        artistDoc.ownerUserId === authUser.uid || artistDoc.claimedByUserId === authUser.uid;

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

      const isAdmin = authUser.email === PRIMARY_ADMIN_EMAIL && authUser.emailVerified;
      const isArtistOwner =
        artistDoc.ownerUserId === authUser.uid || artistDoc.claimedByUserId === authUser.uid;
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

  // 4e. Durable Write-Ahead Sync Event Mirror
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

      const events = readJsonArray<Record<string, unknown>>(SYNC_LEDGER_PATH);
      events.unshift({
        collection,
        docId,
        mode,
        timestamp,
        summary: req.body?.summary || null,
      });
      writeJsonArray(SYNC_LEDGER_PATH, events.slice(0, 1500));
      res.status(200).json({ ok: true });
    } catch {
      res.status(200).json({ ok: true });
    }
  });

  // 5. Dynamic SEO / OpenGraph SSR pre-injection for Artist Profile Pages + Vite / Production serving
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

    app.get('/artists/:slug', async (req, res, next) => {
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

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const distIndexPath = path.resolve(distPath, 'index.html');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, { index: false }));

      app.get('/artists/:slug', async (req, res) => {
        try {
          const rawHtml = fs.readFileSync(distIndexPath, 'utf8');
          const slug = String(req.params.slug || '').trim();
          const { artist, tracksCount } = await lookupPublicArtistForSeo(slug);
          const seoHtml = injectArtistSeoHtml(rawHtml, artist, tracksCount, req);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(seoHtml);
        } catch {
          res.sendFile(distIndexPath);
        }
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

startServer().catch(err => {
  console.error('[LOWERVIBE] Failed to start server:', err);
  process.exit(1);
});
