import React, {useCallback, useMemo} from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Label,
  Separator,
  Switch,
} from '@sqlrooms/ui';
import {produce} from 'immer';
import {useCellsStore} from '../hooks';
import type {BrushFieldType, TimeScale, VegaCell, VegaCellData} from '../types';
import {
  readSpecValues,
  buildCrossFilterSpec,
  buildFlatSpec,
} from '../vegaSpecBuilder';
import {FieldSelector} from './FieldSelector';
import {ColorSelector, colorOptions} from './ColorSelector';
import {ChartTypeSelector} from './ChartTypeSelector';
import {AggregationSelector} from './AggregationSelector';
import {TimeScaleSelector} from './TimeScaleSelector';
import {detectFieldType} from '../utils';
import {useVegaCellSchema} from '../hooks/useVegaCellSchema';

type VegaConfigPanelProps = {
  cell: VegaCell;
  spec: any;
  onSpecChange: (spec: any) => void;
};

export const VegaConfigPanel: React.FC<VegaConfigPanelProps> = ({
  cell,
  spec,
  onSpecChange,
}) => {
  const updateCell = useCellsStore((s) => s.cells.updateCell);
  const crossFilterEnabled = cell.data.crossFilter?.enabled !== false;
  const xTimeScale = cell.data.xTimeScale;

  // Query schema using metadata - decoupled from SQL cell cache
  const {fields: schemaFields} = useVegaCellSchema(cell);
  const fields = schemaFields ?? [];

  // Helper to detect field type from schema
  const getFieldType = useCallback(
    (fieldName: string) => {
      return schemaFields
        ? detectFieldType(fieldName, {schema: {fields: schemaFields}})
        : undefined;
    },
    [schemaFields],
  );

  // Generic updater for cross-filter properties
  const updateCrossFilter = <
    K extends keyof NonNullable<VegaCellData['crossFilter']>,
  >(
    key: K,
    value: NonNullable<VegaCellData['crossFilter']>[K],
  ) => {
    updateCell(cell.id, (c) =>
      produce(c, (draft) => {
        if (draft.type === 'vega') {
          if (!draft.data.crossFilter) draft.data.crossFilter = {};
          draft.data.crossFilter[key] = value;
        }
      }),
    );
  };

  // Generic updater for cell data properties
  const updateVegaData = <K extends keyof VegaCellData>(
    key: K,
    value: VegaCellData[K],
  ) => {
    updateCell(cell.id, (c) =>
      produce(c, (draft) => {
        if (draft.type === 'vega') {
          draft.data[key] = value;
        }
      }),
    );
  };

  // Internal handlers that update cell directly
  const onCrossFilterToggle = (enabled: boolean) =>
    updateCrossFilter('enabled', enabled);
  const onBrushFieldChange = (field: string | undefined) =>
    updateCrossFilter('brushField', field);
  const onBrushFieldTypeChange = (fieldType: BrushFieldType | undefined) =>
    updateCrossFilter('brushFieldType', fieldType);
  const onXTimeScaleChange = (timeScale: TimeScale) =>
    updateVegaData('xTimeScale', timeScale);

  const current = readSpecValues(spec);

  // Pre-compute commonly used field types
  const fieldTypes = useMemo(
    () => ({
      xField: current.xField ? getFieldType(current.xField) : undefined,
      yField: current.yField ? getFieldType(current.yField) : undefined,
    }),
    [current.xField, current.yField, getFieldType],
  );

  /**
   * Rebuilds the Vega spec with new values and updates cross-filter settings.
   *
   * @param overrides - Partial spec values to override. Use xTimeScale to specify
   *                    a time scale value that should take precedence over cellData.xTimeScale.
   *                    This is necessary to avoid race conditions when the time scale is changed
   *                    but the cellData hasn't been updated yet.
   * @param cfEnabled - Whether cross-filtering should be enabled in the rebuilt spec
   */
  const rebuild = (
    overrides: Partial<ReturnType<typeof readSpecValues>> & {
      xTimeScale?: TimeScale;
    },
    cfEnabled = crossFilterEnabled,
  ) => {
    // Include xTimeScale from cell.data as part of current state
    // (readSpecValues doesn't return xTimeScale since it's not stored in spec)
    const merged = {
      ...current,
      xTimeScale, // from cell.data
      ...overrides, // allow explicit override
    };
    const builder = cfEnabled ? buildCrossFilterSpec : buildFlatSpec;
    const xFieldType = merged.xField ? getFieldType(merged.xField) : undefined;

    onSpecChange(
      builder({
        mark: merged.mark ?? 'bar',
        xField: merged.xField,
        xFieldType,
        xTimeScale: merged.xTimeScale,
        yField: merged.yField,
        yAggregate: merged.yAggregate,
        color: merged.color ?? colorOptions[0]?.value,
      }),
    );
    if ('xField' in overrides) {
      // Only set brush field if cross-filter is enabled AND field type supports it
      const shouldSetBrushField = cfEnabled && xFieldType !== null;
      onBrushFieldChange(shouldSetBrushField ? overrides.xField : undefined);
      onBrushFieldTypeChange(
        shouldSetBrushField && overrides.xField ? xFieldType : undefined,
      );
    }
  };

  const handleMarkChange = (mark: string) => rebuild({mark});
  const handleXFieldChange = (field: string) => {
    const fieldType = getFieldType(field);
    // Disable cross-filtering if field type doesn't support it
    const canCrossFilter = fieldType !== null;
    const effectiveCrossFilter = crossFilterEnabled && canCrossFilter;

    // Reset time scale when changing to non-temporal field
    if (fieldType !== 'temporal') {
      onXTimeScaleChange('none');
      rebuild({xField: field, xTimeScale: 'none'}, effectiveCrossFilter);
    } else {
      rebuild({xField: field}, effectiveCrossFilter);
    }

    // Auto-disable cross-filtering if field doesn't support it
    if (!canCrossFilter && crossFilterEnabled) {
      onCrossFilterToggle(false);
    }
  };
  const handleYFieldChange = (field: string) => {
    const fieldType = getFieldType(field);
    // Only numeric fields support sum/mean, all others force count aggregation
    const aggregate =
      fieldType === 'numeric' ? (current.yAggregate ?? 'sum') : 'count';
    rebuild({yField: field, yAggregate: aggregate});
  };
  const handleYAggregationChange = (aggregate: string) =>
    rebuild({yAggregate: aggregate});
  const handleColorChange = (color: string) => rebuild({color});
  const handleXTimeScaleChange = (xTimeScale: TimeScale) => {
    onXTimeScaleChange(xTimeScale);
    // Rebuild spec with new time scale to apply axis formatting
    rebuild({xTimeScale}, crossFilterEnabled);
  };

  const handleCrossFilterToggle = (enabled: boolean) => {
    onCrossFilterToggle(enabled);
    rebuild({}, enabled);
    // Only set brush field if enabled AND field type supports cross-filtering
    const shouldSetBrushField = enabled && fieldTypes.xField !== null;
    onBrushFieldChange(shouldSetBrushField ? current.xField : undefined);
    onBrushFieldTypeChange(
      shouldSetBrushField && current.xField ? fieldTypes.xField : undefined,
    );
  };

  const isXFieldTemporal = fieldTypes.xField === 'temporal';
  const xFieldSupportsCrossFilter = fieldTypes.xField !== null;

  const yFieldType = fieldTypes.yField;

  return (
    <div className="w-80 border-r p-4 text-xs">
      <div className="space-y-3">
        <ChartTypeSelector
          value={current.mark}
          onValueChange={handleMarkChange}
        />

        <Separator />

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" className="text-xs">
              General
            </TabsTrigger>
            <TabsTrigger value="styles" className="text-xs">
              Styles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4 space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-400">
                X-Axis
              </Label>
              <div className="flex gap-2">
                <FieldSelector
                  value={current.xField}
                  fields={fields}
                  onValueChange={handleXFieldChange}
                />
                {isXFieldTemporal && (
                  <TimeScaleSelector
                    value={xTimeScale}
                    onValueChange={handleXTimeScaleChange}
                  />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-400">
                Y-Axis
              </Label>
              <div className="flex gap-2">
                <FieldSelector
                  value={current.yField}
                  fields={fields}
                  onValueChange={handleYFieldChange}
                />

                <AggregationSelector
                  value={current.yAggregate}
                  fieldType={yFieldType}
                  onValueChange={handleYAggregationChange}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-400">
                  Cross-filter
                </Label>
                <Switch
                  checked={crossFilterEnabled}
                  onCheckedChange={handleCrossFilterToggle}
                  disabled={!xFieldSupportsCrossFilter}
                />
              </div>
              {!xFieldSupportsCrossFilter && (
                <p className="text-xs text-gray-500">
                  Selected field type does not support cross-filtering
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="styles" className="mt-4 space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-400">Color</Label>
              <ColorSelector
                value={current.color}
                onValueChange={handleColorChange}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
