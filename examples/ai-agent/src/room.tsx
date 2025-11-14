import {RoomStateProvider} from '@sqlrooms/room-store';
import {MainView} from './components/MainView';
import {roomStore} from './store';

export const Room = () => {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <MainView />
    </RoomStateProvider>
  );
};
