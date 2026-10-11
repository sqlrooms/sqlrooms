import {createRoot} from 'react-dom/client';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {TooltipProvider} from '@sqlrooms/ui';
import {initializeRoomie, roomStore} from './store';
import {App} from './App';
import './style.css';

await initializeRoomie();
createRoot(document.getElementById('root')!).render(
  <RoomStateProvider roomStore={roomStore}>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </RoomStateProvider>,
);
