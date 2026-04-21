import {RoomPanel} from '@sqlrooms/room-shell';
import {RoomPanelTypes} from '../panel-types';
import {FC} from 'react';

export const DataSourcesPanel: FC = () => {
  return (
    <RoomPanel type={RoomPanelTypes.enum['data']}>
      <div className="text-muted-foreground text-xs">
        Manage your data connections and files here.
      </div>
      <div className="border-border flex flex-col gap-2 rounded border p-3">
        <div className="text-sm font-medium">sample_data.csv</div>
        <div className="text-muted-foreground text-xs">
          1,234 rows · 12 columns
        </div>
      </div>
      <div className="border-border flex flex-col gap-2 rounded border p-3">
        <div className="text-sm font-medium">users.parquet</div>
        <div className="text-muted-foreground text-xs">
          5,678 rows · 8 columns
        </div>
      </div>
    </RoomPanel>
  );
};
