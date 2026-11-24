import { AlertTriangle, CheckCircle2, Info, Undo2, X } from 'lucide-react';
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

    setToasts((prev) => [...prev.slice(-3), newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
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
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, showError, showUndoToast, removeToast }}>
      {children}

      {/* Stacked floating alert banners: positioned top-right so never blocking mini-player */}
      <div
        className="fixed top-20 right-3 sm:right-6 z-70 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-24px)] sm:w-full pointer-events-none"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isInfo = toast.type === 'info';

          return (
            <div
              key={toast.id}
              role={isError ? 'alert' : 'status'}
              className={`pointer-events-auto relative overflow-hidden flex items-center gap-3 px-3.5 py-3 rounded-2xl shadow-[0_14px_34px_rgba(0,0,0,0.22)] backdrop-blur-xl border text-[13px] font-semibold animate-slide-up transition-all bg-[var(--surface)]/95 text-[var(--text)] ${
                isError
                  ? 'border-[var(--danger)]/45'
                  : isInfo
                  ? 'border-[var(--violet)]/35'
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

              <div
                className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
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

              <span className="flex-1 leading-snug">{toast.message}</span>

              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] hover:brightness-95 border border-[var(--border)] text-[var(--accent-text)] font-bold text-xs shrink-0 transition active:scale-95 cursor-pointer inline-flex items-center gap-1 min-h-[34px] whitespace-nowrap"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>{toast.action.label}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition shrink-0 cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
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
