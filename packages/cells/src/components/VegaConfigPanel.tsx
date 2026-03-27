import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Label,
  Separator,
  Switch,
} from '@sqlrooms/ui';
import {ChartColumnBig, ChartLine} from 'lucide-react';
import {useSql} from '@sqlrooms/duckdb';
import {getArrowColumnTypeCategory} from '@sqlrooms/duckdb';
import {BRUSH_PARAM_NAME} from '../vegaSelectionUtils';
import type {BrushFieldType} from '../types';

const markOptions = [
  {value: 'bar', label: 'Bar', icon: ChartColumnBig},
  {value: 'line', label: 'Line', icon: ChartLine},
];

const colorOptions = [
  {value: '#077A9D', label: 'Blue'},
  {value: '#FFAB00', label: 'Orange'},
  {value: '#00A972', label: 'Green'},
  {value: '#85b6b2', label: 'Teal'},
  {value: '#919191', label: 'Gray'},
];

const aggregationOptions = [
  {value: 'sum', label: 'Sum'},
  {value: 'mean', label: 'Mean'},
  {value: 'count', label: 'Count'},
];

/**
 * Read the flat encoding/mark values from either a flat spec or a
 * dual-layer cross-filter spec so the config panel dropdowns reflect
 * the current state regardless of spec shape.
 */
function readSpecValues(spec: any): {
  mark: string | undefined;
  xField: string | undefined;
  yField: string | undefined;
  yAggregate: string | undefined;
  color: string | undefined;
} {
  if (spec?.layer && Array.isArray(spec.layer)) {
    const fg = spec.layer[1] ?? spec.layer[0];
    const bg = spec.layer[0];
    return {
      mark: fg?.mark ?? bg?.mark,
      xField: fg?.encoding?.x?.field ?? bg?.encoding?.x?.field,
      yField: fg?.encoding?.y?.field ?? bg?.encoding?.y?.field,
      yAggregate: fg?.encoding?.y?.aggregate ?? bg?.encoding?.y?.aggregate,
      color: fg?.encoding?.color?.value,
    };
  }
  return {
    mark: spec?.mark,
    xField: spec?.encoding?.x?.field,
    yField: spec?.encoding?.y?.field,
    yAggregate: spec?.encoding?.y?.aggregate,
    color: spec?.encoding?.color?.value,
  };
}

/**
 * Build a dual-layer Vega-Lite spec with a brush selection param on the
 * background layer and a filter transform on the foreground layer.
 */
function buildCrossFilterSpec(opts: {
  mark: string;
  xField?: string;
  xFieldType?: BrushFieldType;
  yField?: string;
  yAggregate?: string;
  color?: string;
}): any {
  const {mark, xField, xFieldType, yField, yAggregate, color} = opts;
  const xEnc: any = xField
    ? {
        field: xField,
        ...(xFieldType === 'numeric' ? {bin: {maxbins: 20}} : {}),
      }
    : undefined;
  const yEnc: any = yField
    ? {field: yField, aggregate: yAggregate ?? 'sum'}
    : yAggregate === 'count'
      ? {aggregate: 'count'}
      : undefined;

  const encoding: any = {};
  if (xEnc) encoding.x = xEnc;
  if (yEnc) encoding.y = yEnc;

  return {
    layer: [
      {
        params: [
          {
            name: BRUSH_PARAM_NAME,
            select: {type: 'interval', encodings: ['x']},
          },
        ],
        mark,
        encoding: {
          ...encoding,
          color: {value: '#ddd'},
        },
      },
      {
        transform: [{filter: {param: BRUSH_PARAM_NAME}}],
        mark,
        encoding: {
          ...encoding,
          ...(color ? {color: {value: color}} : {}),
        },
      },
    ],
    padding: 20,
  };
}

/** Build a simple flat spec (no cross-filtering). */
function buildFlatSpec(opts: {
  mark: string;
  xField?: string;
  yField?: string;
  yAggregate?: string;
  color?: string;
}): any {
  const {mark, xField, yField, yAggregate, color} = opts;
  const encoding: any = {};
  if (xField) encoding.x = {field: xField};
  if (yField) encoding.y = {field: yField, aggregate: yAggregate ?? 'sum'};
  else if (yAggregate === 'count') encoding.y = {aggregate: 'count'};
  if (color) encoding.color = {value: color};
  return {mark, encoding, padding: 20};
}

