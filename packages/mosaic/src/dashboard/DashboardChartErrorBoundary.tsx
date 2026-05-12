import React, {PropsWithChildren} from 'react';

import {ChartSpecError} from '../chart-types/errors';
import {ChartSpecErrorDisplay} from './ChartSpecErrorDisplay';

export class DashboardChartErrorBoundary extends React.Component<
  PropsWithChildren,
  {error?: ChartSpecError}
> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {};
  }

  componentDidCatch(originalError: Error) {
    if (originalError instanceof ChartSpecError) {
      this.setState({error: originalError});
      return;
    }

    console.error('Unexpected error generating chart spec:', originalError);

    this.setState({
      error: new ChartSpecError(
        'An unexpected error occurred while generating the chart spec',
      ),
    });
  }

  render() {
    if (this.state.error) {
      return <ChartSpecErrorDisplay error={this.state.error} />;
    }

    return this.props.children;
  }
}
