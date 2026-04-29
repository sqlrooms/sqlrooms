import {RoomPanel} from '@sqlrooms/room-shell';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import {RoomPanelTypes} from '../store';
import {FC} from 'react';

export const DataSourcesPanel: FC = () => {
  return (
    <RoomPanel type={RoomPanelTypes.enum['data']}>
      <SchemaExplorer>
        <SchemaExplorer.Header>
          <SchemaExplorer.RefreshButton />
        </SchemaExplorer.Header>
        <SchemaExplorer.Tree className="h-full" />
      </SchemaExplorer>
    </RoomPanel>
  );
};
