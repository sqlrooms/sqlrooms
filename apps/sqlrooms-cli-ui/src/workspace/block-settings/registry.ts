import type {BlockSettingsComponent} from '@sqlrooms/documents';
import {BlockChartSettings} from './BlockChartSettings';
import {DashboardChartSettings} from './DashboardChartSettings';
import {BlockDashboardSettings} from './BlockDashboardSettings';
import {DashboardDataTableSettings} from './DashboardDataTableSettings';
import {BlockDataTableSettings} from './BlockDataTableSettings';
import {DashboardMapSettings} from './DashboardMapSettings';

/**
 * Central registry of block settings components.
 *
 * Key format:
 * - Dashboard panels: `dashboard-panel:{panelType}` (e.g., `dashboard-panel:vgplot`)
 * - Standalone blocks: `standalone-block:{blockType}` (e.g., `standalone-block:chart-block`)
 * - Dashboard blocks: `dashboard-block` (the entire dashboard)
 *
 * This registry is passed to createBlockSelectionSlice during store initialization.
 */
export const blockSettingsRegistry: Record<string, BlockSettingsComponent> = {
  'standalone-block:chart-block': BlockChartSettings,
  'standalone-block:data-table': BlockDataTableSettings,
  'dashboard-panel:vgplot': DashboardChartSettings,
  'dashboard-panel:data-table-explorer': DashboardDataTableSettings,
  'dashboard-panel:deck-json-map': DashboardMapSettings,
  'dashboard-block': BlockDashboardSettings,
};
