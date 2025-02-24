import {
  cn,
  Slider,
  Label,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Button,
} from '@sqlrooms/ui';
import {FC} from 'react';
import {Info, Pause, Play, Wind} from 'lucide-react';
import {useStoreWithCosmos} from './CosmosSlice';
import {CosmosSliceConfig} from './CosmosSliceConfig';

/**
 * Props for the CosmosSimulationControls component.
 */
interface CosmosSimulationControlsProps {
  /**
   * Optional className to override the default positioning and styling of the controls container.
   * By default, controls are positioned at the top-right corner.
   *
   * @example
   * ```tsx
   * // Position controls at the bottom-right
   * <CosmosSimulationControls className="absolute bottom-4 right-4" />
   * ```
   */
  className?: string;
}

/**
 * Configuration for each simulation parameter slider.
 * These values define the range and step size for each parameter.
 *
 * @internal
 */
const simulationSliders = [
  {
    key: 'simulationGravity',
    label: 'Gravity',
    min: 0,
    max: 0.5,
    step: 0.01,
  },
  {
    key: 'simulationRepulsion',
    label: 'Repulsion',
    min: 0,
    max: 2,
    step: 0.01,
  },
  {
    key: 'simulationLinkSpring',
    label: 'Link Strength',
    min: 0,
    max: 2,
    step: 0.01,
  },
  {
    key: 'simulationLinkDistance',
    label: 'Link Distance',
    min: 1,
    max: 20,
    step: 1,
  },
  {
    key: 'simulationFriction',
    label: 'Friction',
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: 'simulationDecay',
    label: 'Decay',
    min: 100,
    max: 10000,
    step: 100,
  },
] as const;

type SimulationKey = (typeof simulationSliders)[number]['key'];

/**
 * A component that provides fine-grained controls for adjusting graph simulation parameters.
 * Uses the zustand store to access and control the graph state.
 *
 * Features:
 * - Slider controls for all simulation parameters
 * - Real-time parameter adjustment
 * - Tooltips with parameter descriptions
 * - Customizable positioning
 * - Default values optimized for common use cases
 *
 * Available parameters:
 * - Gravity (0-0.5): Controls how strongly nodes are pulled toward the center
 * - Repulsion (0-2): Controls how strongly nodes push away from each other
 * - Link Strength (0-2): Controls the spring force between connected nodes
 * - Link Distance (1-20): Sets the natural length of links between nodes
 * - Friction (0-1): Controls how quickly node movement decays
 * - Decay (100-10000): Controls how quickly the simulation "cools down"
 *
 * @example Basic usage
 * ```tsx
 * import { CosmosGraph, CosmosSimulationControls } from '@sqlrooms/cosmos';
 *
 * const MyGraph = () => {
 *   return (
 *       <CosmosGraph {...graphProps}>
 *         <CosmosSimulationControls />
 *       </CosmosGraph>
 *   );
 * };
 * ```
 *
 * @example Custom positioning with other controls
 * ```tsx
 * import { CosmosGraph, CosmosGraphControls, CosmosSimulationControls } from '@sqlrooms/cosmos';
 *
 * const MyGraph = () => {
 *   return (
 *       <CosmosGraph {...graphProps}>
 *         <CosmosGraphControls className="absolute top-4 left-4" />
 *         <CosmosSimulationControls className="absolute top-4 right-4" />
 *       </CosmosGraph>
 *   );
 * };
 * ```
 *
 * @example With custom styling
 * ```tsx
 * <CosmosGraph {...graphProps}>
 *   <CosmosSimulationControls
 *     className="absolute bottom-4 right-4 bg-opacity-75 backdrop-blur-sm"
 *   />
 * </CosmosGraph>
 * ```
 */
export const CosmosSimulationControls: FC<CosmosSimulationControlsProps> = ({
  className,
}) => {
  const {
    isSimulationRunning,
    toggleSimulation,
    startWithEnergy,
    updateSimulationConfig,
  } = useStoreWithCosmos((s) => s.cosmos);

  const config = useStoreWithCosmos(
    (s) => s.project.config.cosmos,
  ) as CosmosSliceConfig['cosmos'];

  const handleParameterChange = (paramKey: SimulationKey, value: number[]) => {
    updateSimulationConfig({[paramKey]: value[0]});
  };

  return (
    <div
      className={cn(
        'w-48 bg-card/90 dark:bg-card/90 rounded-lg shadow-lg p-3 space-y-4',
        className,
      )}
    >
      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={toggleSimulation}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              {isSimulationRunning ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isSimulationRunning ? 'Pause simulation' : 'Start simulation'}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={startWithEnergy}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Wind className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Push energy into simulation
          </TooltipContent>
        </Tooltip>
      </div>
      {simulationSliders.map(({key, label, min, max, step}) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <Label
                  htmlFor={key}
                  className="text-xs font-medium flex items-center gap-1 cursor-help"
                >
                  <Info className="w-3 h-3 text-muted-foreground/50" />
                  {label}
                </Label>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[200px]">
                {CosmosSliceConfig.shape.cosmos.shape[key].description}
              </TooltipContent>
            </Tooltip>
            <span className="text-xs tabular-nums text-muted-foreground">
              {config[key].toFixed(2)}
            </span>
          </div>
          <Slider
            id={key}
            min={min}
            max={max}
            step={step}
            value={[config[key]]}
            onValueChange={(value) => handleParameterChange(key, value)}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
};
