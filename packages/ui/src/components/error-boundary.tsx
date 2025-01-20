import {Component, ErrorInfo, ReactNode} from 'react';
import {Alert, AlertDescription, AlertTitle} from './alert';
import {Button} from './button';
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from './card';

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
        <Card className="w-[450px] mx-auto mt-20">
          <CardHeader>
            <CardTitle>Oops! Something went wrong</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {this.state.error?.message || 'An unexpected error occurred'}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={this.handleRetry} className="w-full">
              Retry
            </Button>
          </CardFooter>
        </Card>
      );
    }

    return this.props.children;
  }
}
