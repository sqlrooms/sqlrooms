import {Graph, GraphConfigInterface} from '@cosmograph/cosmos';
import {FC, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Button} from '@sqlrooms/ui';
import {Maximize2, Play, Pause, RotateCw} from 'lucide-react';

type CosmosGraphProps = {
  config: GraphConfigInterface;
  pointPositions: Float32Array;
  pointSizes: Float32Array;
  pointColors: Float32Array;
  linkIndexes?: Float32Array;
  linkColors?: Float32Array;
};

export const CosmosGraph: FC<CosmosGraphProps> = ({
  config,
  pointPositions,
  pointSizes,
  pointColors,
  linkIndexes,
  linkColors,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);

  const configWithCallbacks = useMemo(
    () => ({
      ...config,
      onSimulationStart: () => {
        setIsSimulationRunning(true);
        config.onSimulationStart?.();
      },
      onSimulationPause: () => {
        setIsSimulationRunning(false);
        config.onSimulationPause?.();
      },
      onSimulationEnd: () => {
        setIsSimulationRunning(false);
        config.onSimulationEnd?.();
      },
      onSimulationRestart: () => {
        setIsSimulationRunning(true);
        config.onSimulationRestart?.();
      },
    }),
    [config],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    if (!graphRef.current) {
      graphRef.current = new Graph(containerRef.current);
    }

    const graph = graphRef.current;
    graph.setPointPositions(pointPositions);
    graph.setPointColors(pointColors);
    graph.setPointSizes(pointSizes);

    if (linkIndexes && linkColors) {
      graph.setLinks(linkIndexes);
      graph.setLinkColors(linkColors);
    }

    graph.setConfig(configWithCallbacks);
    graph.render();
    graph.start();
    setIsSimulationRunning(true);

    graph.setZoomLevel(0.6);

    return () => {
      graph.pause();
      setIsSimulationRunning(false);
    };
  }, [
    pointPositions,
    pointColors,
    pointSizes,
    linkIndexes,
    linkColors,
    configWithCallbacks,
  ]);

  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.setConfig(configWithCallbacks);
  }, [configWithCallbacks]);

  const handleFitView = useCallback(() => {
    if (!graphRef.current) return;
    graphRef.current.fitView();
  }, []);

  const handleToggleSimulation = useCallback(() => {
    if (!graphRef.current) return;
    if (graphRef.current.isSimulationRunning) {
      graphRef.current.pause();
      setIsSimulationRunning(false);
    } else {
      graphRef.current.start();
      setIsSimulationRunning(true);
    }
  }, []);

  const handleRestartSimulation = useCallback(() => {
    if (!graphRef.current) return;
    graphRef.current.restart();
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-1 left-1 flex gap-2">
        {!config.disableSimulation && (
          <>
            <Button
              onClick={handleToggleSimulation}
              variant="outline"
              size="sm"
            >
              {isSimulationRunning ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={handleRestartSimulation}
              variant="outline"
              size="sm"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button onClick={handleFitView} variant="outline" size="sm">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
