import {SpinnerPane} from '@sqlrooms/ui';
import {TablePropertiesIcon} from 'lucide-react';
import {DataTableExplorer} from '../DataTableExplorer';
import type {DataTableExplorerPanel} from '../../dashboard/dashboard-types';
import {
  type MosaicDashboardPanelRenderer,
  type DataTableExplorerPanelRendererProps,
  useStoreWithMosaicDashboard,
} from '../../dashboard/MosaicDashboardSlice';
import {FC} from 'react';
import {useDataTable} from '../../hooks/useDataTable';

const MosaicDashboardDataTableExplorerRenderer: FC<
  DataTableExplorerPanelRendererProps
> = ({panel, dashboard, selectionName}) => {
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );

  const selectedTable = useDataTable(dashboard.selectedTable);

  const pageSize =
    typeof panel.config.pageSize === 'number'
      ? panel.config.pageSize
      : undefined;

  if (!selectedTable) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Data Table Explorer panels require a table source.
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

  return (
    <DataTableExplorer
      tableName={selectedTable}
      pageSize={pageSize ?? 10}
      selectionName={selectionName}
    >
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
};

export const mosaicDashboardDataTableExplorerPanelRenderer: MosaicDashboardPanelRenderer<DataTableExplorerPanel> =
  {
    component: MosaicDashboardDataTableExplorerRenderer,
    icon: TablePropertiesIcon,
  };
