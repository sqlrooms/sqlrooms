import {Button, cn} from '@sqlrooms/ui';
import {Maximize2} from 'lucide-react';
import {FC, PropsWithChildren} from 'react';
import {useStoreWithCosmos} from './CosmosSlice';

interface CosmosGraphControlsProps {
  /**
   * Optional className to override the default positioning and styling of the controls container.
   * By default, controls are positioned at the top-left corner.
   * @example
   * ```tsx
   * // Position controls at the bottom-right
   * <CosmosGraphControls className="absolute bottom-4 right-4" />
   * ```
   */
  className?: string;
}

/**
 * A flexible control panel component for CosmosGraph that provides view controls.
 * Must be used within a CosmosGraph component as it relies on the graph state from the store.
 *
 * The component shows the default fit view control and allows adding custom controls as children.
 * For simulation controls, use the CosmosSimulationControls component.
 *
 * @example Default usage
 * ```tsx
 * <CosmosGraph {...graphProps}>
 *   <CosmosGraphControls />
 * </CosmosGraph>
 * ```
 *
 * @example Custom positioning
 * ```tsx
 * <CosmosGraph {...graphProps}>
 *   <CosmosGraphControls className="absolute bottom-4 right-4" />
 * </CosmosGraph>
 * ```
 *
 * @example Adding custom controls
 * ```tsx
 * <CosmosGraph {...graphProps}>
 *   <CosmosGraphControls>
 *     <Button onClick={handleExport}>
 *       <Download className="h-4 w-4" />
 *     </Button>
 *   </CosmosGraphControls>
 * </CosmosGraph>
 * ```
 */
export const CosmosGraphControls: FC<
  PropsWithChildren<CosmosGraphControlsProps>
> = ({className, children}) => {
  const {fitView} = useStoreWithCosmos((s) => s.cosmos);

  return (
    <div className={cn('absolute top-1 left-1 flex gap-2', className)}>
      <Button onClick={fitView} variant="outline" size="sm">
        <Maximize2 className="h-4 w-4" />
      </Button>
      {children}
    </div>
  );
};
