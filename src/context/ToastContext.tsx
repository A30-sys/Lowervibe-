import { AlertTriangle, ArrowRight, CheckCircle2, Info, RefreshCw, Undo2, X } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_ARTWORK_SVG } from '../utils/artworkFallback';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  title?: string;
  message: string;
  artworkUrl?: string;
  type?: 'success' | 'info' | 'error';
  duration?: number;
  action?: ToastAction;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (
    message: string,
    type?: 'success' | 'info' | 'error',
    options?: { duration?: number; action?: ToastAction; title?: string; artworkUrl?: string }
  ) => void;
  showError: (message: string, retryAction?: () => void) => void;
  showUndoToast: (message: string, onUndo: () => void) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastCardProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onRemove }) => {
  const [isPaused, setIsPaused] = useState(false);
  const remainingRef = useRef<number>(toast.duration || 3200);
  const startedAtRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);

  const scheduleRemoval = useCallback(
    (delayMs: number) => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      startedAtRef.current = Date.now();
      timerRef.current = window.setTimeout(() => {
        onRemove(toast.id);
      }, Math.max(200, delayMs));
    },
    [onRemove, toast.id]
  );

  useEffect(() => {
    scheduleRemoval(remainingRef.current);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [scheduleRemoval]);

  const handlePause = () => {
    if (isPaused) return;
    setIsPaused(true);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const elapsed = Date.now() - startedAtRef.current;
    remainingRef.current = Math.max(400, remainingRef.current - elapsed);
  };

  const handleResume = () => {
    if (!isPaused) return;
    setIsPaused(false);
    scheduleRemoval(remainingRef.current);
  };

  const isError = toast.type === 'error';
  const isInfo = toast.type === 'info';
  const actionLabelLower = (toast.action?.label || '').toLowerCase();

  const renderActionIcon = () => {
    if (actionLabelLower.includes('undo')) return <Undo2 className="w-3.5 h-3.5" />;
    if (actionLabelLower.includes('retry') || actionLabelLower.includes('try')) {
      return <RefreshCw className="w-3.5 h-3.5" />;
    }
    return <ArrowRight className="w-3.5 h-3.5" />;
  };

  return (
    <div
      role={isError ? 'alert' : 'status'}
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
      onTouchStart={handlePause}
      onTouchEnd={handleResume}
      className={`pointer-events-auto relative overflow-hidden flex items-center gap-3 px-3.5 py-3 rounded-2xl shadow-[0_16px_38px_rgba(0,0,0,0.26)] backdrop-blur-xl border text-[13px] animate-slide-up transition-all bg-[var(--surface)]/95 text-[var(--text)] ${
        isError
          ? 'border-[var(--danger)]/45'
          : isInfo
          ? 'border-[var(--violet)]/40'
          : 'border-[var(--border-strong)]'
      }`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-[2px] ${
          isError
            ? 'bg-[var(--danger)]'
            : isInfo
            ? 'bg-[var(--violet)]'
            : 'bg-[#c6ff3d]'
        }`}
      />

      {toast.artworkUrl ? (
        <img
          src={toast.artworkUrl}
          alt={toast.title || 'LOWERVIBE'}
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
          }}
          className="w-9 h-9 rounded-xl object-cover border border-[var(--border)] shrink-0"
        />
      ) : (
        <div
          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
            isError
              ? 'bg-[var(--danger)]/14 border-[var(--danger)]/30 text-[var(--danger)]'
              : isInfo
              ? 'bg-[var(--violet)]/14 border-[var(--violet)]/30 text-[var(--violet)]'
              : 'bg-[#c6ff3d]/18 border-[#c6ff3d]/35 text-[var(--accent-text)]'
          }`}
        >
          {isError ? (
            <AlertTriangle className="w-4 h-4" />
          ) : isInfo ? (
            <Info className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="text-xs font-extrabold text-[var(--text)] leading-tight truncate mb-0.5">
            {toast.title}
          </div>
        )}
        <span className="block text-[12.5px] font-medium text-[var(--text-dim)] leading-snug line-clamp-3">
          {toast.message}
        </span>
      </div>

      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onRemove(toast.id);
          }}
          className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] hover:brightness-95 border border-[var(--border)] text-[var(--accent-text)] font-bold text-xs shrink-0 transition active:scale-95 cursor-pointer inline-flex items-center gap-1 min-h-[36px] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <span>{toast.action.label}</span>
          {renderActionIcon()}
        </button>
      )}

      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        className="min-h-[38px] min-w-[38px] -mr-1 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Auto-dismiss progress hairline */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 h-[2px] opacity-65 animate-toast-countdown ${
          isError
            ? 'bg-[var(--danger)]'
            : isInfo
            ? 'bg-[var(--violet)]'
            : 'bg-[var(--accent)]'
        }`}
        style={{
          animationDuration: `${toast.duration || 3200}ms`,
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      />
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: 'success' | 'info' | 'error' = 'success',
      options?: { duration?: number; action?: ToastAction; title?: string; artworkUrl?: string }
    ) => {
      const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      const duration = options?.duration || (type === 'error' ? 5400 : 3800);
      const newToast: Toast = {
        id,
        title: options?.title,
        message,
        artworkUrl: options?.artworkUrl,
        type,
        duration,
        action: options?.action,
      };

      setToasts((prev) => [...prev.slice(-2), newToast]);
    },
    []
  );

  const showError = useCallback(
    (message: string, retryAction?: () => void) => {
      showToast(message, 'error', {
        duration: 6000,
        action: retryAction ? { label: 'Retry', onClick: retryAction } : undefined,
      });
    },
    [showToast]
  );

  const showUndoToast = useCallback(
    (message: string, onUndo: () => void) => {
      showToast(message, 'info', {
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: onUndo,
        },
      });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, showError, showUndoToast, removeToast }}>
      {children}

      {/* Stacked floating alert container with standalone WebApp safe-area clearance */}
      <div
        className="fixed top-[calc(env(safe-area-inset-top,0px)+4.5rem)] left-3 right-3 sm:left-auto sm:right-6 sm:w-[392px] z-[70] flex flex-col gap-2.5 pointer-events-none"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
