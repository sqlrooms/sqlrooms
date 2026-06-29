import type {ComponentType} from 'react';

/**
 * Props passed to block settings components.
 *
 * @property blockId - The ID of the block or panel being configured
 * @property dashboardId - The ID of the parent dashboard/document, when available
 * @property blockInstanceId - Backing state id for stateful document blocks, when available
 * @property onClose - Optional callback for settings UIs that can close the host settings panel
 */
export type BlockSettingsComponentProps = {
  blockId: string;
  dashboardId?: string;
  blockInstanceId?: string;
  onClose?: () => void;
};

/**
 * A React component that renders settings UI for a specific block or panel.
 */
export type BlockSettingsComponent = ComponentType<BlockSettingsComponentProps>;

/**
 * Represents a selected block in the editor or dashboard.
 *
 * @property type - The type of selected block:
 *   - 'dashboard-panel': A panel inside a dashboard (chart, map, data table)
 *   - 'standalone-block': A standalone block in a block document (chart block, data table block, etc.)
 *   - 'dashboard-block': The entire dashboard block itself
 * @property id - The unique identifier of the selected block or panel
 * @property dashboardId - The ID of the parent dashboard (optional, used for context)
 * @property blockInstanceId - Backing state id for stateful document blocks, when available
 * @property panelType - The type of panel (e.g., 'vgplot', 'deck-json-map') for dashboard panels
 * @property settingsComponent - Runtime settings component supplied by the selected surface
 */
export type SelectedBlock = {
  type: 'dashboard-panel' | 'standalone-block' | 'dashboard-block';
  id: string;
  dashboardId?: string;
  blockInstanceId?: string;
  panelType?: string;
  settingsComponent?: BlockSettingsComponent;
};
