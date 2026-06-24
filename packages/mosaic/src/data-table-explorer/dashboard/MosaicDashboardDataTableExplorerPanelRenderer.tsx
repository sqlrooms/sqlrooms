import {ScrollArea, ScrollBar, SpinnerPane} from '@sqlrooms/ui';
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
import {useDataTable} from '@sqlrooms/db';
import {useDataTableExplorer} from '../useDataTableExplorer';
import {MosaicDashboardDataTableExplorerHeaderActions} from './MosaicDashboardDataTableExplorerHeaderActions';
import type {DataTable} from '@sqlrooms/db';
import {SelectablePanelWrapper} from '@sqlrooms/documents';

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
    tableName: selectedTable.table,
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
        <ScrollArea className="min-h-0 flex-1 px-0.5">
          <DataTableExplorer.Table>
            <DataTableExplorer.Header />
            <DataTableExplorer.Rows />
          </DataTableExplorer.Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <DataTableExplorer.StatusBar />
      </div>
    </DataTableExplorer.Root>
  );
};

const MosaicDashboardDataTableExplorerRenderer: FC<
  DataTableExplorerPanelRendererProps
> = ({panel, dashboard, selectionName, dashboardId}) => {
  const selectedTable = useDataTable(dashboard.selectedTable);

  const content = !selectedTable ? (
    <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
      Data Table Explorer panels require a table source.
    </div>
  ) : (
    <MosaicDashboardDataTableExplorerRendererInner
      panel={panel}
      dashboard={dashboard}
      selectionName={selectionName}
      selectedTable={selectedTable}
    />
  );

  return (
    <SelectablePanelWrapper
      dashboardId={dashboardId}
      panelId={panel.id}
      panelType="data-table-explorer"
      blockType="dashboard-panel"
    >
      {content}
    </SelectablePanelWrapper>
  );
};

export const mosaicDashboardDataTableExplorerPanelRenderer: MosaicDashboardPanelRenderer<DataTableExplorerPanel> =
  {
    component: MosaicDashboardDataTableExplorerRenderer,
    headerActions: MosaicDashboardDataTableExplorerHeaderActions,
    icon: TablePropertiesIcon,
  };
