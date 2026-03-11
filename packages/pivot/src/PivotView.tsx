import {DataTable} from '@sqlrooms/duckdb';
import {useBaseRoomStore} from '@sqlrooms/room-store';
import {Button, Tabs, TabsList, TabsTrigger} from '@sqlrooms/ui';
import {PlusIcon, XIcon} from 'lucide-react';
import React, {useEffect, useMemo} from 'react';
import {PivotEditor} from './PivotEditor';
import {PivotResults} from './PivotResults';
import {getPivotFieldsFromTable} from './pivotExecution';
import type {PivotSliceState, PivotSourceOption} from './types';

type PivotRootState = PivotSliceState & {
  db: {
    tables: DataTable[];
  };
};

export const PivotView: React.FC = () => {
  const tables = useBaseRoomStore<PivotRootState, DataTable[]>(
    (state) => state.db.tables,
  );
  const pivotConfig = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['config']
  >((state) => state.pivot.config);
  const pivotStatus = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['status']
  >((state) => state.pivot.status);
  const addPivot = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['addPivot']
  >((state) => state.pivot.addPivot);
  const removePivot = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['removePivot']
  >((state) => state.pivot.removePivot);
  const setCurrentPivot = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['setCurrentPivot']
  >((state) => state.pivot.setCurrentPivot);
  const setSource = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['setSource']
  >((state) => state.pivot.setSource);
  const setRendererName = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['setRendererName']
  >((state) => state.pivot.setRendererName);
  const setAggregatorName = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['setAggregatorName']
  >((state) => state.pivot.setAggregatorName);
  const setVals = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['setVals']
  >((state) => state.pivot.setVals);
  const moveField = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['moveField']
  >((state) => state.pivot.moveField);
  const cycleRowOrder = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['cycleRowOrder']
  >((state) => state.pivot.cycleRowOrder);
  const cycleColOrder = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['cycleColOrder']
  >((state) => state.pivot.cycleColOrder);
  const setAttributeFilterValues = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['setAttributeFilterValues']
  >((state) => state.pivot.setAttributeFilterValues);
  const addAttributeFilterValues = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['addAttributeFilterValues']
  >((state) => state.pivot.addAttributeFilterValues);
  const removeAttributeFilterValues = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['removeAttributeFilterValues']
  >((state) => state.pivot.removeAttributeFilterValues);
  const clearAttributeFilter = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['clearAttributeFilter']
  >((state) => state.pivot.clearAttributeFilter);
  const runPivot = useBaseRoomStore<
    PivotRootState,
    PivotRootState['pivot']['runPivot']
  >((state) => state.pivot.runPivot);

  const currentPivotId = pivotConfig.currentPivotId;
  const currentPivot = currentPivotId
    ? pivotConfig.pivots[currentPivotId]
    : undefined;
  const currentStatus = currentPivotId
    ? pivotStatus[currentPivotId]
    : undefined;

  const sourceOptions = useMemo<PivotSourceOption[]>(
    () =>
      tables.map((table) => ({
        value: `table:${table.tableName}`,
        label: table.tableName,
        source: {kind: 'table', tableName: table.tableName},
        fields: getPivotFieldsFromTable(table),
        relationName: table.table.toString(),
      })),
    [tables],
  );

  const selectedSourceOption = useMemo(
    () =>
      currentPivot?.source
        ? sourceOptions.find((option) =>
            option.source.kind === currentPivot.source?.kind &&
            option.source.kind === 'table' &&
            currentPivot.source.kind === 'table'
              ? option.source.tableName === currentPivot.source.tableName
              : false,
          )
        : undefined,
    [currentPivot?.source, sourceOptions],
  );

  useEffect(() => {
    if (
      !currentPivotId ||
      !currentPivot?.source ||
      !selectedSourceOption?.relationName
    ) {
      return;
    }
    if (currentStatus?.status === 'running') {
      return;
    }
    if (currentStatus?.relations && !currentStatus.stale) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void runPivot(currentPivotId);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [
    currentPivotId,
    currentPivot?.config,
    currentPivot?.source,
    currentStatus?.relations,
    currentStatus?.stale,
    currentStatus?.status,
    selectedSourceOption?.relationName,
    runPivot,
  ]);

  if (!currentPivot) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
        Add a pivot tab to get started.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-2">
        <Tabs value={currentPivotId} onValueChange={setCurrentPivot}>
          <div className="flex items-center gap-2">
            <TabsList className="h-9">
              {pivotConfig.order.map((pivotId) => {
                const pivot = pivotConfig.pivots[pivotId];
                if (!pivot) return null;
                return (
                  <div key={pivotId} className="flex items-center">
                    <TabsTrigger value={pivotId} className="h-7 gap-2">
                      <span>{pivot.title}</span>
                    </TabsTrigger>
                    {pivotConfig.order.length > 1 ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-1 h-7 w-7"
                        onClick={() => void removePivot(pivotId)}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </TabsList>
            <Button size="sm" variant="outline" onClick={() => addPivot()}>
              <PlusIcon className="mr-1 h-4 w-4" />
              Add pivot
            </Button>
          </div>
        </Tabs>
      </div>
      <div className="min-h-0 flex-1">
        <PivotEditor
          sourceLabel="Table"
          sourceValue={selectedSourceOption?.value}
          sourceOptions={sourceOptions}
          config={currentPivot.config}
          availableFields={
            selectedSourceOption?.fields.filter(
              (field) =>
                !currentPivot.config.hiddenAttributes.includes(field.name),
            ) ?? []
          }
          sourceRelation={selectedSourceOption?.relationName}
          status={currentStatus}
          onSourceChange={(value) => {
            const option = sourceOptions.find(
              (candidate) => candidate.value === value,
            );
            setSource(option?.source);
          }}
          onRendererNameChange={setRendererName}
          onAggregatorNameChange={setAggregatorName}
          onValsChange={setVals}
          onMoveField={moveField}
          onCycleRowOrder={cycleRowOrder}
          onCycleColOrder={cycleColOrder}
          onSetFilterValues={setAttributeFilterValues}
          onAddFilters={addAttributeFilterValues}
          onRemoveFilters={removeAttributeFilterValues}
          onClearFilter={clearAttributeFilter}
          onRun={() => void runPivot()}
          results={
            <PivotResults
              config={currentPivot.config}
              relations={currentStatus?.relations}
            />
          }
        />
      </div>
    </div>
  );
};
