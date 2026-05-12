/**
 * Chart settings compound component for configuring chart types and their parameters.
 *
 * @example
 * ```tsx
 * <ChartSettings.Root
 *   tableName={tableName}
 *   config={config}
 *   columns={columns}
 *   onChange={handleChange}
 * >
 *   <ChartSettings.TypeSelector />
 *   <ChartSettings.Fields />
 * </ChartSettings.Root>
 * ```
 */
import {type FC, type PropsWithChildren, createElement} from 'react';
import {ChartTypeSelector} from './ChartTypeSelector';
import {
  ChartSettingsProvider,
  useChartSettingsContext,
} from './ChartSettingsContext';
import type {TableColumn} from '@sqlrooms/duckdb';
import {type VgPlotChartConfig, type VgPlotChartType} from '../../chart-types';
import {Button} from '@sqlrooms/ui';
import {CodeIcon, XIcon} from 'lucide-react';
import {useChartTypeDefinition} from '../../chart-types/useChartTypeDefinition';

interface ChartSettingsRootProps {
  tableName?: string;
  config: VgPlotChartConfig;
  columns: TableColumn[];
  onChange: (config: VgPlotChartConfig) => void;
}

const ChartSettingsRoot: FC<PropsWithChildren<ChartSettingsRootProps>> = ({
  tableName,
  config,
  columns,
  onChange,
  children,
}) => {
  return (
    <ChartSettingsProvider
      tableName={tableName}
      config={config}
      columns={columns}
      onChange={onChange}
    >
      {children}
    </ChartSettingsProvider>
  );
};

const ChartSettingsViewSpecButton: FC<{onClick: () => void}> = ({onClick}) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-5 w-5"
      onClick={onClick}
      title="View spec"
      aria-label="View spec"
    >
      <CodeIcon className="h-3.5 w-3.5" />
    </Button>
  );
};

const ChartSettingsCloseButton: FC<{onClick: () => void}> = ({onClick}) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-5 w-5"
      onClick={onClick}
      aria-label="Close"
    >
      <XIcon className="h-3.5 w-3.5" />
    </Button>
  );
};

const ChartSettingsHeader: FC<PropsWithChildren> = ({children}) => {
  return (
    <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs font-medium">
      {children}
    </div>
  );
};

const ChartSettingsContent: FC<PropsWithChildren> = ({children}) => {
  return <div className="flex flex-col gap-2 p-2">{children}</div>;
};

const ChartSettingsTypeSelector: FC = () => {
  const {config, onChange} = useChartSettingsContext();

  const handleChartTypeChange = (newChartType: VgPlotChartType) => {
    // When changing chart type, clear settings
    onChange({
      chartType: newChartType,
      settings: {},
      settingsOpen: config.settingsOpen,
    });
  };

  return (
    <ChartTypeSelector
      value={config.chartType}
      onChange={handleChartTypeChange}
    />
  );
};

const ChartSettingsFields: FC = () => {
  const {config, columns} = useChartSettingsContext();
  const chartTypeDef = useChartTypeDefinition(config.chartType);

  if (!chartTypeDef) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Unknown chart type: {config.chartType}
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        No columns available
      </div>
    );
  }

  return createElement(chartTypeDef.settingsComponent);
};

export const ChartSettings = {
  Root: ChartSettingsRoot,
  Header: ChartSettingsHeader,
  Content: ChartSettingsContent,
  TypeSelector: ChartSettingsTypeSelector,
  Fields: ChartSettingsFields,
  ViewSpecButton: ChartSettingsViewSpecButton,
  CloseButton: ChartSettingsCloseButton,
};
