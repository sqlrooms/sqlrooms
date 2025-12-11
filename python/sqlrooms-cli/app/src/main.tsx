import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {Room} from './room';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Room />
  </StrictMode>,
);
