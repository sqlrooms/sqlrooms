import {useSql} from '@sqlrooms/duckdb';
import {SpinnerPane} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {useRoomStore} from '../store';
import {AirportFeature, MapView} from './MapView';

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
      ),
    [data],
  );

  if (!table) return null;
  return (
    <div className="flex h-full w-full items-center justify-center">
      {error ? <div>Error: {error.message}</div> : null}
      <MapView features={features} />
    </div>
  );
};
