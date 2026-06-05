import {
  createContext,
  useContext,
  type ComponentProps,
  type PropsWithChildren,
  type ReactElement,
} from 'react';
import {cn, Table} from '@sqlrooms/ui';
import {getDataTableExplorerTableWidth} from './layout';
import {
  DataTableExplorerHeader,
  type DataTableExplorerHeaderProps,
} from './DataTableExplorerHeader';
import {
  DataTableExplorerRows,
  type DataTableExplorerRowsProps,
} from './DataTableExplorerRows';
import {
  DataTableExplorerStatusBar,
  type DataTableExplorerStatusBarProps,
} from './DataTableExplorerStatusBar';
import type {
  DataTableExplorerOptions,
  UseDataTableExplorerReturn,
} from './types';
import {useDataTableExplorer} from './useDataTableExplorer';
import {ResetFiltersButton} from '../dashboard/components/ResetFiltersButton';

const explorerContext = createContext<UseDataTableExplorerReturn | null>(null);

function useDataTableExplorerCompoundContext() {
  const explorer = useContext(explorerContext);

  if (!explorer) {
    throw new Error(
      'DataTableExplorer compound components must be rendered inside <DataTableExplorer> or <DataTableExplorer.Root>.',
    );
  }

  return explorer;
}

export type DataTableExplorerRootProps = PropsWithChildren<{
  explorer: UseDataTableExplorerReturn;
}>;

/**
 * Provides an existing explorer instance to compound explorer subcomponents.
 */
export function DataTableExplorerRoot({
  children,
  explorer,
}: DataTableExplorerRootProps) {
  return (
    <explorerContext.Provider value={explorer}>
      {children}
    </explorerContext.Provider>
  );
}

export type DataTableExplorerProps =
  PropsWithChildren<DataTableExplorerOptions>;

/**
 * Creates an explorer instance and exposes it to compound explorer
 * subcomponents through context.
 */
function DataTableExplorerComponent({
  children,
  ...options
}: DataTableExplorerProps): ReactElement {
  const explorer = useDataTableExplorer(options);
  return (
    <DataTableExplorerRoot explorer={explorer}>
      {children}
    </DataTableExplorerRoot>
  );
}

export type DataTableExplorerCompoundHeaderProps = Omit<
  DataTableExplorerHeaderProps,
  'explorer'
>;

function DataTableExplorerCompoundHeader(
  props: DataTableExplorerCompoundHeaderProps,
) {
  const explorer = useDataTableExplorerCompoundContext();
  return <DataTableExplorerHeader {...props} explorer={explorer} />;
}

export type DataTableExplorerCompoundRowsProps = Omit<
  DataTableExplorerRowsProps,
  'explorer'
>;

function DataTableExplorerCompoundRows(
  props: DataTableExplorerCompoundRowsProps,
) {
  const explorer = useDataTableExplorerCompoundContext();
  return <DataTableExplorerRows {...props} explorer={explorer} />;
}

export type DataTableExplorerCompoundStatusBarProps = Omit<
  DataTableExplorerStatusBarProps,
  'explorer'
>;

function DataTableExplorerCompoundStatusBar(
  props: DataTableExplorerCompoundStatusBarProps,
) {
  const explorer = useDataTableExplorerCompoundContext();
  return <DataTableExplorerStatusBar {...props} explorer={explorer} />;
}

export type DataTableExplorerCompoundTableProps = ComponentProps<typeof Table>;

function DataTableExplorerCompoundTable({
  className,
  disableWrapper = true,
  style,
  ...props
}: DataTableExplorerCompoundTableProps) {
  const explorer = useDataTableExplorerCompoundContext();
  const tableWidth = getDataTableExplorerTableWidth(explorer.columns);

  return (
    <Table
      disableWrapper={disableWrapper}
      className={['min-w-full table-fixed', className]
        .filter(Boolean)
        .join(' ')}
      style={{width: `${tableWidth}px`, ...style}}
      {...props}
    />
  );
}

export type DataTableExplorerCompoundResetButtonProps = Omit<
  ComponentProps<typeof ResetFiltersButton>,
  'disabled' | 'onClick'
> & {
  disabled?: boolean;
  onClick?: () => void;
};

function DataTableExplorerCompoundResetButton({
  className,
  disabled: disabledProp,
  onClick,
  ...props
}: DataTableExplorerCompoundResetButtonProps) {
  const explorer = useDataTableExplorerCompoundContext();
  const disabled = disabledProp ?? !explorer.hasFilters;

  return (
    <ResetFiltersButton
      className={cn('h-7 w-7', className)}
      iconClassName="h-4 w-4"
      disabled={disabled}
      onClick={() => {
        explorer.reset();
        onClick?.();
      }}
      tooltip="Reset filters"
      {...props}
    />
  );
}

type DataTableExplorerCompoundComponent = ((
  props: DataTableExplorerProps,
) => ReactElement) & {
  Header: typeof DataTableExplorerCompoundHeader;
  ResetButton: typeof DataTableExplorerCompoundResetButton;
  Root: typeof DataTableExplorerRoot;
  Rows: typeof DataTableExplorerCompoundRows;
  StatusBar: typeof DataTableExplorerCompoundStatusBar;
  Table: typeof DataTableExplorerCompoundTable;
};

export const DataTableExplorer: DataTableExplorerCompoundComponent =
  Object.assign(DataTableExplorerComponent, {
    Header: DataTableExplorerCompoundHeader,
    ResetButton: DataTableExplorerCompoundResetButton,
    Root: DataTableExplorerRoot,
    Rows: DataTableExplorerCompoundRows,
    StatusBar: DataTableExplorerCompoundStatusBar,
    Table: DataTableExplorerCompoundTable,
  });
