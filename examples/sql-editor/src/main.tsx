import {RoomShellProvider} from '@sqlrooms/room-shell';
import {ThemeProvider} from '@sqlrooms/ui';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import {MainView} from './MainView';
import {roomStore} from './store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="absolute inset-0">
      <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ui-theme">
        <RoomShellProvider roomStore={roomStore}>
          <MainView />
        </RoomShellProvider>
      </ThemeProvider>
    </div>
  </StrictMode>,
);
