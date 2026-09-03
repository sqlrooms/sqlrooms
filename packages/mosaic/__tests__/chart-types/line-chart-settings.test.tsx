/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import {afterAll, beforeAll, jest} from '@jest/globals';
import {TransformStream} from 'node:stream/web';
import {useState, type ReactElement} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {makeQualifiedTableName} from '@sqlrooms/duckdb';
import {MosaicChartSettingsProvider} from '../../src/charts/chart-settings/MosaicChartSettingsContext';
import {LineChartSettingsComponent} from '../../src/charts/chart-types/line-chart/LineChartSettings';
import {LineChartConfig} from '../../src/charts/chart-types/line-chart/schema';
import {validateLineChartSettings} from '../../src/charts/chart-types/line-chart/validation';
import type {ChartConfig} from '../../src/charts/chart-types';
import {ChartBuilderContext} from '../../src/chart-builders/ChartBuilderContext';
import {ChartBuilderFields} from '../../src/chart-builders/ChartBuilderFields';
import {ChartBuilderActions} from '../../src/chart-builders/ChartBuilderActions';
import {createChartBuilderStore} from '../../src/chart-builders/createChartBuilderStore';

const originalResizeObserver = globalThis.ResizeObserver;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
const originalTransformStream = globalThis.TransformStream;
beforeAll(() => {
  Object.assign(globalThis, {TransformStream});
  // JSDOM has no layout observation or scrolling; keep the real menu handlers.
  globalThis.ResizeObserver = class {
    observe(): void {
      /* No layout observation in JSDOM. */
    }
    unobserve(): void {
      /* No layout observation in JSDOM. */
    }
    disconnect(): void {
      /* No layout observation in JSDOM. */
    }
  };
  HTMLElement.prototype.scrollIntoView = jest.fn();
});
afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  globalThis.TransformStream = originalTransformStream;
});

const columns = [
  {name: 'time', type: 'TIMESTAMP'},
  {name: 'amount', type: 'DOUBLE'},
  {name: 'value', type: 'DOUBLE'},
];
const numericConfig: LineChartConfig = {
  chartType: 'line-chart',
  settings: {
    x: 'time',
    xInterval: 'month',
    showLegend: true,
    yFields: [
      {field: 'amount', aggregate: 'avg', color: '#123456'},
      {field: 'value', aggregate: 'max', color: '#abcdef'},
    ],
  },
};

function Settings({
  initialConfig,
  onChange,
}: {
  initialConfig: LineChartConfig;
  onChange: (config: LineChartConfig) => void;
}): ReactElement {
  const [config, setConfig] = useState(initialConfig);
  return (
    <MosaicChartSettingsProvider
      config={config}
      columns={columns}
      onChange={(next) => {
        const parsed = LineChartConfig.parse(next);
        setConfig(parsed);
        onChange(parsed);
      }}
    >
      <LineChartSettingsComponent />
    </MosaicChartSettingsProvider>
  );
}

async function selectMetric(from: string, to: string): Promise<void> {
  fireEvent.click(screen.getByText(from));
  fireEvent.click(await screen.findByRole('option', {name: to}));
}

it('restores all numeric series after count mode and a serialized settings remount', async () => {
  const onChange = jest.fn<(config: LineChartConfig) => void>();
  const view = render(
    <Settings initialConfig={numericConfig} onChange={onChange} />,
  );
  await selectMetric('Numeric fields', 'Row count');
  const countConfig = onChange.mock.calls.at(-1)![0];
  expect(countConfig.settings).toMatchObject({metric: 'count', yFields: []});
  expect(() =>
    validateLineChartSettings({
      dataTable: {
        tableName: 'events',
        table: makeQualifiedTableName({schema: 'main', table: 'events'}),
        columns,
      },
      settings: countConfig.settings,
    }),
  ).not.toThrow();
  view.unmount();
  // Reopening a persisted chart must not depend on component-local state.
  render(
    <Settings
      initialConfig={LineChartConfig.parse(
        JSON.parse(JSON.stringify(countConfig)),
      )}
      onChange={onChange}
    />,
  );
  await selectMetric('Row count', 'Numeric fields');
  const restored = onChange.mock.calls.at(-1)![0];
  expect(restored.settings.yFields).toEqual(numericConfig.settings.yFields);
  expect(restored.settings).toMatchObject({
    x: 'time',
    xInterval: 'month',
    metric: 'aggregate',
  });
  expect(restored).not.toHaveProperty('lastAggregateYFields');
  await selectMetric('Numeric fields', 'Row count');
  await selectMetric('Row count', 'Numeric fields');
  expect(onChange.mock.calls.at(-1)![0].settings.yFields).toEqual(
    numericConfig.settings.yFields,
  );
});

