import {type DataTable} from '@sqlrooms/db';
import {Input} from '@sqlrooms/ui';
import {FC} from 'react';
import {DataTableSelector} from '../components/DataTableSelector';
import {useTablesWithColumns} from '../hooks/useTablesWithColumns';
import {Field} from '../components/Field';

/**
 * Props for the data-table explorer settings panel.
 */
export type DataTableSettingsPanelProps = {
  /** Currently selected table for the data-table explorer. */
  value: DataTable | undefined;
  /** Called when the selected table changes. */
  onChange: (table: DataTable) => void;
  /** Optional display title or caption value. */
  title?: string;
  /** Label for the editable title field. */
  titleLabel?: string;
  /** Called when the display title or caption changes. */
  onTitleChange?: (title: string) => void;
};

/**
 * Renders dataset and title controls for data-table explorer settings.
 */
export const DataTableSettingsPanel: FC<DataTableSettingsPanelProps> = ({
  value,
  onChange,
  title,
  titleLabel = 'Title',
  onTitleChange,
}) => {
  const tables = useTablesWithColumns();

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Data Table Settings</h3>
      </div>

      <Field label={titleLabel}>
        <Input
          value={title ?? ''}
          onChange={(e) => onTitleChange?.(e.target.value)}
          placeholder={`Enter ${titleLabel.toLowerCase()}`}
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
