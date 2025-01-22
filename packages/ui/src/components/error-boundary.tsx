import {Component, ErrorInfo, ReactNode} from 'react';
import {ErrorPane} from './error-pane';

interface Props {
  children?: ReactNode;
  onRetry?: () => void;
  fallback?: ReactNode;
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
    return {hasError: true, error};
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleRetry = () => {
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorPane
          error={this.state.error}
          onRetry={this.props.onRetry ? this.handleRetry : undefined}
          actions={!!this.props.onRetry}
        />
      );
    }

    return this.props.children;
  }
}
