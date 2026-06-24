import {cn} from '@sqlrooms/ui';
import type {FC, ReactNode} from 'react';
import {useCallback} from 'react';
import {useBlockSelection} from './useBlockSelection';

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
  const selectBlock = useBlockSelection(
    (state) => state.blockSelection.selectBlock,
  );
  const isSelected = useBlockSelection((state) =>
    state.blockSelection.isBlockSelected(blockType, panelId, dashboardId),
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent click from bubbling to parent handlers
      selectBlock({
        type: blockType,
        id: panelId,
        dashboardId: dashboardId,
        panelType,
      });
    },
    [blockType, dashboardId, panelId, panelType, selectBlock],
  );

  return (
    <div
      className={cn(
        'relative h-full rounded-sm transition-all',
        isSelected && 'outline-primary outline outline-2 outline-offset-[-2px]',
        className,
      )}
      onClick={handleClick}
    >
      {children}
    </div>
  );
};
