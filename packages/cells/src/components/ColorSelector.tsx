import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';

export const colorOptions = [
  {value: '#077A9D', label: 'Blue'},
  {value: '#FFAB00', label: 'Orange'},
  {value: '#00A972', label: 'Green'},
  {value: '#85b6b2', label: 'Teal'},
  {value: '#919191', label: 'Gray'},
] as const;

const ColorCircle: React.FC<{color: string}> = ({color}) => {
  return (
    <div
      className="h-3.5 w-3.5 shrink-0 rounded-full border border-gray-300"
      style={{backgroundColor: color}}
    />
  );
};

interface ColorSelectorProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
}

export const ColorSelector: React.FC<ColorSelectorProps> = ({
  value,
  onValueChange,
}) => {
  const selectedColor =
    colorOptions.find((opt) => opt.value === value) ?? colorOptions[0];

  return (
    <Select value={selectedColor.value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Select color">
          <div className="flex items-center gap-2">
            <ColorCircle color={selectedColor.value} />
            <span>{selectedColor.label}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {colorOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              <ColorCircle color={option.value} />
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
