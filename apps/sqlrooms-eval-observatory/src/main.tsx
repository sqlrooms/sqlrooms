import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {EvalObservatory} from './EvalObservatory';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EvalObservatory />
  </StrictMode>,
);
