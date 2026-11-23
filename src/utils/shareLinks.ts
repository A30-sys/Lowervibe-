const PRODUCTION_ORIGIN = 'https://lowervibemusic.web.app';

export function getTrustedShareOrigin(): string {
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;
  const { origin, hostname } = window.location;
  if (hostname === 'lowervibemusic.web.app' || hostname === 'lowervibemusic.firebaseapp.com') {
    return PRODUCTION_ORIGIN;
  }
  return origin || PRODUCTION_ORIGIN;
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
