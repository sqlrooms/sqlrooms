import {type DataTable} from '@sqlrooms/db';
import {Input} from '@sqlrooms/ui';
import {FC} from 'react';
import {DataTableSelector} from '../components/DataTableSelector';
import {useTablesWithColumns} from '../hooks/useTablesWithColumns';
import {Field} from '../components/Field';

export type DataTableSettingsPanelProps = {
  value: DataTable | undefined;
  onChange: (table: DataTable) => void;
  /** Optional title value and change handler */
  title?: string;
  onTitleChange?: (title: string) => void;
};

export const DataTableSettingsPanel: FC<DataTableSettingsPanelProps> = ({
  value,
  onChange,
  title,
  onTitleChange,
}) => {
  const tables = useTablesWithColumns();

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Data Table Settings</h3>
      </div>

      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          placeholder="Enter title"
          className="text-xs"
        />
      </Field>

      <Field label="Dataset" required>
        <DataTableSelector
          onChange={onChange}
          tables={tables}
          value={value}
          className="w-full"
        />
      </Field>
    </div>
  );
};
