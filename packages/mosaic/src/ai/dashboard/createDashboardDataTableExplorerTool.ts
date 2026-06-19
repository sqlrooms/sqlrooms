import type {Tool} from 'ai';
import {createDataTableExplorerTool} from '../createDataTableExplorerTool';

import {createMosaicDashboardDataTableExplorerPanelConfig} from '../../dashboard/MosaicDashboardSlice';
import {DatabaseAiAdapter} from '../database-types';
import {DashboardAiAdapter} from './dashboard-types';

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
