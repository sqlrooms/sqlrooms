'use client';

import {RoomStateProvider} from '@sqlrooms/room-store';
import {roomStore} from '@/app/store';
import {MainView} from './main-view';

const AppShell = () => {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <MainView />
    </RoomStateProvider>
  );
};

export default AppShell;
