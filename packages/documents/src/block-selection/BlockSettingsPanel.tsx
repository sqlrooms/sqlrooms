import {cn} from '@sqlrooms/ui';
import {createElement, FC, useMemo} from 'react';
import {useBlockSelection} from './useBlockSelection';
import {useSelectedBlockOrPanel} from './useSelectedBlockOrPanel';
import {useBlockDocumentEditorContext} from '../BlockDocumentEditor/BlockDocumentEditorContext';
import {SettingsErrorBoundary} from './SettingsErrorBoundary';

export type BlockSettingsPanelProps = {
  /** Additional CSS classes to apply to the panel */
  className?: string;
  /** Callback when the panel is closed */
  onClose?: () => void;
};

/**
 * Panel that displays settings for the currently selected block.
 *
 * Automatically renders the appropriate settings component based on
 * the selected block type by looking it up in the settings registry.
 *
 * Shows empty states for:
 * - No block selected
 * - No settings component registered for the block type
 *
 * @example
 * ```tsx
 * <div className="flex h-full">
 *   <div className="flex-1">
 *     <Dashboard />
 *   </div>
 *   <BlockSettingsPanel className="w-80 border-l" />
 * </div>
 * ```
 */
export const BlockSettingsPanel: FC<BlockSettingsPanelProps> = ({
  className,
}) => {
  const {editor} = useBlockDocumentEditorContext();
  const selectedItem = useSelectedBlockOrPanel(editor);
  const getSettings = useBlockSelection(
    (state) => state.blockSelection.getSettings,
  );

  // Determine settings component based on selection type
  const SettingsComponent = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    if (selectedItem.type === 'panel') {
      const {selectedBlock} = selectedItem;

      // Dashboard block has its own registry key
      if (selectedBlock.type === 'dashboard-block') {
        return getSettings('dashboard-block');
      }

      // Panel types need panelType to construct the key
      if (!selectedBlock.panelType) {
        return null;
      }

      const blockType =
        selectedBlock.type === 'dashboard-panel'
          ? `dashboard-panel:${selectedBlock.panelType}`
          : `standalone-block:${selectedBlock.panelType}`;

      return getSettings(blockType);
    }

    // Block selection from TipTap
    if (selectedItem.type === 'block') {
      // Construct registry key for stateful blocks
      const registryKey = `standalone-block:${selectedItem.blockType}`;
      return getSettings(registryKey);
    }

    return null;
  }, [selectedItem, getSettings]);

  // Determine props to pass to settings component
  const settingsProps = useMemo(() => {
    if (!selectedItem) return null;

    if (selectedItem.type === 'panel') {
      return {
        blockId: selectedItem.selectedBlock.id,
        dashboardId: selectedItem.selectedBlock.dashboardId,
      };
    }

    if (selectedItem.type === 'block') {
      return {
        blockId: selectedItem.blockId,
        dashboardId: selectedItem.attrs.blockInstanceId,
      };
    }

    return null;
  }, [selectedItem]);

  if (!selectedItem || !settingsProps) {
    return (
      <div
        className={cn('flex h-full items-center justify-center p-4', className)}
      >
        <p className="text-muted-foreground text-sm">
          Select a block to edit settings
        </p>
      </div>
    );
  }

  if (!SettingsComponent) {
    return (
      <div
        className={cn('flex h-full items-center justify-center p-4', className)}
      >
        <p className="text-muted-foreground text-sm">
          No settings available for this block
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <SettingsErrorBoundary>
        {createElement(SettingsComponent, settingsProps)}
      </SettingsErrorBoundary>
    </div>
  );
};
