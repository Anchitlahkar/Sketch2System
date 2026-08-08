import React from 'react';
import { AlertOctagon } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Without this, a single malformed field in a model response white-screens the
 * whole app. Validation should prevent that, but a render-time crash should still
 * degrade to a recoverable screen rather than a blank page.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  override render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="h-screen w-screen bg-[#0F1115] text-[#E0E0E0] flex items-center justify-center p-6 font-mono">
        <div className="max-w-lg w-full bg-[#15181E] border border-red-500/40 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3 text-red-400">
            <AlertOctagon className="w-6 h-6 shrink-0" />
            <h1 className="text-sm font-bold">Sketch2System hit an unexpected error</h1>
          </div>
          <p className="text-xs text-white/60">
            The interface crashed while rendering. Your last analysis was not saved. Reloading starts a fresh session.
          </p>
          <pre className="text-[11px] text-red-300 bg-black/40 border border-white/10 rounded p-3 overflow-x-auto whitespace-pre-wrap">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors cursor-pointer"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
