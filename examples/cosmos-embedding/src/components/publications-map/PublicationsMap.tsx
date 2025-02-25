import {FC, useState, useMemo, useEffect} from 'react';
import {GraphConfigInterface} from '@cosmograph/cosmos';
import {CosmosGraph, CosmosGraphControls} from '@sqlrooms/cosmos';
import {usePublicationsData} from './hooks/usePublicationsData';
import {Legend} from './components/Legend';
import {PublicationTooltip} from './components/PublicationTooltip';
import {useProjectStore} from '../../store';

export const PublicationsMap: FC = () => {
  const {
    queryResult,
    colorScale,
    uniqueFields,
    citationStats,
    sizeScale,
    graphData,
  } = usePublicationsData();

  const citationStatsData = useMemo(
    () => (citationStats ? citationStats.getRow(0) : null),
    [citationStats],
  );

  const [focusedPointIndex, setFocusedPointIndex] = useState<number>();

  const updateGraphConfig = useProjectStore((s) => s.cosmos.updateGraphConfig);

  const config = useMemo<GraphConfigInterface>(
    () => ({
      backgroundColor: 'transparent',
      fitViewOnInit: true,
      enableDrag: false,
      disableSimulation: true,
      pointSizeScale: 1,
      scalePointsOnZoom: false,
      hoveredPointCursor: 'pointer',
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

  // Update graph config when it changes
  useEffect(() => {
    updateGraphConfig(config);
  }, [config, updateGraphConfig]);

  return graphData && colorScale ? (
    <div className="relative w-full h-full">
      <CosmosGraph
        config={config}
        focusedPointIndex={focusedPointIndex}
        pointPositions={graphData.pointPositions}
        pointSizes={graphData.pointSizes}
        pointColors={graphData.pointColors}
        renderPointTooltip={(index: number) => {
          if (!queryResult) return null;
          const row = queryResult.getRow(index);
          const fieldColor = colorScale(row.mainField);
          return (
            <PublicationTooltip publication={row} fieldColor={fieldColor} />
          );
        }}
      >
        <CosmosGraphControls className="absolute top-0 left-0" />
      </CosmosGraph>
      <Legend
        uniqueFields={uniqueFields}
        colorScale={colorScale}
        citationStats={citationStatsData}
        sizeScale={sizeScale}
      />
    </div>
  ) : null;
};
