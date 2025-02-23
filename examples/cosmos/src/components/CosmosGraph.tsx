import {Graph, GraphConfigInterface} from '@cosmograph/cosmos';
import {Button, cn} from '@sqlrooms/ui';
import {Maximize2, Pause, Play} from 'lucide-react';
import {FC, useCallback, useEffect, useMemo, useRef, useState} from 'react';

const useRelativeCoordinates = (containerRef: React.RefObject<HTMLElement>) => {
  return useCallback(
    (x: number, y: number): [number, number] => {
      if (!containerRef.current) return [0, 0];
      const rect = containerRef.current.getBoundingClientRect();
      return [x - rect.left, y - rect.top];
    },
    [containerRef],
  );
};

type WithClientCoordinates = {
  clientX: number;
  clientY: number;
};

const hasClientCoordinates = (
  event: unknown,
): event is WithClientCoordinates => {
  return (
    typeof event === 'object' &&
    event !== null &&
    'clientX' in event &&
    'clientY' in event &&
    typeof event.clientX === 'number' &&
    typeof event.clientY === 'number'
  );
};

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
  const [hoveredPoint, setHoveredPoint] = useState<{
    index: number;
    position: [number, number];
  } | null>(null);

  const calcRelativeCoordinates = useRelativeCoordinates(containerRef);
  const configWithCallbacks = useMemo(
    () =>
      ({
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
        onPointMouseOver: (index, _pointPosition, event) => {
          if (hasClientCoordinates(event)) {
            setHoveredPoint({
              index,
              position: calcRelativeCoordinates(event.clientX, event.clientY),
            });
          }
        },
        onPointMouseOut: () => {
          setHoveredPoint(null);
        },
        onZoomStart: () => {
          setHoveredPoint(null);
        },
        onDragStart: () => {
          setHoveredPoint(null);
        },
      }) satisfies GraphConfigInterface,
    [config, calcRelativeCoordinates],
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
  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute w-full h-full" />
      <div
        className={cn(
          'absolute bg-white/90 dark:bg-gray-800/90 rounded-md shadow-lg p-2',
          'text-xs flex gap-2 items-center pointer-events-none transition-opacity duration-150',
          hoveredPoint ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          transform: `translate(${hoveredPoint?.position?.[0] ?? 0}px, ${
            hoveredPoint?.position?.[1] ?? 0
          }px) translate(-50%, 5px)`,
          visibility: hoveredPoint ? 'visible' : 'hidden',
        }}
      >
        <div>Node {hoveredPoint?.index ?? ''}</div>
      </div>
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
          </>
        )}
        <Button onClick={handleFitView} variant="outline" size="sm">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
