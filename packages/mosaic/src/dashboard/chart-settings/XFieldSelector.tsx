import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {FC, useMemo} from 'react';

interface XFieldSelectorProps {
  label?: string;
  value: string | undefined;
  columns: Array<{name: string; type: string}>;
  onChange: (value: string) => void;
  filterTypes?: string[];
}

export const XFieldSelector: FC<XFieldSelectorProps> = ({
  label = 'X Field',
  value,
  columns,
  onChange,
  filterTypes,
}) => {
  const filteredColumns = useMemo(
    () =>
      filterTypes
        ? columns.filter((col) => filterTypes.includes(col.type))
        : columns,
    [columns, filterTypes],
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent>
          {filteredColumns.map((col) => (
            <SelectItem key={col.name} value={col.name}>
              {col.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
