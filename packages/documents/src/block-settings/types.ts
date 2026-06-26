import type {ComponentType} from 'react';

/**
 * Represents a selected block in the editor or dashboard.
 *
 * @property type - The type of selected block:
 *   - 'dashboard-panel': A panel inside a dashboard (chart, map, data table)
 *   - 'standalone-block': A standalone block in a worksheet (chart block, data table block, etc.)
 *   - 'dashboard-block': The entire dashboard block itself
 * @property id - The unique identifier of the selected block or panel
 * @property dashboardId - The ID of the parent dashboard (optional, used for context)
 * @property panelType - The type of panel (e.g., 'vgplot', 'deck-json-map') for dashboard panels
 */
export type SelectedBlock = {
  type: 'dashboard-panel' | 'standalone-block' | 'dashboard-block';
  id: string;
  dashboardId?: string;
  panelType?: string;
};

/**
 * Props passed to block settings components.
 *
 * @property blockId - The ID of the block or panel being configured
 * @property dashboardId - The ID of the parent dashboard (optional, used for worksheet blocks)
 */
export type BlockSettingsComponentProps = {
  blockId: string;
  dashboardId?: string;
};

/**
 * A React component that renders settings UI for a specific block type.
 * Used in the settings panel to display configuration options for selected blocks.
 */
export type BlockSettingsComponent = ComponentType<BlockSettingsComponentProps>;
