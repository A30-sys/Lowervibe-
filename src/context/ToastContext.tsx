import { CheckCircle2, Info, Undo2, X, AlertTriangle } from 'lucide-react';
import React, { createContext, useContext, useState } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'error';
  duration?: number;
  action?: ToastAction;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (
    message: string,
    type?: 'success' | 'info' | 'error',
    options?: { duration?: number; action?: ToastAction }
  ) => void;
  showError: (message: string, retryAction?: () => void) => void;
  showUndoToast: (message: string, onUndo: () => void) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (
    message: string,
    type: 'success' | 'info' | 'error' = 'success',
    options?: { duration?: number; action?: ToastAction }
  ) => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const duration = options?.duration || (type === 'error' ? 5000 : 3200);
    const newToast: Toast = { id, message, type, duration, action: options?.action };

    setToasts(prev => [...prev.slice(-3), newToast]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const showError = (message: string, retryAction?: () => void) => {
    showToast(message, 'error', {
      duration: 6000,
      action: retryAction ? { label: 'Retry', onClick: retryAction } : undefined,
    });
  };

  const showUndoToast = (message: string, onUndo: () => void) => {
    showToast(message, 'info', {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: onUndo,
      },
    });
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, showError, showUndoToast, removeToast }}>
      {children}

      {/* Stacked floating Toast Notifications: positioned top-right so never blocking player */}
      <div
        className="fixed top-20 right-3 sm:right-6 z-70 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-2 sm:px-0"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-2xl border text-xs font-semibold animate-slideDown transition-all bg-[var(--surface)]/95 text-[var(--text)] ${
              toast.type === 'error'
                ? 'border-[var(--danger)]/60'
                : toast.type === 'info'
                ? 'border-[var(--border-strong)]'
                : 'border-[var(--border-strong)]'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-[var(--danger)] shrink-0" />
            ) : toast.type === 'info' ? (
              <Info className="w-4 h-4 text-[var(--violet)] shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
            )}

            <span className="flex-1 leading-snug">{toast.message}</span>

            {/* Optional action/undo button */}
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  removeToast(toast.id);
                }}
                className="px-2.5 py-1 rounded-full bg-[var(--surface-2)] hover:brightness-95 border border-[var(--border)] text-[var(--accent-text)] font-bold text-[11px] shrink-0 transition active:scale-95 cursor-pointer flex items-center gap-1"
              >
                <Undo2 className="w-3 h-3" />
                <span>{toast.action.label}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition shrink-0 cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
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
