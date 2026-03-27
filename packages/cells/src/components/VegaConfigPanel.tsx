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
import type {BrushFieldType} from '../types';
import {
  readSpecValues,
  buildCrossFilterSpec,
  buildFlatSpec,
} from '../vegaSpecBuilder';
import {FieldSelector} from './FieldSelector';
import {ColorSelector, colorOptions} from './ColorSelector';

const markOptions = [
  {value: 'bar', label: 'Bar', icon: ChartColumnBig},
  {value: 'line', label: 'Line', icon: ChartLine},
];

const aggregationOptions = [
  {value: 'sum', label: 'Sum'},
  {value: 'mean', label: 'Mean'},
  {value: 'count', label: 'Count'},
];

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
  const fields = arrowTable?.schema?.fields || [];

  const detectBrushFieldType = (fieldName: string): BrushFieldType => {
    const arrowField = arrowTable?.schema?.fields?.find(
      (field) => field.name === fieldName,
    );

    if (!arrowField) {
      return 'numeric';
    }

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
        xFieldType: merged.xField
          ? detectBrushFieldType(merged.xField)
          : undefined,
        yField: merged.yField,
        yAggregate: merged.yAggregate,
        color: merged.color ?? colorOptions[0]?.value,
      }),
    );
    if ('xField' in overrides) {
      onBrushFieldChange(cfEnabled ? overrides.xField : undefined);
      onBrushFieldTypeChange(
        cfEnabled && overrides.xField
          ? detectBrushFieldType(overrides.xField)
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
      enabled && current.xField
        ? detectBrushFieldType(current.xField)
        : undefined,
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
              <FieldSelector
                value={current.xField}
                fields={fields}
                onValueChange={handleXFieldChange}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-400">
                Y-Axis
              </Label>
              <div className="grid grid-cols-[2fr_1fr] gap-2">
                <FieldSelector
                  value={current.yField}
                  fields={fields}
                  onValueChange={handleYFieldChange}
                />

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
