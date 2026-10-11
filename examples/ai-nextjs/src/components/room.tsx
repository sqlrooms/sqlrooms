'use client';

import {roomStore} from '@/app/store';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {TooltipProvider} from '@sqlrooms/ui';
import {MainView} from './main-view';

const Room = () => {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <TooltipProvider>
        <MainView />
      </TooltipProvider>
    </RoomStateProvider>
  );
};

export default Room;
