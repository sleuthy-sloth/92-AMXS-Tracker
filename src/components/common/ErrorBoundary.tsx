import React, { Component } from 'react';
import { ShieldAlert } from 'lucide-react';
import { FirestoreErrorInfo } from '../../firebase';

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
      let displayError = "Something went wrong.";
      let details = null;

      try {
        const parsed = JSON.parse(this.state.error.message) as FirestoreErrorInfo;
        if (parsed.error) {
          displayError = "Database Access Error";
          details = (
            <div className="mt-4 p-4 bg-error/10 border border-error/20 rounded-xl text-left">
              <p className="text-error font-bold text-sm">Operation: {parsed.operationType.toUpperCase()}</p>
              <p className="text-on-surface-variant text-xs mt-1">Path: {parsed.path || 'Unknown'}</p>
              <p className="text-on-surface text-sm mt-2 font-mono">{parsed.error}</p>
              <div className="mt-4 pt-4 border-t border-error/10">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Auth Context</p>
                <p className="text-xs text-on-surface-variant">User ID: {parsed.authInfo.userId || 'Not Logged In'}</p>
                <p className="text-xs text-on-surface-variant">Email: {parsed.authInfo.email || 'N/A'}</p>
              </div>
            </div>
          );
        }
      } catch (e) {
        displayError = this.state.error.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full sleek-card text-center space-y-6">
            <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mx-auto text-error">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-on-background tracking-tight">{displayError}</h2>
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
