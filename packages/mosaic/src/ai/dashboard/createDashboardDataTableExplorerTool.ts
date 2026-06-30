import type {Tool} from 'ai';
import {createDataTableExplorerTool} from '../createDataTableExplorerTool';

import {createMosaicDashboardDataTableExplorerPanelConfig} from '../../dashboard/MosaicDashboardSlice';
import {DatabaseAiAdapter} from '../database-types';
import {DashboardAiAdapter} from './dashboard-types';
import {ensureTable} from '../tool-helpers';
import {getTableIdentity} from '@sqlrooms/db';

/**
 * Parameters for creating a dashboard data table explorer tool.
 *
 * @property databaseAdapter - Adapter for database operations and table queries
 * @property dashboardAdapter - Adapter for adding panels to the dashboard
 */
export type CreateDashboardDataTableExplorerToolParams = {
  databaseAdapter: DatabaseAiAdapter;
  dashboardAdapter: DashboardAiAdapter;
};

/**
 * Creates an AI tool for generating Data Table Explorer panels in dashboards.
 *
 * @param params - Configuration parameters
 * @param params.databaseAdapter - Adapter for database operations
 * @param params.dashboardAdapter - Adapter for dashboard panel management
 * @returns Tool instance for creating data table explorer panels with schema and statistics
 */
export function createDashboardDataTableExplorerTool({
  dashboardAdapter,
  databaseAdapter,
}: CreateDashboardDataTableExplorerToolParams): Tool {
  return createDataTableExplorerTool({
    databaseAdapter,
    addDataTable: async ({tableName, title}) => {
      const resolvedTable = tableName
        ? ensureTable(databaseAdapter, tableName)
        : undefined;
      if (resolvedTable?.table) {
        await dashboardAdapter.setSelectedTable(
          getTableIdentity(resolvedTable.table),
        );
      }

      return dashboardAdapter.addPanel(
        createMosaicDashboardDataTableExplorerPanelConfig({
          title,
        }),
      );
    },
  });
}
