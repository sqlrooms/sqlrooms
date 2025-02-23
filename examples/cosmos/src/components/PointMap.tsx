import {GraphConfigInterface} from '@cosmograph/cosmos';
import {useDuckDbQuery} from '@sqlrooms/duckdb';
import {FC, useMemo, useState} from 'react';
import {useProjectStore} from '../store';
import {CosmosGraph} from './CosmosGraph';
import {z} from 'zod';
import {scaleOrdinal, scaleSqrt} from 'd3-scale';
import {schemeTableau10} from 'd3-scale-chromatic';

export const PointMap: FC = () => {
  const isTableReady = useProjectStore((state) =>
    Boolean(state.project.tables.find((t) => t.tableName === 'publications')),
  );

  const {data: queryResult} = useDuckDbQuery(
    z.object({
      x: z.number(),
      y: z.number(),
      title: z.string(),
      publishedOn: z.coerce.date(), // convert epoch to date
      numCitations: z.coerce.number(), // avoid bigint errors
      mainField: z.string(),
    }),
    {
      query: `
        FROM publications
        SELECT
          x, y, title, 
          pub_date AS publishedOn,
          n_cits AS numCitations,
          main_field AS mainField
      `,
      enabled: isTableReady,
    },
  );

  const {data: citationStats} = useDuckDbQuery(
    z.object({
      minCitations: z.coerce.number(),
      maxCitations: z.coerce.number(),
    }),
    {
      query: `
        FROM publications
        SELECT 
          MIN(n_cits) as minCitations,
          MAX(n_cits) as maxCitations
      `,
      enabled: isTableReady,
    },
  );

  const colorScale = useMemo(() => {
    if (!queryResult) return null;
    const uniqueFields = Array.from(
      new Set(
        Array.from(
          {length: queryResult.length},
          (_, i) => queryResult.getRow(i).mainField,
        ),
      ),
    ).sort();
    const scale = scaleOrdinal<string>(schemeTableau10);
    scale.domain(uniqueFields);
    return scale;
  }, [queryResult]);

  const uniqueFields = useMemo(() => {
    if (!queryResult) return [];
    return Array.from(
      new Set(
        Array.from(
          {length: queryResult.length},
          (_, i) => queryResult.getRow(i).mainField,
        ),
      ),
    ).sort();
  }, [queryResult]);

  const sizeScale = useMemo(() => {
    if (!citationStats) return null;
    const stats = citationStats.getRow(0);
    return scaleSqrt()
      .domain([stats.minCitations, stats.maxCitations])
      .range([1, 25]);
  }, [citationStats]);

  const graphData = useMemo(() => {
    if (!queryResult || !colorScale || !citationStats || !sizeScale)
      return null;

    const pointPositions = new Float32Array(queryResult.length * 2);
    const pointSizes = new Float32Array(queryResult.length);
    const pointColors = new Float32Array(queryResult.length * 4);

    for (let i = 0; i < queryResult.length; i++) {
      const point = queryResult.getRow(i);
      pointPositions[i * 2] = point.x;
      pointPositions[i * 2 + 1] = point.y;
      pointSizes[i] = sizeScale(point.numCitations);

      // Convert hex color to RGB components
      const color = colorScale(point.mainField);
      const r = parseInt(color.slice(1, 3), 16) / 255;
      const g = parseInt(color.slice(3, 5), 16) / 255;
      const b = parseInt(color.slice(5, 7), 16) / 255;

      pointColors[i * 4] = r;
      pointColors[i * 4 + 1] = g;
      pointColors[i * 4 + 2] = b;
      pointColors[i * 4 + 3] = 0.8;
    }

    return {
      pointPositions,
      pointSizes,
      pointColors,
    };
  }, [queryResult, colorScale, citationStats, sizeScale]);

  const [focusedPointIndex, setFocusedPointIndex] = useState<number>();

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
      onClick: (index) => {
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
    <div className="relative w-full h-full">
      <CosmosGraph
        config={config}
        focusedPointIndex={focusedPointIndex}
        pointPositions={graphData.pointPositions}
        pointSizes={graphData.pointSizes}
        pointColors={graphData.pointColors}
        getPointTooltip={(index) => {
          if (!queryResult || !colorScale) return null;
          const row = queryResult.getRow(index);
          const fieldColor = colorScale(row.mainField);
          return (
            // Tooltip
            <div className="flex flex-col gap-1 text-xs">
              <div className="text-xs font-medium text-gray-100 mb-1.5">
                {row.title}
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <span
                  className="px-1.5 py-0.5 rounded text-gray-900"
                  style={{backgroundColor: fieldColor}}
                >
                  {row.mainField}
                </span>
              </div>
              <div className="text-gray-400">
                Published: {row.publishedOn.getFullYear()}
              </div>
              <div className="text-gray-400">
                Citations: {row.numCitations.toLocaleString()}
              </div>
            </div>
          );
        }}
      />
      {/* Color Legend */}
      <div className="absolute top-4 right-4 bg-gray-900/80 rounded-lg p-3 backdrop-blur-sm">
        <div className="text-xs font-medium text-gray-300 mb-2">Fields</div>
        <div className="flex flex-col gap-1.5">
          {uniqueFields.map((field) => (
            <div key={field} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-3 h-3 rounded-sm"
                style={{backgroundColor: colorScale?.(field)}}
              />
              <span className="text-gray-400">{field}</span>
            </div>
          ))}
        </div>
        {/* Size Legend */}
        {citationStats && sizeScale && (
          <>
            <div className="text-xs font-medium text-gray-300 mb-2 mt-4">
              Citations
            </div>
            <div className="flex flex-col gap-1.5">
              {sizeScale.ticks(4).map((citations: number) => (
                <div
                  key={citations}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <span
                    className="relative flex items-center justify-center"
                    style={{width: '20px', height: '20px'}}
                  >
                    <span
                      className="absolute bg-white rounded-full bg-opacity-50"
                      style={{
                        width: `${sizeScale(citations)}px`,
                        height: `${sizeScale(citations)}px`,
                        opacity: 0.8,
                      }}
                    />
                  </span>
                  <span className="text-gray-400">
                    {citations.toLocaleString()} citations
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;
};
