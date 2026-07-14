/**
 * Application entry point.
 * Sets up Cesium Ion token and CSS imports.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import {App} from './App';

// CRITICAL: Import Cesium widgets CSS for timeline/animation controls
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Import Tailwind CSS
import './index.css';

// Set Cesium Ion access token from environment
import {Ion} from 'cesium';
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN ?? '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
