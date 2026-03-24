import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {arrowTableToJson, useSql} from '@sqlrooms/duckdb';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@sqlrooms/ui';
import {
  ArrowDownWideNarrowIcon,
  ArrowUpAZIcon,
  ArrowUpNarrowWideIcon,
  Columns2Icon,
  FilterIcon,
  GripVerticalIcon,
  Rows3Icon,
  TablePropertiesIcon,
} from 'lucide-react';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useStore} from 'zustand';
import {PIVOT_AGGREGATORS, getPivotAggregator} from './aggregators';
import {
  type CreatePivotCoreStoreProps,
  type PivotInstanceState,
  type PivotInstanceStore,
  createPivotCoreStore,
} from './PivotCoreSlice';
import {PivotResults} from './PivotResults';
import {buildDistinctValuesQuery} from './sql';
import {
  PIVOT_RENDERER_NAMES,
  type PivotDropZone,
  type PivotField,
} from './types';

type PivotEditorProps = CreatePivotCoreStoreProps & {
  store?: PivotInstanceStore;
  autoRun?: boolean;
  autoRunDebounceMs?: number;
  className?: string;
  children?: React.ReactNode;
};

const PivotEditorStoreContext = createContext<PivotInstanceStore | null>(null);

function usePivotEditorStore<T>(selector: (state: PivotInstanceState) => T): T {
  const store = useContext(PivotEditorStoreContext);
  if (!store) {
    throw new Error('PivotEditor store context is missing');
  }
  return useStore(store, selector);
}

function usePivotEditorStoreApi() {
  const store = useContext(PivotEditorStoreContext);
  if (!store) {
    throw new Error('PivotEditor store context is missing');
  }
  return store;
}

const CONTAINER_ID_PREFIX = 'pivot-container:';
const numericTypePattern = /INT|DECIMAL|FLOAT|DOUBLE|REAL|HUGEINT|BIGINT/i;
const EMPTY_FILTER_VALUES: Record<string, boolean> = Object.freeze({});

function getContainerId(zone: PivotDropZone) {
  return `${CONTAINER_ID_PREFIX}${zone}`;
}

function parseContainerId(id: string): PivotDropZone | null {
  if (!id.startsWith(CONTAINER_ID_PREFIX)) {
    return null;
  }
  return id.replace(CONTAINER_ID_PREFIX, '') as PivotDropZone;
}

function getSortIcon(order: PivotInstanceState['config']['rowOrder']) {
  switch (order) {
    case 'value_a_to_z':
      return ArrowDownWideNarrowIcon;
    case 'value_z_to_a':
      return ArrowUpNarrowWideIcon;
    default:
      return ArrowUpAZIcon;
  }
}

function useVisibleFields() {
  const fields = usePivotEditorStore((state) => state.fields);
  const hiddenAttributes = usePivotEditorStore(
    (state) => state.config.hiddenAttributes,
  );
  return useMemo(
    () => fields.filter((field) => !hiddenAttributes.includes(field.name)),
    [fields, hiddenAttributes],
  );
}

function useZoneFields(zone: PivotDropZone) {
  const visibleFields = useVisibleFields();
  const rows = usePivotEditorStore((state) => state.config.rows);
  const cols = usePivotEditorStore((state) => state.config.cols);
  const hiddenFromDragDrop = usePivotEditorStore(
    (state) => state.config.hiddenFromDragDrop,
  );
  const unusedOrder = usePivotEditorStore((state) => state.config.unusedOrder);

  return useMemo(() => {
    if (zone === 'rows') {
      return rows
        .map((name) => visibleFields.find((field) => field.name === name))
        .filter((field): field is PivotField => Boolean(field));
    }

    if (zone === 'cols') {
      return cols
        .map((name) => visibleFields.find((field) => field.name === name))
        .filter((field): field is PivotField => Boolean(field));
    }

    const used = new Set([...rows, ...cols]);
    const candidates = visibleFields.filter(
      (field) =>
        !used.has(field.name) && !hiddenFromDragDrop.includes(field.name),
    );
    const orderedNames = [
      ...unusedOrder.filter((name) =>
        candidates.some((field) => field.name === name),
      ),
      ...candidates
        .map((field) => field.name)
        .filter((name) => !unusedOrder.includes(name)),
    ];
    return orderedNames
      .map((name) => candidates.find((field) => field.name === name))
      .filter((field): field is PivotField => Boolean(field));
  }, [zone, rows, cols, hiddenFromDragDrop, unusedOrder, visibleFields]);
}

