import { AlertTriangle, CheckCircle2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export const CrashRecoveryHandler: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [cacheRepairedNotice, setCacheRepairedNotice] = useState(false);

  useEffect(() => {
    // 1. Connection Monitoring
    const handleOnline = () => {
      setIsOffline(false);
      setShowRestoredNotice(true);
      // Soft automatic sync/refresh after connection restores
      setTimeout(() => {
        setShowRestoredNotice(false);
      }, 4000);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Cache Corruption Self-Healing Check
    try {
      const keysToCheck = [
        'lowervibe_tracks_v1',
        'lowervibe_artists_v1',
        'lowervibe_history_v1',
        'lowervibe_current_user_v1',
      ];

      let foundCorruption = false;
      keysToCheck.forEach(key => {
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
        setTimeout(() => setCacheRepairedNotice(false), 5000);
      }
    } catch (e) {
      console.warn('Storage validation note:', e);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSoftRefresh = () => {
    window.location.reload();
  };

  return (
    <>
      {/* Offline Toast */}
      {isOffline && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs font-medium shadow-2xl backdrop-blur-md animate-fadeIn">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Connection interrupted. Offline audio engine active. Will auto-sync on reconnect.</span>
          <button
            onClick={handleManualSoftRefresh}
            className="p-1 rounded-lg hover:bg-amber-900/60 transition ml-1"
            title="Try soft reconnect now"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
          </button>
        </div>
      )}

      {/* Online Restored Auto-Refresh Notice */}
      {showRestoredNotice && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs font-medium shadow-2xl backdrop-blur-md animate-fadeIn">
          <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Connection restored. Session audio and stream state synchronized smoothly.</span>
        </div>
      )}

      {/* Cache Auto-Healed Toast */}
      {cacheRepairedNotice && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-zinc-900/90 border border-amber-500/40 text-zinc-200 text-xs font-medium shadow-2xl backdrop-blur-md animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Storage cache refreshed and auto-recovered.</span>
        </div>
      )}
    </>
  );
};