it('does not carry saved series into another count chart', async () => {
  const onChange = jest.fn<(config: LineChartConfig) => void>();
  const view = render(
    <Settings initialConfig={numericConfig} onChange={onChange} />,
  );
  await selectMetric('Numeric fields', 'Row count');
  view.unmount();
  render(
    <Settings
      initialConfig={{
        chartType: 'line-chart',
        settings: {x: 'time', metric: 'count', showLegend: true},
      }}
      onChange={onChange}
    />,
  );
  await selectMetric('Row count', 'Numeric fields');
  expect(onChange.mock.calls.at(-1)![0].settings.yFields ?? []).toEqual([]);
});

it('preserves numeric series through builder toggles and count-chart creation', async () => {
  // Load the real chart definition after installing JSDOM's missing web stream.
  const {lineChartChartType} =
    await import('../../src/charts/chart-types/line-chart/definition');
  const store = createChartBuilderStore();
  store.getState().selectTemplate('line-chart');
  Object.entries(numericConfig.settings).forEach(([key, value]) => {
    store.getState().setFieldValue(key, value);
  });
  const onCreateChart = jest.fn<(title: string, config: ChartConfig) => void>();
  const view = render(
    <ChartBuilderContext.Provider
      value={{
        tableName: 'events',
        columns,
        templates: [lineChartChartType],
        availableTemplates: [lineChartChartType],
        store,
        onCreateChart,
      }}
    >
      <ChartBuilderFields />
      <ChartBuilderActions />
    </ChartBuilderContext.Provider>,
  );
  await selectMetric('Numeric fields', 'Row count');
  await selectMetric('Row count', 'Numeric fields');
  expect(store.getState().fieldValues.yFields).toEqual(
    numericConfig.settings.yFields,
  );
  expect(store.getState().chartOptions).not.toHaveProperty(
    'lastAggregateYFields',
  );
  await selectMetric('Numeric fields', 'Row count');
  fireEvent.click(screen.getByRole('button', {name: 'Create'}));
  const created = LineChartConfig.parse(onCreateChart.mock.calls.at(-1)![1]);
  expect(created.settings).toMatchObject({metric: 'count', yFields: []});
  expect(created.lastAggregateYFields).toEqual(numericConfig.settings.yFields);
  expect(store.getState().chartOptions).toEqual({});
  view.unmount();
  const onChange = jest.fn<(config: LineChartConfig) => void>();
  render(<Settings initialConfig={created} onChange={onChange} />);
  await selectMetric('Row count', 'Numeric fields');
  expect(onChange.mock.calls.at(-1)![0].settings.yFields).toEqual(
    numericConfig.settings.yFields,
  );
});

it.each(['reset', 'selectTemplate'] as const)(
  'clears saved builder options on %s',
  (action) => {
    const store = createChartBuilderStore();
    store.getState().setConfig({
      chartType: 'line-chart',
      settings: {x: 'time', metric: 'count', showLegend: true},
      lastAggregateYFields: numericConfig.settings.yFields,
      dataPolicy: {maxRows: 500},
    });
    store.getState().setFieldValue('xInterval', 'month');
    expect(store.getState().chartOptions).toMatchObject({
      lastAggregateYFields: numericConfig.settings.yFields,
      dataPolicy: {maxRows: 500},
    });
    if (action === 'selectTemplate')
      store.getState().selectTemplate('histogram');
    else store.getState().reset();
    expect(store.getState().chartOptions).toEqual({});
    expect(store.getState().fieldValues).toEqual({});
  },
);
