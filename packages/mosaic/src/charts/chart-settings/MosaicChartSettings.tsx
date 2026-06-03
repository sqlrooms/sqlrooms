/**
 * Chart settings compound component for configuring chart types and their parameters.
 *
 * @example
 * ```tsx
 * <MosaicChartSettings.Root
 *   tableName={tableName}
 *   config={config}
 *   columns={columns}
 *   onChange={handleChange}
 * >
 *   <MosaicChartSettings.TypeSelector />
 *   <MosaicChartSettings.Fields />
 * </MosaicChartSettings.Root>
 * ```
 */
import {type FC, type PropsWithChildren, createElement} from 'react';
import {MosaicChartTypeSelector} from './MosaicChartTypeSelector';
import {
  MosaicChartSettingsProvider,
  useMosaicChartSettingsContext,
} from './MosaicChartSettingsContext';
import type {TableColumn} from '@sqlrooms/db';
import {type ChartConfig, type ChartType} from '../chart-types';
import {Button} from '@sqlrooms/ui';
import {CodeIcon, XIcon} from 'lucide-react';
import {useChartTypeDefinition} from '../useChartTypeDefinition';
import {Field} from '../../chart-builders/Field';
import {useColumnsContext} from '../../chart-builders/ColumnsContext';

interface MosaicChartSettingsRootProps {
  config: ChartConfig;
  columns: TableColumn[];
  onChange: (config: ChartConfig) => void;
}

const MosaicChartSettingsRoot: FC<
  PropsWithChildren<MosaicChartSettingsRootProps>
> = ({config, columns, onChange, children}) => {
  return (
    <MosaicChartSettingsProvider
      config={config}
      columns={columns}
      onChange={onChange}
    >
      {children}
    </MosaicChartSettingsProvider>
  );
};

const MosaicChartSettingsViewSpecButton: FC<{onClick?: () => void}> = ({
  onClick,
}) => {
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

const MosaicChartSettingsCloseButton: FC<{onClick: () => void}> = ({
  onClick,
}) => {
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

const MosaicChartSettingsHeader: FC<PropsWithChildren> = ({children}) => {
  return (
    <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs font-medium">
      {children}
    </div>
  );
};

const MosaicChartSettingsContent: FC<PropsWithChildren> = ({children}) => {
  return <div className="flex flex-col gap-2 p-2">{children}</div>;
};

const MosaicChartSettingsTypeSelector: FC = () => {
  const {config, onChange} = useMosaicChartSettingsContext();

  const handleChartTypeChange = (newChartType: ChartType) => {
    // When changing chart type, clear settings
    onChange({
      chartType: newChartType,
      settings: {},
      settingsOpen: config.settingsOpen,
    });
  };

  return (
    <Field label="Chart type" required>
      <MosaicChartTypeSelector
        value={config.chartType}
        onChange={handleChartTypeChange}
      />
    </Field>
  );
};

const MosaicChartSettingsFields: FC = () => {
  const {config} = useMosaicChartSettingsContext();
  const {columns} = useColumnsContext();

  const chartTypeDef = useChartTypeDefinition(config.chartType);

  if (!chartTypeDef) {
    return (
      <Field label="Chart type" required>
        <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
          Unknown chart type: {config.chartType}
        </div>
      </Field>
    );
  }

  if (columns.length === 0) {
    return (
      <Field label="Columns" required>
        <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
          No columns available
        </div>
      </Field>
    );
  }

  return createElement(chartTypeDef.settingsComponent);
};

export const MosaicChartSettings = {
  Root: MosaicChartSettingsRoot,
  Header: MosaicChartSettingsHeader,
  Content: MosaicChartSettingsContent,
  TypeSelector: MosaicChartSettingsTypeSelector,
  Fields: MosaicChartSettingsFields,
  ViewSpecButton: MosaicChartSettingsViewSpecButton,
  CloseButton: MosaicChartSettingsCloseButton,
} as const;
