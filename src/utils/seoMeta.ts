import { Artist, Track } from '../types';

const DEFAULT_TITLE = 'LOWERVIBE — African Independent Music';
const DEFAULT_DESCRIPTION =
  'Stream independent music from Malawi, Nigeria, and across Africa. Discover new artists, save tracks offline, and support creators directly.';
const DEFAULT_KEYWORDS =
  'LOWERVIBE, African music streaming, independent African artists, Malawi music, Nigerian music, Afrobeats, Amapiano, Afro-fusion, offline music player, artist studio';
const PRODUCTION_ORIGIN = 'https://lowervibemusic.web.app';

const NOINDEX_ROUTES = new Set([
  'admin',
  'admin_dashboard',
  'admin_login',
  'admin_access_denied',
  'login',
  'register',
  'forgot_password',
  'account',
  'thank_you',
  'not_found',
  'server_error',
]);

function getPublicOrigin(): string {
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;
  const { origin, hostname } = window.location;
  if (hostname === 'lowervibemusic.web.app' || hostname === 'lowervibemusic.firebaseapp.com') {
    return PRODUCTION_ORIGIN;
  }
  return origin || PRODUCTION_ORIGIN;
}

function getNormalizedCanonicalUrl(): string {
  const origin = getPublicOrigin();
  if (typeof window === 'undefined') return `${origin}/`;
  const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';

  const shortTrack = rawPath.match(/^\/(?:s|song)\/([^/]+)$/);
  if (shortTrack) {
    return `${origin}/tracks/${shortTrack[1]}`;
  }
  const shortArtist = rawPath.match(/^\/(?:a|artist)\/([^/]+)$/);
  if (shortArtist) {
    return `${origin}/artists/${shortArtist[1]}`;
  }
  if (rawPath === '/studio') {
    return `${origin}/artistcreator`;
  }
  return `${origin}${rawPath}`;
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return;
  const escapedKey = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(key) : key.replace(/"/g, '\\"');
  let el = document.head.querySelector(`meta[${attr}="${escapedKey}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMetaTag(attr: 'name' | 'property', key: string): void {
  if (typeof document === 'undefined') return;
  const escapedKey = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(key) : key.replace(/"/g, '\\"');
  const el = document.head.querySelector(`meta[${attr}="${escapedKey}"]`);
  if (el) el.remove();
}

function clearDynamicMediaMetaTags(): void {
  removeMetaTag('property', 'profile:username');
  removeMetaTag('property', 'music:musician');
  removeMetaTag('property', 'music:duration');
  removeMetaTag('property', 'og:audio');
  removeMetaTag('property', 'og:audio:type');
  removeMetaTag('property', 'og:image:secure_url');
}

function setCanonicalLink(href: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setStructuredData(payload: Record<string, unknown>): void {
  if (typeof document === 'undefined') return;
  let script = document.getElementById('lv-structured-data') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'lv-structured-data';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

function truncateText(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${(lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}

export function resolvePublicImageUrl(
  rawUrl: string | undefined,
  origin: string,
  coverEndpointPath?: string
): string {
  const fallback = `${origin}/icons/pwa-512x512.png`;
  if (!rawUrl) return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('data:image/svg+xml') || trimmed.startsWith('blob:')) {
    return fallback;
  }
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('/api/media/')) {
    return coverEndpointPath ? `${origin}${coverEndpointPath}` : fallback;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${origin}${trimmed}`;
  return `${origin}/${trimmed}`;
}

export function resolvePublicAudioUrl(rawUrl: string | undefined, origin: string): string | undefined {
  if (!rawUrl) return undefined;
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

function formatIsoDuration(secondsValue: number): string | undefined {
  const totalSeconds = Math.round(secondsValue);
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

export function buildArtistSeoPayload(
  artist: Partial<Artist> & { name?: string },
  options: {
    origin: string;
    canonicalUrl: string;
    tracksCount?: number;
  }
) {
  const safeName = (artist.name || 'Independent Artist').trim();
  const locationText =
    [artist.city, artist.country].filter(Boolean).join(', ') || artist.location || '';

  let title = `${safeName} – Listen on LOWERVIBE`;
  if (title.length < 30) {
    title = `${safeName} – Stream Music on LOWERVIBE`;
  }
  if (title.length > 60) {
    const shortName = safeName.length > 42 ? `${safeName.slice(0, 41).trim()}…` : safeName;
    title = `${shortName} – LOWERVIBE`;
  }

  const rawBio = (artist.bio || '').replace(/\s+/g, ' ').trim();
  const trackLabel =
    typeof options.tracksCount === 'number' && options.tracksCount > 0
      ? `${options.tracksCount} track${options.tracksCount === 1 ? '' : 's'}`
      : 'original releases';
  const locClause = locationText ? ` from ${locationText}` : '';

  const baseDesc = rawBio
    ? `${rawBio} Stream ${trackLabel} by ${safeName}${locClause} on LOWERVIBE.`
    : `Listen to ${safeName}${locClause} on LOWERVIBE. Stream ${trackLabel}, explore top songs, and support independent African music creators directly.`;
  const description = truncateText(baseDesc, 160);

  const artistCoverPath = artist.id
    ? `/og/artist/${encodeURIComponent(artist.id)}/cover`
    : undefined;
  const rawArtistImg = [artist.avatar, artist.banner].find(
    (candidate) =>
      typeof candidate === 'string' &&
      candidate.trim().length > 0 &&
      !candidate.includes('pwa-512x512.png') &&
      !candidate.startsWith('data:image/svg+xml')
  );
  const image = resolvePublicImageUrl(rawArtistImg || artist.avatar || artist.banner, options.origin, artistCoverPath);
  const genres = Array.isArray(artist.genres)
    ? artist.genres.filter((g) => typeof g === 'string' && g.trim().length > 0)
    : [];
  const sameAs = Object.values(artist.socials || {})
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter((u) => u.startsWith('https://') || u.startsWith('http://'));

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: safeName,
    description,
    image,
    url: options.canonicalUrl,
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

  return {
    title,
    description,
    image,
    imageAlt: `${safeName} on LOWERVIBE`,
    canonicalUrl: options.canonicalUrl,
    username: artist.slug || artist.id || safeName,
    structuredData,
  };
}

export function applyArtistSeoMeta(artist: Artist, tracksCount = 0): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const origin = getPublicOrigin();
  const canonicalHandle = (artist.slug || artist.id || '').trim();
  const canonicalUrl = canonicalHandle
    ? `${origin}/artists/${encodeURIComponent(canonicalHandle)}`
    : getNormalizedCanonicalUrl();
  const seo = buildArtistSeoPayload(artist, {
    origin,
    canonicalUrl,
    tracksCount,
  });

  clearDynamicMediaMetaTags();
  document.title = seo.title;
  setCanonicalLink(seo.canonicalUrl);
  setMetaTag('name', 'description', seo.description);
  setMetaTag(
    'name',
    'robots',
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  );
  setMetaTag(
    'name',
    'keywords',
    `${artist.name}, ${(artist.genres || []).join(', ')}, LOWERVIBE artist, African independent music`
  );

  setMetaTag('property', 'og:type', 'profile');
  setMetaTag('property', 'og:locale', 'en_US');
  setMetaTag('property', 'og:site_name', 'LOWERVIBE');
  setMetaTag('property', 'og:title', seo.title);
  setMetaTag('property', 'og:description', seo.description);
  setMetaTag('property', 'og:image', seo.image);
  if (seo.image.startsWith('https://')) {
    setMetaTag('property', 'og:image:secure_url', seo.image);
  }
  setMetaTag('property', 'og:image:width', '512');
  setMetaTag('property', 'og:image:height', '512');
  setMetaTag('property', 'og:image:alt', seo.imageAlt);
  setMetaTag('property', 'og:url', seo.canonicalUrl);
  setMetaTag('property', 'profile:username', seo.username);

  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', seo.title);
  setMetaTag('name', 'twitter:description', seo.description);
  setMetaTag('name', 'twitter:image', seo.image);
  setMetaTag('name', 'twitter:image:alt', seo.imageAlt);

  setStructuredData(seo.structuredData);
}

export function buildTrackSeoPayload(
  track: Track,
  options: {
    origin: string;
    canonicalUrl: string;
    artist?: Artist | null;
  }
) {
  const safeTrack = (track.title || 'Track').trim();
  const safeArtist = (track.artistName || options.artist?.name || 'Independent Artist').trim();

  let title = `${safeTrack} by ${safeArtist} – LOWERVIBE`;
  if (title.length > 60) {
    title = `${truncateText(safeTrack, 38)} – LOWERVIBE`;
  }

  const description = truncateText(
    track.story?.trim() ||
      `Stream "${safeTrack}" by ${safeArtist} (${track.genre || 'Independent Music'}) on LOWERVIBE. Listen offline, share, and support creators directly.`,
    160
  );
  const trackCoverPath = track.id
    ? `/og/track/${encodeURIComponent(track.id)}/cover`
    : undefined;
  const rawTrackImg = [track.coverArt, options.artist?.avatar, track.artistAvatar].find(
    (candidate) =>
      typeof candidate === 'string' &&
      candidate.trim().length > 0 &&
      !candidate.includes('pwa-512x512.png') &&
      !candidate.startsWith('data:image/svg+xml')
  );
  const image = resolvePublicImageUrl(rawTrackImg || track.coverArt, options.origin, trackCoverPath);
  const durationSeconds = Math.round(
    Number(track.durationSeconds || track.metadata?.duration || track.metadata?.Duration || 0)
  );
  const isoDuration = formatIsoDuration(durationSeconds);
  const artistSlugOrId = (options.artist?.slug || track.artistId || '').trim();
  const artistUrl = artistSlugOrId ? `${options.origin}/artists/${encodeURIComponent(artistSlugOrId)}` : '';
  const audioUrl = resolvePublicAudioUrl(track.audioUrl, options.origin);
  const datePublished = track.releaseDate ? track.releaseDate.trim().slice(0, 10) : undefined;

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
    url: options.canonicalUrl,
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

  return {
    title,
    description,
    image,
    imageAlt: `${safeTrack} cover artwork`,
    canonicalUrl: options.canonicalUrl,
    artistUrl,
    durationSeconds,
    audioUrl,
    audioType: audioUrl ? inferAudioMimeType(audioUrl) : undefined,
    structuredData,
  };
}

export function applyTrackSeoMeta(track: Track, artist?: Artist | null): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const origin = getPublicOrigin();
  const canonicalUrl = `${origin}/tracks/${encodeURIComponent(track.id)}`;
  const seo = buildTrackSeoPayload(track, { origin, canonicalUrl, artist });

  clearDynamicMediaMetaTags();
  document.title = seo.title;
  setCanonicalLink(seo.canonicalUrl);
  setMetaTag('name', 'description', seo.description);
  setMetaTag(
    'name',
    'robots',
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  );
  setMetaTag(
    'name',
    'keywords',
    `${track.title}, ${track.artistName}, ${track.genre || 'African music'}, LOWERVIBE`
  );

  setMetaTag('property', 'og:type', 'music.song');
  setMetaTag('property', 'og:locale', 'en_US');
  setMetaTag('property', 'og:site_name', 'LOWERVIBE');
  setMetaTag('property', 'og:title', seo.title);
  setMetaTag('property', 'og:description', seo.description);
  setMetaTag('property', 'og:image', seo.image);
  if (seo.image.startsWith('https://')) {
    setMetaTag('property', 'og:image:secure_url', seo.image);
  }
  setMetaTag('property', 'og:image:width', '512');
  setMetaTag('property', 'og:image:height', '512');
  setMetaTag('property', 'og:image:alt', seo.imageAlt);
  setMetaTag('property', 'og:url', seo.canonicalUrl);
  if (seo.artistUrl) {
    setMetaTag('property', 'music:musician', seo.artistUrl);
  }
  if (seo.durationSeconds > 0) {
    setMetaTag('property', 'music:duration', String(seo.durationSeconds));
  }
  if (seo.audioUrl && seo.audioType) {
    setMetaTag('property', 'og:audio', seo.audioUrl);
    setMetaTag('property', 'og:audio:type', seo.audioType);
  }

  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', seo.title);
  setMetaTag('name', 'twitter:description', seo.description);
  setMetaTag('name', 'twitter:image', seo.image);
  setMetaTag('name', 'twitter:image:alt', seo.imageAlt);

  setStructuredData(seo.structuredData);
}

export function applyRouteSeoMeta(route: string, searchQuery = ''): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (route === 'artist_detail' || route === 'track_detail') return;
  clearDynamicMediaMetaTags();

  const origin = getPublicOrigin();
  const canonicalUrl = getNormalizedCanonicalUrl();
  const defaultImage = `${origin}/icons/pwa-512x512.png`;

  const routeMetaMap: Record<string, { title: string; description: string }> = {
    home: {
      title: 'LOWERVIBE — Stream Independent African Music',
      description: DEFAULT_DESCRIPTION,
    },
    discover: {
      title: 'Discover Charts & Genres — LOWERVIBE Music',
      description:
        'Explore Top 10 charts, Afro-Fusion, Amapiano, Chillout, and rising independent artists across Malawi, Nigeria, and the African diaspora.',
    },
    artists: {
      title: 'Independent Artists Directory — LOWERVIBE',
      description:
        'Browse verified African musicians, follow creators directly, and explore original songs, albums, and regional playlists on LOWERVIBE.',
    },
    library: {
      title: 'Your Music Library & Offline Saves — LOWERVIBE',
      description:
        'Access your liked songs, saved offline tracks, custom playlists, and followed independent creators anytime in your LOWERVIBE library.',
    },
    studio: {
      title: 'Creator Studio, Analytics & Payouts — LOWERVIBE',
      description:
        'Upload lossless tracks, monitor real-time song earnings and play analytics, manage monetization, and request payouts in LOWERVIBE Studio.',
    },
    account: {
      title: 'Account Settings & Preferences — LOWERVIBE',
      description:
        'Manage your LOWERVIBE listener or creator profile, privacy exports, security controls, support tickets, and artist app installation.',
    },
    search: {
      title: searchQuery
        ? `Search "${truncateText(searchQuery, 28)}" — LOWERVIBE`
        : 'Search Songs, Artists & Genres — LOWERVIBE',
      description:
        'Search across independent African tracks, artists, regional genres, and curated playlists on LOWERVIBE for instant high-quality streaming.',
    },
    terms: {
      title: 'Terms of Service & Creator Rules — LOWERVIBE',
      description:
        'Review LOWERVIBE Terms of Service, creator distribution rights, monetization eligibility rules, and acceptable platform usage policies.',
    },
    privacy: {
      title: 'Privacy Policy & Data Controls — LOWERVIBE',
      description:
        'Learn how LOWERVIBE protects your personal data, listening history, offline storage, cookie preferences, and account deletion rights.',
    },
    copyright: {
      title: 'Copyright & Takedown Policy — LOWERVIBE',
      description:
        'Understand LOWERVIBE original audio rules, rights-holder verification, and how to submit a copyright infringement or DMCA takedown notice.',
    },
    about: {
      title: 'About LOWERVIBE — African Independent Music',
      description:
        'Learn about LOWERVIBE, our Malawi and African independent music platform, creator tools, and direct support contacts.',
    },
    thank_you: {
      title: 'Confirmation & Next Steps — LOWERVIBE',
      description:
        'Thank you for submitting on LOWERVIBE. View your confirmation reference and jump directly back to Studio, Withdrawals, or Music Discovery.',
    },
    login: {
      title: 'Sign In to Stream & Create — LOWERVIBE',
      description:
        'Sign in to LOWERVIBE to sync your liked songs, offline downloads, playlists, artist studio analytics, and creator monetization payouts.',
    },
    register: {
      title: 'Create Your Free Account — LOWERVIBE',
      description:
        'Join LOWERVIBE free as a music listener or independent artist to stream tracks, save music offline, and release songs directly to fans.',
    },
    forgot_password: {
      title: 'Reset Your Account Password — LOWERVIBE',
      description:
        'Recover access to your LOWERVIBE listener or creator account securely with an email or account password reset link.',
    },
    admin_dashboard: {
      title: 'LOWERVIBE — Administration Portal',
      description:
        'Authorized LOWERVIBE staff administration workspace for catalog moderation, artist approvals, support tickets, and payout governance.',
    },
    admin_login: {
      title: 'Administration Sign In — LOWERVIBE',
      description:
        'Restricted sign-in gateway for authorized LOWERVIBE staff administrators.',
    },
    admin_access_denied: {
      title: 'Administration Access Restricted — LOWERVIBE',
      description:
        'Administration access is restricted to verified platform staff accounts on LOWERVIBE.',
    },
    not_found: {
      title: '404 Page Not Found — LOWERVIBE Music',
      description:
        'The song, artist, or page you requested could not be found. Search our independent music catalog or return to the LOWERVIBE homepage.',
    },
    server_error: {
      title: 'Temporary Service Notice — LOWERVIBE',
      description:
        'LOWERVIBE encountered a temporary service interruption. Refresh or return home to keep streaming independent music.',
    },
  };

  const meta = routeMetaMap[route] || routeMetaMap.home;
  const isNoindex = NOINDEX_ROUTES.has(route);

  document.title = meta.title;
  setCanonicalLink(canonicalUrl);
  setMetaTag('name', 'description', meta.description);
  setMetaTag(
    'name',
    'robots',
    isNoindex
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  );
  setMetaTag('name', 'keywords', DEFAULT_KEYWORDS);

  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:locale', 'en_US');
  setMetaTag('property', 'og:site_name', 'LOWERVIBE');
  setMetaTag('property', 'og:title', meta.title);
  setMetaTag('property', 'og:description', meta.description);
  setMetaTag('property', 'og:image', defaultImage);
  if (defaultImage.startsWith('https://')) {
    setMetaTag('property', 'og:image:secure_url', defaultImage);
  }
  setMetaTag('property', 'og:image:width', '512');
  setMetaTag('property', 'og:image:height', '512');
  setMetaTag('property', 'og:image:alt', meta.title);
  setMetaTag('property', 'og:url', canonicalUrl);

  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', meta.title);
  setMetaTag('name', 'twitter:description', meta.description);
  setMetaTag('name', 'twitter:image', defaultImage);
  setMetaTag('name', 'twitter:image:alt', meta.title);

  if (route === 'home' || route === 'discover' || route === 'artists') {
    setStructuredData({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${origin}/#website`,
          name: 'LOWERVIBE',
          url: `${origin}/`,
          description: DEFAULT_DESCRIPTION,
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${origin}/search?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'Organization',
          '@id': `${origin}/#organization`,
          name: 'LOWERVIBE',
          url: `${origin}/`,
          logo: {
            '@type': 'ImageObject',
            url: defaultImage,
            width: 512,
            height: 512,
          },
        },
        {
          '@type': 'WebApplication',
          name: 'LOWERVIBE',
          applicationCategory: 'MusicApplication',
          operatingSystem: 'All',
          url: canonicalUrl,
          description: meta.description,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
        },
      ],
    });
  } else {
    setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'LOWERVIBE',
      applicationCategory: 'MusicApplication',
      operatingSystem: 'All',
      url: canonicalUrl,
      description: meta.description,
    });
  }
}

export function resetDefaultSeoMeta(): void {
  applyRouteSeoMeta('home');
}