function AutoRunEffect({
  enabled,
  debounceMs,
}: {
  enabled: boolean;
  debounceMs: number;
}) {
  const store = usePivotEditorStoreApi();
  const source = usePivotEditorStore((state) => state.source);
  const config = usePivotEditorStore((state) => state.config);
  const stale = usePivotEditorStore((state) => state.status.stale);
  const runState = usePivotEditorStore((state) => state.status.state);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !source || !stale || runState === 'running') {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      void store.getState().run();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [config, debounceMs, enabled, runState, source, stale, store]);

  return null;
}

type PivotEditorComponent = React.FC<PivotEditorProps> & {
  Source: React.FC<{children?: React.ReactNode}>;
  Toolbar: React.FC<{children?: React.ReactNode}>;
  TableSelector: React.FC;
  RunButton: React.FC;
  RendererSelector: React.FC;
  AggregatorSelector: React.FC;
  Values: React.FC<{children?: React.ReactNode}> & {
    Select: React.FC<{index: number}>;
  };
  Rows: React.FC<{children?: React.ReactNode}> & {
    Header: React.FC;
    Zone: React.FC;
  };
  Columns: React.FC<{children?: React.ReactNode}> & {
    Header: React.FC;
    Zone: React.FC;
  };
  AvailableFields: React.FC<{children?: React.ReactNode}> & {
    Zone: React.FC;
  };
  FieldChip: React.FC<{field: PivotField}>;
  FieldFilter: React.FC<{
    field: PivotField;
    children: React.ReactNode;
  }>;
  Output: React.FC<{children?: React.ReactNode}> & {
    Header: React.FC;
    Body: React.FC;
  };
  Results: React.FC;
  TableOutput: React.FC;
  ChartOutput: React.FC;
  TsvOutput: React.FC;
};

const PivotEditorRoot: React.FC<PivotEditorProps> = ({
  store,
  source,
  config,
  status,
  querySource,
  fields,
  availableTables,
  callbacks,
  autoRun = false,
  autoRunDebounceMs = 300,
  className,
  children,
}) => {
  const [internalStore] = useState(() =>
    store
      ? null
      : createPivotCoreStore({
          source,
          config,
          status,
          querySource,
          fields,
          availableTables,
          callbacks,
        }),
  );

  const resolvedStore = store ?? internalStore;
  if (!resolvedStore) {
    return null;
  }

  return (
    <PivotEditorStoreContext.Provider value={resolvedStore}>
      <AutoRunEffect enabled={autoRun} debounceMs={autoRunDebounceMs} />
      <PivotEditorDndProvider className={className}>
        {children ?? <DefaultPivotEditorLayout />}
      </PivotEditorDndProvider>
    </PivotEditorStoreContext.Provider>
  );
};

