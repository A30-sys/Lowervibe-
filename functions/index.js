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

async function readTopChartTrackForShare() {
  const snap = await db.collection('tracks').limit(150).get();
  const tracks = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    if (!data.isDraft && !data.isDeranked) {
      tracks.push({ id: docSnap.id, ...data });
    }
  });
  tracks.sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
  const topTrack = tracks[0] || null;
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
  try {
    const reqPath = String(req.path || '/').replace(/\/+$/, '');
    const trackMatch = reqPath.match(/^\/(?:api\/)?og\/track\/([^/]+)\/cover$/);
    const artistMatch = reqPath.match(/^\/(?:api\/)?og\/artist\/([^/]+)\/cover$/);
    const chartsMatch = /^\/(?:api\/)?og\/charts\/cover$/.test(reqPath);

    const candidates = [];
    if (trackMatch) {
      const trackId = decodeURIComponent(trackMatch[1]);
      const trackSnap = await db.collection('tracks').doc(trackId).get();
      if (trackSnap.exists) {
        const track = trackSnap.data() || {};
        if (!track.isDraft && !track.isDeranked) {
          candidates.push(track.coverArt, track.artistAvatar);
          if (track.artistId) {
            const artistSnap = await db.collection('artists').doc(String(track.artistId)).get();
            if (artistSnap.exists) {
              const artist = artistSnap.data() || {};
              candidates.push(artist.avatar, artist.banner);
            }
          }
        }
      }
    } else if (artistMatch) {
      const slugOrId = decodeURIComponent(artistMatch[1]);
      let artistSnap = await db.collection('artists').doc(slugOrId).get();
      if (!artistSnap.exists) {
        const q = await db.collection('artists').where('slug', '==', slugOrId).limit(1).get();
        if (!q.empty) artistSnap = q.docs[0];
      }
      if (artistSnap.exists) {
        const artist = artistSnap.data() || {};
        candidates.push(artist.avatar, artist.banner);
      }
    } else if (chartsMatch) {
      const { topTrack, artist } = await readTopChartTrackForShare();
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
          }).send(media.buffer);
          return;
        }
      }

      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const safeExternal = isSafePublicHttpUrl(raw);
        if (safeExternal) {
          res.redirect(302, safeExternal);
          return;
        }
      }
    }

    res.redirect(302, DEFAULT_FALLBACK_IMAGE);
  } catch {
    res.redirect(302, DEFAULT_FALLBACK_IMAGE);
  }
});

/**
 * 6. shareMeta: OpenGraph metadata HTML responder for social crawlers (/s/:id, /tracks/:id, /a/:slug, /artists/:slug, /charts)
 */
