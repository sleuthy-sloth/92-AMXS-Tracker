import React, { Component } from 'react';
import { ShieldAlert } from 'lucide-react';

export class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || String(this.state.error) || "Something went wrong.";
      const details = (
        <div className="mt-4 p-4 bg-error/10 border border-error/20 rounded-xl text-left">
          <p className="text-on-surface text-sm font-mono break-words">{message}</p>
        </div>
      );

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full sleek-card text-center space-y-6">
            <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mx-auto text-error">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-on-background tracking-tight">Something went wrong</h2>
              <p className="text-on-surface-variant text-sm">
                The application encountered a critical error. Please try refreshing the page or contact support if the issue persists.
              </p>
            </div>
            {details}
            <button 
              onClick={() => window.location.reload()}
              className="sleek-button w-full bg-primary text-white"
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
