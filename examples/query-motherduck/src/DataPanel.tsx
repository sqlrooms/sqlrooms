import {RoomPanel} from '@sqlrooms/room-shell';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import {RoomPanelTypes} from './store';

export const DataPanel = () => {
  return (
    <RoomPanel type={RoomPanelTypes.enum['data']}>
      <SchemaExplorer />
    </RoomPanel>
  );
};
