import {Button} from '@sqlrooms/ui';
import {useRoomStore} from './store';

export const DataPanel = () => {
  const runQuery = useRoomStore((s) => s.sql.runQuery);
  const setDefaultQuery = useRoomStore((s) => s.sql.setQuery);
  const onLoadSample = () => {
    setDefaultQuery(`select 42 as answer`);
    runQuery();
  };
  return (
    <div className="p-2">
      <Button onClick={onLoadSample} size="sm">
        Run sample query
      </Button>
    </div>
  );
};

