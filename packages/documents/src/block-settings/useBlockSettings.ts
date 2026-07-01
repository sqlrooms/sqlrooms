import {useMemo} from 'react';
import type {SelectedItem} from './useSelectedBlockOrPanel';
import {useBlockDocumentStatefulBlockSettings} from '../BlockDocumentStatefulBlockRendererContext';
import {useBlockDocumentChartSettings} from '../BlockDocumentChartRendererContext';
import type {
  BlockSettingsComponent,
  BlockSettingsComponentProps,
} from './types';

type BlockSettingsResult = {
  SettingsComponent: BlockSettingsComponent | null;
  settingsProps: BlockSettingsComponentProps | null;
};

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
  readOnly?: boolean,
): BlockSettingsResult {
  const chartSettings = useBlockDocumentChartSettings();
  const statefulBlockSettings = useBlockDocumentStatefulBlockSettings(
    selectedItem?.type === 'block' ? selectedItem.blockType : '',
  );

  return useMemo(() => {
    if (!selectedItem) {
      return {SettingsComponent: null, settingsProps: null};
    }

    // Handle panel selection
    if (selectedItem.type === 'panel') {
      const {selectedBlock} = selectedItem;

      return {
        SettingsComponent: selectedBlock.settingsComponent ?? null,
        settingsProps: {
          blockId: selectedBlock.id,
          dashboardId: selectedBlock.dashboardId,
          blockInstanceId: selectedBlock.blockInstanceId ?? selectedBlock.id,
          readOnly: selectedBlock.readOnly,
        },
      };
    }

    // Handle block selection from TipTap
    if (selectedItem.type === 'block') {
      // Require documentId for blocks in documents
      if (!documentId) {
        return {SettingsComponent: null, settingsProps: null};
      }

      const SettingsComponent =
        selectedItem.blockType === 'chart-block'
          ? chartSettings
          : statefulBlockSettings;

      return {
        SettingsComponent: SettingsComponent ?? null,
        settingsProps: {
          blockId: selectedItem.blockId,
          dashboardId: documentId,
          blockInstanceId:
            typeof selectedItem.attrs.blockInstanceId === 'string'
              ? selectedItem.attrs.blockInstanceId
              : undefined,
          readOnly,
        },
      };
    }

    return {SettingsComponent: null, settingsProps: null};
  }, [
    selectedItem,
    documentId,
    readOnly,
    chartSettings,
    statefulBlockSettings,
  ]);
}
