import { Check } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAudio } from '../../context/AudioContext';

interface PullToRefreshProps {
  children: React.ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 68;
const MAX_PULL_DISTANCE = 112;
const MIN_SPIN_MS = 650;
const REFRESH_TIMEOUT_MS = 6000;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.closest(
      'input, textarea, select, option, button, a, [role="slider"], [role="dialog"], [contenteditable="true"], [data-no-pull-refresh]'
    )
  ) {
    return true;
  }

  let el: HTMLElement | null = target;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      el.scrollTop > 2
    ) {
      return true;
    }
    if (
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      el.scrollWidth > el.clientWidth + 4
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ children, disabled = false }) => {
  const { refreshCatalog } = useAudio();
  const [pullDistance, setPullDistance] = useState(0);
  const [status, setStatus] = useState<'idle' | 'pulling' | 'ready' | 'refreshing' | 'done'>('idle');

  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const thresholdVibratedRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const triggerRefresh = useCallback(async () => {
    if (statusRef.current === 'refreshing') return;
    setStatus('refreshing');
    setPullDistance(PULL_THRESHOLD);

    const minSpinPromise = new Promise<void>((resolve) => {
      window.setTimeout(resolve, MIN_SPIN_MS);
    });
    const timeoutPromise = new Promise<boolean>((resolve) => {
      window.setTimeout(() => resolve(true), REFRESH_TIMEOUT_MS);
    });

    try {
      await Promise.all([minSpinPromise, Promise.race([refreshCatalog(), timeoutPromise])]);
    } catch {
      await minSpinPromise;
    }

    setStatus('done');
    resetTimerRef.current = window.setTimeout(() => {
      setPullDistance(0);
      setStatus('idle');
      resetTimerRef.current = null;
    }, 520);
  }, [refreshCatalog]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || statusRef.current === 'refreshing') return;
    if (e.touches.length !== 1) return;
    if ((window.scrollY || document.documentElement.scrollTop || 0) > 2) return;
    if (isInteractiveTarget(e.target)) return;

    startYRef.current = e.touches[0].clientY;
    startXRef.current = e.touches[0].clientX;
    pullingRef.current = false;
    thresholdVibratedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || statusRef.current === 'refreshing') return;
    if (startYRef.current === null || startXRef.current === null || e.touches.length !== 1) return;
    if ((window.scrollY || document.documentElement.scrollTop || 0) > 2) {
      startYRef.current = null;
      return;
    }

    const deltaY = e.touches[0].clientY - startYRef.current;
    const deltaX = Math.abs(e.touches[0].clientX - startXRef.current);

    if (!pullingRef.current) {
      if (deltaY <= 8 || deltaX > deltaY * 0.85) return;
      pullingRef.current = true;
    }

    const damped = Math.min(MAX_PULL_DISTANCE, Math.round(deltaY * 0.48));
    setPullDistance(Math.max(0, damped));

    if (damped >= PULL_THRESHOLD) {
      if (!thresholdVibratedRef.current) {
        thresholdVibratedRef.current = true;
        try {
          if ('vibrate' in navigator) navigator.vibrate?.(12);
        } catch {}
      }
      setStatus('ready');
    } else {
      setStatus('pulling');
    }
  };

  const handleTouchEnd = () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    startXRef.current = null;

    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (statusRef.current === 'ready') {
      void triggerRefresh();
    } else if (statusRef.current !== 'refreshing') {
      setPullDistance(0);
      setStatus('idle');
    }
  };

  const isVisible = status !== 'idle' || pullDistance > 0;
  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const ringCircumference = 2 * Math.PI * 22;
  const ringOffset = ringCircumference * (1 - (status === 'refreshing' || status === 'done' ? 1 : progress));
  const dragRotation = Math.round(pullDistance * 3.2);

  const label =
    status === 'refreshing'
      ? 'Refreshing LOWERVIBE...'
      : status === 'done'
      ? 'Feed up to date'
      : status === 'ready'
      ? 'Release to refresh'
      : 'Pull down to refresh';

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="relative flex-1 flex flex-col w-full"
    >
      {/* Interactive Pull-to-Refresh Indicator with Spinning Round LOWERVIBE Logo */}
      <div
        aria-live="polite"
        className="w-full flex flex-col items-center justify-center overflow-hidden select-none pointer-events-none transition-[height,opacity] duration-200 ease-out"
        style={{
          height: isVisible ? `${Math.max(52, Math.min(86, pullDistance + 16))}px` : '0px',
          opacity: isVisible ? Math.max(0.25, Math.min(1, progress * 1.15)) : 0,
        }}
      >
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-[var(--surface)]/95 border border-[var(--border)] shadow-lg backdrop-blur-md">
          <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
            <svg
              className="absolute inset-0 w-full h-full -rotate-90"
              viewBox="0 0 50 50"
              aria-hidden="true"
            >
              <circle
                cx="25"
                cy="25"
                r="22"
                fill="none"
                stroke="var(--border)"
                strokeWidth="2.5"
              />
              <circle
                cx="25"
                cy="25"
                r="22"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="transition-[stroke-dashoffset] duration-150 ease-out"
              />
            </svg>

            {status === 'done' ? (
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shadow-sm animate-fadeIn">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            ) : (
              <img
                src="/icons/icon-192.svg"
                alt="LOWERVIBE refresh emblem"
                className={`w-8 h-8 rounded-full object-cover shadow-sm ${
                  status === 'refreshing' ? 'animate-lv-spin' : ''
                }`}
                style={
                  status === 'refreshing'
                    ? undefined
                    : { transform: `rotate(${dragRotation}deg)` }
                }
              />
            )}
          </div>

          <div className="text-left pr-1">
            <p className="text-[11px] font-bold text-[var(--text)] leading-tight">{label}</p>
            <p className="text-[10px] text-[var(--text-muted)] leading-tight">
              {status === 'refreshing'
                ? 'Syncing tracks & library'
                : status === 'done'
                ? 'Catalog healthy'
                : 'Audio keeps playing'}
            </p>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
};
