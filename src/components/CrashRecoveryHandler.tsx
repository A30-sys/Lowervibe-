import { CheckCircle2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export const CrashRecoveryHandler: React.FC = () => {
  const [cacheRepairedNotice, setCacheRepairedNotice] = useState(false);

  useEffect(() => {
    try {
      const keysToCheck = [
        'lowervibe_tracks_v1',
        'lowervibe_artists_v1',
        'lowervibe_history_v1',
        'lowervibe_current_user_v1',
      ];

      let foundCorruption = false;
      keysToCheck.forEach((key) => {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            JSON.parse(item);
          } catch (err) {
            console.warn(`Detected corrupted cache key [${key}], auto-repairing...`, err);
            localStorage.removeItem(key);
            foundCorruption = true;
          }
        }
      });

      if (foundCorruption) {
        setCacheRepairedNotice(true);
        const timer = window.setTimeout(() => setCacheRepairedNotice(false), 4500);
        return () => window.clearTimeout(timer);
      }
    } catch (e) {
      console.warn('Storage validation note:', e);
    }
  }, []);

  if (!cacheRepairedNotice) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] text-xs font-medium shadow-2xl animate-fadeIn">
      <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
      <span>Storage cache refreshed cleanly.</span>
    </div>
  );
};
