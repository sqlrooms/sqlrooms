import {getPanelByPath} from '../getPanelByPath';

describe('getPanelByPath', () => {
  describe('simple matches', () => {
    test('matches exact panel key', () => {
      const panels = {
        dashboards: {component: 'DashboardsComponent'},
        console: {component: 'ConsoleComponent'},
      };

      const result = getPanelByPath(panels, ['root', 'main', 'dashboards']);

      expect(result).toEqual({
        panelId: 'dashboards',
        panel: {component: 'DashboardsComponent'},
        params: {},
      });
    });

    test('matches panel at the end of a longer path', () => {
      const panels = {
        console: {component: 'ConsoleComponent'},
      };

      const result = getPanelByPath(panels, [
        'root',
        'main',
        'bottom',
        'console',
      ]);

      expect(result).toEqual({
        panelId: 'console',
        panel: {component: 'ConsoleComponent'},
        params: {},
      });
    });

    test('returns null when no match found', () => {
      const panels = {
        dashboards: {component: 'DashboardsComponent'},
      };

      const result = getPanelByPath(panels, ['root', 'main', 'unknown']);

      expect(result).toBeNull();
    });
  });

  describe('parameter matching', () => {
    test('matches single parameter', () => {
      const panels = {
        'dashboards/{dashboardId}': {component: 'DashboardComponent'},
      };

      const result = getPanelByPath(panels, [
        'root',
        'main',
        'dashboards',
        'overview',
      ]);

      expect(result).toEqual({
        panelId: 'overview',
        panel: {component: 'DashboardComponent'},
        params: {dashboardId: 'overview'},
      });
    });

    test('matches multiple parameters', () => {
      const panels = {
        'dashboards/{dashboardId}/{chartId}': {component: 'ChartComponent'},
      };

      const result = getPanelByPath(panels, [
        'root',
        'main',
        'dashboards',
        'overview',
        'users',
      ]);

      expect(result).toEqual({
        panelId: 'users',
        panel: {component: 'ChartComponent'},
        params: {dashboardId: 'overview', chartId: 'users'},
      });
    });

    test('matches parameter at root level', () => {
      const panels = {
        '{chartId}': {component: 'ChartComponent'},
      };

      const result = getPanelByPath(panels, [
        'root',
        'main',
        'dashboards',
        'revenue',
      ]);

      expect(result).toEqual({
        panelId: 'revenue',
        panel: {component: 'ChartComponent'},
        params: {chartId: 'revenue'},
      });
    });

    test('matches mixed literal and parameter segments', () => {
      const panels = {
        'projects/{projectId}/tasks/{taskId}': {
          component: 'TaskComponent',
        },
      };

      const result = getPanelByPath(panels, [
        'root',
        'main',
        'projects',
        'sqlrooms',
        'tasks',
        'layout-123',
      ]);

      expect(result).toEqual({
        panelId: 'layout-123',
        panel: {component: 'TaskComponent'},
        params: {projectId: 'sqlrooms', taskId: 'layout-123'},
      });
    });
  });

  describe('matching order priority', () => {
    test('returns first matching panel in definition order', () => {
      const panels = {
        'dashboards/{dashboardId}/{chartId}': {
          component: 'SpecificChartComponent',
        },
        '{chartId}': {component: 'GenericChartComponent'},
      };

      const result = getPanelByPath(panels, [
        'root',
        'main',
        'dashboards',
        'overview',
        'users',
      ]);

      expect(result?.panelId).toBe('users');
      expect(result?.panel.component).toBe('SpecificChartComponent');
    });

    test('matches less specific pattern when more specific not applicable', () => {
      const panels = {
        'dashboards/{dashboardId}/{chartId}': {
          component: 'SpecificChartComponent',
        },
        '{chartId}': {component: 'GenericChartComponent'},
      };

      const result = getPanelByPath(panels, ['root', 'main', 'revenue']);

      expect(result?.panelId).toBe('revenue');
      expect(result?.panel.component).toBe('GenericChartComponent');
    });

    test('order matters - later pattern is not checked if first matches', () => {
      const panels = {
        '{id}': {component: 'GenericComponent'},
        'dashboards/{dashboardId}': {component: 'SpecificComponent'},
      };

      const result = getPanelByPath(panels, [
        'root',
        'main',
        'dashboards',
        'overview',
      ]);

      // Since {id} is first and matches, it wins even though
      // dashboards/{dashboardId} would be more specific
      expect(result?.panelId).toBe('overview');
      expect(result?.panel.component).toBe('GenericComponent');
    });
  });

  describe('edge cases', () => {
    test('handles empty path', () => {
      const panels = {
        dashboards: {component: 'DashboardsComponent'},
      };

      const result = getPanelByPath(panels, []);

      expect(result).toBeNull();
    });

    test('handles single segment path', () => {
      const panels = {
        root: {component: 'RootComponent'},
      };

      const result = getPanelByPath(panels, ['root']);

      expect(result).toEqual({
        panelId: 'root',
        panel: {component: 'RootComponent'},
        params: {},
      });
    });

    test('handles pattern longer than path', () => {
      const panels = {
        'a/b/c/d/e': {component: 'DeepComponent'},
      };

      const result = getPanelByPath(panels, ['root', 'a', 'b']);

      expect(result).toBeNull();
    });

    test('handles empty panels object', () => {
      const panels = {};

      const result = getPanelByPath(panels, ['root', 'main', 'dashboards']);

      expect(result).toBeNull();
    });

    test('matches pattern with exact same length as path', () => {
      const panels = {
        'root/main/dashboards': {component: 'DashboardsComponent'},
      };

      const result = getPanelByPath(panels, ['root', 'main', 'dashboards']);

      expect(result).toEqual({
        panelId: 'dashboards',
        panel: {component: 'DashboardsComponent'},
        params: {},
      });
    });
  });

  describe('real-world scenarios', () => {
    test('matches complex layout-areas panel structure', () => {
      const panels = {
        dashboards: {component: 'DashboardsContainer'},
        'data-sources': {component: 'DataSourcesPanel'},
        'dashboards/{dashboardId}': {component: 'DashboardPanel'},
        'dashboards/{dashboardId}/{chartId}': {component: 'DynamicChartPanel'},
        '{chartId}': {component: 'ChartPanel'},
        schema: {component: 'SchemaPanel'},
        console: {component: 'ConsolePanel'},
        results: {component: 'ResultsPanel'},
      };

      // Match tabs container
      expect(getPanelByPath(panels, ['root', 'main', 'dashboards'])).toEqual({
        panelId: 'dashboards',
        panel: {component: 'DashboardsContainer'},
        params: {},
      });

      // Match dashboard with id
      expect(
        getPanelByPath(panels, ['root', 'main', 'dashboards', 'overview']),
      ).toEqual({
        panelId: 'overview',
        panel: {component: 'DashboardPanel'},
        params: {dashboardId: 'overview'},
      });

      // Match chart within dashboard
      expect(
        getPanelByPath(panels, [
          'root',
          'main',
          'dashboards',
          'overview',
          'users',
        ]),
      ).toEqual({
        panelId: 'users',
        panel: {component: 'DynamicChartPanel'},
        params: {dashboardId: 'overview', chartId: 'users'},
      });

      // Match standalone chart
      expect(getPanelByPath(panels, ['root', 'main', 'revenue'])).toEqual({
        panelId: 'revenue',
        panel: {component: 'ChartPanel'},
        params: {chartId: 'revenue'},
      });
    });
  });
});