export const VegaConfigPanel: React.FC<{
  spec: any;
  sqlQuery: string;
  lastRunTime?: number;
  crossFilterEnabled: boolean;
  onSpecChange: (spec: any) => void;
  onCrossFilterToggle: (enabled: boolean) => void;
  onBrushFieldChange: (field: string | undefined) => void;
  onBrushFieldTypeChange: (fieldType: BrushFieldType | undefined) => void;
}> = ({
  sqlQuery,
  lastRunTime,
  spec,
  crossFilterEnabled,
  onSpecChange,
  onCrossFilterToggle,
  onBrushFieldChange,
  onBrushFieldTypeChange,
}) => {
  const result = useSql({query: sqlQuery, version: lastRunTime});
  const arrowTable = result.data?.arrowTable;
  const fieldNames =
    arrowTable?.schema?.fields?.map((field: any) => field.name) || [];

  const detectFieldType = (fieldName: string): BrushFieldType => {
    const arrowField = arrowTable?.schema?.fields?.find(
      (f: any) => f.name === fieldName,
    );
    if (!arrowField) return 'numeric';
    const category = getArrowColumnTypeCategory(arrowField.type);
    if (category === 'datetime') return 'temporal';
    if (category === 'string') return 'string';
    return 'numeric';
  };

  const current = readSpecValues(spec);

  const rebuild = (
    overrides: Partial<ReturnType<typeof readSpecValues>>,
    cfEnabled = crossFilterEnabled,
  ) => {
    const merged = {...current, ...overrides};
    const builder = cfEnabled ? buildCrossFilterSpec : buildFlatSpec;
    onSpecChange(
      builder({
        mark: merged.mark ?? 'bar',
        xField: merged.xField,
        xFieldType: merged.xField ? detectFieldType(merged.xField) : undefined,
        yField: merged.yField,
        yAggregate: merged.yAggregate,
        color: merged.color,
      }),
    );
    if ('xField' in overrides) {
      onBrushFieldChange(cfEnabled ? overrides.xField : undefined);
      onBrushFieldTypeChange(
        cfEnabled && overrides.xField
          ? detectFieldType(overrides.xField)
          : undefined,
      );
    }
  };

  const handleMarkChange = (mark: string) => rebuild({mark});
  const handleXFieldChange = (field: string) => rebuild({xField: field});
  const handleYFieldChange = (field: string) =>
    rebuild({yField: field, yAggregate: current.yAggregate ?? 'sum'});
  const handleYAggregationChange = (aggregate: string) =>
    rebuild({yAggregate: aggregate});
  const handleColorChange = (color: string) => rebuild({color});

  const handleCrossFilterToggle = (enabled: boolean) => {
    onCrossFilterToggle(enabled);
    rebuild({}, enabled);
    onBrushFieldChange(enabled ? current.xField : undefined);
    onBrushFieldTypeChange(
      enabled && current.xField ? detectFieldType(current.xField) : undefined,
    );
  };

  return (
    <div className="w-80 border-r p-4 text-xs">
      <div className="space-y-3">
        <Select value={current.mark} onValueChange={handleMarkChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select chart type">
              {current.mark && (
                <div className="flex items-center gap-2">
                  {React.createElement(
                    markOptions.find((opt) => opt.value === current.mark)
                      ?.icon || ChartColumnBig,
                    {className: 'h-4 w-4'},
                  )}
                  <span>
                    {
                      markOptions.find((opt) => opt.value === current.mark)
                        ?.label
                    }
                  </span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
            {markOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <option.icon className="h-4 w-4" />
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
              <Select
                value={current.xField || ''}
                onValueChange={handleXFieldChange}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                  {fieldNames.map((field: string) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-400">
                Y-Axis
              </Label>
              <div className="grid grid-cols-[2fr_1fr] gap-2">
                <Select
                  value={current.yField || ''}
                  onValueChange={handleYFieldChange}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    {fieldNames.map((field: string) => (
                      <SelectItem key={field} value={field}>
                        {field}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={current.yAggregate}
                  onValueChange={handleYAggregationChange}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    {aggregationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-gray-400">
                Cross-filter
              </Label>
              <Switch
                checked={crossFilterEnabled}
                onCheckedChange={handleCrossFilterToggle}
              />
            </div>
          </TabsContent>

          <TabsContent value="styles" className="mt-4 space-y-4">
            <div className="space-y-1">
              <Label className="font-medium">Color</Label>
              <Select value={current.color} onValueChange={handleColorChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                  {colorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
