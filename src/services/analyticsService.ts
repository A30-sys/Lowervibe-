import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics, isSupported, logEvent, Analytics } from 'firebase/analytics';
import firebaseConfig from '../../firebase-applet-config.json';

export type CookieConsentLevel = 'all' | 'essential';

const COOKIE_CONSENT_KEY = 'lowervibe_cookie_consent_v1';
const SESSION_ID_KEY = 'lowervibe_analytics_sid_v1';

let analyticsInstance: Analytics | null = null;
let analyticsInitAttempted = false;

export function getCookieConsent(): CookieConsentLevel | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (val === 'all' || val === 'essential') return val;
  } catch {}
  return null;
}

export function setCookieConsent(level: CookieConsentLevel): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, level);
    window.dispatchEvent(new CustomEvent('lowervibe:cookie-consent', { detail: level }));
  } catch {}
  if (level === 'all') {
    void initFirebaseAnalytics();
  }
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const next = `lv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_ID_KEY, next);
    return next;
  } catch {
    return `lv-${Date.now().toString(36)}`;
  }
}

export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (analyticsInstance) return analyticsInstance;
  if (analyticsInitAttempted || typeof window === 'undefined') return null;
  analyticsInitAttempted = true;

  const measurementId = (firebaseConfig as { measurementId?: string }).measurementId;
  if (!measurementId) return null;

  try {
    const supported = await isSupported();
    if (!supported) return null;
    const app = getApps()[0] || initializeApp(firebaseConfig);
    analyticsInstance = getAnalytics(app);
    return analyticsInstance;
  } catch {
    return null;
  }
}

function dispatchAnalyticsBeacon(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/analytics/event', blob)) return;
    }
  } catch {}
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function trackPageView(pathname: string, title?: string): void {
  const consent = getCookieConsent();
  if (consent === 'essential') return;

  if (analyticsInstance) {
    try {
      logEvent(analyticsInstance, 'page_view', {
        page_path: pathname,
        page_title: title || (typeof document !== 'undefined' ? document.title : 'LOWERVIBE'),
      });
    } catch {}
  }

  dispatchAnalyticsBeacon({
    event: 'page_view',
    path: pathname,
    title: title || (typeof document !== 'undefined' ? document.title : 'LOWERVIBE'),
    sessionId: getOrCreateSessionId(),
    timestamp: new Date().toISOString(),
  });
}

export function trackEvent(
  eventName: string,
  params: Record<string, string | number | boolean> = {}
): void {
  const consent = getCookieConsent();
  if (consent === 'essential') return;

  if (analyticsInstance) {
    try {
      logEvent(analyticsInstance, eventName, params);
    } catch {}
  }

  dispatchAnalyticsBeacon({
    event: eventName,
    params,
    path: typeof window !== 'undefined' ? window.location.pathname : '/',
    sessionId: getOrCreateSessionId(),
    timestamp: new Date().toISOString(),
  });
}
