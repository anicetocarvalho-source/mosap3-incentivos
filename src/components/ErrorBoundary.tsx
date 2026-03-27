import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
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
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md text-center">
            <div className="mb-4 text-5xl">⚠️</div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
              Ocorreu um erro inesperado
            </h1>
            <p className="mb-6 text-gray-600">
              A aplicação encontrou um problema. Tente recarregar a página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-green-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-800 transition-colors"
            >
              Recarregar página
            </button>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-xs text-gray-400">
                  Detalhes técnicos
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-600">
                  {this.state.error.message}
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

export default ErrorBoundary;
