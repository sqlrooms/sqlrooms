import {Component, type ReactNode} from 'react';

type SettingsErrorBoundaryProps = {
  children: ReactNode;
};

type SettingsErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

/**
 * Error boundary for settings components.
 * Catches and displays errors that occur in settings panels.
 */
export class SettingsErrorBoundary extends Component<
  SettingsErrorBoundaryProps,
  SettingsErrorBoundaryState
> {
  constructor(props: SettingsErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError(error: Error): SettingsErrorBoundaryState {
    return {hasError: true, error};
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-4">
          <p className="text-destructive text-sm font-medium">
            Settings panel error
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            {this.state.error?.message || 'Unknown error'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
