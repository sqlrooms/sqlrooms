import {RoomPanelTypes} from './panel-types';
import {RoomPanel} from '@sqlrooms/room-shell';
import {RoomPanelComponent} from '@sqlrooms/layout';

export const SchemaPanel: RoomPanelComponent = () => {
  return (
    <RoomPanel type={RoomPanelTypes.enum['schema']}>
      <div className="text-muted-foreground text-xs">
        Browse table schemas and column definitions.
      </div>
      <div className="border-border flex flex-col gap-1 rounded border p-3">
        <div className="text-sm font-medium">sample_data</div>
        <div className="text-muted-foreground font-mono text-xs">
          <div>id: INTEGER</div>
          <div>name: VARCHAR</div>
          <div>value: DOUBLE</div>
          <div>created_at: TIMESTAMP</div>
        </div>
      </div>
    </RoomPanel>
  );
};
