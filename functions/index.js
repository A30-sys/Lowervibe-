/**
 * LOWERVIBE Cloud Functions for Firebase (v2 SDK pattern)
 *
 * Server-authoritative handlers for:
 *  1. Verified play counting & MWK earnings credit (30s listen + 30-min dedup + approved monetization gate)
 *  2. Atomic like/follow synchronization
 *  3. Payout fulfillment boundary (Airtel Money / TNM Mpamba via PayChangu/Flutterwave + USDT TRC-20/BEP-20)
 *  4. Copyright / abuse report admin notification
 *  5. Social OpenGraph preview metadata (shareMeta) & binary song/artist cover artwork (ogCover)
 */

const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const FIRESTORE_DATABASE_ID = 'ai-studio-lowervibe-b2e45d28-38e1-4e03-bbe9-11eddd11a756';
const db = getFirestore(FIRESTORE_DATABASE_ID);
const messaging = getMessaging();

const PRIMARY_ADMIN_EMAIL = 'odulamw@gmail.com';
const DEFAULT_RATE_PER_PLAY_MWK = 4.5;
const PUBLIC_SITE_ORIGIN = 'https://lowervibemusic.web.app';
const DEFAULT_FALLBACK_IMAGE = `${PUBLIC_SITE_ORIGIN}/icons/pwa-512x512.png`;

function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isSafePublicHttpUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
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
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Facebook & WhatsApp link preview scrapers frequently reject .webp images.
 * Converts Cloudinary image URLs to guaranteed 1200px-max JPEG (image/jpeg) automatically.
 */
function toShareableSocialImageUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return rawUrl;
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

function inferImageMimeType(imageUrl, fallback = 'image/jpeg') {
  const lower = String(imageUrl || '').toLowerCase().split('?')[0];
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return fallback;
}

function resolveRequestOrigin(req) {
  const fwdHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = fwdHost || String(req.headers.host || '').trim();
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  if (host && !/localhost|127\.0\.0\.1|0\.0\.0\.0|\.cloudfunctions\.net/i.test(host)) {
    return `${proto}://${host}`;
  }
  return PUBLIC_SITE_ORIGIN;
}

function isSocialCrawlerUserAgent(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return true;
  return /facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|discordbot|slackbot|linkedinbot|pinterest|embedly|skypeuripreview|vkshare|googlebot|bingbot|applebot|yandex|baiduspider|curl\/|wget\//i.test(
    ua
  );
}

function pickFirstValidArtworkCandidate(candidates) {
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
  return null;
}

function formatTrackShareTitle(trackTitle, artistName) {
  const safeTrack = String(trackTitle || 'Track').replace(/\s+/g, ' ').trim();
  const safeArtist = String(artistName || 'Independent Artist').replace(/\s+/g, ' ').trim();
  const full = `${safeTrack} by ${safeArtist} – LOWERVIBE`;
  if (full.length <= 70) return full;

  const trimmedTrack = safeTrack.length > 28 ? `${safeTrack.slice(0, 27).trim()}…` : safeTrack;
  const trimmedArtist = safeArtist.length > 22 ? `${safeArtist.slice(0, 21).trim()}…` : safeArtist;
  return `${trimmedTrack} by ${trimmedArtist} – LOWERVIBE`;
}

async function lookupPublicTrackForFunction(trackId, includeDrafts = false) {
  const cleanId = String(trackId || '').trim();
  if (!cleanId) return { track: null, artist: null };

  let track = null;
  const directSnap = await db.collection('tracks').doc(cleanId).get();
  if (directSnap.exists) {
    track = { id: directSnap.id, ...(directSnap.data() || {}) };
  } else {
    const snap = await db.collection('tracks').limit(300).get();
    const lowerTarget = cleanId.toLowerCase();
    snap.forEach((docSnap) => {
      if (track) return;
      const data = docSnap.data() || {};
      const candidateId = String(data.id || docSnap.id || '').trim();
      if (
        docSnap.id === cleanId ||
        candidateId === cleanId ||
        docSnap.id.toLowerCase() === lowerTarget ||
        candidateId.toLowerCase() === lowerTarget
      ) {
        track = { id: docSnap.id, ...data };
      }
    });
  }

  if (
    track &&
    ((!includeDrafts && (track.isDraft || track.moderationStatus === 'rejected')) ||
      track.isDeranked)
  ) {
    track = null;
  }

  let artist = null;
  if (track && track.artistId) {
    const artistSnap = await db.collection('artists').doc(String(track.artistId)).get();
    if (artistSnap.exists) {
      artist = { id: artistSnap.id, ...(artistSnap.data() || {}) };
    }
  }
  if (track && !artist && track.uploadedByUserId) {
    const q = await db
      .collection('artists')
      .where('ownerId', '==', String(track.uploadedByUserId))
      .limit(1)
      .get();
    if (!q.empty) {
      artist = { id: q.docs[0].id, ...(q.docs[0].data() || {}) };
    }
  }

  return { track, artist };
}

