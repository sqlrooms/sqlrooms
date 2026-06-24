import {cn} from '@sqlrooms/ui';
import {createElement, FC, useMemo} from 'react';
import {useBlockSelection} from './useBlockSelection';
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
  const selectedBlock = useBlockSelection(
    (state) => state.blockSelection.config.selectedBlock,
  );
  const getSettings = useBlockSelection(
    (state) => state.blockSelection.getSettings,
  );
  // Construct block type key and get settings component using useMemo
  const SettingsComponent = useMemo(() => {
    if (!selectedBlock) {
      return null;
    }

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
  }, [selectedBlock, getSettings]);

  if (!selectedBlock) {
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
        {createElement(SettingsComponent, {
          blockId: selectedBlock.id,
          dashboardId: selectedBlock.dashboardId,
        })}
      </SettingsErrorBoundary>
    </div>
  );
};
