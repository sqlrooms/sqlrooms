import {RoomShellProvider} from '@sqlrooms/room-shell';
import {ThemeProvider} from '@sqlrooms/ui';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.js';
import './index.css';
import {roomStore} from './store.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
      <RoomShellProvider roomStore={roomStore}>
        <App />
      </RoomShellProvider>
    </ThemeProvider>
  </StrictMode>,
);
