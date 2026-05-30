import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {getArrowColumnTypeCategory} from '@sqlrooms/duckdb';
import {FieldTypeIcon} from './FieldTypeIcon';
import {Field} from 'apache-arrow';

interface FieldSelectorProps {
  value: string | undefined;
  fields: Field<any>[];
  placeholder?: string;
  onValueChange: (value: string) => void;
}

export const FieldSelector: React.FC<FieldSelectorProps> = ({
  value,
  fields,
  placeholder = 'Select field',
  onValueChange,
}) => {
  return (
    <Select value={value || ''} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {fields.map((field) => {
          const typeCategory = getArrowColumnTypeCategory(field.type);
          return (
            <SelectItem key={field.name} value={field.name}>
              <div className="flex items-center gap-2">
                <FieldTypeIcon typeCategory={typeCategory} />
                <span>{field.name}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
