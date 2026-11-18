/**
 * Clean inline SVG data-URI fallbacks and studio sleeve generators.
 * Eliminates external stock photo placeholders so every visual is self-contained and authentic.
 */

export function makeCoverSvg(c1: string, c2: string, ring: string): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#g)"/>
        <circle cx="200" cy="200" r="112" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
        <circle cx="200" cy="200" r="76" fill="none" stroke="${ring}" stroke-opacity="0.35" stroke-width="2"/>
        <circle cx="200" cy="200" r="22" fill="#0B0B10" stroke="${ring}" stroke-width="3"/>
        <circle cx="200" cy="200" r="6" fill="${ring}"/>
      </svg>`
    )
  );
}

export function makeBannerSvg(c1: string, c2: string, accent: string): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400">
        <defs>
          <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#b)"/>
        <circle cx="300" cy="180" r="240" fill="${accent}" fill-opacity="0.16"/>
        <circle cx="920" cy="210" r="220" fill="#C6FF4A" fill-opacity="0.08"/>
      </svg>`
    )
  );
}

export function makeAvatarSvg(c1: string, c2: string, ring: string): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
          </linearGradient>
        </defs>
        <rect width="200" height="200" fill="url(#a)"/>
        <circle cx="100" cy="78" r="32" fill="${ring}" fill-opacity="0.22" stroke="${ring}" stroke-opacity="0.7" stroke-width="2.5"/>
        <path d="M44 168c8-30 30-46 56-46s48 16 56 46" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="3" stroke-linecap="round"/>
      </svg>`
    )
  );
}

export const DEFAULT_ARTWORK_SVG = makeCoverSvg('#12121A', '#1B1633', '#C6FF4A');
export const DEFAULT_BANNER_SVG = makeBannerSvg('#0B0B10', '#18122B', '#6C4BFF');
export const DEFAULT_AVATAR_SVG = makeAvatarSvg('#1E1B3A', '#101218', '#C6FF4A');
