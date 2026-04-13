/**
 * Main App component for the Cesium OpenSky flights example.
 */

import React from 'react';
import {ThemeProvider} from '@sqlrooms/ui';
import {Room} from './Room';

export const App: React.FC = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="cesium-example-theme">
      <Room />
    </ThemeProvider>
  );
};
