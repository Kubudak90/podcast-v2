import { Component, Fragment, createRef } from 'react';
import type { ErrorInfo, ReactNode, RefObject } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  resetKey: number;
}

const actionButtonClass =
  'inline-flex items-center justify-center min-h-11 min-w-11 px-6 py-2.5 text-white rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

class ErrorBoundary extends Component<Props, State> {
  private headingRef: RefObject<HTMLHeadingElement | null> = createRef();

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, resetKey: 0 };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  componentDidMount() {
    this.focusHeading();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (!prevState.hasError) {
      this.focusHeading();
    }
  }

  focusHeading() {
    if (this.state.hasError && !this.props.fallback) {
      this.headingRef.current?.focus();
    }
  }

  handleRetry = () => {
    this.setState((state) => ({
      hasError: false,
      resetKey: state.resetKey + 1,
    }));
  };

  handleHome = () => {
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="min-h-screen bg-pod-bg flex items-center justify-center p-4"
          role="alert"
          aria-labelledby="error-boundary-title"
        >
          <div className="bg-pod-elevated border border-pod-border rounded-2xl p-8 max-w-md w-full text-center">
            <div
              className="w-16 h-16 bg-pod-red/20 rounded-full flex items-center justify-center mx-auto mb-4"
              aria-hidden="true"
            >
              <svg
                className="w-8 h-8 text-pod-red"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1
              ref={this.headingRef}
              id="error-boundary-title"
              tabIndex={-1}
              className="text-xl font-bold text-white mb-2 outline-none"
            >
              Bir hata olustu
            </h1>

            <p className="text-pod-text-secondary mb-6">
              Beklenmeyen bir hata meydana geldi. Lutfen tekrar deneyin.
            </p>

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleRetry}
                className={`${actionButtonClass} bg-pod-red hover:bg-red-600`}
              >
                Tekrar Dene
              </button>

              <button
                type="button"
                onClick={this.handleHome}
                className={`${actionButtonClass} bg-pod-active hover:bg-pod-elevated`}
              >
                Ana Sayfa
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}

export default ErrorBoundary;
