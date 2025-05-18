import {useSql} from '@sqlrooms/duckdb';
import {Card, CardContent, CardHeader, CardTitle} from '@sqlrooms/ui';
import {useProjectStore} from '../store.js';

export function MainView() {
  const tableReady = useProjectStore((s) => s.db.findTableByName('earthquakes'));
  const {data, isLoading, error} = useSql<{count: number; maxMag: number; avgDepth: number}>({
    query: `SELECT COUNT(*) AS count, max(Magnitude) AS maxMag, avg(Depth) AS avgDepth FROM earthquakes`,
    enabled: Boolean(tableReady),
  });

  if (!tableReady) {
    return <div className="p-4">Loading data...</div>;
  }
  if (isLoading) {
    return <div className="p-4">Querying...</div>;
  }
  if (error) {
    return <div className="p-4">Error: {error.message}</div>;
  }

  const row = data?.toArray()[0];
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <Card className="w-64">
        <CardHeader>
          <CardTitle>Earthquakes Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div>Total records: {row?.count}</div>
          <div>Max magnitude: {row?.maxMag?.toFixed(2)}</div>
          <div>Avg depth: {row?.avgDepth?.toFixed(2)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
