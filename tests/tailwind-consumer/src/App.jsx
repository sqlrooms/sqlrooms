import React from 'react';
import {
  createBaseRoomSlice,
  createRoomStore,
  RoomStateProvider,
} from '@sqlrooms/room-shell';
import {SchemaExplorer} from '@sqlrooms/sql-editor';

const {roomStore} = createRoomStore((...args) => ({
  ...createBaseRoomSlice()(...args),
  db: {
    schemaTrees: [
      {
        key: 'trips',
        object: {
          type: 'table',
          name: 'trips',
          table: {database: 'memory', schema: 'main', table: 'trips'},
          rowCount: 123,
        },
      },
    ],
  },
}));

export default function App() {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <div style={{width: 320, height: 240}}>
        <SchemaExplorer>
          <SchemaExplorer.Tree />
        </SchemaExplorer>
      </div>
      <div hidden className="h-10" />
    </RoomStateProvider>
  );
}
