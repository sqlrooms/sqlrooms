/**
 * Main App component for Cesium Earthquake Explorer.
 */

import React from 'react';
import {ThemeProvider} from '@sqlrooms/ui';
import {Room} from './Room';

export const App: React.FC = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="cesium-app-theme">
      <Room />
    </ThemeProvider>
  );
};
