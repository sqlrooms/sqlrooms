import {useMemo} from 'react';
import {useBlockSettingsStore} from './useBlockSettingsStore';
import type {SelectedItem} from './useSelectedBlockOrPanel';
import type {
  BlockSettingsComponent,
  BlockSettingsComponentProps,
  SelectedBlock,
} from './types';

type BlockSettingsResult = {
  SettingsComponent: BlockSettingsComponent | null;
  settingsProps: BlockSettingsComponentProps | null;
};

/**
 * Determines the settings registry key for a selected panel.
 * Returns null if the panel type doesn't have settings.
 */
function getPanelRegistryKey(selectedBlock: SelectedBlock): string | null {
  switch (selectedBlock.type) {
    case 'dashboard-block':
      return 'dashboard-block';

    case 'dashboard-panel':
      return selectedBlock.panelType
        ? `dashboard-panel:${selectedBlock.panelType}`
        : null;

    case 'standalone-block':
      return selectedBlock.panelType
        ? `standalone-block:${selectedBlock.panelType}`
        : null;

    default:
      return null;
  }
}

/**
 * Determines the settings registry key for a TipTap block selection.
 */
function getBlockRegistryKey(blockType: string): string {
  return blockType === 'dashboard'
    ? 'dashboard-block'
    : `standalone-block:${blockType}`;
}

/**
 * Hook that resolves the settings component and props for a selected block.
 *
 * @param selectedItem - The currently selected block or panel
 * @param documentId - Document ID (used as dashboardId for TipTap blocks)
 * @returns Settings component and props, or null if no settings available
 */
export function useBlockSettings(
  selectedItem: SelectedItem,
  documentId: string | undefined,
): BlockSettingsResult {
  const getSettings = useBlockSettingsStore(
    (state) => state.blockSettings.getSettings,
  );

  return useMemo(() => {
    if (!selectedItem) {
      return {SettingsComponent: null, settingsProps: null};
    }

    // Handle panel selection
    if (selectedItem.type === 'panel') {
      const {selectedBlock} = selectedItem;
      const registryKey = getPanelRegistryKey(selectedBlock);

      if (!registryKey) {
        return {SettingsComponent: null, settingsProps: null};
      }

      return {
        SettingsComponent: getSettings(registryKey) ?? null,
        settingsProps: {
          blockId: selectedBlock.id,
          dashboardId: selectedBlock.dashboardId,
        },
      };
    }

    // Handle block selection from TipTap
    if (selectedItem.type === 'block') {
      // Require documentId for blocks in documents
      if (!documentId) {
        return {SettingsComponent: null, settingsProps: null};
      }

      const registryKey = getBlockRegistryKey(selectedItem.blockType);

      return {
        SettingsComponent: getSettings(registryKey) ?? null,
        settingsProps: {
          blockId: selectedItem.blockId,
          dashboardId: documentId,
        },
      };
    }

    return {SettingsComponent: null, settingsProps: null};
  }, [selectedItem, documentId, getSettings]);
}
