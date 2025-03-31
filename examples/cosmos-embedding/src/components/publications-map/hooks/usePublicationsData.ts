import {z} from 'zod';
import {useSql} from '@sqlrooms/duckdb';
import {useProjectStore} from '../../../store';
import {useMemo} from 'react';
import {scaleOrdinal, scaleSqrt} from 'd3-scale';
import {schemeTableau10} from 'd3-scale-chromatic';

export const publicationSchema = z.object({
  x: z.number(),
  y: z.number(),
  title: z.string(),
  publishedOn: z.coerce.date(),
  numCitations: z.coerce.number(),
  mainField: z.string(),
});

export const citationStatsSchema = z.object({
  minCitations: z.coerce.number(),
  maxCitations: z.coerce.number(),
});

export const usePublicationsData = () => {
  const isTableReady = useProjectStore((state) =>
    Boolean(state.db.tables.find((t) => t.tableName === 'publications')),
  );

  const {data: queryResult} = useSql(publicationSchema, {
    query: `
      FROM publications
      SELECT
        x, y, title, 
        pub_date AS publishedOn,
        n_cits AS numCitations,
        main_field AS mainField
    `,
    enabled: isTableReady,
  });

  const {data: citationStats} = useSql(citationStatsSchema, {
    query: `
      FROM publications
      SELECT 
        MIN(n_cits) as minCitations,
        MAX(n_cits) as maxCitations
    `,
    enabled: isTableReady,
  });

  const uniqueFields = useMemo(() => {
    if (!queryResult) return [];
    return Array.from(
      new Set(Array.from(queryResult.rows(), (row) => row.mainField)),
    ).sort();
  }, [queryResult]);

  const colorScale = useMemo(() => {
    if (!queryResult) return null;
    const scale = scaleOrdinal<string>(schemeTableau10);
    scale.domain(uniqueFields);
    return scale;
  }, [queryResult, uniqueFields]);

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

  return {
    queryResult,
    citationStats,
    colorScale,
    uniqueFields,
    sizeScale,
    graphData,
  };
};
