import React, { useEffect, useState } from 'react';
import { LowerVibeLogo } from './brand/LowerVibeLogo';

export const InitialLoader: React.FC = () => {
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem('lowervibe_session_booted');
    } catch {
      return false;
    }
  });
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (!loading) return;

    try {
      sessionStorage.setItem('lowervibe_session_booted', 'true');
    } catch {}

    const timer1 = setTimeout(() => setFade(true), 220);
    const timer2 = setTimeout(() => setLoading(false), 380);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [loading]);

  if (!loading) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--lv-bg)] text-[var(--lv-text)] transition-opacity duration-200 pointer-events-none ${
        fade ? 'opacity-0' : 'opacity-100 pointer-events-auto'
      }`}
    >
      <div className="flex flex-col items-center space-y-4 text-center px-6">
        <LowerVibeLogo size="lg" showTagline={false} isPlaying={true} />
        <p className="text-xs text-[var(--lv-muted)]">Loading your music...</p>
      </div>
    </div>
  );
};
