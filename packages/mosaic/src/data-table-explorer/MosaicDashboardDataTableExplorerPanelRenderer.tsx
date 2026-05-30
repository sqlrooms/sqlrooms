import {SpinnerPane} from '@sqlrooms/ui';
import {TablePropertiesIcon} from 'lucide-react';
import {
  DataTableExplorer,
  type DataTableExplorerProps,
} from './DataTableExplorer';
import type {DataTableExplorerPanel} from '../dashboard/dashboard-types';
import {
  type MosaicDashboardPanelRenderer,
  type DataTableExplorerPanelRendererProps,
  useStoreWithMosaicDashboard,
} from '../dashboard/MosaicDashboardSlice';

function MosaicDashboardDataTableExplorerRenderer({
  panel,
  dashboard,
  selectionName,
}: DataTableExplorerPanelRendererProps) {
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );
  const tableName = dashboard.selectedTable;
  const pageSize =
    typeof panel.config.pageSize === 'number'
      ? panel.config.pageSize
      : undefined;

  if (!tableName) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Data Table panels require a table source.
      </div>
    );
  }

  if (connection.status === 'loading') {
    return <SpinnerPane className="h-full w-full" />;
  }

  if (connection.status !== 'ready') {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Mosaic connection is not ready.
      </div>
    );
  }

  const dataTableExplorerProps = {
    tableName,
    pageSize: pageSize ?? 10,
    selectionName,
  } satisfies DataTableExplorerProps;

  return (
    <DataTableExplorer {...dataTableExplorerProps}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-auto">
          <DataTableExplorer.Table>
            <DataTableExplorer.Header />
            <DataTableExplorer.Rows />
          </DataTableExplorer.Table>
        </div>
        <DataTableExplorer.StatusBar />
      </div>
    </DataTableExplorer>
  );
}

export const mosaicDashboardDataTableExplorerPanelRenderer: MosaicDashboardPanelRenderer<DataTableExplorerPanel> =
  {
    component: MosaicDashboardDataTableExplorerRenderer,
    icon: TablePropertiesIcon,
  };
