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
} from '@sqlrooms/ui';
import {useSql} from '@sqlrooms/duckdb';

const markOptions = [
  {value: 'bar', label: 'Bar'},
  {value: 'line', label: 'Line'},
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

export const VegaConfigPanel: React.FC<{
  sqlQuery: string;
  spec: any;
  onSpecChange: (spec: any) => void;
}> = ({sqlQuery, spec, onSpecChange}) => {
  const {data: sqlData} = useSql({query: sqlQuery});

  const fieldNames =
    sqlData?.arrowTable?.schema?.fields?.map((field) => field.name) || [];

  const handleMarkChange = (mark: string) => {
    onSpecChange({
      ...spec,
      mark,
    });
  };

  const handleXFieldChange = (field: string) => {
    onSpecChange({
      ...spec,
      encoding: {
        ...spec.encoding,
        x: {...spec.encoding.x, field},
      },
    });
  };

  const handleYFieldChange = (field: string) => {
    onSpecChange({
      ...spec,
      encoding: {
        ...spec.encoding,
        y: {...spec.encoding.y, field},
      },
    });
  };

  const handleYAggregationChange = (aggregate: string) => {
    onSpecChange({
      ...spec,
      encoding: {
        ...spec.encoding,
        y: {...spec.encoding.y, aggregate},
      },
    });
  };

  // const handleColorChange = (scheme: string) => {
  //   const yField = spec.encoding?.y?.field;
  //   onSpecChange({
  //     ...spec,
  //     encoding: {
  //       ...spec.encoding,
  //       color: {field: yField, scale: {scheme}},
  //     },
  //   });
  // };

  // {value: 'tableau10', label: 'Tableau10'},
  // {value: 'observable10', label: 'Observable10'},
  // {value: 'category20', label: 'Category20'},
  // {value: 'category20b', label: 'Category20b'},

  const handleColorChange = (color: string) => {
    onSpecChange({
      ...spec,
      encoding: {
        ...spec.encoding,
        color: {value: color},
      },
    });
  };

  return (
    <div className="min-h-70 w-80 border-r p-4 text-xs">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium text-gray-400">Type</Label>
          <Select value={spec.mark} onValueChange={handleMarkChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select chart type" />
            </SelectTrigger>
            <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
              {markOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
                value={spec.encoding?.x?.field || ''}
                onValueChange={handleXFieldChange}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                  {fieldNames.map((field) => (
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
                  value={spec.encoding?.y?.field || ''}
                  onValueChange={handleYFieldChange}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    {fieldNames.map((field) => (
                      <SelectItem key={field} value={field}>
                        {field}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={spec.encoding?.y?.aggregate}
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
          </TabsContent>

          <TabsContent value="styles" className="mt-4 space-y-4">
            <div className="space-y-1">
              <Label className="font-medium">Color</Label>
              <Select
                value={spec.encoding?.color?.value}
                onValueChange={handleColorChange}
              >
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
