import type {FC} from 'react';
import {Combobox} from './Combobox';
import {CHART_COLORS} from '../constants/chart-colors';

export interface ColorSelectorProps {
  value: string;
  onChange: (color: string) => void;
}

/**
 * Dropdown for selecting a color from the chart color palette.
 * Displays colors as circular indicators.
 */
export const ColorSelector: FC<ColorSelectorProps> = ({value, onChange}) => {
  return (
    <Combobox value={value} onChange={onChange}>
      <Combobox.Trigger
        className="w-auto gap-1.5 px-2 shadow-none [&>svg]:ml-0"
        ariaLabel="Select color"
      >
        <div
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-gray-300"
          style={{backgroundColor: value}}
        />
      </Combobox.Trigger>
      <Combobox.Content>
        {CHART_COLORS.map((color) => (
          <Combobox.Item key={color} value={color}>
            <div
              className="h-4 w-4 rounded-full border border-gray-300"
              style={{backgroundColor: color}}
            />
          </Combobox.Item>
        ))}
      </Combobox.Content>
    </Combobox>
  );
};