const PivotEditorDndProvider: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({className, children}) => {
  const moveField = usePivotEditorStore((state) => state.moveField);
  const rowFields = useZoneFields('rows');
  const colFields = useZoneFields('cols');
  const unusedFields = useZoneFields('unused');
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {distance: 6},
    }),
  );

  const zoneItems: Record<PivotDropZone, string[]> = {
    unused: unusedFields.map((field) => field.name),
    rows: rowFields.map((field) => field.name),
    cols: colFields.map((field) => field.name),
  };

  const [activeDragField, setActiveDragField] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragField(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : '';
    setActiveDragField(null);
    if (!overId) {
      return;
    }

    const containerId =
      parseContainerId(overId) ??
      parseContainerId(
        String(event.over?.data.current?.sortable?.containerId ?? ''),
      );
    const destination =
      containerId ??
      (Object.entries(zoneItems).find(([, items]) =>
        items.includes(overId),
      )?.[0] as PivotDropZone | undefined);

    if (!destination) {
      return;
    }

    const index = containerId
      ? zoneItems[destination].length
      : zoneItems[destination].indexOf(overId);
    moveField(activeId, destination, index);
  };

  return (
    <div
      className={cn(
        'bg-muted/10 flex h-full flex-col gap-4 overflow-auto p-4',
        className,
      )}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragField(null)}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeDragField ? (
            <div className="bg-background flex items-center gap-1 rounded-md border px-2 py-1 text-sm shadow-md">
              <GripVerticalIcon className="text-muted-foreground h-4 w-4" />
              <span className="truncate">{activeDragField}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

const PivotSourceSection: React.FC<{children?: React.ReactNode}> = ({
  children,
}) => (
  <Card>
    <CardContent className="grid gap-4 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
      {children ?? (
        <>
          <PivotTableSelector />
          <PivotRendererSelector />
          <PivotAggregatorSelector />
          <PivotValues />
        </>
      )}
    </CardContent>
  </Card>
);

const PivotToolbar: React.FC<{children?: React.ReactNode}> = ({children}) => (
  <div className="flex items-center justify-between gap-3">{children}</div>
);

const PivotTableSelector: React.FC = () => {
  const source = usePivotEditorStore((state) => state.source);
  const availableTables = usePivotEditorStore((state) => state.availableTables);
  const setSource = usePivotEditorStore((state) => state.setSource);

  return (
    <div className="space-y-2">
      <Label>Table</Label>
      <Select
        value={source?.kind === 'table' ? source.tableName : undefined}
        onValueChange={(tableName) => setSource({kind: 'table', tableName})}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a table" />
        </SelectTrigger>
        <SelectContent>
          {availableTables.map((tableName) => (
            <SelectItem key={tableName} value={tableName}>
              {tableName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const PivotRunButton: React.FC = () => {
  const run = usePivotEditorStore((state) => state.run);
  const status = usePivotEditorStore((state) => state.status);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => void run()}
      disabled={status.state === 'running'}
    >
      {status.state === 'running' ? 'Running…' : 'Run'}
    </Button>
  );
};

const PivotRendererSelector: React.FC = () => {
  const value = usePivotEditorStore((state) => state.config.rendererName);
  const setRendererName = usePivotEditorStore((state) => state.setRendererName);

  return (
    <div className="space-y-2">
      <Label>Renderer</Label>
      <Select value={value} onValueChange={setRendererName}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PIVOT_RENDERER_NAMES.map((rendererName) => (
            <SelectItem key={rendererName} value={rendererName}>
              {rendererName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const PivotAggregatorSelector: React.FC = () => {
  const value = usePivotEditorStore((state) => state.config.aggregatorName);
  const setAggregatorName = usePivotEditorStore(
    (state) => state.setAggregatorName,
  );

  return (
    <div className="space-y-2">
      <Label>Aggregator</Label>
      <Select value={value} onValueChange={setAggregatorName}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(PIVOT_AGGREGATORS).map((aggregatorName) => (
            <SelectItem key={aggregatorName} value={aggregatorName}>
              {aggregatorName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const PivotValuesSelect: React.FC<{index: number}> = ({index}) => {
  const visibleFields = useVisibleFields();
  const config = usePivotEditorStore((state) => state.config);
  const setVals = usePivotEditorStore((state) => state.setVals);
  const aggregator = useMemo(
    () => getPivotAggregator(config.aggregatorName),
    [config.aggregatorName],
  );

  return (
    <Select
      value={config.vals[index]}
      onValueChange={(value) => {
        const nextValues = [...config.vals];
        nextValues[index] = value;
        setVals(nextValues.slice(0, aggregator.numInputs));
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={`Value ${index + 1}`} />
      </SelectTrigger>
      <SelectContent>
        {visibleFields
          .filter(
            (field) =>
              !config.hiddenFromAggregators.includes(field.name) &&
              (aggregator.valueRequirement !== 'numeric' ||
                numericTypePattern.test(field.type)),
          )
          .map((field) => (
            <SelectItem key={field.name} value={field.name}>
              {field.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
};

const PivotValuesBase: React.FC<{children?: React.ReactNode}> = ({
  children,
}) => {
  const aggregatorName = usePivotEditorStore(
    (state) => state.config.aggregatorName,
  );
  const aggregator = useMemo(
    () => getPivotAggregator(aggregatorName),
    [aggregatorName],
  );

  return (
    <div className="space-y-2">
      <Label>Values</Label>
      <div className="flex flex-col gap-2">
        {children ??
          Array.from({length: aggregator.numInputs}).map((_, index) => (
            <PivotValuesSelect key={`value-select-${index}`} index={index} />
          ))}
        {aggregator.numInputs === 0 ? (
          <div className="text-muted-foreground text-xs">
            This aggregation does not require measure columns.
          </div>
        ) : null}
      </div>
    </div>
  );
};

const PivotFieldFilter: React.FC<{
  field: PivotField;
  children: React.ReactNode;
}> = ({field, children}) => {
  const querySource = usePivotEditorStore((state) => state.querySource);
  const menuLimit = usePivotEditorStore((state) => state.config.menuLimit);
  const rawFilterValues = usePivotEditorStore(
    (state) => state.config.valueFilter[field.name],
  );
  const filterValues = rawFilterValues ?? EMPTY_FILTER_VALUES;
  const setFilterValues = usePivotEditorStore(
    (state) => state.setAttributeFilterValues,
  );
  const addFilters = usePivotEditorStore(
    (state) => state.addAttributeFilterValues,
  );
  const removeFilters = usePivotEditorStore(
    (state) => state.removeAttributeFilterValues,
  );
  const clearFilter = usePivotEditorStore(
    (state) => state.clearAttributeFilter,
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = useMemo(
    () =>
      querySource
        ? buildDistinctValuesQuery(querySource, field.name, menuLimit)
        : '',
    [field.name, menuLimit, querySource],
  );
  const valuesResult = useSql({query, enabled: open && Boolean(query)});
  const valuesData = valuesResult.data;
  const values = useMemo(
    () =>
      valuesData?.arrowTable
        ? (arrowTableToJson(valuesData.arrowTable) as Array<{
            value: string;
            count: number;
          }>)
        : [],
    [valuesData],
  );
  const shownValues = values.filter((item) =>
    String(item.value).toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{field.name}</div>
              <div className="text-muted-foreground text-xs">Filter values</div>
            </div>
            {Object.keys(filterValues).length > 0 ? (
              <Badge variant="secondary">
                {Object.keys(filterValues).length} excluded
              </Badge>
            ) : null}
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search values"
            className="h-8"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                removeFilters(
                  field.name,
                  shownValues.map((item) => String(item.value)),
                )
              }
            >
              Select shown
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                addFilters(
                  field.name,
                  shownValues.map((item) => String(item.value)),
                )
              }
            >
              Deselect shown
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => clearFilter(field.name)}
            >
              Clear
            </Button>
          </div>
          <ScrollArea className="h-64 rounded-md border">
            <div className="space-y-1 p-2">
              {valuesResult.isLoading ? (
                <div className="text-muted-foreground text-xs">
                  Loading values…
                </div>
              ) : shownValues.length === 0 ? (
                <div className="text-muted-foreground text-xs">
                  No matching values.
                </div>
              ) : (
                shownValues.map((item) => {
                  const value = String(item.value);
                  const included = !(value in filterValues);
                  return (
                    <div
                      key={value}
                      className="hover:bg-muted flex items-center justify-between gap-2 rounded-sm px-2 py-1"
                    >
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                        <Checkbox
                          checked={included}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              removeFilters(field.name, [value]);
                            } else {
                              addFilters(field.name, [value]);
                            }
                          }}
                        />
                        <span className="truncate">{value || 'null'}</span>
                        <span className="text-muted-foreground text-xs">
                          ({item.count})
                        </span>
                      </label>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          setFilterValues(
                            field.name,
                            values
                              .map((candidate) => String(candidate.value))
                              .filter((candidate) => candidate !== value),
                          )
                        }
                      >
                        only
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const PivotFieldChip: React.FC<{field: PivotField}> = ({field}) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id: field.name});
  const isFiltered = usePivotEditorStore((state) =>
    Boolean(state.config.valueFilter[field.name]),
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="max-w-full"
      {...attributes}
    >
      <div
        className={cn(
          'bg-background flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-sm shadow-xs',
          isFiltered && 'border-primary text-primary',
        )}
      >
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab"
          {...listeners}
        >
          <GripVerticalIcon className="h-4 w-4" />
        </button>
        <span className="truncate">{field.name}</span>
        <PivotFieldFilter field={field}>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
          >
            <FilterIcon className="h-3.5 w-3.5" />
          </Button>
        </PivotFieldFilter>
      </div>
    </div>
  );
};

const PivotZone: React.FC<{
  zone: PivotDropZone;
  title: string;
  description: string;
  framed?: boolean;
}> = ({zone, title, description, framed = true}) => {
  const items = useZoneFields(zone);
  const {setNodeRef, isOver} = useDroppable({id: getContainerId(zone)});

  const content = (
    <>
      {framed ? (
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-sm">{title}</CardTitle>
          <div className="text-muted-foreground text-xs">{description}</div>
        </CardHeader>
      ) : null}
      {framed ? <CardContent>{renderZone()}</CardContent> : renderZone()}
    </>
  );

  function renderZone() {
    return (
      <div
        ref={setNodeRef}
        id={getContainerId(zone)}
        className={cn(
          'bg-muted/30 flex min-h-20 flex-wrap items-start gap-2 rounded-md border border-dashed p-3',
          isOver && 'border-primary bg-primary/5',
        )}
      >
        <SortableContext
          id={getContainerId(zone)}
          items={items.map((field) => field.name)}
          strategy={rectSortingStrategy}
        >
          {items.map((field) => (
            <PivotFieldChip key={field.name} field={field} />
          ))}
        </SortableContext>
        {items.length === 0 ? (
          <div className="text-muted-foreground text-xs">Drop fields here.</div>
        ) : null}
      </div>
    );
  }

  return framed ? <Card>{content}</Card> : <>{content}</>;
};

const PivotRowsHeader: React.FC = () => {
  const cycleRowOrder = usePivotEditorStore((state) => state.cycleRowOrder);
  const rowOrder = usePivotEditorStore((state) => state.config.rowOrder);
  const icon = getSortIcon(rowOrder);

  return (
    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
      <div>
        <CardTitle className="text-sm">Rows</CardTitle>
        <div className="text-muted-foreground text-xs">
          Drag fields to define row groups.
        </div>
      </div>
      <Button size="icon" variant="ghost" onClick={cycleRowOrder}>
        {React.createElement(icon, {className: 'h-4 w-4'})}
      </Button>
    </CardHeader>
  );
};

const PivotRowsZone: React.FC = () => (
  <CardContent className="pt-0">
    <PivotZone
      zone="rows"
      title="Rows"
      description="Drag fields to define row groups."
      framed={false}
    />
  </CardContent>
);

const PivotRowsBase: React.FC<{children?: React.ReactNode}> = ({children}) => (
  <Card>
    {children ?? (
      <>
        <PivotRowsHeader />
        <PivotRowsZone />
      </>
    )}
  </Card>
);

const PivotColumnsHeader: React.FC = () => {
  const cycleColOrder = usePivotEditorStore((state) => state.cycleColOrder);
  const colOrder = usePivotEditorStore((state) => state.config.colOrder);
  const icon = getSortIcon(colOrder);

  return (
    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
      <div>
        <CardTitle className="text-sm">Columns</CardTitle>
        <div className="text-muted-foreground text-xs">
          Drag fields to define column groups.
        </div>
      </div>
      <Button size="icon" variant="ghost" onClick={cycleColOrder}>
        {React.createElement(icon, {className: 'h-4 w-4'})}
      </Button>
    </CardHeader>
  );
};

const PivotColumnsZone: React.FC = () => (
  <CardContent className="pt-0">
    <PivotZone
      zone="cols"
      title="Columns"
      description="Drag fields to define column groups."
      framed={false}
    />
  </CardContent>
);

const PivotColumnsBase: React.FC<{children?: React.ReactNode}> = ({
  children,
}) => (
  <Card>
    {children ?? (
      <>
        <PivotColumnsHeader />
        <PivotColumnsZone />
      </>
    )}
  </Card>
);

const PivotAvailableFieldsZone: React.FC = () => (
  <PivotZone
    zone="unused"
    title="Available fields"
    description="Drag fields into rows or columns."
  />
);

const PivotAvailableFieldsBase: React.FC<{children?: React.ReactNode}> = ({
  children,
}) => children ?? <PivotAvailableFieldsZone />;

const PivotResultsView: React.FC = () => {
  const config = usePivotEditorStore((state) => state.config);
  const status = usePivotEditorStore((state) => state.status);
  const querySource = usePivotEditorStore((state) => state.querySource);

  if (!querySource && !status.relations?.cells) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
        Add or load a table to start pivoting data.
      </div>
    );
  }

  return (
    <PivotResults
      config={config}
      source={querySource}
      relations={status.relations}
      runState={status.state}
      stale={status.stale}
      lastError={status.lastError}
    />
  );
};

const PivotTableOutput: React.FC = () => <PivotResultsView />;
const PivotChartOutput: React.FC = () => <PivotResultsView />;
const PivotTsvOutput: React.FC = () => <PivotResultsView />;

const PivotOutputHeader: React.FC = () => {
  const config = usePivotEditorStore((state) => state.config);
  const aggregator = useMemo(
    () => getPivotAggregator(config.aggregatorName),
    [config.aggregatorName],
  );

  return (
    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
      <div>
        <CardTitle className="text-sm">Pivot output</CardTitle>
        <div className="text-muted-foreground text-xs">
          DuckDB computes the aggregation; charts render with Vega-Lite.
        </div>
      </div>
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1">
          <Rows3Icon className="h-3.5 w-3.5" /> {config.rows.length} rows
        </span>
        <span className="inline-flex items-center gap-1">
          <Columns2Icon className="h-3.5 w-3.5" /> {config.cols.length} cols
        </span>
        <span className="inline-flex items-center gap-1">
          <TablePropertiesIcon className="h-3.5 w-3.5" />
          {aggregator.name}
        </span>
      </div>
    </CardHeader>
  );
};

const PivotOutputBody: React.FC = () => (
  <CardContent className="min-h-0">
    <PivotResultsView />
  </CardContent>
);

const PivotOutputBase: React.FC<{children?: React.ReactNode}> = ({
  children,
}) => (
  <Card className="min-h-0">
    {children ?? (
      <>
        <PivotOutputHeader />
        <PivotOutputBody />
      </>
    )}
  </Card>
);

const DefaultPivotEditorLayout: React.FC = () => {
  return (
    <>
      <PivotSourceSection />
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <PivotRows />
            <PivotColumns />
          </div>
          <PivotAvailableFields />
        </div>
        <PivotOutput />
      </div>
    </>
  );
};

const PivotValues = Object.assign(PivotValuesBase, {
  Select: PivotValuesSelect,
});

const PivotRows = Object.assign(PivotRowsBase, {
  Header: PivotRowsHeader,
  Zone: PivotRowsZone,
});

const PivotColumns = Object.assign(PivotColumnsBase, {
  Header: PivotColumnsHeader,
  Zone: PivotColumnsZone,
});

const PivotAvailableFields = Object.assign(PivotAvailableFieldsBase, {
  Zone: PivotAvailableFieldsZone,
});

const PivotOutput = Object.assign(PivotOutputBase, {
  Header: PivotOutputHeader,
  Body: PivotOutputBody,
});

export const PivotEditor = Object.assign(PivotEditorRoot, {
  Source: PivotSourceSection,
  Toolbar: PivotToolbar,
  TableSelector: PivotTableSelector,
  RunButton: PivotRunButton,
  RendererSelector: PivotRendererSelector,
  AggregatorSelector: PivotAggregatorSelector,
  Values: PivotValues,
  Rows: PivotRows,
  Columns: PivotColumns,
  AvailableFields: PivotAvailableFields,
  FieldChip: PivotFieldChip,
  FieldFilter: PivotFieldFilter,
  Output: PivotOutput,
  Results: PivotResultsView,
  TableOutput: PivotTableOutput,
  ChartOutput: PivotChartOutput,
  TsvOutput: PivotTsvOutput,
}) as PivotEditorComponent;
