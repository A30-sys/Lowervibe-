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