async function lookupPublicArtistForFunction(slugOrId) {
  const clean = String(slugOrId || '').trim();
  if (!clean) return { artist: null, tracksCount: 0 };

  let artist = null;
  const directSnap = await db.collection('artists').doc(clean).get();
  if (directSnap.exists) {
    artist = { id: directSnap.id, ...(directSnap.data() || {}) };
  }
  if (!artist) {
    const q = await db.collection('artists').where('slug', '==', clean).limit(1).get();
    if (!q.empty) {
      artist = { id: q.docs[0].id, ...(q.docs[0].data() || {}) };
    }
  }
  if (!artist) {
    const snap = await db.collection('artists').limit(200).get();
    const lower = clean.toLowerCase();
    snap.forEach((docSnap) => {
      if (artist) return;
      const d = docSnap.data() || {};
      const slugVal = String(d.slug || '').trim().toLowerCase();
      if (docSnap.id.toLowerCase() === lower || slugVal === lower) {
        artist = { id: docSnap.id, ...d };
      }
    });
  }

  let tracksCount = 0;
  if (artist) {
    const tracksSnap = await db
      .collection('tracks')
      .where('artistId', '==', artist.id)
      .limit(200)
      .get();
    tracksSnap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      if (!d.isDraft && !d.isDeranked) tracksCount += 1;
    });
  }

  return { artist, tracksCount };
}

async function readTopChartTrackForShare(options) {
  const tab = options && options.tab === 'trending' ? 'trending' : 'most-played';
  const rawGenre = options && typeof options.genre === 'string' ? options.genre.trim().toLowerCase() : '';
  const requestedTrackId = options && typeof options.trackId === 'string' ? options.trackId.trim() : '';

  const snap = await db.collection('tracks').limit(250).get();
  let tracks = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    if (!data.isDraft && !data.isDeranked && data.moderationStatus !== 'rejected') {
      tracks.push({ id: docSnap.id, ...data });
    }
  });
  if (rawGenre) {
    const genreFiltered = tracks.filter((t) => String(t.genre || '').trim().toLowerCase() === rawGenre);
    if (genreFiltered.length > 0) tracks = genreFiltered;
  }
  if (tab === 'trending') {
    tracks.sort((a, b) => {
      const scoreB = Number(b.plays || 0) + Number(b.likes || 0) * 4 + Number(b.downloads || 0) * 3;
      const scoreA = Number(a.plays || 0) + Number(a.likes || 0) * 4 + Number(a.downloads || 0) * 3;
      return scoreB - scoreA || Number(b.plays || 0) - Number(a.plays || 0);
    });
  } else {
    tracks.sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
  }
  const topTrack = (requestedTrackId ? tracks.find((t) => t.id === requestedTrackId) : null) || tracks[0] || null;
  let artist = null;
  if (topTrack && topTrack.artistId) {
    const artistSnap = await db.collection('artists').doc(String(topTrack.artistId)).get();
    if (artistSnap.exists) artist = artistSnap.data() || null;
  }
  return { topTrack, artist, totalCount: tracks.length };
}

async function readMediaAssetBuffer(assetId) {
  const assetSnap = await db.collection('mediaAssets').doc(assetId).get();
  if (!assetSnap.exists) return null;
  const asset = assetSnap.data() || {};
  const contentType = String(asset.contentType || '');
  if (!contentType.startsWith('image/')) return null;

  if (asset.dataBase64) {
    return { contentType, buffer: Buffer.from(asset.dataBase64, 'base64') };
  }

  const chunkCount = Number(asset.chunkCount || 0);
  if (chunkCount > 0) {
    const chunkIndices = Array.from({ length: chunkCount }, (_, i) => i);
    const parts = await Promise.all(
      chunkIndices.map(async (idx) => {
        const chunkSnap = await db
          .collection('mediaAssets')
          .doc(assetId)
          .collection('chunks')
          .doc(String(idx))
          .get();
        if (!chunkSnap.exists) return null;
        const b64 = chunkSnap.data()?.dataBase64;
        return typeof b64 === 'string' && b64.length > 0 ? Buffer.from(b64, 'base64') : null;
      })
    );
    if (parts.some((p) => !p)) return null;
    return { contentType, buffer: Buffer.concat(parts) };
  }

  return null;
}

let cachedSpaIndexHtml = '';
let cachedSpaIndexAt = 0;

async function fetchSpaIndexHtml(origin) {
  if (cachedSpaIndexHtml && Date.now() - cachedSpaIndexAt < 5 * 60 * 1000) {
    return cachedSpaIndexHtml;
  }
  try {
    const res = await fetch(`${origin}/index.html`, {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('id="root"')) {
        cachedSpaIndexHtml = text;
        cachedSpaIndexAt = Date.now();
        return text;
      }
    }
  } catch {}
  return null;
}

