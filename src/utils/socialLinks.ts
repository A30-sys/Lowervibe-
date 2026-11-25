import { PlatformSocialLinks } from '../types';

export interface SocialPlatformField {
  key: keyof PlatformSocialLinks;
  label: string;
  placeholder: string;
  helperText: string;
}

export const PLATFORM_SOCIAL_FIELDS: SocialPlatformField[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp Channel / Community',
    placeholder: 'https://whatsapp.com/channel/...',
    helperText: 'Official LOWERVIBE WhatsApp channel or group invite link.',
  },
  {
    key: 'facebook',
    label: 'Facebook Page',
    placeholder: 'https://facebook.com/lowervibemusic',
    helperText: 'Official LOWERVIBE Facebook page URL.',
  },
  {
    key: 'instagram',
    label: 'Instagram Profile',
    placeholder: 'https://instagram.com/lowervibemusic',
    helperText: 'Official LOWERVIBE Instagram handle URL.',
  },
  {
    key: 'tiktok',
    label: 'TikTok Profile',
    placeholder: 'https://tiktok.com/@lowervibemusic',
    helperText: 'Official LOWERVIBE TikTok creator/brand page.',
  },
  {
    key: 'youtube',
    label: 'YouTube Channel',
    placeholder: 'https://youtube.com/@lowervibemusic',
    helperText: 'Official LOWERVIBE YouTube channel URL.',
  },
  {
    key: 'x',
    label: 'X (Twitter) Profile',
    placeholder: 'https://x.com/lowervibemusic',
    helperText: 'Official LOWERVIBE X profile URL.',
  },
];

/**
 * Normalizes and validates an administrator-entered social URL.
 * Allows only http:// or https:// links and rejects dangerous protocols (javascript:, data:, etc.).
 */
export function sanitizeSocialUrl(raw?: string | null): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return undefined;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.includes('.') && !trimmed.includes(' ')
    ? `https://${trimmed}`
    : '';

  if (!withProtocol) return undefined;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return undefined;
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return undefined;
    }
    return parsed.href;
  } catch {
    return undefined;
  }
}

export function sanitizePlatformSocialLinks(
  raw?: Partial<PlatformSocialLinks> | null
): PlatformSocialLinks {
  const out: PlatformSocialLinks = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const field of PLATFORM_SOCIAL_FIELDS) {
    const cleaned = sanitizeSocialUrl(raw[field.key]);
    if (cleaned) {
      out[field.key] = cleaned;
    }
  }
  return out;
}
