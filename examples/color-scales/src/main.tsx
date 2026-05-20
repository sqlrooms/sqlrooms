import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Room} from './room';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Room />
  </StrictMode>,
);
