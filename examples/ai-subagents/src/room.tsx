import {RoomStateProvider} from '@sqlrooms/room-store';
import {TooltipProvider} from '@sqlrooms/ui';
import {MainView} from './components/MainView';
import {roomStore} from './store';

export const Room = () => {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <TooltipProvider>
        <MainView />
      </TooltipProvider>
    </RoomStateProvider>
  );
};
