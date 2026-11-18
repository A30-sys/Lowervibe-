import { AlertTriangle, Check, Copy, RefreshCw } from 'lucide-react';
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
  componentStack: string;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      errorStack: '',
      componentStack: '',
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected error occurred.',
      errorStack: error?.stack || '',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('LOWERVIBE Runtime Exception:', error, errorInfo);
    this.setState({ componentStack: errorInfo?.componentStack || '' });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyLog = () => {
    const fullLog = `LOWERVIBE Error\nMessage: ${this.state.errorMessage}\nStack: ${this.state.errorStack}`;
    navigator.clipboard.writeText(fullLog);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--lv-bg)] text-[var(--lv-text)] flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-[28px] bg-[var(--lv-surface)] border border-[var(--lv-border)] shadow-2xl text-center space-y-5 animate-slideUp">
            <div className="w-14 h-14 rounded-2xl bg-[var(--lv-danger)]/15 border border-[var(--lv-danger)]/30 text-[var(--lv-danger)] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-extrabold font-heading text-[var(--lv-text)]">
                Something went wrong
              </h2>
              <p className="text-xs sm:text-sm text-[var(--lv-muted)] leading-relaxed">
                Please reload the app to continue listening. Your saved playback position is safe.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-[var(--lv-elevated)] border border-[var(--lv-border)] text-left font-mono text-[11px] text-[var(--lv-danger)] max-h-28 overflow-y-auto break-all">
              {this.state.errorMessage}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-2xl bg-[var(--lv-accent)] text-[#0A0B0A] font-bold text-sm transition hover:brightness-95 active:scale-95 flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyLog}
                className="py-3 px-4 rounded-2xl bg-[var(--lv-elevated)] hover:opacity-90 text-[var(--lv-text)] text-xs font-semibold border border-[var(--lv-border)] transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer min-h-[48px]"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-4 h-4 text-[var(--lv-accent-text)]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy details</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
