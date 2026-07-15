import {
  getTableDisplayName,
  getTableIdentity,
  isColumnCategorical,
  isColumnGeometry,
  isColumnNumeric,
  isColumnQuantitative,
  type DataTable,
  type TableColumn,
} from '@sqlrooms/duckdb';
import {
  Button,
  cn,
  Combobox,
  CopyButton,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {CodeIcon, TableIcon} from 'lucide-react';
import {
  createContext,
  useContext,
  type FC,
  type PropsWithChildren,
} from 'react';

export const DeckMapSettingsField: FC<
  PropsWithChildren<{label: string; required?: boolean}>
> = ({label, required, children}) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium">
      {label}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
    <div className="grid items-end gap-2">{children}</div>
  </div>
);

export type DeckMapColumnKind =
  | 'all'
  | 'numeric'
  | 'quantitative'
  | 'categorical'
  | 'geometry';

export function filterDeckMapColumns(
  columns: TableColumn[],
  kind: DeckMapColumnKind,
) {
  if (kind === 'all') return columns;
  return columns.filter((column) => {
    if (!column.type) return false;
    if (kind === 'numeric') return isColumnNumeric(column.type);
    if (kind === 'quantitative') return isColumnQuantitative(column.type);
    if (kind === 'geometry') return isColumnGeometry(column.type);
    return isColumnCategorical(column.type);
  });
}

const DeckMapColumnsContext = createContext<TableColumn[]>([]);

export const DeckMapColumnsProvider: FC<
  PropsWithChildren<{columns: TableColumn[]}>
> = ({columns, children}) => (
  <DeckMapColumnsContext.Provider value={columns}>
    {children}
  </DeckMapColumnsContext.Provider>
);

export type DeckMapColumnSelectorProps = {
  columns?: TableColumn[];
  kind?: DeckMapColumnKind;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

const DeckMapColumnSelectorRoot: FC<DeckMapColumnSelectorProps> = ({
  columns,
  kind = 'all',
  value,
  onChange,
  placeholder = 'Select column…',
  disabled,
}) => {
  const contextColumns = useContext(DeckMapColumnsContext);
  const options = filterDeckMapColumns(columns ?? contextColumns, kind);
  const selectedColumn = options.find((column) => column.name === value);
  const isMissing = Boolean(value && !selectedColumn);
  return (
    <Combobox value={value ?? ''} onChange={onChange} disabled={disabled}>
      <Combobox.Trigger
        className={cn(
          'w-full',
          isMissing && 'border-destructive/60 bg-destructive/5',
        )}
      >
        {selectedColumn ? (
          <span className="flex min-w-0 items-baseline gap-1">
            <span className="truncate">{selectedColumn.name}</span>
            <span className="text-muted-foreground truncate text-[8px]">
              {selectedColumn.type}
            </span>
          </span>
        ) : value ? (
          <span className="text-destructive truncate">{value} (missing)</span>
        ) : (
          <span className="text-muted-foreground truncate">{placeholder}</span>
        )}
      </Combobox.Trigger>
      <Combobox.Content
        searchable
        searchPlaceholder="Search columns..."
        emptyMessage="No matching column."
      >
        {options.map((column) => (
          <Combobox.Item key={column.name} value={column.name}>
            <span className="truncate">{column.name}</span>
            <span className="text-muted-foreground ml-auto text-[8px]">
              {column.type}
            </span>
          </Combobox.Item>
        ))}
      </Combobox.Content>
    </Combobox>
  );
};

export const DeckMapColumnSelector = Object.assign(DeckMapColumnSelectorRoot, {
  Numeric: (props: Omit<DeckMapColumnSelectorProps, 'kind'>) => (
    <DeckMapColumnSelectorRoot {...props} kind="numeric" />
  ),
  Quantitative: (props: Omit<DeckMapColumnSelectorProps, 'kind'>) => (
    <DeckMapColumnSelectorRoot {...props} kind="quantitative" />
  ),
  Categorical: (props: Omit<DeckMapColumnSelectorProps, 'kind'>) => (
    <DeckMapColumnSelectorRoot {...props} kind="categorical" />
  ),
  Geometry: (props: Omit<DeckMapColumnSelectorProps, 'kind'>) => (
    <DeckMapColumnSelectorRoot {...props} kind="geometry" />
  ),
});

export const DeckMapTableSelector: FC<{
  tables: DataTable[];
  value?: DataTable;
  onChange: (table: DataTable) => void;
  disabled?: boolean;
}> = ({tables, value, onChange, disabled}) => {
  const identity = value ? getTableIdentity(value.table) : '';
  return (
    <Combobox
      value={identity}
      onChange={(nextIdentity) => {
        const table = tables.find(
          (candidate) => getTableIdentity(candidate.table) === nextIdentity,
        );
        if (table) onChange(table);
      }}
      disabled={disabled}
    >
      <Combobox.Trigger className="w-full font-mono">
        <span className="flex min-w-0 items-center gap-2">
          <TableIcon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {value ? getTableDisplayName(value.table) : 'Select table...'}
          </span>
        </span>
      </Combobox.Trigger>
      <Combobox.Content
        searchable
        searchPlaceholder="Search tables..."
        emptyMessage="No tables found."
      >
        {tables.map((table) => {
          const tableIdentity = getTableIdentity(table.table);
          return (
            <Combobox.Item
              key={tableIdentity}
              value={tableIdentity}
              keywords={[
                getTableDisplayName(table.table),
                table.table.schema ?? '',
                table.table.database ?? '',
              ]}
            >
              <span className="truncate font-mono">
                {getTableDisplayName(table.table)}
              </span>
              {table.isView ? (
                <span className="text-muted-foreground ml-auto text-[10px]">
                  view
                </span>
              ) : null}
            </Combobox.Item>
          );
        })}
      </Combobox.Content>
    </Combobox>
  );
};

export const DeckMapCodeViewToggleButton: FC<{
  selected: boolean;
  onClick: () => void;
  label?: string;
}> = ({selected, onClick, label: labelProp}) => {
  const label = labelProp ?? (selected ? 'Show settings' : 'View code');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={selected ? 'secondary' : 'ghost'}
          size="icon"
          className="h-6 w-6"
          onClick={onClick}
          aria-label={label}
          aria-pressed={selected}
        >
          <CodeIcon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};

export const DeckMapCodeViewerPanel: FC<{
  value: string;
  copyTooltipLabel?: string;
}> = ({value, copyTooltipLabel = 'Copy map config'}) => (
  <ScrollArea className="min-h-0 flex-1">
    <div className="h-full p-2">
      <div className="border-input relative h-full overflow-hidden rounded-md border">
        <pre className="h-full overflow-auto p-3 pr-12 font-mono text-xs whitespace-pre-wrap">
          {value}
        </pre>
        <div className="bg-background absolute top-2 right-2 rounded-md border">
          <CopyButton
            text={value}
            size="xs"
            tooltipLabel={copyTooltipLabel}
            disabled={!value.trim()}
          />
        </div>
      </div>
    </div>
  </ScrollArea>
);
