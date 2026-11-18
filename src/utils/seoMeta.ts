import { Artist } from '../types';

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

  // Keep page titles concise and descriptive (30–60 chars target)
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

export function resetDefaultSeoMeta(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const origin = window.location.origin;
  const canonicalUrl = `${origin}${window.location.pathname}`;
  const defaultImage = `${origin}/icons/pwa-512x512.png`;

  document.title = DEFAULT_TITLE;
  setCanonicalLink(canonicalUrl);
  setMetaTag('name', 'description', DEFAULT_DESCRIPTION);

  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:site_name', 'LOWERVIBE');
  setMetaTag('property', 'og:title', DEFAULT_TITLE);
  setMetaTag('property', 'og:description', DEFAULT_DESCRIPTION);
  setMetaTag('property', 'og:image', defaultImage);
  setMetaTag('property', 'og:image:alt', DEFAULT_TITLE);
  setMetaTag('property', 'og:url', canonicalUrl);

  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', DEFAULT_TITLE);
  setMetaTag('name', 'twitter:description', DEFAULT_DESCRIPTION);
  setMetaTag('name', 'twitter:image', defaultImage);

  setStructuredData({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'LOWERVIBE',
    applicationCategory: 'MusicApplication',
    operatingSystem: 'All',
    description: DEFAULT_DESCRIPTION,
  });
}
