import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary Component
 * 
 * This component catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 * In production, it shows a user-friendly message without technical details.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error only in development or with minimal details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      logger.error('ErrorBoundary', 'Uncaught error:', error);
      logger.error('ErrorBoundary', 'Component stack:', errorInfo.componentStack);
    } else {
      // Log minimal information in production
      logger.error('ErrorBoundary', 'An application error occurred');
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      return (
        <div className="p-6 max-w-xl mx-auto my-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
            Something went wrong
          </h2>
          
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            We're sorry, but an unexpected error occurred. Our team has been notified.
          </p>
          
          {/* Only show error details in development */}
          {isDevelopment && this.state.error && (
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded overflow-auto">
              <p className="font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {this.state.error.toString()}
              </p>
            </div>
          )}
          
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
} 