import {ThemeProvider} from '@sqlrooms/ui';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
