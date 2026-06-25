import {cn} from '@sqlrooms/ui';
import type {FC, ReactNode} from 'react';
import {useCallback, useContext} from 'react';
import {useBlockSettingsStore} from './useBlockSettingsStore';
import {BlockDocumentEditorContext} from '../BlockDocumentEditor/BlockDocumentEditorContext';

export type SelectablePanelWrapperProps = {
  /** Dashboard or document ID containing the block */
  dashboardId: string;
  /** Unique ID of the panel/block */
  panelId: string;
  /** Type of panel (e.g., 'vgplot', 'chart-block') */
  panelType: string;
  /** Whether this is a dashboard panel, standalone block, or dashboard itself */
  blockType: 'dashboard-panel' | 'standalone-block' | 'dashboard-block';
  /** Content to render inside the selectable wrapper */
  children: ReactNode;
  /** Additional CSS classes to apply to the wrapper */
  className?: string;
};

/**
 * Wrapper component that makes a block/panel selectable.
 *
 * Features:
 * - Visual outline when selected
 * - Click to select
 * - Click propagation prevention
 *
 * @example
 * ```tsx
 * <SelectablePanelWrapper
 *   dashboardId={dashboardId}
 *   panelId={panel.id}
 *   panelType="vgplot"
 *   blockType="dashboard-panel"
 * >
 *   <ChartPanel />
 * </SelectablePanelWrapper>
 * ```
 */
export const SelectablePanelWrapper: FC<SelectablePanelWrapperProps> = ({
  dashboardId,
  panelId,
  panelType,
  blockType,
  children,
  className,
}) => {
  const selectBlock = useBlockSettingsStore(
    (state) => state.blockSettings.selectBlock,
  );
  const isSelected = useBlockSettingsStore((state) =>
    state.blockSettings.isBlockSelected(blockType, panelId, dashboardId),
  );

  // Get editor from context to clear TipTap selection when panel is selected
  // Context may not exist if SelectablePanelWrapper is used outside BlockDocumentEditor
  const editorContext = useContext(BlockDocumentEditorContext);
  const editor = editorContext?.editor ?? null;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent click from bubbling to parent handlers

      // Clear TipTap selection when selecting a panel
      if (editor && !editor.isDestroyed) {
        // Set selection to end of document to deselect any node
        const {doc} = editor.state;
        editor.commands.setTextSelection(doc.content.size);
      }

      selectBlock({
        type: blockType,
        id: panelId,
        dashboardId: dashboardId,
        panelType,
      });
    },
    [blockType, dashboardId, panelId, panelType, selectBlock, editor],
  );

  return (
    <div
      className={cn(
        'relative h-full rounded-sm transition-all',
        isSelected && 'outline-primary outline outline-2 outline-offset-[-2px]',
        className,
      )}
      onClick={handleClick}
      data-selectable-panel
    >
      {children}
    </div>
  );
};
