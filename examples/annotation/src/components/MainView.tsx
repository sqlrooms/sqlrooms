import {useSql} from '@sqlrooms/duckdb';
import {TableCard} from '@sqlrooms/project-builder';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SpinnerPane,
} from '@sqlrooms/ui';
import {useProjectStore} from '../store.js';

export const MainView: React.FC = () => {
  const table = useProjectStore((s) => s.db.findTableByName('earthquakes'));
  const {data, isLoading, error} = useSql<{count: number; maxMag: number}>({
    query: `SELECT COUNT(*) AS count, MAX(Magnitude) AS maxMag FROM earthquakes`,
    enabled: Boolean(table),
  });

  if (!table) return null;

  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      {isLoading ? (
        <SpinnerPane className="h-full w-full" />
      ) : error ? (
        <div>Error: {error.message}</div>
      ) : (
        <Card className="w-[300px]">
          <CardHeader>
            <CardTitle>Earthquakes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <TableCard value={table} isReadOnly className="p-2" />
            <div>Total records: {data?.getRow(0).count}</div>
            <div>Max magnitude: {data?.getRow(0).maxMag}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