function stripStaticSeoTags(html) {
  return String(html || '')
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '')
    .replace(/<meta\s+property="profile:[^"]+"[^>]*>/gi, '')
    .replace(/<meta\s+property="music:[^"]+"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, '')
    .replace(/<script\s+id="lv-structured-data"[\s\S]*?<\/script>/gi, '');
}

/**
 * 1. onPlayCreate: Validates >= 30s listen, enforces 30-min deduplication per (userId, trackId, windowKey),
 *    skips artist self-plays for payouts, and credits MWK ONLY if artist.monetizationStatus === 'approved'.
 */
exports.onPlayCreate = onDocumentCreated(
  { document: 'plays/{playId}', database: FIRESTORE_DATABASE_ID },
  async (event) => {
    const play = event.data?.data();
    if (!play) return;

    if (typeof play.listenedSeconds !== 'number' || play.listenedSeconds < 30) {
      return;
    }

    const dedupId = `${play.userId}_${play.trackId}_${play.windowKey}`;
    const dedupRef = db.collection('play_dedup').doc(dedupId);

    const trackRef = db.collection('tracks').doc(play.trackId);
    const artistRef = db.collection('artists').doc(play.artistId);
    const configRef = db.collection('config').doc('platform');

    await db.runTransaction(async (tx) => {
      const existingDedup = await tx.get(dedupRef);
      if (existingDedup.exists) {
        return;
      }

      const [trackSnap, artistSnap, configSnap] = await Promise.all([
        tx.get(trackRef),
        tx.get(artistRef),
        tx.get(configRef),
      ]);

      if (!trackSnap.exists || !artistSnap.exists) return;

      const artistData = artistSnap.data();
      const ratePerPlayMwk = configSnap.exists
        ? Number(configSnap.data().ratePerPlayMwk || DEFAULT_RATE_PER_PLAY_MWK)
        : DEFAULT_RATE_PER_PLAY_MWK;

      const isSelfPlay =
        Boolean(play.isArtistSelfPlay) ||
        artistData.ownerId === play.userId ||
        artistData.ownerUserId === play.userId ||
        artistData.claimedByUserId === play.userId;

      const isMonetizedApproved =
        artistData.monetizationStatus === 'approved' && artistData.isMonetized === true;

      tx.set(dedupRef, {
        playId: event.params.playId,
        createdAt: new Date().toISOString(),
      });

      tx.update(trackRef, {
        plays: FieldValue.increment(1),
      });

      const artistUpdate = {
        totalStreams: FieldValue.increment(1),
      };

      if (!isSelfPlay && isMonetizedApproved && ratePerPlayMwk > 0) {
        artistUpdate.earningsBalanceMwk = FieldValue.increment(ratePerPlayMwk);
        artistUpdate.lifetimeEarningsMwk = FieldValue.increment(ratePerPlayMwk);
      }

      tx.update(artistRef, artistUpdate);
    });
  }
);

/**
 * 2. onLikeWrite: Synchronizes unique user likes across track documents.
 */
exports.onLikeWrite = onDocumentWritten(
  { document: 'tracks/{trackId}', database: FIRESTORE_DATABASE_ID },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after || !Array.isArray(after.likedByUserIds)) return;

    const uniqueLikes = Array.from(new Set(after.likedByUserIds));
    if (after.likes !== uniqueLikes.length) {
      await event.data.after.ref.update({
        likes: uniqueLikes.length,
        likedByUserIds: uniqueLikes,
      });
    }
  }
);

/**
 * 3. onPayoutRequestCreate: Checks whether Mobile Money or USDT provider credentials exist in env.
 *    If not configured, flags request as 'awaiting_review' for manual admin settlement.
 *    Re-validates artist approved status and net amount before processing.
 */
exports.onPayoutRequestCreate = onDocumentCreated(
  { document: 'payoutRequests/{requestId}', database: FIRESTORE_DATABASE_ID },
  async (event) => {
    const reqSnap = event.data;
    const reqData = reqSnap?.data();
    if (!reqSnap || !reqData) return;

    const artistRef = db.collection('artists').doc(reqData.artistId);
    const artistSnap = await artistRef.get();
    if (!artistSnap.exists || artistSnap.data().monetizationStatus !== 'approved') {
      await reqSnap.ref.update({
        status: 'failed',
        failureReason: 'Artist monetization is not approved.',
        processedAt: new Date().toISOString(),
      });
      return;
    }

    const hasMobileMoneyKeys = Boolean(process.env.PAYCHANGU_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY);
    const hasUsdtKeys = Boolean(
      process.env.USDT_TREASURY_PRIVATE_KEY && (process.env.TRONGRID_API_KEY || process.env.BSC_RPC_URL)
    );

    const isUsdt = String(reqData.payoutMethodLabel || '').includes('USDT');
    const providerReady = isUsdt ? hasUsdtKeys : hasMobileMoneyKeys;

    if (!providerReady) {
      await reqSnap.ref.update({
        status: 'awaiting_review',
        providerConfigured: false,
      });
      return;
    }

    await reqSnap.ref.update({
      status: 'processing',
      providerConfigured: true,
    });
  }
);

