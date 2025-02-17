import {safeJsonParse} from '@sqlrooms/utils';
import {arrowTableToJson, useDuckDb} from '@sqlrooms/duckdb';
import {useEffect, useMemo, useState} from 'react';
import {VegaLite, VisualizationSpec} from 'react-vega';

const DATA_NAME = 'queryResult';

/**
 * A component that renders a Vega-Lite chart.
 * @see Vega Lite Chart - https://vega.github.io/vega-lite/
 * @param props - The props for the component.
 * @returns The component.
 * @example
 * <VegaLiteChart sqlQuery="SELECT * FROM my_table" spec={spec} />
 */
export const VegaLiteChart: React.FC<{
  width?: number;
  height?: number;
  sqlQuery: string;
  spec: string | VisualizationSpec;
}> = ({width, height, sqlQuery, spec}) => {
  const {conn} = useDuckDb();
  const [data, setData] = useState<Record<string, unknown>>();
  const refinedSpec = useMemo(() => {
    const parsed = typeof spec === 'string' ? safeJsonParse(spec) : spec;
    if (!parsed) return null;
    return {
      ...parsed,
      data: {name: DATA_NAME},
    } as VisualizationSpec;
  }, [spec]);
  useEffect(() => {
    const fetchData = async () => {
      const result = await conn.query(sqlQuery);
      setData({[DATA_NAME]: arrowTableToJson(result)});
    };
    fetchData();
  }, [sqlQuery, conn]);

  if (!refinedSpec || !data) return null;
  return (
    <div className="w-full flex flex-col gap-2 overflow-hidden">
      <VegaLite spec={refinedSpec} data={data} width={width} height={height} />
    </div>
  );
};
