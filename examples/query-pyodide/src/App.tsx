import {ThemeProvider} from '@sqlrooms/ui';
import {Room} from './Room';

export const App = () => {
  return (
    <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
      <Room />
    </ThemeProvider>
  );
};
