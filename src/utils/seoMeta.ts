import { Artist, Track } from '../types';

const DEFAULT_TITLE = 'LOWERVIBE — African Independent Music';
const DEFAULT_DESCRIPTION =
  'Stream independent music from Malawi, Nigeria, and across Africa. Discover new artists, save tracks offline, and support creators directly.';

function setMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
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

export function resolvePublicImageUrl(rawUrl: string | undefined, origin: string): string {
  const fallback = `${origin}/icons/pwa-512x512.png`;
  if (!rawUrl) return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('data:')) return fallback;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${origin}${trimmed}`;
  return `${origin}/${trimmed}`;
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

  const image = resolvePublicImageUrl(artist.avatar || artist.banner, options.origin);
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
    canonicalUrl: options.canonicalUrl,
    username: artist.slug || artist.id || safeName,
    structuredData,
  };
}

export function applyArtistSeoMeta(artist: Artist, tracksCount = 0): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const origin = window.location.origin;
  const canonicalUrl = `${origin}${window.location.pathname}`;
  const seo = buildArtistSeoPayload(artist, {
    origin,
    canonicalUrl,
    tracksCount,
  });

  document.title = seo.title;
  setCanonicalLink(seo.canonicalUrl);
  setMetaTag('name', 'description', seo.description);

  setMetaTag('property', 'og:type', 'profile');
  setMetaTag('property', 'og:site_name', 'LOWERVIBE');
  setMetaTag('property', 'og:title', seo.title);
  setMetaTag('property', 'og:description', seo.description);
  setMetaTag('property', 'og:image', seo.image);
  setMetaTag('property', 'og:image:alt', `${artist.name || 'Artist'} on LOWERVIBE`);
  setMetaTag('property', 'og:url', seo.canonicalUrl);
  setMetaTag('property', 'profile:username', seo.username);

  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', seo.title);
  setMetaTag('name', 'twitter:description', seo.description);
  setMetaTag('name', 'twitter:image', seo.image);

  setStructuredData(seo.structuredData);
}

export function applyTrackSeoMeta(track: Track): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const origin = window.location.origin;
  const canonicalUrl = `${origin}${window.location.pathname}`;
  const safeTrack = track.title || 'Track';
  const safeArtist = track.artistName || 'Independent Artist';

  let title = `${safeTrack} by ${safeArtist} – LOWERVIBE`;
  if (title.length > 60) {
    title = `${truncateText(safeTrack, 38)} – LOWERVIBE`;
  }

  const description = truncateText(
    track.story?.trim() ||
      `Stream "${safeTrack}" by ${safeArtist} (${track.genre || 'Independent Music'}) on LOWERVIBE. Listen offline, share, and support creators directly.`,
    160
  );
  const image = resolvePublicImageUrl(track.coverArt, origin);

  document.title = title;
  setCanonicalLink(canonicalUrl);
  setMetaTag('name', 'description', description);

  setMetaTag('property', 'og:type', 'music.song');
  setMetaTag('property', 'og:site_name', 'LOWERVIBE');
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:image', image);
  setMetaTag('property', 'og:image:alt', `${safeTrack} cover artwork`);
  setMetaTag('property', 'og:url', canonicalUrl);

  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);
  setMetaTag('name', 'twitter:image', image);

  setStructuredData({
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: safeTrack,
    byArtist: {
      '@type': 'MusicGroup',
      name: safeArtist,
    },
    genre: track.genre || 'Independent',
    url: canonicalUrl,
    image,
    description,
  });
}

export function applyRouteSeoMeta(route: string, searchQuery = ''): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (route === 'artist_detail' || route === 'track_detail') return;

  const origin = window.location.origin;
  const canonicalUrl = `${origin}${window.location.pathname}`;
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

  document.title = meta.title;
  setCanonicalLink(canonicalUrl);
  setMetaTag('name', 'description', meta.description);

  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:site_name', 'LOWERVIBE');
  setMetaTag('property', 'og:title', meta.title);
  setMetaTag('property', 'og:description', meta.description);
  setMetaTag('property', 'og:image', defaultImage);
  setMetaTag('property', 'og:image:alt', meta.title);
  setMetaTag('property', 'og:url', canonicalUrl);

  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', meta.title);
  setMetaTag('name', 'twitter:description', meta.description);
  setMetaTag('name', 'twitter:image', defaultImage);

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

export function resetDefaultSeoMeta(): void {
  applyRouteSeoMeta('home');
}
