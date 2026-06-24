import {type DataTable} from '@sqlrooms/db';
import {DataTableSelector, useTablesWithColumns, Field} from '@sqlrooms/mosaic';
import {FC} from 'react';

export type DataTableSettingsPanelProps = {
  value: DataTable | undefined;
  onChange: (table: DataTable) => void;
};

export const DataTableSettingsPanel: FC<DataTableSettingsPanelProps> = ({
  value,
  onChange,
}) => {
  const tables = useTablesWithColumns();

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Data Table Settings</h3>
      </div>

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
