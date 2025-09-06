import {ThemeProvider} from '@sqlrooms/ui';
import React from 'react';
import ReactDOM from 'react-dom/client';
import {Room} from './room';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ui-theme">
      <Room />
    </ThemeProvider>
  </React.StrictMode>,
);

