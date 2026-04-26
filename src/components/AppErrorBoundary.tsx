import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App crashed:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center px-6"
          style={{ background: '#040d1a', color: '#f1f5f9' }}
        >
          <div
            className="w-full max-w-xl rounded-2xl p-6 text-center"
            style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(248,113,113,0.35)' }}
          >
            <h1 className="text-xl font-bold mb-3" style={{ color: '#f87171' }}>
              Something went wrong
            </h1>
            <p className="text-sm text-slate-300 mb-2">
              The app hit an unexpected error, but your work is still in the current session.
            </p>
            <p className="text-xs text-slate-500 mb-5 break-words">{this.state.message}</p>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

