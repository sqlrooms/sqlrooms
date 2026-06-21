import {RoomPanel} from '@sqlrooms/room-shell';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import type {FC} from 'react';

export const DataPanel: FC = () => {
  return (
    <RoomPanel>
      <SchemaExplorer>
        <SchemaExplorer.Header>
          <SchemaExplorer.RefreshButton />
        </SchemaExplorer.Header>
        <SchemaExplorer.Tree className="h-full" />
      </SchemaExplorer>
    </RoomPanel>
  );
};
