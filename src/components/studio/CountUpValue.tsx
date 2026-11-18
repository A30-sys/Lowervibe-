import React, { useEffect, useRef, useState } from 'react';

interface UseCountUpOptions {
  durationMs?: number;
  replayKey?: number;
}

export function useCountUp(targetValue: number, options: UseCountUpOptions = {}): number {
  const { durationMs = 700, replayKey = 0 } = options;
  const safeTarget = Number.isFinite(targetValue) ? Math.max(0, Math.round(targetValue)) : 0;

  const [displayValue, setDisplayValue] = useState<number>(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return reduced || durationMs <= 0 ? safeTarget : 0;
  });
  const currentDisplayedRef = useRef<number>(displayValue);
  const lastReplayKeyRef = useRef<number>(replayKey);
  const hasMountedRef = useRef<boolean>(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const isManualReplay = lastReplayKeyRef.current !== replayKey;
    lastReplayKeyRef.current = replayKey;

    const startValue = !hasMountedRef.current || isManualReplay ? 0 : currentDisplayedRef.current;
    hasMountedRef.current = true;

    if (prefersReducedMotion || durationMs <= 0) {
      currentDisplayedRef.current = safeTarget;
      setDisplayValue(safeTarget);
      return;
    }

    if (startValue === safeTarget && !isManualReplay) {
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out for crisp, smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = Math.round(startValue + (safeTarget - startValue) * eased);

      currentDisplayedRef.current = nextVal;
      setDisplayValue(nextVal);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      } else {
        currentDisplayedRef.current = safeTarget;
        setDisplayValue(safeTarget);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [safeTarget, durationMs, replayKey]);

  return displayValue;
}

interface CountUpValueProps {
  value: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
  replayKey?: number;
  className?: string;
}

export const CountUpValue: React.FC<CountUpValueProps> = ({
  value,
  suffix = '',
  prefix = '',
  durationMs = 700,
  replayKey = 0,
  className = '',
}) => {
  const animated = useCountUp(value, { durationMs, replayKey });
  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {animated.toLocaleString()}
      {suffix}
    </span>
  );
};