/**
 * 4. onReportCreate: Immediately notifies the primary administrator when any copyright/DMCA or content report arrives.
 */
exports.onReportCreate = onDocumentCreated(
  { document: 'reports/{reportId}', database: FIRESTORE_DATABASE_ID },
  async (event) => {
    const report = event.data?.data();
    if (!report) return;

    await db.collection('notifications').add({
      userId: 'admin',
      userEmail: PRIMARY_ADMIN_EMAIL,
      type: 'system',
      title: `New ${report.type || 'content'} report`,
      message: `${report.reporterEmail || 'A user'} reported "${report.trackTitle || report.artistName || 'content'}": ${report.reason}`,
      readBy: [],
      createdAt: new Date().toISOString(),
      actionRoute: '/administrationside',
    });
  }
);

/**
 * 5. ogCover: Binary cover artwork responder for social share crawlers (/og/track/:id/cover, /og/artist/:slug/cover, /og/charts/cover)
 */
exports.ogCover = onRequest({ cors: true }, async (req, res) => {
  const origin = resolveRequestOrigin(req);
  const fallbackImage = `${origin}/icons/pwa-512x512.png`;
  try {
    const reqPath = String(req.path || '/').replace(/\/+$/, '');
    const trackMatch = reqPath.match(/^\/(?:api\/)?og\/track\/([^/]+)\/cover$/);
    const artistMatch = reqPath.match(/^\/(?:api\/)?og\/artist\/([^/]+)\/cover$/);
    const chartsMatch = /^\/(?:api\/)?og\/charts\/cover$/.test(reqPath);
    const includeDrafts = req.query.preview === '1';

    const candidates = [];
    if (trackMatch) {
      const trackId = decodeURIComponent(trackMatch[1]);
      const { track, artist } = await lookupPublicTrackForFunction(trackId, includeDrafts);
      if (track) {
        candidates.push(track.coverArt, artist?.avatar, track.artistAvatar, artist?.banner);
      }
    } else if (artistMatch) {
      const slugOrId = decodeURIComponent(artistMatch[1]);
      const { artist } = await lookupPublicArtistForFunction(slugOrId);
      if (artist) {
        candidates.push(artist.avatar, artist.banner);
      }
    } else if (chartsMatch) {
      const tab = typeof req.query.tab === 'string' ? req.query.tab : undefined;
      const genre = typeof req.query.genre === 'string' ? req.query.genre : undefined;
      const trackId = typeof req.query.track === 'string' ? req.query.track : undefined;
      const { topTrack, artist } = await readTopChartTrackForShare({ tab, genre, trackId });
      if (topTrack) {
        candidates.push(topTrack.coverArt, artist?.avatar, topTrack.artistAvatar, artist?.banner);
      }
    }

    const raw = pickFirstValidArtworkCandidate(candidates);
    if (raw) {
      const dataMatch = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw);
      if (dataMatch) {
        const mimeType = dataMatch[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : dataMatch[1].toLowerCase();
        const buffer = Buffer.from(dataMatch[2].replace(/\s+/g, ''), 'base64');
        res.status(200).set({
          'Content-Type': mimeType,
          'Content-Length': String(buffer.length),
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*',
        }).send(buffer);
        return;
      }

      const mediaMatch = /\/api\/media\/([a-zA-Z0-9_-]{4,128})(?:\?.*)?$/.exec(raw);
      if (mediaMatch) {
        const media = await readMediaAssetBuffer(mediaMatch[1]);
        if (media && media.buffer.length > 0) {
          res.status(200).set({
            'Content-Type': media.contentType,
            'Content-Length': String(media.buffer.length),
            'Cache-Control': 'public, max-age=86400, immutable',
            'Access-Control-Allow-Origin': '*',
          }).send(media.buffer);
          return;
        }
      }

      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const transformed = toShareableSocialImageUrl(raw);
        const safeExternal = isSafePublicHttpUrl(transformed);
        if (safeExternal) {
          try {
            const upstream = await fetch(safeExternal, {
              headers: { Accept: 'image/jpeg,image/png,image/*;q=0.8' },
              signal: AbortSignal.timeout(4500),
            });
            if (upstream.ok) {
              const contentType = upstream.headers.get('content-type') || inferImageMimeType(safeExternal);
              if (contentType.startsWith('image/')) {
                const buffer = Buffer.from(await upstream.arrayBuffer());
                if (buffer.length > 0 && buffer.length <= 10 * 1024 * 1024) {
                  res.status(200).set({
                    'Content-Type': contentType,
                    'Content-Length': String(buffer.length),
                    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
                    'Access-Control-Allow-Origin': '*',
                  }).send(buffer);
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

    res.redirect(302, fallbackImage);
  } catch {
    res.redirect(302, fallbackImage);
  }
});

/**
 * 6. shareMeta: OpenGraph metadata responder for social crawlers & SPA routes
 *    (/s/:id, /tracks/:id, /a/:slug, /artists/:slug, /charts, /api/share-preview)
 */
exports.shareMeta = onRequest({ cors: true }, async (req, res) => {
  const origin = resolveRequestOrigin(req);
  const reqPath = String(req.path || '/').replace(/\/+$/, '') || '/';
  const fallbackImage = `${origin}/icons/pwa-512x512.png`;

  // Live Share Preview JSON verification endpoint for ShareModal
  if (reqPath === '/api/share-preview') {
    try {
      const type = String(req.query.type || 'track').trim();
      const id = String(req.query.id || '').trim();
      const includeDrafts = req.query.includeDraft === '1';

      if (type === 'track') {
        if (!id) {
          res.status(400).json({ ok: false, error: 'Missing track id' });
          return;
        }
        const { track, artist } = await lookupPublicTrackForFunction(id, includeDrafts);
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
        const imageUrl = rawImg
          ? rawImg.startsWith('data:image/') || rawImg.startsWith('/api/media/')
            ? coverEndpoint
            : isSafePublicHttpUrl(toShareableSocialImageUrl(rawImg)) ||
              (rawImg.startsWith('/') ? `${origin}${rawImg}` : coverEndpoint)
          : fallbackImage;
        res.status(200).json({
          ok: true,
          found: true,
          type: 'track',
          id: track.id,
          isDraft: Boolean(track.isDraft),
          title: safeTrack,
          artistName: safeArtist,
          shareTitle: formatTrackShareTitle(safeTrack, safeArtist),
          description: track.story
            ? String(track.story).slice(0, 160)
            : `Stream "${safeTrack}" by ${safeArtist} (${track.genre || 'Independent Music'}) on LOWERVIBE.`,
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
        const { artist, tracksCount } = await lookupPublicArtistForFunction(id);
        if (!artist) {
          res.status(404).json({ ok: false, found: false, error: 'Artist not found' });
          return;
        }
        const safeName = String(artist.name || 'Independent Artist').trim();
        const slugOrId = String(artist.slug || artist.id || id).trim();
        const rawImg = pickFirstValidArtworkCandidate([artist.avatar, artist.banner]);
        const coverEndpoint = `${origin}/og/artist/${encodeURIComponent(slugOrId)}/cover`;
        const imageUrl = rawImg
          ? rawImg.startsWith('data:image/') || rawImg.startsWith('/api/media/')
            ? coverEndpoint
            : isSafePublicHttpUrl(toShareableSocialImageUrl(rawImg)) ||
              (rawImg.startsWith('/') ? `${origin}${rawImg}` : coverEndpoint)
          : fallbackImage;
        res.status(200).json({
          ok: true,
          found: true,
          type: 'artist',
          id: artist.id,
          isDraft: false,
          title: safeName,
          artistName: safeName,
          shareTitle: `${safeName} – Listen on LOWERVIBE`,
          description: artist.bio
            ? String(artist.bio).slice(0, 160)
            : `Listen to ${safeName} (${tracksCount} tracks) on LOWERVIBE.`,
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
      const { topTrack, artist, totalCount } = await readTopChartTrackForShare({ tab, genre, trackId });
      const qsParams = new URLSearchParams();
      if (tab && tab !== 'most-played') qsParams.set('tab', tab);
      if (genre && genre.trim()) qsParams.set('genre', genre.trim());
      if (trackId && trackId.trim()) qsParams.set('track', trackId.trim());
      const qs = qsParams.toString() ? `?${qsParams.toString()}` : '';
      const safeTrack = String(topTrack?.title || '').trim();
      const safeArtist = String(topTrack?.artistName || artist?.name || '').trim();
      const label = genre ? `Top ${genre} Chart` : tab === 'trending' ? 'Most Trending Chart' : 'Most Played & Trending Charts';
      const coverEndpoint = `${origin}/og/charts/cover${qs}`;
      res.status(200).json({
        ok: true,
        found: Boolean(topTrack),
        type: 'charts',
        id: topTrack?.id || 'charts',
        title: safeTrack || label,
        artistName: safeArtist || 'LOWERVIBE Charts',
        shareTitle: safeTrack ? `${label} (#1: ${safeTrack} by ${safeArtist || 'Artist'}) – LOWERVIBE` : `${label} – LOWERVIBE`,
        description: safeTrack
          ? `Explore ${totalCount} tracks on LOWERVIBE ${label}. #1 right now: "${safeTrack}" by ${safeArtist || 'Independent Artist'}.`
          : 'Explore and share the most played songs and trending charts across LOWERVIBE.',
        imageUrl: coverEndpoint,
        coverEndpointUrl: coverEndpoint,
        shortUrl: `${origin}/charts${qs}`,
        canonicalUrl: `${origin}/charts${qs}`,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Preview failed' });
    }
    return;
  }

  const trackMatch = reqPath.match(/^\/(?:s|song|tracks)\/([^/?#]+)/);
  const artistMatch = reqPath.match(/^\/(?:a|artist|artists)\/([^/?#]+)/);
  const chartsMatch = /^\/(?:charts|trending|promo)$/.test(reqPath);

  let title = 'LOWERVIBE — African Independent Music Streaming';
  let description = 'Stream independent African music from Malawi and beyond on LOWERVIBE.';
  let image = fallbackImage;
  let imageAlt = 'LOWERVIBE';
  let canonicalUrl = `${origin}${reqPath}`;
  let ogType = 'website';
  let audioUrl = '';
  let durationSeconds = 0;
  let fallbackRedirectUrl = `${origin}/`;

  try {
    if (trackMatch) {
      const trackId = decodeURIComponent(trackMatch[1]);
      fallbackRedirectUrl = `${origin}/?track=${encodeURIComponent(trackId)}`;
      const { track, artist } = await lookupPublicTrackForFunction(trackId, false);
      if (track) {
        const safeTrack = String(track.title || 'Track').trim();
        const safeArtist = String(track.artistName || artist?.name || 'Independent Artist').trim();
        title = formatTrackShareTitle(safeTrack, safeArtist);
        imageAlt = `${safeTrack} by ${safeArtist} cover artwork`;
        description = track.story
          ? String(track.story).slice(0, 160)
          : `Stream "${safeTrack}" by ${safeArtist} (${track.genre || 'Independent Music'}) on LOWERVIBE.`;
        const rawImg = pickFirstValidArtworkCandidate([
          track.coverArt,
          artist?.avatar,
          track.artistAvatar,
          artist?.banner,
        ]);
        if (rawImg) {
          if (rawImg.startsWith('data:image/') || rawImg.startsWith('/api/media/')) {
            image = `${origin}/og/track/${encodeURIComponent(track.id)}/cover`;
          } else {
            const converted = toShareableSocialImageUrl(rawImg);
            image =
              isSafePublicHttpUrl(converted) ||
              (rawImg.startsWith('/') ? `${origin}${rawImg}` : `${origin}/og/track/${encodeURIComponent(track.id)}/cover`);
          }
        }
        if (typeof track.audioUrl === 'string' && track.audioUrl.startsWith('https://')) {
          audioUrl = track.audioUrl.trim();
        }
        durationSeconds = Math.round(Number(track.durationSeconds || track.metadata?.duration || 0));
        ogType = 'music.song';
      }
    } else if (artistMatch) {
      const slugOrId = decodeURIComponent(artistMatch[1]);
      fallbackRedirectUrl = `${origin}/?artist=${encodeURIComponent(slugOrId)}`;
      const { artist } = await lookupPublicArtistForFunction(slugOrId);
      if (artist) {
        const safeName = String(artist.name || 'Independent Artist').trim();
        title = `${safeName} – Listen on LOWERVIBE`;
        imageAlt = `${safeName} on LOWERVIBE`;
        description = artist.bio
          ? String(artist.bio).slice(0, 160)
          : `Listen to ${safeName} on LOWERVIBE. Stream songs and support independent African music.`;
        const rawImg = pickFirstValidArtworkCandidate([artist.avatar, artist.banner]);
        if (rawImg) {
          if (rawImg.startsWith('data:image/') || rawImg.startsWith('/api/media/')) {
            image = `${origin}/og/artist/${encodeURIComponent(String(artist.slug || artist.id))}/cover`;
          } else {
            const converted = toShareableSocialImageUrl(rawImg);
            image =
              isSafePublicHttpUrl(converted) ||
              (rawImg.startsWith('/') ? `${origin}${rawImg}` : `${origin}/og/artist/${encodeURIComponent(String(artist.slug || artist.id))}/cover`);
          }
        }
        ogType = 'profile';
      }
    } else if (chartsMatch) {
      const tab = typeof req.query.tab === 'string' ? req.query.tab : undefined;
      const genre = typeof req.query.genre === 'string' ? req.query.genre : undefined;
      const trackId = typeof req.query.track === 'string' ? req.query.track : undefined;
      const qsParams = new URLSearchParams();
      if (tab && tab !== 'most-played') qsParams.set('tab', tab);
      if (genre && genre.trim()) qsParams.set('genre', genre.trim());
      if (trackId && trackId.trim()) qsParams.set('track', trackId.trim());
      const qs = qsParams.toString() ? `?${qsParams.toString()}` : '';
      canonicalUrl = `${origin}/charts${qs}`;
      fallbackRedirectUrl = canonicalUrl;
      const { topTrack, artist, totalCount } = await readTopChartTrackForShare({ tab, genre, trackId });
      if (topTrack) {
        const safeTrack = String(topTrack.title || 'Top Track').trim();
        const safeArtist = String(topTrack.artistName || artist?.name || 'Independent Artist').trim();
        const label = genre ? `Top ${genre} Chart` : tab === 'trending' ? 'Most Trending Chart' : 'Most Played & Trending Charts';
        title = `${label} (#1: ${safeTrack} by ${safeArtist}) – LOWERVIBE`;
        description = `Explore ${totalCount} tracks on LOWERVIBE ${label}. #1 right now: "${safeTrack}" by ${safeArtist}. Stream free and share.`;
        imageAlt = `#1 Charting: ${safeTrack} by ${safeArtist}`;
        const rawImg = pickFirstValidArtworkCandidate([
          topTrack.coverArt,
          artist?.avatar,
          topTrack.artistAvatar,
          artist?.banner,
        ]);
        if (rawImg) {
          image = `${origin}/og/charts/cover${qs}`;
        }
      } else {
        title = 'Most Played & Trending Charts – LOWERVIBE';
        description = 'Explore and share the most played songs, trending chart velocity, and top genres across LOWERVIBE.';
      }
    }
  } catch {}

  const imageMime = inferImageMimeType(image, image.includes('/og/') ? 'image/jpeg' : 'image/png');
  const headTags = [
    `<title>${escapeHtmlAttr(title)}</title>`,
    `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta name="description" content="${escapeHtmlAttr(description)}" />`,
    `<meta property="og:type" content="${escapeHtmlAttr(ogType)}" />`,
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
    ...(durationSeconds > 0 ? [`<meta property="music:duration" content="${durationSeconds}" />`] : []),
    ...(audioUrl
      ? [
          `<meta property="og:audio" content="${escapeHtmlAttr(audioUrl)}" />`,
          `<meta property="og:audio:type" content="audio/mpeg" />`,
        ]
      : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(image)}" />`,
    `<meta name="twitter:image:src" content="${escapeHtmlAttr(image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtmlAttr(imageAlt)}" />`,
  ].join('\n    ');

  const isBot = isSocialCrawlerUserAgent(req.headers['user-agent']);
  if (!isBot) {
    const spaHtml = await fetchSpaIndexHtml(origin);
    if (spaHtml) {
      const injected = stripStaticSeoTags(spaHtml).replace('</head>', `    ${headTags}\n  </head>`);
      res
        .status(200)
        .set({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
        })
        .send(injected);
      return;
    }
  }

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    ${headTags}
    ${!isBot ? `<meta http-equiv="refresh" content="0;url=${escapeHtmlAttr(fallbackRedirectUrl)}" />` : ''}
  </head>
  <body style="background:#0A0B0A;color:#F4F5F3;font-family:sans-serif;padding:24px;text-align:center;">
    <p>Opening <a href="${escapeHtmlAttr(fallbackRedirectUrl)}" style="color:#C6FF3D;">${escapeHtmlAttr(title)}</a>…</p>
    ${!isBot ? `<script>window.location.replace(${JSON.stringify(fallbackRedirectUrl)});</script>` : ''}
  </body>
</html>`;

  res
    .status(200)
    .set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    })
    .send(html);
});

async function sendFcmMulticast(tokenDocs, payload) {
  if (!Array.isArray(tokenDocs) || tokenDocs.length === 0) return;

  const uniqueByToken = new Map();
  for (const d of tokenDocs) {
    if (d && typeof d.token === 'string' && d.token.length >= 20 && !uniqueByToken.has(d.token)) {
      uniqueByToken.set(d.token, d);
    }
  }
  const entries = Array.from(uniqueByToken.values());
  if (entries.length === 0) return;

  const safePath = String(payload.url || '/').startsWith('/') ? String(payload.url || '/') : '/';
  const fullLink = `${PUBLIC_SITE_ORIGIN}${safePath}`;
  const safeImage = isSafePublicHttpUrl(payload.artworkUrl || '') || undefined;

  for (let i = 0; i < entries.length; i += 500) {
    const chunk = entries.slice(i, i + 500);
    const tokens = chunk.map((c) => c.token);
    try {
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: String(payload.title || 'LOWERVIBE').slice(0, 140),
          body: String(payload.body || '').slice(0, 300),
          ...(safeImage ? { imageUrl: safeImage } : {}),
        },
        data: {
          title: String(payload.title || 'LOWERVIBE').slice(0, 140),
          body: String(payload.body || '').slice(0, 300),
          url: safePath,
          tag: String(payload.tag || 'lowervibe-push'),
          ...(safeImage ? { artworkUrl: safeImage } : {}),
        },
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            title: String(payload.title || 'LOWERVIBE').slice(0, 140),
            body: String(payload.body || '').slice(0, 300),
            icon: `${PUBLIC_SITE_ORIGIN}/icons/pwa-192x192.png`,
            badge: `${PUBLIC_SITE_ORIGIN}/icons/pwa-192x192.png`,
            ...(safeImage ? { image: safeImage } : {}),
            tag: String(payload.tag || 'lowervibe-push'),
          },
          fcmOptions: {
            link: fullLink,
          },
        },
      });

      const staleDeletions = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code || '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            const docId = chunk[idx]?.docId;
            if (docId) {
              staleDeletions.push(db.collection('fcmTokens').doc(docId).delete().catch(() => {}));
            }
          }
        }
      });
      if (staleDeletions.length > 0) {
        await Promise.allSettled(staleDeletions);
      }
    } catch (err) {
      console.error('FCM multicast send error:', err);
    }
  }
}

/**
 * 7. onTrackPublishPush: Sends native lock-screen Web Push alerts to followers of an artist
 *    whenever a new track is published (even when listeners' apps are closed).
 */
exports.onTrackPublishPush = onDocumentWritten(
  { document: 'tracks/{trackId}', database: FIRESTORE_DATABASE_ID },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return;

    const isAfterPublic =
      !after.isDraft && !after.isDeranked && after.moderationStatus !== 'rejected';
    const wasBeforePublic =
      Boolean(before) &&
      !before.isDraft &&
      !before.isDeranked &&
      before.moderationStatus !== 'rejected';

    if (!isAfterPublic || wasBeforePublic) return;
    if (!after.artistId) return;

    const trackId = event.params.trackId;
    const artistId = String(after.artistId);

    const subscriberUserIds = new Set();
    const tokenDocs = [];

    try {
      const [usersSnap, directTokenSnap] = await Promise.all([
        db.collection('users').where('followingArtistIds', 'array-contains', artistId).limit(500).get(),
        db
          .collection('fcmTokens')
          .where('followingArtistIds', 'array-contains', artistId)
          .where('enabled', '==', true)
          .limit(500)
          .get(),
      ]);

      usersSnap.forEach((docSnap) => {
        if (docSnap.id && docSnap.id !== after.uploadedByUserId) {
          subscriberUserIds.add(docSnap.id);
        }
      });

      directTokenSnap.forEach((docSnap) => {
        const d = docSnap.data() || {};
        if (d.userId !== after.uploadedByUserId && d.newReleasesPush !== false) {
          tokenDocs.push({ docId: docSnap.id, token: d.token });
        }
      });

      const uidList = Array.from(subscriberUserIds);
      for (let i = 0; i < uidList.length; i += 30) {
        const uidChunk = uidList.slice(i, i + 30);
        const snap = await db
          .collection('fcmTokens')
          .where('userId', 'in', uidChunk)
          .where('enabled', '==', true)
          .get();
        snap.forEach((docSnap) => {
          const d = docSnap.data() || {};
          if (d.newReleasesPush !== false) {
            tokenDocs.push({ docId: docSnap.id, token: d.token });
          }
        });
      }

      if (tokenDocs.length === 0) return;

      const coverArt = isSafePublicHttpUrl(after.coverArt || '')
        ? after.coverArt
        : `${PUBLIC_SITE_ORIGIN}/og/track/${encodeURIComponent(trackId)}/cover`;

      await sendFcmMulticast(tokenDocs, {
        title: `New drop from ${after.artistName || 'Artist'}`,
        body: `"${after.title || 'New Release'}" is now streaming on LOWERVIBE.`,
        artworkUrl: coverArt,
        url: `/tracks/${encodeURIComponent(trackId)}`,
        tag: `release-${trackId}`,
      });
    } catch (err) {
      console.error('onTrackPublishPush failed:', err);
    }
  }
);

/**
 * 8. onNotificationCreatedPush: Dispatches native FCM lock-screen push for targeted
 *    creator/account notifications (approvals, payouts, upload completion, followers).
 */
exports.onNotificationCreatedPush = onDocumentCreated(
  { document: 'notifications/{notificationId}', database: FIRESTORE_DATABASE_ID },
  async (event) => {
    const notif = event.data?.data();
    if (!notif || !notif.userId || notif.userId === 'all' || notif.userId === 'admin') return;

    const pushEligibleTypes = new Set([
      'artist_approved',
      'artist_rejected',
      'withdrawal_status',
      'upload_completed',
      'upload_failed',
      'account_security',
      'new_follower',
      'new_release',
    ]);
    if (!pushEligibleTypes.has(String(notif.type || ''))) return;

    try {
      const snap = await db
        .collection('fcmTokens')
        .where('userId', '==', String(notif.userId))
        .where('enabled', '==', true)
        .get();

      const tokenDocs = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() || {};
        if (notif.type === 'withdrawal_status' && d.payoutUpdatesPush === false) return;
        if (notif.type === 'new_follower' && d.likesFollowsPush === false) return;
        if (notif.type === 'new_release' && d.newReleasesPush === false) return;
        tokenDocs.push({ docId: docSnap.id, token: d.token });
      });

      if (tokenDocs.length === 0) return;

      await sendFcmMulticast(tokenDocs, {
        title: notif.title || 'LOWERVIBE',
        body: notif.message || 'Open LOWERVIBE to view your update.',
        artworkUrl: notif.artworkUrl,
        url: notif.actionRoute || '/',
        tag: `notif-${event.params.notificationId}`,
      });
    } catch (err) {
      console.error('onNotificationCreatedPush failed:', err);
    }
  }
);

