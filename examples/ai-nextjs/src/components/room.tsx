'use client';

import {roomStore} from '@/app/store';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {MainView} from './main-view';

const Room = () => {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <MainView />
    </RoomStateProvider>
  );
};

export default Room;
