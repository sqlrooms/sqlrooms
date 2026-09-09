import {
  getTableDisplayName,
  getTableIdentity,
  isColumnCategorical,
  isColumnNumeric,
  isColumnQuantitative,
  getColumnTypeCategory,
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
  /** Numeric/temporal + string columns usable for color scales. */
  | 'colorable'
  /** Geometry / WKB / well-known geometry column names. */
  | 'geometry'
  /** Geometry or numeric columns that can define a point position. */
  | 'position';

const GEOMETRY_COLUMN_NAME_PATTERN = /(?:^|_)((?:wkb_)?geom(?:etry)?)$/i;
const LATITUDE_COLUMN_NAME_PATTERN = /^(lat|latitude|y|northing)$/i;
const LONGITUDE_COLUMN_NAME_PATTERN = /^(lon|lng|long|longitude|x|easting)$/i;

/** True for columns that can drive a color scale (excludes geometry blobs/structs). */
export function isDeckMapColorableColumn(column: TableColumn): boolean {
  if (!column.type) return false;
  const category = getColumnTypeCategory(column.type);
  if (
    category === 'geometry' ||
    category === 'binary' ||
    category === 'struct'
  ) {
    return false;
  }
  if (isColumnQuantitative(column.type)) return true;
  return category === 'string' || category === 'boolean';
}

/** True for columns that can be bound as map geometry. */
export function isDeckMapGeometryPickerColumn(column: TableColumn): boolean {
  if (GEOMETRY_COLUMN_NAME_PATTERN.test(column.name)) return true;
  const type = column.type?.toLowerCase() ?? '';
  if (!type) return false;
  const category = getColumnTypeCategory(column.type);
  return (
    category === 'geometry' ||
    category === 'binary' ||
    type.includes('geoarrow') ||
    type.includes('wkb') ||
    type.includes('wkt')
  );
}

/** Classifies a coordinate column name as latitude, longitude, or unknown. */
export function classifyDeckMapCoordinateColumn(
  columnName: string,
): 'latitude' | 'longitude' | 'unknown' {
  const name = columnName.trim();
  if (LATITUDE_COLUMN_NAME_PATTERN.test(name)) return 'latitude';
  if (LONGITUDE_COLUMN_NAME_PATTERN.test(name)) return 'longitude';
  return 'unknown';
}

/**
 * Assigns a first/second position pair to longitude/latitude. Named lon/lat
 * columns win; otherwise the first column is latitude and the second is
 * longitude.
 */
export function resolveDeckMapLonLatPair(
  firstColumn: string,
  secondColumn: string,
): {latitudeColumn: string; longitudeColumn: string} {
  const first = classifyDeckMapCoordinateColumn(firstColumn);
  const second = classifyDeckMapCoordinateColumn(secondColumn);
  if (first === 'longitude' && second !== 'longitude') {
    return {longitudeColumn: firstColumn, latitudeColumn: secondColumn};
  }
  if (first === 'latitude' && second !== 'latitude') {
    return {latitudeColumn: firstColumn, longitudeColumn: secondColumn};
  }
  if (second === 'longitude' && first !== 'longitude') {
    return {longitudeColumn: secondColumn, latitudeColumn: firstColumn};
  }
  if (second === 'latitude' && first !== 'latitude') {
    return {latitudeColumn: secondColumn, longitudeColumn: firstColumn};
  }
  return {latitudeColumn: firstColumn, longitudeColumn: secondColumn};
}

/** String/boolean (and binary) fields that need a categorical color scale. */
export function isDeckMapCategoricalColorColumn(column: TableColumn): boolean {
  if (!column.type || isColumnQuantitative(column.type)) return false;
  const category = getColumnTypeCategory(column.type);
  return (
    category === 'string' ||
    category === 'boolean' ||
    category === 'binary' ||
    isColumnCategorical(column.type)
  );
}

export function filterDeckMapColumns(
  columns: TableColumn[],
  kind: DeckMapColumnKind,
) {
  if (kind === 'all') return columns;
  return columns.filter((column) => {
    if (kind === 'geometry') return isDeckMapGeometryPickerColumn(column);
    if (kind === 'position') {
      return (
        isDeckMapGeometryPickerColumn(column) ||
        Boolean(column.type && isColumnNumeric(column.type))
      );
    }
    if (!column.type) return false;
    if (kind === 'numeric') return isColumnNumeric(column.type);
    if (kind === 'quantitative') return isColumnQuantitative(column.type);
    if (kind === 'colorable') return isDeckMapColorableColumn(column);
    return isDeckMapCategoricalColorColumn(column);
  });
}

function mergeDeckMapPickerColumns(
  ...columnSets: Array<TableColumn[] | undefined>
): TableColumn[] {
  const columnsByName = new Map<string, TableColumn>();
  for (const columns of columnSets) {
    for (const column of columns ?? []) {
      columnsByName.set(column.name, column);
    }
  }
  return [...columnsByName.values()];
}

/**
 * Geometry columns for the Geom tab. Prefers the source table over inspected
 * transform output so generated WKB aliases and Arrow type rewrites cannot
 * hide native geometry after switching back to lon/lat.
 */
export function listDeckMapGeometryPickerColumns(options: {
  sourceColumns: TableColumn[];
  outputColumns?: TableColumn[];
  extraColumnNames?: Array<string | undefined>;
  isGeneratedColumn?: (columnName: string) => boolean;
}): TableColumn[] {
  const isGenerated = options.isGeneratedColumn ?? (() => false);
  const extraColumns: TableColumn[] = [];
  const seenExtra = new Set<string>();
  for (const columnName of options.extraColumnNames ?? []) {
    if (!columnName || isGenerated(columnName) || seenExtra.has(columnName)) {
      continue;
    }
    if (
      options.sourceColumns.length > 0 &&
      !options.sourceColumns.some((column) => column.name === columnName)
    ) {
      continue;
    }
    seenExtra.add(columnName);
    extraColumns.push({name: columnName, type: 'GEOMETRY'});
  }

  const catalogGeometry = filterDeckMapColumns(
    options.sourceColumns,
    'geometry',
  ).filter((column) => !isGenerated(column.name));
  const inspectedGeometry =
    options.sourceColumns.length > 0
      ? []
      : filterDeckMapColumns(options.outputColumns ?? [], 'geometry').filter(
          (column) => !isGenerated(column.name),
        );

  return mergeDeckMapPickerColumns(
    inspectedGeometry,
    catalogGeometry,
    extraColumns,
  );
}

function pickExistingColumnName(
  columnName: string | undefined,
  sourceColumns: ReadonlyArray<{name: string}>,
): string | undefined {
  if (!columnName) return undefined;
  return sourceColumns.some((column) => column.name === columnName)
    ? columnName
    : undefined;
}

/**
 * Lon/lat columns to restore after leaving geom mode. Only returns names that
 * still exist on the source table.
 */
export function pickDeckMapCoordinateColumns(
  sourceColumns: ReadonlyArray<{name: string}>,
  preferred?: {
    latitudeColumn?: string;
    longitudeColumn?: string;
  },
): {latitudeColumn?: string; longitudeColumn?: string} {
  return {
    latitudeColumn: pickExistingColumnName(
      preferred?.latitudeColumn,
      sourceColumns,
    ),
    longitudeColumn: pickExistingColumnName(
      preferred?.longitudeColumn,
      sourceColumns,
    ),
  };
}

/**
 * Origin/destination lon/lat columns to restore after leaving arc geom mode.
 * Only returns names that still exist on the source table.
 */
export function pickDeckMapArcCoordinateColumns(
  sourceColumns: ReadonlyArray<{name: string}>,
  preferred?: {
    sourceLatitudeColumn?: string;
    sourceLongitudeColumn?: string;
    targetLatitudeColumn?: string;
    targetLongitudeColumn?: string;
  },
): {
  sourceLatitudeColumn?: string;
  sourceLongitudeColumn?: string;
  targetLatitudeColumn?: string;
  targetLongitudeColumn?: string;
} {
  return {
    sourceLatitudeColumn: pickExistingColumnName(
      preferred?.sourceLatitudeColumn,
      sourceColumns,
    ),
    sourceLongitudeColumn: pickExistingColumnName(
      preferred?.sourceLongitudeColumn,
      sourceColumns,
    ),
    targetLatitudeColumn: pickExistingColumnName(
      preferred?.targetLatitudeColumn,
      sourceColumns,
    ),
    targetLongitudeColumn: pickExistingColumnName(
      preferred?.targetLongitudeColumn,
      sourceColumns,
    ),
  };
}

/**
 * Source geometry column to restore after leaving lon/lat mode. Prefers the
 * previously bound column; if the table has exactly one geometry column, uses
 * that.
 */
export function pickDeckMapSourceGeometryColumn(
  sourceColumns: TableColumn[],
  preferredColumn?: string,
): string | undefined {
  const geometryColumns = filterDeckMapColumns(sourceColumns, 'geometry');
  if (
    preferredColumn &&
    geometryColumns.some((column) => column.name === preferredColumn)
  ) {
    return preferredColumn;
  }
  if (geometryColumns.length === 1) {
    return geometryColumns[0]?.name;
  }
  return undefined;
}

/**
 * Source/target geometry columns to restore after leaving arc lon/lat mode.
 * Prefers previously bound columns; if the table has exactly two geometry
 * columns, uses those as source then target.
 */
export function pickDeckMapArcGeometryColumns(
  sourceColumns: TableColumn[],
  preferred?: {
    sourceGeometryColumn?: string;
    targetGeometryColumn?: string;
  },
): {sourceGeometryColumn?: string; targetGeometryColumn?: string} {
  const names = filterDeckMapColumns(sourceColumns, 'geometry').map(
    (column) => column.name,
  );
  const source =
    preferred?.sourceGeometryColumn &&
    names.includes(preferred.sourceGeometryColumn)
      ? preferred.sourceGeometryColumn
      : undefined;
  const target =
    preferred?.targetGeometryColumn &&
    names.includes(preferred.targetGeometryColumn) &&
    preferred.targetGeometryColumn !== source
      ? preferred.targetGeometryColumn
      : undefined;
  if (source && target) {
    return {sourceGeometryColumn: source, targetGeometryColumn: target};
  }
  if (names.length === 2) {
    if (source) {
      return {
        sourceGeometryColumn: source,
        targetGeometryColumn: names.find((name) => name !== source),
      };
    }
    if (target) {
      return {
        sourceGeometryColumn: names.find((name) => name !== target),
        targetGeometryColumn: target,
      };
    }
    return {
      sourceGeometryColumn: names[0],
      targetGeometryColumn: names[1],
    };
  }
  return {sourceGeometryColumn: source, targetGeometryColumn: target};
}

const DeckMapColumnsContext = createContext<TableColumn[]>([]);

export const DeckMapColumnsProvider: FC<
  PropsWithChildren<{columns: TableColumn[]}>
> = ({columns, children}) => (
  <DeckMapColumnsContext.Provider value={columns}>
    {children}
  </DeckMapColumnsContext.Provider>
);

export type DeckMapColumnSelectorExtraOption = {
  value: string;
  label: string;
  keywords?: string[];
};

export type DeckMapColumnSelectorProps = {
  columns?: TableColumn[];
  kind?: DeckMapColumnKind;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  extraOptions?: readonly DeckMapColumnSelectorExtraOption[];
};

const DeckMapColumnSelectorRoot: FC<DeckMapColumnSelectorProps> = ({
  columns,
  kind = 'all',
  value,
  onChange,
  placeholder = 'Select column…',
  disabled,
  extraOptions,
}) => {
  const contextColumns = useContext(DeckMapColumnsContext);
  const allColumns = columns ?? contextColumns;
  const filtered = filterDeckMapColumns(allColumns, kind);
  const selectedColumn = allColumns.find((column) => column.name === value);
  const selectedExtra = extraOptions?.find((option) => option.value === value);
  const options =
    selectedColumn && !filtered.some((column) => column.name === value)
      ? [selectedColumn, ...filtered]
      : filtered;
  const isMissing = Boolean(value && !selectedColumn && !selectedExtra);
  return (
    <Combobox value={value ?? ''} onChange={onChange} disabled={disabled}>
      <Combobox.Trigger
        className={cn(
          'w-full',
          isMissing && 'border-destructive/60 bg-destructive/5',
        )}
      >
        {selectedExtra ? (
          <span className="truncate">{selectedExtra.label}</span>
        ) : selectedColumn ? (
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
        {extraOptions?.map((option) => (
          <Combobox.Item
            key={option.value}
            value={option.value}
            keywords={option.keywords ?? [option.label]}
          >
            <span className="truncate">{option.label}</span>
          </Combobox.Item>
        ))}
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
  Colorable: (props: Omit<DeckMapColumnSelectorProps, 'kind'>) => (
    <DeckMapColumnSelectorRoot {...props} kind="colorable" />
  ),
  Geometry: (props: Omit<DeckMapColumnSelectorProps, 'kind'>) => (
    <DeckMapColumnSelectorRoot {...props} kind="geometry" />
  ),
  Position: (props: Omit<DeckMapColumnSelectorProps, 'kind'>) => (
    <DeckMapColumnSelectorRoot {...props} kind="position" />
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
