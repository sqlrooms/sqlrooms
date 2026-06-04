import {SpinnerPane} from '@sqlrooms/ui';
import {TablePropertiesIcon} from 'lucide-react';
import {DataTableExplorer} from '../DataTableExplorer';
import type {DataTableExplorerPanel} from '../../dashboard/dashboard-types';
import {
  type MosaicDashboardPanelRenderer,
  type DataTableExplorerPanelRendererProps,
  useStoreWithMosaicDashboard,
} from '../../dashboard/MosaicDashboardSlice';
import {usePanelClientRegistration} from '../../dashboard/usePanelClientRegistration';
import {useDataTableExplorerPanelClients} from './useDataTableExplorerPanelClients';
import {FC} from 'react';
import {useDataTable} from '../../hooks/useDataTable';
import {useDataTableExplorer} from '../useDataTableExplorer';
import {MosaicDashboardDataTableExplorerHeaderActions} from './MosaicDashboardDataTableExplorerHeaderActions';
import type {DataTable} from '@sqlrooms/db';

type MosaicDashboardDataTableExplorerRendererInnerProps = Omit<
  DataTableExplorerPanelRendererProps,
  'dashboardId'
> & {selectedTable: DataTable};

const MosaicDashboardDataTableExplorerRendererInner: FC<
  MosaicDashboardDataTableExplorerRendererInnerProps
> = ({panel, dashboard, selectionName, selectedTable}) => {
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );

  const pageSize =
    typeof panel.config.pageSize === 'number'
      ? panel.config.pageSize
      : undefined;

  const explorer = useDataTableExplorer({
    tableName: selectedTable,
    pageSize: pageSize ?? 10,
    selectionName,
  });

  const explorerClients = useDataTableExplorerPanelClients(
    explorer,
    selectedTable,
    connection.status,
  );

  usePanelClientRegistration(dashboard.id, panel.id, explorerClients);

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
    <DataTableExplorer.Root explorer={explorer}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-auto">
          <DataTableExplorer.Table>
            <DataTableExplorer.Header />
            <DataTableExplorer.Rows />
          </DataTableExplorer.Table>
        </div>
        <DataTableExplorer.StatusBar />
      </div>
    </DataTableExplorer.Root>
  );
};

const MosaicDashboardDataTableExplorerRenderer: FC<
  DataTableExplorerPanelRendererProps
> = ({panel, dashboard, selectionName}) => {
  const selectedTable = useDataTable(dashboard.selectedTable);

  if (!selectedTable) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Data Table Explorer panels require a table source.
      </div>
    );
  }

  return (
    <MosaicDashboardDataTableExplorerRendererInner
      panel={panel}
      dashboard={dashboard}
      selectionName={selectionName}
      selectedTable={selectedTable}
    />
  );
};

export const mosaicDashboardDataTableExplorerPanelRenderer: MosaicDashboardPanelRenderer<DataTableExplorerPanel> =
  {
    component: MosaicDashboardDataTableExplorerRenderer,
    headerActions: MosaicDashboardDataTableExplorerHeaderActions,
    icon: TablePropertiesIcon,
  };
