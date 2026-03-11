import {
  DndContext,
  DragEndEvent,
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
  PlayIcon,
  Rows3Icon,
  TablePropertiesIcon,
} from 'lucide-react';
import React, {useMemo, useState} from 'react';
import {PIVOT_AGGREGATORS, getPivotAggregator} from './aggregators';
import {buildDistinctValuesQuery} from './sql';
import {
  PIVOT_RENDERER_NAMES,
  PivotConfig,
  PivotDropZone,
  PivotField,
  PivotSourceOption,
} from './types';

const CONTAINER_ID_PREFIX = 'pivot-container:';
const numericTypePattern = /INT|DECIMAL|FLOAT|DOUBLE|REAL|HUGEINT|BIGINT/i;

function getContainerId(zone: PivotDropZone) {
  return `${CONTAINER_ID_PREFIX}${zone}`;
}

function parseContainerId(id: string): PivotDropZone | null {
  if (!id.startsWith(CONTAINER_ID_PREFIX)) {
    return null;
  }
  return id.replace(CONTAINER_ID_PREFIX, '') as PivotDropZone;
}

function getSortIcon(order: PivotConfig['rowOrder']) {
  switch (order) {
    case 'value_a_to_z':
      return ArrowDownWideNarrowIcon;
    case 'value_z_to_a':
      return ArrowUpNarrowWideIcon;
    default:
      return ArrowUpAZIcon;
  }
}

type FilterableSortableFieldChipProps = {
  field: PivotField;
  sourceRelation?: string;
  menuLimit: number;
  isFiltered: boolean;
  filterValues: Record<string, boolean>;
  setFilterValues: (values: string[]) => void;
  addFilters: (values: string[]) => void;
  removeFilters: (values: string[]) => void;
  clearFilter: () => void;
};

const FilterableSortableFieldChip: React.FC<
  FilterableSortableFieldChipProps
