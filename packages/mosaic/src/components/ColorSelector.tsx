import type {FC} from 'react';
import {Combobox} from './Combobox';
import {cn} from '@sqlrooms/ui';

type ColorSelectorItemProps = {
  color: string;
  className?: string;
};

const ColorSelectorItem: FC<ColorSelectorItemProps> = ({color, className}) => {
  return (
    <>
      <div
        className={cn('h-4 w-4 rounded-full border border-gray-300', className)}
        style={{backgroundColor: color}}
      />
      <span className="sr-only">{color}</span>
    </>
  );
};

export type ColorSelectorProps = {
  value: string;
  items: readonly string[];
  onChange: (color: string) => void;
};

/**
 * Dropdown for selecting a color from the chart color palette.
 * Displays colors as circular indicators.
 */
export const ColorSelector: FC<ColorSelectorProps> = ({
  value,
  items,
  onChange,
}) => {
  return (
    <Combobox value={value} onChange={onChange}>
      <Combobox.Trigger
        className="w-auto gap-1.5 px-2 shadow-none [&>svg]:ml-0"
        ariaLabel="Select color"
      >
        <ColorSelectorItem color={value} className="h-3.5 w-3.5 shrink-0" />
      </Combobox.Trigger>
      <Combobox.Content>
        {items.map((color) => (
          <Combobox.Item key={color} value={color}>
            <ColorSelectorItem color={color} />
          </Combobox.Item>
        ))}
      </Combobox.Content>
    </Combobox>
  );
};