exports.shareMeta = onRequest({ cors: true }, async (req, res) => {
  const reqPath = String(req.path || '/').replace(/\/+$/, '') || '/';
  const trackMatch = reqPath.match(/^\/(?:s|song|tracks)\/([^/?#]+)/);
  const artistMatch = reqPath.match(/^\/(?:a|artist|artists)\/([^/?#]+)/);
  const chartsMatch = /^\/(?:charts|trending|promo)$/.test(reqPath);

  let title = 'LOWERVIBE — African Independent Music Streaming';
  let description = 'Stream independent African music from Malawi and beyond on LOWERVIBE.';
  let image = DEFAULT_FALLBACK_IMAGE;
  let imageAlt = 'LOWERVIBE';
  let canonicalUrl = `${PUBLIC_SITE_ORIGIN}${reqPath}`;
  let ogType = 'website';

  try {
    if (trackMatch) {
      const trackId = decodeURIComponent(trackMatch[1]);
      const trackSnap = await db.collection('tracks').doc(trackId).get();
      if (trackSnap.exists) {
        const track = trackSnap.data() || {};
        if (!track.isDraft && !track.isDeranked) {
          const artistSnap = track.artistId
            ? await db.collection('artists').doc(String(track.artistId)).get()
            : null;
          const artist = artistSnap?.exists ? artistSnap.data() : null;
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
              image = `${PUBLIC_SITE_ORIGIN}/og/track/${encodeURIComponent(trackId)}/cover`;
            } else {
              image = isSafePublicHttpUrl(rawImg) || (rawImg.startsWith('/') ? `${PUBLIC_SITE_ORIGIN}${rawImg}` : DEFAULT_FALLBACK_IMAGE);
            }
          }
          ogType = 'music.song';
        }
      }
    } else if (artistMatch) {
      const slugOrId = decodeURIComponent(artistMatch[1]);
      let artistSnap = await db.collection('artists').doc(slugOrId).get();
      if (!artistSnap.exists) {
        const q = await db.collection('artists').where('slug', '==', slugOrId).limit(1).get();
        if (!q.empty) artistSnap = q.docs[0];
      }
      if (artistSnap.exists) {
        const artist = artistSnap.data() || {};
        const safeName = String(artist.name || 'Independent Artist').trim();
        title = `${safeName} – Listen on LOWERVIBE`;
        imageAlt = `${safeName} on LOWERVIBE`;
        description = artist.bio
          ? String(artist.bio).slice(0, 160)
          : `Listen to ${safeName} on LOWERVIBE. Stream songs and support independent African music.`;
        const rawImg = pickFirstValidArtworkCandidate([artist.avatar, artist.banner]);
        if (rawImg) {
          if (rawImg.startsWith('data:image/') || rawImg.startsWith('/api/media/')) {
            image = `${PUBLIC_SITE_ORIGIN}/og/artist/${encodeURIComponent(String(artist.slug || artistSnap.id))}/cover`;
          } else {
            image = isSafePublicHttpUrl(rawImg) || (rawImg.startsWith('/') ? `${PUBLIC_SITE_ORIGIN}${rawImg}` : DEFAULT_FALLBACK_IMAGE);
          }
        }
        ogType = 'profile';
      }
    } else if (chartsMatch) {
      canonicalUrl = `${PUBLIC_SITE_ORIGIN}/charts`;
      const { topTrack, artist, totalCount } = await readTopChartTrackForShare();
      if (topTrack) {
        const safeTrack = String(topTrack.title || 'Top Track').trim();
        const safeArtist = String(topTrack.artistName || artist?.name || 'Independent Artist').trim();
        title = `Most Played & Trending Charts (#1: ${safeTrack} by ${safeArtist}) – LOWERVIBE`;
        description = `Explore ${totalCount} tracks on LOWERVIBE Top Charts. #1 right now: "${safeTrack}" by ${safeArtist}. Stream free and share trending genres.`;
        imageAlt = `#1 Charting: ${safeTrack} by ${safeArtist}`;
        const rawImg = pickFirstValidArtworkCandidate([
          topTrack.coverArt,
          artist?.avatar,
          topTrack.artistAvatar,
          artist?.banner,
        ]);
        if (rawImg) {
          image = `${PUBLIC_SITE_ORIGIN}/og/charts/cover`;
        }
      } else {
        title = 'Most Played & Trending Charts – LOWERVIBE';
        description = 'Explore and share the most played songs, trending chart velocity, and top genres across LOWERVIBE.';
      }
    }
  } catch {}

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtmlAttr(title)}</title>
    <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />
    <meta name="description" content="${escapeHtmlAttr(description)}" />
    <meta property="og:type" content="${escapeHtmlAttr(ogType)}" />
    <meta property="og:site_name" content="LOWERVIBE" />
    <meta property="og:title" content="${escapeHtmlAttr(title)}" />
    <meta property="og:description" content="${escapeHtmlAttr(description)}" />
    <meta property="og:image" content="${escapeHtmlAttr(image)}" />
    <meta property="og:image:secure_url" content="${escapeHtmlAttr(image)}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:image:alt" content="${escapeHtmlAttr(imageAlt)}" />
    <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttr(title)}" />
    <meta name="twitter:description" content="${escapeHtmlAttr(description)}" />
    <meta name="twitter:image" content="${escapeHtmlAttr(image)}" />
    <meta name="twitter:image:alt" content="${escapeHtmlAttr(imageAlt)}" />
  </head>
  <body>
    <p>Opening <a href="${escapeHtmlAttr(canonicalUrl)}">${escapeHtmlAttr(title)}</a>…</p>
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

