import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Room} from './room';

import './style.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Room />
  </StrictMode>,
);
