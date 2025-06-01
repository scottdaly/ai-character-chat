import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // You could send this to an error reporting service
    // reportError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-zinc-800 flex items-center justify-center">
          <div className="max-w-md mx-auto p-6 text-center">
            <div className="text-red-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-100 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-400 mb-4">
              We're sorry, but something unexpected happened. Please try
              refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-gray-400 cursor-pointer">
                  Error Details
                </summary>
                <pre className="mt-2 p-3 bg-zinc-900 text-red-400 text-xs overflow-auto rounded">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
