import {RoomShellProvider} from '@sqlrooms/room-shell';
import {ThemeProvider} from '@sqlrooms/ui';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {AppShell} from './app';
import './index.css';
import {roomStore} from './store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ui-theme">
      <RoomShellProvider roomStore={roomStore}>
        <AppShell />
      </RoomShellProvider>
    </ThemeProvider>
  </StrictMode>,
);
