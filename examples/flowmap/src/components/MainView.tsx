import {useSql} from '@sqlrooms/duckdb';
import {useRoomStore} from '../store';
import {Location, Flow, FlowmapView} from './FlowmapView';

export const MainView: React.FC = () => {
  const locationsTable = useRoomStore((s) => s.db.findTableByName('locations'));
  const locationsQuery = useSql<Location>({
    query: `SELECT id::int as id, name, lat, lon FROM locations`,
    enabled: Boolean(locationsTable),
  });

  const flowsTable = useRoomStore((s) => s.db.findTableByName('flows'));
  const flowsQuery = useSql<Flow>({
    query: `
    SELECT 
      origin::int as origin, dest::int as dest, count::int as count
    FROM flows`,
    enabled: Boolean(flowsTable),
  });

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      <FlowmapView
        className="h-full w-full"
        locations={locationsQuery.data?.arrowTable}
        flows={flowsQuery.data?.arrowTable}
      />
      {/* {locationsQuery.isLoading || flowsQuery.isLoading ? (
        <SpinnerPane className="absolute inset-0" />
      ) : null} */}
      {locationsQuery.error || flowsQuery.error ? (
        <div className="absolute left-5 top-5 whitespace-pre-wrap font-mono text-xs text-red-500">
          Error: {locationsQuery.error?.message} {flowsQuery.error?.message}
        </div>
      ) : null}
    </div>
  );
};