> = ({
  field,
  sourceRelation,
  menuLimit,
  isFiltered,
  filterValues,
  setFilterValues,
  addFilters,
  removeFilters,
  clearFilter,
}) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id: field.name});
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = useMemo(
    () =>
      sourceRelation
        ? buildDistinctValuesQuery(sourceRelation, field.name, menuLimit)
        : '',
    [field.name, menuLimit, sourceRelation],
  );
  const valuesResult = useSql({
    query,
    enabled: open && Boolean(sourceRelation),
  });
  const values = useMemo(
    () =>
      valuesResult.data?.arrowTable
        ? (arrowTableToJson(valuesResult.data.arrowTable) as Array<{
            value: string;
            count: number;
          }>)
        : [],
    [valuesResult.data?.arrowTable],
  );

  const shownValues = values.filter((item) =>
    String(item.value).toLowerCase().includes(search.trim().toLowerCase()),
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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
            >
              <FilterIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-80 p-3"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{field.name}</div>
                  <div className="text-muted-foreground text-xs">
                    Filter values
                  </div>
                </div>
                {isFiltered ? (
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
                    removeFilters(shownValues.map((item) => String(item.value)))
                  }
                >
                  Select shown
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    addFilters(shownValues.map((item) => String(item.value)))
                  }
                >
                  Deselect shown
                </Button>
                <Button size="xs" variant="ghost" onClick={clearFilter}>
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-64 rounded-md border">
                <div className="space-y-1 p-2">
                  {valuesResult.isLoading ? (
                    <div className="text-muted-foreground text-xs">
                      Loading values...
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
                                  removeFilters([value]);
                                } else {
                                  addFilters([value]);
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
      </div>
    </div>
  );
};

type FieldZoneProps = {
  zone: PivotDropZone;
  title: string;
  description: string;
  framed?: boolean;
  items: PivotField[];
  sourceRelation?: string;
  menuLimit: number;
  filterValues: PivotConfig['valueFilter'];
  setFilterValues: (field: string, values: string[]) => void;
  addFilters: (field: string, values: string[]) => void;
  removeFilters: (field: string, values: string[]) => void;
  clearFilter: (field: string) => void;
};

const FieldZone: React.FC<FieldZoneProps> = ({
  zone,
  title,
  description,
  framed = true,
  items,
  sourceRelation,
  menuLimit,
  filterValues,
  setFilterValues,
  addFilters,
  removeFilters,
  clearFilter,
}) => {
  const {setNodeRef, isOver} = useDroppable({id: getContainerId(zone)});

  const content = (
    <>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <div className="text-muted-foreground text-xs">{description}</div>
      </CardHeader>
      <CardContent>
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
              <FilterableSortableFieldChip
                key={field.name}
                field={field}
                sourceRelation={sourceRelation}
                menuLimit={menuLimit}
                isFiltered={Boolean(filterValues[field.name])}
                filterValues={filterValues[field.name] ?? {}}
                setFilterValues={(values) =>
                  setFilterValues(field.name, values)
                }
                addFilters={(values) => addFilters(field.name, values)}
                removeFilters={(values) => removeFilters(field.name, values)}
                clearFilter={() => clearFilter(field.name)}
              />
            ))}
          </SortableContext>
          {items.length === 0 ? (
            <div className="text-muted-foreground text-xs">
              Drop fields here.
            </div>
          ) : null}
        </div>
      </CardContent>
    </>
  );

  if (!framed) {
    return (
      <div className="space-y-0">
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
              <FilterableSortableFieldChip
                key={field.name}
                field={field}
                sourceRelation={sourceRelation}
                menuLimit={menuLimit}
                isFiltered={Boolean(filterValues[field.name])}
                filterValues={filterValues[field.name] ?? {}}
                setFilterValues={(values) =>
                  setFilterValues(field.name, values)
                }
                addFilters={(values) => addFilters(field.name, values)}
                removeFilters={(values) => removeFilters(field.name, values)}
                clearFilter={() => clearFilter(field.name)}
              />
            ))}
          </SortableContext>
          {items.length === 0 ? (
            <div className="text-muted-foreground text-xs">
              Drop fields here.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return <Card>{content}</Card>;
};

export type PivotEditorProps = {
  title?: string;
  sourceLabel?: string;
  sourceValue?: string;
  sourceOptions: PivotSourceOption[];
  config: PivotConfig;
  availableFields: PivotField[];
  sourceRelation?: string;
  status?: {
    status: string;
    stale?: boolean;
    lastError?: string;
  };
  onSourceChange: (value: string) => void;
  onRendererNameChange: (rendererName: PivotConfig['rendererName']) => void;
  onAggregatorNameChange: (aggregatorName: string) => void;
  onValsChange: (vals: string[]) => void;
  onMoveField: (
    field: string,
    destination: PivotDropZone,
    index?: number,
  ) => void;
  onCycleRowOrder: () => void;
  onCycleColOrder: () => void;
  onSetFilterValues: (field: string, values: string[]) => void;
  onAddFilters: (field: string, values: string[]) => void;
  onRemoveFilters: (field: string, values: string[]) => void;
  onClearFilter: (field: string) => void;
  onRun?: () => void;
  results: React.ReactNode;
};

export const PivotEditor: React.FC<PivotEditorProps> = ({
  title = 'Pivot output',
  sourceLabel = 'Source',
  sourceValue,
  sourceOptions,
  config,
  availableFields,
  sourceRelation,
  status,
  onSourceChange,
  onRendererNameChange,
  onAggregatorNameChange,
  onValsChange,
  onMoveField,
  onCycleRowOrder,
  onCycleColOrder,
  onSetFilterValues,
  onAddFilters,
  onRemoveFilters,
  onClearFilter,
  onRun,
  results,
}) => {
  const rowFields = useMemo(
    () =>
      config.rows
        .map((name) => availableFields.find((field) => field.name === name))
        .filter((field): field is PivotField => Boolean(field)),
    [availableFields, config.rows],
  );
  const colFields = useMemo(
    () =>
      config.cols
        .map((name) => availableFields.find((field) => field.name === name))
        .filter((field): field is PivotField => Boolean(field)),
    [availableFields, config.cols],
  );
  const unusedFields = useMemo(() => {
    const used = new Set([...config.rows, ...config.cols]);
    const candidates = availableFields.filter(
      (field) =>
        !used.has(field.name) &&
        !config.hiddenFromDragDrop.includes(field.name),
    );
    const orderedNames = [
      ...config.unusedOrder.filter((name) =>
        candidates.some((field) => field.name === name),
      ),
      ...candidates
        .map((field) => field.name)
        .filter((name) => !config.unusedOrder.includes(name)),
    ];
    return orderedNames
      .map((name) => candidates.find((field) => field.name === name))
      .filter((field): field is PivotField => Boolean(field));
  }, [
    availableFields,
    config.cols,
    config.hiddenFromDragDrop,
    config.rows,
    config.unusedOrder,
  ]);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : '';
    if (!overId) {
      return;
    }

    const containerId =
      parseContainerId(overId) ??
      parseContainerId(
        String(event.over?.data.current?.sortable?.containerId ?? ''),
      );
    const fallbackDestination = Object.entries(zoneItems).find(([, items]) =>
      items.includes(overId),
    )?.[0] as PivotDropZone | undefined;
    const destination = containerId ?? fallbackDestination;

    if (!destination) {
      return;
    }

    const index = containerId
      ? zoneItems[destination].length
      : zoneItems[destination].indexOf(overId);
    onMoveField(activeId, destination, index);
  };

  const aggregator = getPivotAggregator(config.aggregatorName);
  const rowSortIcon = getSortIcon(config.rowOrder);
  const colSortIcon = getSortIcon(config.colOrder);

  return (
    <div className="bg-muted/10 flex h-full flex-col gap-4 overflow-auto p-4">
      <Card>
        <CardContent className="grid gap-4 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          <div className="space-y-2">
            <Label>{sourceLabel}</Label>
            <Select value={sourceValue} onValueChange={onSourceChange}>
              <SelectTrigger>
                <SelectValue
                  placeholder={`Select ${sourceLabel.toLowerCase()}`}
                />
              </SelectTrigger>
              <SelectContent>
                {sourceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Renderer</Label>
            <Select
              value={config.rendererName}
              onValueChange={onRendererNameChange}
            >
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
          <div className="space-y-2">
            <Label>Aggregator</Label>
            <Select
              value={config.aggregatorName}
              onValueChange={onAggregatorNameChange}
            >
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
          <div className="space-y-2">
            <Label>Values</Label>
            <div className="flex flex-col gap-2">
              {Array.from({length: aggregator.numInputs}).map((_, index) => (
                <Select
                  key={`value-select-${index}`}
                  value={config.vals[index]}
                  onValueChange={(value) => {
                    const nextValues = [...config.vals];
                    nextValues[index] = value;
                    onValsChange(nextValues.slice(0, aggregator.numInputs));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Value ${index + 1}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields
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
              ))}
              {aggregator.numInputs === 0 ? (
                <div className="text-muted-foreground text-xs">
                  This aggregation does not require measure columns.
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                  <div>
                    <CardTitle className="text-sm">Rows</CardTitle>
                    <div className="text-muted-foreground text-xs">
                      Drag fields to define row groups.
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={onCycleRowOrder}>
                    {React.createElement(rowSortIcon, {className: 'h-4 w-4'})}
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <FieldZone
                    zone="rows"
                    title=""
                    description=""
                    framed={false}
                    items={rowFields}
                    sourceRelation={sourceRelation}
                    menuLimit={config.menuLimit}
                    filterValues={config.valueFilter}
                    setFilterValues={onSetFilterValues}
                    addFilters={onAddFilters}
                    removeFilters={onRemoveFilters}
                    clearFilter={onClearFilter}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                  <div>
                    <CardTitle className="text-sm">Columns</CardTitle>
                    <div className="text-muted-foreground text-xs">
                      Drag fields to define column groups.
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={onCycleColOrder}>
                    {React.createElement(colSortIcon, {className: 'h-4 w-4'})}
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <FieldZone
                    zone="cols"
                    title=""
                    description=""
                    framed={false}
                    items={colFields}
                    sourceRelation={sourceRelation}
                    menuLimit={config.menuLimit}
                    filterValues={config.valueFilter}
                    setFilterValues={onSetFilterValues}
                    addFilters={onAddFilters}
                    removeFilters={onRemoveFilters}
                    clearFilter={onClearFilter}
                  />
                </CardContent>
              </Card>
            </div>

            <FieldZone
              zone="unused"
              title="Available fields"
              description="Drag fields into rows or columns."
              items={unusedFields}
              sourceRelation={sourceRelation}
              menuLimit={config.menuLimit}
              filterValues={config.valueFilter}
              setFilterValues={onSetFilterValues}
              addFilters={onAddFilters}
              removeFilters={onRemoveFilters}
              clearFilter={onClearFilter}
            />
          </div>

          <Card className="min-h-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <div>
                <CardTitle className="text-sm">{title}</CardTitle>
                <div className="text-muted-foreground text-xs">
                  DuckDB computes the aggregation; charts render with Vega-Lite.
                </div>
              </div>
              <div className="flex items-center gap-3">
                {status ? (
                  <Badge
                    variant={
                      status.status === 'error' ? 'destructive' : 'secondary'
                    }
                  >
                    {status.stale ? 'stale' : status.status}
                  </Badge>
                ) : null}
                {onRun ? (
                  <Button size="sm" variant="secondary" onClick={onRun}>
                    <PlayIcon className="mr-1 h-4 w-4" />
                    Run
                  </Button>
                ) : null}
                <div className="text-muted-foreground flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Rows3Icon className="h-3.5 w-3.5" /> {config.rows.length}{' '}
                    rows
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Columns2Icon className="h-3.5 w-3.5" />{' '}
                    {config.cols.length} cols
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <TablePropertiesIcon className="h-3.5 w-3.5" />
                    {aggregator.name}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0">{results}</CardContent>
          </Card>
        </div>
      </DndContext>
    </div>
  );
};
