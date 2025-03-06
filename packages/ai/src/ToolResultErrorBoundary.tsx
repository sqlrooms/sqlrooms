import React, {ReactNode} from 'react';

export class ToolCallErrorBoundary extends React.Component<
  {children: ReactNode; onError?: () => void},
  {hasError: boolean; error?: Error}
> {
  constructor(props: {children: ReactNode; onError?: () => void}) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError() {
    return {hasError: true};
  }

  componentDidCatch(error: Error) {
    console.error('Tool call component error:', error);
    this.setState({error});
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-sm text-danger text-red-500">
          Failed to render tool component. Please try again or contact support.
          <pre>{JSON.stringify(this.state.error, null, 2)}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
