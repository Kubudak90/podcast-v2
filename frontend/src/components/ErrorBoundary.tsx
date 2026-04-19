import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-pod-bg flex items-center justify-center p-4">
          <div className="bg-pod-elevated border border-pod-border rounded-2xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-pod-red/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-pod-red"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">
              Bir hata olustu
            </h2>

            <p className="text-pod-text-secondary mb-6">
              Beklenmeyen bir hata meydana geldi. Lutfen tekrar deneyin.
            </p>

            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-pod-text-secondary cursor-pointer hover:text-white text-sm">
                  Hata detaylari
                </summary>
                <pre className="mt-2 p-3 bg-pod-bg rounded-lg text-xs text-pod-red overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-2.5 bg-pod-red text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Tekrar Dene
              </button>

              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-2.5 bg-pod-active text-white rounded-lg font-medium hover:bg-pod-elevated transition-colors"
              >
                Ana Sayfa
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
