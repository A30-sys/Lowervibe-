const PRODUCTION_ORIGIN = 'https://lowervibemusic.web.app';

export function getTrustedShareOrigin(): string {
  const configured =
    typeof import.meta !== 'undefined' &&
    typeof import.meta.env?.VITE_PUBLIC_SITE_URL === 'string'
      ? import.meta.env.VITE_PUBLIC_SITE_URL.trim().replace(/\/+$/, '')
      : '';
  if (configured.startsWith('https://')) {
    return configured;
  }
  return PRODUCTION_ORIGIN;
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

export function getChartsShareUrl(options?: { tab?: string; genre?: string }): string {
  const params = new URLSearchParams();
  if (options?.tab && options.tab !== 'most-played') {
    params.set('tab', options.tab);
  }
  if (options?.genre && options.genre.trim()) {
    params.set('genre', options.genre.trim());
  }
  const qs = params.toString();
  return `${getTrustedShareOrigin()}/charts${qs ? `?${qs}` : ''}`;
}

export function getShortChartsShareUrl(genre?: string): string {
  if (genre && genre.trim()) {
    return `${getTrustedShareOrigin()}/charts?genre=${encodeURIComponent(genre.trim())}`;
  }
  return `${getTrustedShareOrigin()}/charts`;
}
