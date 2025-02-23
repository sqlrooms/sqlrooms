import {
  cn,
  Slider,
  Label,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Button,
} from '@sqlrooms/ui';
import {FC, useState} from 'react';
import {useCosmosGraph} from './CosmosGraphContext';
import {Info, Pause, Play, Wind} from 'lucide-react';
import {GraphConfigInterface} from '@cosmograph/cosmos';
import {CosmosSimulationConfigSchema} from './config';

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
    default: 0.25,
  },
  {
    key: 'simulationRepulsion',
    label: 'Repulsion',
    min: 0,
    max: 2,
    step: 0.01,
    default: 1.0,
  },
  {
    key: 'simulationLinkSpring',
    label: 'Link Strength',
    min: 0,
    max: 2,
    step: 0.01,
    default: 1,
  },
  {
    key: 'simulationLinkDistance',
    label: 'Link Distance',
    min: 1,
    max: 20,
    step: 1,
    default: 10,
  },
  {
    key: 'simulationFriction',
    label: 'Friction',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.85,
  },
  {
    key: 'simulationDecay',
    label: 'Decay',
    min: 100,
    max: 10000,
    step: 100,
    default: 1000,
  },
] as const;

type SimulationKey = (typeof simulationSliders)[number]['key'];
type SimulationValues = Record<SimulationKey, number>;

/**
 * A component that provides fine-grained controls for adjusting graph simulation parameters.
 * Must be used within a CosmosGraph component as it relies on the CosmosGraphContext.
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
 *     <div style={{ width: '800px', height: '600px' }}>
 *       <CosmosGraph {...graphProps}>
 *         <CosmosSimulationControls />
 *       </CosmosGraph>
 *     </div>
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
 *     <div style={{ width: '800px', height: '600px' }}>
 *       <CosmosGraph {...graphProps}>
 *         <CosmosGraphControls className="absolute top-4 left-4" />
 *         <CosmosSimulationControls className="absolute top-4 right-4" />
 *       </CosmosGraph>
 *     </div>
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
    graphRef,
    isSimulationRunning,
    handleToggleSimulation,
    handleStartWithEnergy,
  } = useCosmosGraph();
  const [values, setValues] = useState<SimulationValues>(
    () =>
      Object.fromEntries(
        simulationSliders.map(({key, default: defaultValue}) => [
          key,
          defaultValue,
        ]),
      ) as SimulationValues,
  );

  const handleParameterChange = (paramKey: SimulationKey, value: number[]) => {
    if (!graphRef?.current) return;

    const newValues = {...values, [paramKey]: value[0]};
    setValues(newValues);

    const config: Partial<GraphConfigInterface> = {
      [paramKey]: value[0],
    };
    graphRef.current.setConfig(config);
  };

  return (
    <div
      className={cn(
        'absolute top-1 right-1 w-48 bg-card/90 dark:bg-card/90 rounded-lg shadow-lg p-3 space-y-4',
        className,
      )}
    >
      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleToggleSimulation}
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
              onClick={handleStartWithEnergy}
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
                  {label}
                  <Info className="w-3 h-3 text-muted-foreground" />
                </Label>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[200px]">
                {CosmosSimulationConfigSchema.shape[key].description}
              </TooltipContent>
            </Tooltip>
            <span className="text-xs tabular-nums text-muted-foreground">
              {values[key].toFixed(2)}
            </span>
          </div>
          <Slider
            id={key}
            min={min}
            max={max}
            step={step}
            value={[values[key]]}
            onValueChange={(value) => handleParameterChange(key, value)}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
};
