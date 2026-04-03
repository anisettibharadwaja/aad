import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.authInfo) {
            errorMessage = `System Access Error: ${parsed.error}`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        // Not a JSON error message
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6 font-mono">
          <div className="hardware-card max-w-md w-full p-8 space-y-6 border-red-500/30 bg-red-500/5">
            <div className="flex items-center gap-4 text-red-500">
              <AlertCircle size={32} />
              <h2 className="text-xl font-bold uppercase tracking-widest">SYSTEM FAILURE</h2>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs opacity-60 uppercase tracking-widest">Error Diagnostics:</p>
              <div className="bg-ink/5 p-4 border border-ink/10 rounded font-mono text-[10px] break-words">
                {errorMessage}
              </div>
            </div>

            {isFirestoreError && (
              <p className="text-[10px] opacity-60 leading-relaxed uppercase">
                THE SYSTEM ENCOUNTERED A PERMISSION RESTRICTION. THIS MAY BE DUE TO AN EXPIRED SESSION OR INSUFFICIENT CLEARANCE.
              </p>
            )}

            <button
              onClick={this.handleReset}
              className="hardware-btn w-full py-4 flex items-center justify-center gap-3 group"
            >
              <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
              <span>REBOOT SYSTEM</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
