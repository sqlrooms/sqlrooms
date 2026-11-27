/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import {afterAll, beforeAll, jest} from '@jest/globals';
import {fireEvent, render, screen} from '@testing-library/react';
import {TransformStream} from 'node:stream/web';
import {type ReactElement, useState} from 'react';
import {MosaicChartSettingsProvider} from '../../src/charts/chart-settings/MosaicChartSettingsContext';
import {HistogramSettingsComponent} from '../../src/charts/chart-types/histogram/HistogramSettings';
import {HistogramChartConfig} from '../../src/charts/chart-types/histogram/schema';

const originalTransformStream = globalThis.TransformStream;
beforeAll(() => {
  Object.assign(globalThis, {TransformStream});
});
afterAll(() => {
  globalThis.TransformStream = originalTransformStream;
});

const columns = [{name: 'duration', type: 'DOUBLE'}];

function Settings({
  onChange,
  showUpperPercentile,
}: {
  onChange: (config: HistogramChartConfig) => void;
  showUpperPercentile?: boolean;
}): ReactElement {
  const [config, setConfig] = useState<HistogramChartConfig>({
    chartType: 'histogram',
    settings: {field: 'duration'},
  });
  return (
    <MosaicChartSettingsProvider
      columns={columns}
      config={config}
      onChange={(next) => {
        const parsed = HistogramChartConfig.parse(next);
        setConfig(parsed);
        onChange(parsed);
      }}
    >
      <HistogramSettingsComponent showUpperPercentile={showUpperPercentile} />
    </MosaicChartSettingsProvider>
  );
}

it('keeps the bin count available when a JSON-only builder hides the percentile', () => {
  render(<Settings onChange={jest.fn()} showUpperPercentile={false} />);

  expect(
    screen.queryByRole('spinbutton', {name: 'Upper percentile'}),
  ).toBeNull();
  expect(screen.getByRole('spinbutton')).toHaveProperty('value', '20');
});

it('commits a valid percentile on blur and clears it for full range', () => {
  const onChange = jest.fn();
  render(<Settings onChange={onChange} />);
  const input = screen.getByRole('spinbutton', {name: 'Upper percentile'});

  fireEvent.change(input, {target: {value: '99.5'}});
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.blur(input);
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      settings: expect.objectContaining({upperPercentile: 99.5}),
    }),
  );

  fireEvent.change(input, {target: {value: ''}});
  fireEvent.blur(input);
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      settings: expect.objectContaining({upperPercentile: undefined}),
    }),
  );
});

it('leaves invalid text for editing without replacing the saved percentile', () => {
  const onChange = jest.fn();
  render(<Settings onChange={onChange} />);
  const input = screen.getByRole('spinbutton', {name: 'Upper percentile'});

  fireEvent.change(input, {target: {value: '0'}});
  fireEvent.blur(input);
  expect(onChange).not.toHaveBeenCalled();
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText(/Enter a percentile greater than 0/)).toBeTruthy();
});
