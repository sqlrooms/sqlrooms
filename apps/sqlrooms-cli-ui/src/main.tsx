import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Room} from './room';

import './style.css';

if (import.meta.env.DEV) {
  (
    globalThis as typeof globalThis & {
      __SQLROOMS_AI_DEVTOOLS__?: {enabled: boolean; endpoint: string};
    }
  ).__SQLROOMS_AI_DEVTOOLS__ = {
    enabled: true,
    endpoint: '/__sqlrooms_ai_devtools',
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Room />
  </StrictMode>,
);
