import type {Tool} from 'ai';
import {createDataTableExplorerTool} from '../../charts/chart-types';

import {createMosaicDashboardDataTableExplorerPanelConfig} from '../../dashboard/MosaicDashboardSlice';
import {DashboardAiAdapter} from '../types';

export function createDashboardDataTableExplorerTool(
  adapter: DashboardAiAdapter,
): Tool {
  return createDataTableExplorerTool({
    adapter,
    addDataTable: ({title, config}) => {
      const panel = createMosaicDashboardDataTableExplorerPanelConfig({
        title,
        config,
      });

      adapter.addPanel(panel);
    },
  });
}
