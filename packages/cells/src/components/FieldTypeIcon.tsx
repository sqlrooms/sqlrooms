import React from 'react';
import {type ColumnTypeCategory} from '@sqlrooms/duckdb';
import {
  Calendar,
  Hash,
  Type,
  HelpCircle,
  ToggleLeft,
  Binary,
  Braces,
  Box,
  Map,
} from 'lucide-react';
import {cn} from '@sqlrooms/ui';

export interface FieldTypeIconProps {
  typeCategory: ColumnTypeCategory | undefined;
  className?: string;
}

export const FieldTypeIcon: React.FC<FieldTypeIconProps> = ({
  typeCategory,
  className,
}) => {
  const iconClass = cn('h-3.5 w-3.5 shrink-0 text-gray-400', className);

  switch (typeCategory) {
    case 'number':
      return <Hash className={iconClass} />;
    case 'string':
      return <Type className={iconClass} />;
    case 'datetime':
      return <Calendar className={iconClass} />;
    case 'boolean':
      return <ToggleLeft className={iconClass} />;
    case 'binary':
      return <Binary className={iconClass} />;
    case 'json':
      return <Braces className={iconClass} />;
    case 'struct':
      return <Box className={iconClass} />;
    case 'geometry':
      return <Map className={iconClass} />;
    default:
      return <HelpCircle className={iconClass} />;
  }
};
