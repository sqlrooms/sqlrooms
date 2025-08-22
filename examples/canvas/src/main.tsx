import React from 'react';
import ReactDOM from 'react-dom/client';
import {Room} from './room';
import './index.css';
import '@xyflow/react/dist/style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Room />
  </React.StrictMode>,
);
