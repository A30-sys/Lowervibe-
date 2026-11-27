const FALLBACK_PRODUCTION_ORIGIN = 'https://lowervibemusic.web.app';

export function getTrustedShareOrigin(): string {
  const configured =
    typeof import.meta !== 'undefined' &&
    typeof import.meta.env?.VITE_PUBLIC_SITE_URL === 'string'
      ? import.meta.env.VITE_PUBLIC_SITE_URL.trim().replace(/\/+$/, '')
      : '';
  if (configured.startsWith('https://') || configured.startsWith('http://')) {
    return configured;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.trim().replace(/\/+$/, '');
    if (origin.startsWith('https://') || origin.startsWith('http://')) {
      return origin;
    }
  }
  return FALLBACK_PRODUCTION_ORIGIN;
}

export function getPlatformShareUrl(): string {
  return `${getTrustedShareOrigin()}/`;
}

export function getTrackShareUrl(trackId: string): string {
  return `${getTrustedShareOrigin()}/tracks/${encodeURIComponent(trackId)}`;
}

export function getShortTrackShareUrl(trackId: string): string {
  return `${getTrustedShareOrigin()}/s/${encodeURIComponent(trackId)}`;
}

export function getArtistShareUrl(artist: { id: string; slug?: string }): string {
  const handleOrId = (artist.slug || artist.id).trim();
  return `${getTrustedShareOrigin()}/artists/${encodeURIComponent(handleOrId)}`;
}

export function getShortArtistShareUrl(artist: { id: string; slug?: string }): string {
  const handleOrId = (artist.slug || artist.id).trim();
  return `${getTrustedShareOrigin()}/a/${encodeURIComponent(handleOrId)}`;
}

export function getChartsShareUrl(options?: { tab?: string; genre?: string; trackId?: string }): string {
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
  return `${getTrustedShareOrigin()}/charts${qs ? `?${qs}` : ''}`;
}

export function getShortChartsShareUrl(
  genreOrOptions?: string | { tab?: string; genre?: string; trackId?: string }
): string {
  if (typeof genreOrOptions === 'string') {
    if (genreOrOptions.trim()) {
      return `${getTrustedShareOrigin()}/charts?genre=${encodeURIComponent(genreOrOptions.trim())}`;
    }
    return `${getTrustedShareOrigin()}/charts`;
  }
  return getChartsShareUrl(genreOrOptions);
}
