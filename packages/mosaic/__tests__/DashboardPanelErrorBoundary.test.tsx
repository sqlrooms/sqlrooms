import {describe, expect, it} from '@jest/globals';
import {renderToStaticMarkup} from 'react-dom/server';
import {DashboardPanelErrorBoundary} from '../src';

describe('DashboardPanelErrorBoundary', () => {
  it('renders children when there is no error', () => {
    const markup = renderToStaticMarkup(
      <DashboardPanelErrorBoundary>
        <div>Child content</div>
      </DashboardPanelErrorBoundary>,
    );

    expect(markup).toContain('Child content');
  });

  it('renders multiple children without error', () => {
    const markup = renderToStaticMarkup(
      <DashboardPanelErrorBoundary>
        <div>First child</div>
        <div>Second child</div>
      </DashboardPanelErrorBoundary>,
    );

    expect(markup).toContain('First child');
    expect(markup).toContain('Second child');
  });

  it('renders with panelType prop', () => {
    const markup = renderToStaticMarkup(
      <DashboardPanelErrorBoundary panelType="vgplot">
        <div>Panel content</div>
      </DashboardPanelErrorBoundary>,
    );

    expect(markup).toContain('Panel content');
  });

  it('is a React component class', () => {
    expect(DashboardPanelErrorBoundary).toBeDefined();
    expect(typeof DashboardPanelErrorBoundary).toBe('function');
  });

  it('has required error boundary lifecycle methods', () => {
    expect(DashboardPanelErrorBoundary.getDerivedStateFromError).toBeDefined();
    expect(typeof DashboardPanelErrorBoundary.getDerivedStateFromError).toBe(
      'function',
    );
  });
});
