// Web Audio API notification chime & OS/PWA system notification helpers

let sharedAudioCtx: AudioContext | null = null;
let unlockBound = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedAudioCtx && sharedAudioCtx.state !== 'closed') {
    return sharedAudioCtx;
  }
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    sharedAudioCtx = new Ctor();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function initNotificationAudioUnlock(): () => void {
  if (typeof window === 'undefined' || unlockBound) return () => {};
  unlockBound = true;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });

  return () => {
    unlockBound = false;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

export type NotificationSoundVariant = 'artist' | 'admin' | 'default';

/**
 * Plays a crisp, pleasant real chime using Web Audio API.
 * Works offline and in installed PWAs without external audio asset requests.
 */
export async function playNotificationSound(
  variant: NotificationSoundVariant = 'default'
): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state !== 'running') return false;

    const now = ctx.currentTime;
    // Artist release = uplifting 3-note arpeggio; Admin update = clear 2-note chime
    const notes =
      variant === 'artist'
        ? [587.33, 783.99, 1046.5] // D5 -> G5 -> C6
        : variant === 'admin'
        ? [659.25, 987.77] // E5 -> B5
        : [587.33, 880.0]; // D5 -> A5

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.095;
      const stop = start + 0.42;

      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();
      const harmonicGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      harmonic.type = 'triangle';
      harmonic.frequency.setValueAtTime(freq * 2, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, stop);

      harmonicGain.gain.setValueAtTime(0.0001, start);
      harmonicGain.gain.exponentialRampToValueAtTime(0.045, start + 0.012);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, stop * 0.99);

      osc.connect(gain);
      harmonic.connect(harmonicGain);
      harmonicGain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      harmonic.start(start);
      osc.stop(stop);
      harmonic.stop(stop);
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Triggers a native browser / installed PWA device notification when permission is granted,
 * routing taps back to the exact song, artist, or studio update inside LOWERVIBE.
 */
export async function showDeviceNotification(input: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;

  const targetUrl = input.url || '/';
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body: input.body,
    icon: input.icon || '/icons/pwa-512x512.png',
    badge: '/icons/pwa-192x192.png',
    tag: input.tag || `lowervibe-${Date.now()}`,
    renotify: true,
    vibrate: [160, 60, 160],
    data: { url: targetUrl },
  };

  try {
    if ('serviceWorker' in navigator) {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1200)),
        ]);
      }
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(input.title, options);
        return true;
      }
    }
  } catch {
    // Fallback to Notification constructor below
  }

  try {
    const n = new Notification(input.title, options);
    n.onclick = () => {
      try {
        window.focus();
        if (targetUrl && targetUrl !== window.location.pathname) {
          window.history.pushState({}, '', targetUrl);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } catch {}
    };
    return true;
  } catch {
    return false;
  }
}
