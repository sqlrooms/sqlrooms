import {Component, type ErrorInfo, type ReactNode} from 'react';

interface Props {
  children: ReactNode;
  panelType?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class DashboardPanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError(error: Error): State {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[DashboardPanelErrorBoundary] Error rendering panel${this.props.panelType ? ` (${this.props.panelType})` : ''}:`,
      error,
      errorInfo,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
          Failed to load panel
        </div>
      );
    }

    return this.props.children;
  }
}
