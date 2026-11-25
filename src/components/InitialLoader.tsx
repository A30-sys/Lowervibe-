import React, { useEffect } from 'react';
import { LowerVibeMark } from './brand/LowerVibeLogo';

export const LowerVibeWaveLoader: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
    <div className="relative w-12 h-12 rounded-2xl bg-[#0A0B0A] border border-[#C6FF3D]/35 flex items-center justify-center shadow-md">
      <LowerVibeMark className="w-9 h-9" animated />
    </div>
    {label && <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>}
  </div>
);

/**
 * Coordinates the instant pre-React #lv-boot-splash in index.html so the app
 * never flashes a blank white screen and fades smoothly into the live feed.
 */
export const InitialLoader: React.FC = () => {
  useEffect(() => {
    const splash = document.getElementById('lv-boot-splash');
    if (!splash) return;

    let alreadyBooted = false;
    try {
      alreadyBooted = sessionStorage.getItem('lowervibe_session_booted') === 'true';
      sessionStorage.setItem('lowervibe_session_booted', 'true');
    } catch {}

    const fadeDelay = alreadyBooted ? 80 : 280;
    const timer1 = window.setTimeout(() => {
      splash.classList.add('lv-boot-hide');
    }, fadeDelay);

    const timer2 = window.setTimeout(() => {
      splash.remove();
    }, fadeDelay + 300);

    return () => {
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
    };
  }, []);

  return null;
};
