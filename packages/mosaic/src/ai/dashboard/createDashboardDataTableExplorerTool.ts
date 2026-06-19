import type {Tool} from 'ai';
import {createDataTableExplorerTool} from '../../charts/chart-types';

import {createMosaicDashboardDataTableExplorerPanelConfig} from '../../dashboard/MosaicDashboardSlice';
import {DatabaseAiAdapter} from '../database-types';
import {DashboardAiAdapter} from '../..';

export type CreateDashboardDataTableExplorerToolParams = {
  databaseAdapter: DatabaseAiAdapter;
  dashboardAdapter: DashboardAiAdapter;
};

export function createDashboardDataTableExplorerTool({
  dashboardAdapter,
  databaseAdapter,
}: CreateDashboardDataTableExplorerToolParams): Tool {
  return createDataTableExplorerTool({
    databaseAdapter,
    addDataTable: ({title, config}) =>
      dashboardAdapter.addPanel(
        createMosaicDashboardDataTableExplorerPanelConfig({
          title,
          config,
        }),
      ),
  });
}
