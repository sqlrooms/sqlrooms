import {Button, cn} from '@sqlrooms/ui';
import {Maximize2, Pause, Play} from 'lucide-react';
import {FC, PropsWithChildren} from 'react';
import {useCosmosGraph} from './CosmosGraphContext';

interface CosmosGraphControlsProps {
  /**
   * Whether to disable simulation controls. This should match the `disableSimulation`
   * config option in the parent CosmosGraph component.
   * @default false
   */
  disableSimulation?: boolean;

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
 * A flexible control panel component for CosmosGraph that provides simulation and view controls.
 * Must be used within a CosmosGraph component as it relies on the CosmosGraphContext.
 *
 * The component always shows the default controls (simulation toggle and/or fit view)
 * and allows adding custom controls as children.
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
 *
 * @example Static visualization (no simulation)
 * ```tsx
 * <CosmosGraph {...graphProps}>
 *   <CosmosGraphControls disableSimulation={true} />
 * </CosmosGraph>
 * ```
 */
export const CosmosGraphControls: FC<
  PropsWithChildren<CosmosGraphControlsProps>
> = ({disableSimulation, className, children}) => {
  const {isSimulationRunning, handleToggleSimulation, handleFitView} =
    useCosmosGraph();

  return (
    <div className={cn('absolute top-1 left-1 flex gap-2', className)}>
      {!disableSimulation && (
        <Button onClick={handleToggleSimulation} variant="outline" size="sm">
          {isSimulationRunning ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      )}
      <Button onClick={handleFitView} variant="outline" size="sm">
        <Maximize2 className="h-4 w-4" />
      </Button>
      {children}
    </div>
  );
};
