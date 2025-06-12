import {ThemeProvider} from '@sqlrooms/ui';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import {App} from './app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ui-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
