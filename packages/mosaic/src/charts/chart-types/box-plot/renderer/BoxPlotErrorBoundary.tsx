import type {ErrorInfo, PropsWithChildren} from 'react';
import {Component} from 'react';

interface BoxPlotErrorBoundaryState {
  error: Error | null;
}

/**
 * Error boundary for box plot rendering to prevent crashes from propagating
 * to the entire dashboard. Catches errors during rendering, in lifecycle methods,
 * and in constructors of the component tree below it.
 */
export class BoxPlotErrorBoundary extends Component<
  PropsWithChildren,
  BoxPlotErrorBoundaryState
> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {error: null};
  }

  static getDerivedStateFromError(error: Error): BoxPlotErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {error};
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details for debugging
    console.error('Box plot rendering error:', error, errorInfo);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="text-destructive flex h-full flex-col items-center justify-center p-4 text-sm">
          <div className="font-medium">Failed to render box plot</div>
          <div className="mt-2 text-xs opacity-75">
            {this.state.error.message}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
