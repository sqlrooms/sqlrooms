import {FC, useMemo, useState} from 'react';
import {GraphConfigInterface} from '@cosmograph/cosmos';
import {
  CosmosGraph,
  CosmosGraphControls,
  CosmosSimulationControls,
} from '@sqlrooms/cosmos';
import {useMammalsData} from './hooks/useMammalsData';
import {DownloadButton} from './components/DownloadButton';

export const MammalsGraph: FC = () => {
  const {graphData} = useMammalsData();
  const [focusedPointIndex, setFocusedPointIndex] = useState<number>();

  const config = useMemo<GraphConfigInterface>(
    () => ({
      backgroundColor: 'transparent',
      enableDrag: true, // allow dragging the nodes
      linkWidth: 1,
      linkColor: '#5F74C2',
      linkArrows: false,
      fitViewOnInit: true,
      fitViewDelay: 5000,
      simulationGravity: 0.25,
      simulationRepulsion: 1.0,
      simulationLinkSpring: 1,
      simulationLinkDistance: 10,
      simulationFriction: 0.85,
      simulationDecay: 1000,
      pointSizeScale: 1,
      scalePointsOnZoom: true,
      renderHoveredPointRing: true,
      hoveredPointRingColor: '#a33aef',
      renderFocusedPointRing: true,
      focusedPointRingColor: '#ee55ff',
      onClick: (index: number | undefined) => {
        if (index === undefined) {
          setFocusedPointIndex(undefined);
        } else {
          setFocusedPointIndex(index);
        }
      },
    }),
    [],
  );

  return graphData ? (
    <CosmosGraph
      config={config}
      focusedPointIndex={focusedPointIndex}
      pointPositions={graphData.pointPositions}
      pointSizes={graphData.pointSizes}
      pointColors={graphData.pointColors}
      linkIndexes={graphData.linkIndexes}
      linkColors={graphData.linkColors}
      getPointTooltip={(index) => String(graphData.nodes[index])}
    >
      <CosmosGraphControls>
        <DownloadButton nodes={graphData.nodes} />
      </CosmosGraphControls>
      <CosmosSimulationControls />
    </CosmosGraph>
  ) : null;
};
