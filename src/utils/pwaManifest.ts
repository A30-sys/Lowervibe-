export type PwaAppTarget = 'main' | 'creator';

export const MAIN_PWA_MANIFEST = '/manifest.json';
export const CREATOR_PWA_MANIFEST = '/manifest-creator.json';

export const MAIN_PWA_INSTALLED_KEY = 'lowervibe_main_pwa_installed_v1';
export const CREATOR_PWA_INSTALLED_KEY = 'lowervibe_creator_pwa_installed_v1';

export function setActivePwaManifest(target: PwaAppTarget): void {
  if (typeof document === 'undefined') return;
  const href = target === 'creator' ? CREATOR_PWA_MANIFEST : MAIN_PWA_MANIFEST;
  const title = target === 'creator' ? 'LV Creator' : 'LOWERVIBE';

  let link = document.head.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'manifest');
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) {
    link.setAttribute('href', href);
  }

  const appleTitle = document.head.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) {
    appleTitle.setAttribute('content', title);
  }
}

export function openPwaInstallPrompt(target: PwaAppTarget = 'main'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('lowervibe:open-install-prompt', {
      detail: { target },
    })
  );
}
