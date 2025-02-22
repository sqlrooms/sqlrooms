import {createContext, useContext, useEffect, useState} from 'react';

/**
 * Available theme options
 * @typedef {'dark' | 'light' | 'system'} Theme
 */
type Theme = 'dark' | 'light' | 'system';

/**
 * Props for the ThemeProvider component
 * @interface ThemeProviderProps
 * @property {React.ReactNode} children - Child components that will have access to the theme context
 * @property {Theme} [defaultTheme='system'] - Initial theme to use if none is stored
 * @property {string} [storageKey='sqlrooms-ui-theme'] - Local storage key to persist theme preference
 */
type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

/**
 * Theme context state
 * @interface ThemeProviderState
 * @property {Theme} theme - Current active theme
 * @property {(theme: Theme) => void} setTheme - Function to update the current theme
 */
type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

/**
 * ThemeProvider component that manages and provides theme context to its children.
 * Handles system theme detection and persistence of theme preference.
 *
 * @example
 * ```tsx
 * // Basic usage with default settings
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <YourApp />
 *     </ThemeProvider>
 *   );
 * }
 *
 * // Custom default theme and storage key
 * function App() {
 *   return (
 *     <ThemeProvider defaultTheme="dark" storageKey="my-app-theme">
 *       <YourApp />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'sqlrooms-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

/**
 * Hook to access the current theme and theme setter function.
 * Must be used within a ThemeProvider component.
 *
 * @example
 * ```tsx
 * import { Button } from '@sqlrooms/ui';
 *
 * function ThemeToggle() {
 *   const { theme, setTheme } = useTheme();
 *   const isDark = theme === 'dark';
 *
 *   return (
 *     <Button
 *       variant="outline"
 *       size="sm"
 *       onClick={() => setTheme(isDark ? 'light' : 'dark')}
 *     >
 *       {isDark ? '☀️ Light' : '🌙 Dark'}
 *     </Button>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * import { ThemeSwitch } from '@sqlrooms/ui';
 *
 * function AppHeader() {
 *   return (
 *     <nav className="border-b">
 *       <div className="flex h-16 items-center px-4">
 *         <div className="ml-auto">
 *           <ThemeSwitch />
 *         </div>
 *       </div>
 *     </nav>
 *   );
 * }
 * ```
 *
 * @returns {ThemeProviderState} Object containing current theme and setTheme function
 * @throws {Error} If used outside of a ThemeProvider
 */
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
