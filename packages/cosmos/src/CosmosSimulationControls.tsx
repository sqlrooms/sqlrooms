import {
  cn,
  Slider,
  Label,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {FC, useState} from 'react';
import {useCosmosGraph} from './CosmosGraphContext';
import {Info} from 'lucide-react';
import {GraphConfigInterface} from '@cosmograph/cosmos';
import {
  CosmosSimulationConfigSchema,
  DEFAULT_COSMOS_CONFIG_SIMULATION,
} from './config';

interface CosmosSimulationControlsProps {
  /**
   * Optional className to override the default positioning and styling of the controls container.
   * By default, controls are positioned at the top-right corner.
   */
  className?: string;
}

interface SimulationParameter {
  name: string;
  configKey: keyof typeof DEFAULT_COSMOS_CONFIG_SIMULATION;
  min: number;
  max: number;
  step: number;
  tooltip: string;
}

const SIMULATION_PARAMETERS: SimulationParameter[] = [
  {
    name: 'Gravity',
    configKey: 'simulationGravity',
    min: 0,
    max: 1,
    step: 0.01,
    tooltip: CosmosSimulationConfigSchema.shape.simulationGravity.description!,
  },
  {
    name: 'Repulsion',
    configKey: 'simulationRepulsion',
    min: 0,
    max: 5,
    step: 0.1,
    tooltip:
      CosmosSimulationConfigSchema.shape.simulationRepulsion.description!,
  },
  {
    name: 'Link Strength',
    configKey: 'simulationLinkSpring',
    min: 0,
    max: 3,
    step: 0.01,
    tooltip:
      CosmosSimulationConfigSchema.shape.simulationLinkSpring.description!,
  },
  {
    name: 'Link Distance',
    configKey: 'simulationLinkDistance',
    min: 1,
    max: 50,
    step: 1,
    tooltip:
      CosmosSimulationConfigSchema.shape.simulationLinkDistance.description!,
  },
  {
    name: 'Friction',
    configKey: 'simulationFriction',
    min: 0,
    max: 1,
    step: 0.01,
    tooltip: CosmosSimulationConfigSchema.shape.simulationFriction.description!,
  },
];

type SimulationValues = Record<SimulationParameter['configKey'], number>;

export const CosmosSimulationControls: FC<CosmosSimulationControlsProps> = ({
  className,
}) => {
  const {graphRef} = useCosmosGraph();
  const [values, setValues] = useState<SimulationValues>(() =>
    SIMULATION_PARAMETERS.reduce(
      (acc, param) => ({
        ...acc,
        [param.configKey]: DEFAULT_COSMOS_CONFIG_SIMULATION[param.configKey],
      }),
      {} as SimulationValues,
    ),
  );

  const handleParameterChange = (
    param: SimulationParameter,
    value: number[],
  ) => {
    if (!graphRef?.current) return;

    const newValues = {...values, [param.configKey]: value[0]};
    setValues(newValues);

    const config: Partial<GraphConfigInterface> = {
      [param.configKey]: value[0],
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
      {SIMULATION_PARAMETERS.map((param) => (
        <div key={param.configKey} className="space-y-2">
          <div className="flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <Label
                  htmlFor={param.configKey}
                  className="text-xs font-medium flex items-center gap-1 cursor-help"
                >
                  {param.name}
                  <Info className="w-3 h-3 text-muted-foreground" />
                </Label>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[200px]">
                {param.tooltip}
              </TooltipContent>
            </Tooltip>
            <span className="text-xs tabular-nums text-muted-foreground">
              {values[param.configKey].toFixed(2)}
            </span>
          </div>
          <Slider
            id={param.configKey}
            min={param.min}
            max={param.max}
            step={param.step}
            value={[values[param.configKey]]}
            onValueChange={(value) => handleParameterChange(param, value)}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
};
