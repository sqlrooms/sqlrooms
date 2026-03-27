import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';

interface FieldSelectorProps {
  value: string | undefined;
  fieldNames: string[];
  placeholder?: string;
  onValueChange: (value: string) => void;
}

export const FieldSelector: React.FC<FieldSelectorProps> = ({
  value,
  fieldNames,
  placeholder = 'Select field',
  onValueChange,
}) => {
  return (
    <Select value={value || ''} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {fieldNames.map((field: string) => (
          <SelectItem key={field} value={field}>
            {field}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
