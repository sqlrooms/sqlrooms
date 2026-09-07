import {ThemeProvider} from '@sqlrooms/ui';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './index.css';

/*
 * StrictMode is intentionally not used, as in the source app: its
 * double-invoked effects would boot the WebGL context and the
 * multi-megabyte Zarr fetch twice in development.
 */
createRoot(document.getElementById('root')!).render(
  <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ui-theme">
    <App />
  </ThemeProvider>,
);
