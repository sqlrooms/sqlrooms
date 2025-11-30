import {useSql} from '@sqlrooms/duckdb';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SpinnerPane,
} from '@sqlrooms/ui';
import {useRoomStore} from '../store.js';

export function MainView() {
  const tableReady = useRoomStore((state) =>
    state.db.findTableByName('earthquakes'),
  );
  const {data, isLoading, error} = useSql<{
    count: number;
    maxMag: number;
    avgDepth: number;
    fromDate: string;
    toDate: string;
    maxMagDate: string;
  }>({
    query: `
      WITH max_magnitude AS (
        SELECT max(Magnitude) as max_mag
        FROM earthquakes
      )
      SELECT 
        COUNT(*)::int AS count,
        max(Magnitude) AS maxMag,
        (SELECT DateTime FROM earthquakes WHERE Magnitude = (SELECT max(Magnitude) FROM earthquakes) LIMIT 1) AS maxMagDate,
        avg(Depth) AS avgDepth,
        min(DateTime) AS fromDate,
        max(DateTime) AS toDate
      FROM earthquakes`,
    enabled: Boolean(tableReady),
  });

  if (isLoading) {
    return <SpinnerPane />;
  }
  if (error) {
    return (
      <div className="whitespace-pre-wrap p-4 font-mono text-xs text-red-500">
        Error: {error.message}
      </div>
    );
  }

  const row = data?.toArray()[0];
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <Card className="w-64">
        <CardHeader>
          <CardTitle>California Earthquakes Stats</CardTitle>
        </CardHeader>
        {row ? (
          <CardContent className="space-y-1 text-xs">
            <div>Total records: {row.count}</div>
            <div>
              Date range: {new Date(row.fromDate).toLocaleDateString()}-{' '}
              {new Date(row.toDate).toLocaleDateString()}
            </div>
            <div>
              Max magnitude:{' '}
              {`${row.maxMag.toFixed(2)} on ${new Date(row.maxMagDate).toLocaleDateString()}`}
            </div>
            <div>Avg depth: {row.avgDepth.toFixed(2)}</div>
          </CardContent>
        ) : (
          <CardContent>
            <div>No data loaded</div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
