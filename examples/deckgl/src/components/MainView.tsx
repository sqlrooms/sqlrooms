import {useSql} from '@sqlrooms/duckdb';
import {useMemo} from 'react';
import {useRoomStore} from '../store';
import {AirportFeature, MapView} from './MapView';
import {SpinnerPane} from '@sqlrooms/ui';

export const MainView: React.FC = () => {
  const table = useRoomStore((s) => s.db.findTableByName('airports'));
  const {data, isLoading, error} = useSql<{
    name: string;
    abbrev: string;
    scalerank: number;
    geometry: string;
  }>({
    query: `
      SELECT 
        name,
        abbrev,
        scalerank,
        ST_AsGeoJSON(geom) AS geometry
      FROM airports`,
    enabled: Boolean(table),
  });

  const features = useMemo(
    () =>
      data?.toArray().map(
        ({geometry, ...properties}) =>
          ({
            type: 'Feature',
            geometry: JSON.parse(geometry),
            properties,
          }) satisfies AirportFeature,
      ) ?? [],
    [data],
  );

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <MapView features={features} />
      {isLoading ? <SpinnerPane className="h-full w-full" /> : null}
      {error ? (
        <div className="absolute left-5 top-5 whitespace-pre-wrap font-mono text-xs text-red-500">
          Error: {error.message}
        </div>
      ) : null}
    </div>
  );
};
