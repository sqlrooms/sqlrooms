import {safeJsonParse} from '@/lib/utils';
import {arrowTableToJson, useDuckDb} from '@sqlrooms/duckdb';
import {useEffect, useMemo, useState} from 'react';
import {VegaLite, VisualizationSpec} from 'react-vega';

const DATA_NAME = 'queryResult';
export const VegaLiteChart: React.FC<{
  width?: number;
  height?: number;
  sqlQuery: string;
  spec: string;
}> = ({width, height, sqlQuery, spec}) => {
  const {conn} = useDuckDb();
  const [data, setData] = useState<Record<string, unknown>>();
  const refinedSpec = useMemo(() => {
    const parsed = safeJsonParse(spec);
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
      {/* <pre>{JSON.stringify(data, null, 2)}</pre>
      <pre>{JSON.stringify(plotLayout, null, 2)}</pre> */}
      <VegaLite spec={refinedSpec} data={data} width={width} height={height} />
    </div>
  );
};
