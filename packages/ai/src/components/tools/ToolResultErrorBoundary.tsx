import {ToolErrorMessage} from './ToolErrorMessage';
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
      return <ToolErrorMessage error={this.state.error} />;
    }

    return this.props.children;
  }
}
