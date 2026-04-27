import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

/**
 * Available theme options
 * @typedef {'dark' | 'light' | 'system'} Theme
 */
export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = Exclude<Theme, 'system'>;

export const DEFAULT_THEME: Theme = 'system';
export const DEFAULT_THEME_STORAGE_KEY = 'sqlrooms-ui-theme';

type GetThemeOptions = {
  defaultTheme?: Theme;
  storageKey?: string;
};

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
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: DEFAULT_THEME,
  resolvedTheme: getResolvedTheme(DEFAULT_THEME),
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Returns the currently stored theme preference without requiring React context.
 * Falls back to the provided default when storage is unavailable or invalid.
 */
export function getThemePreference({
  defaultTheme = DEFAULT_THEME,
  storageKey = DEFAULT_THEME_STORAGE_KEY,
}: GetThemeOptions = {}): Theme {
  if (typeof window === 'undefined') return defaultTheme;

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    return isTheme(storedTheme) ? storedTheme : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

/**
 * Resolves a theme preference to the concrete light/dark theme currently in use.
 */
export function getResolvedTheme(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'light';
  if (typeof window.matchMedia !== 'function') return 'light';

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Returns the concrete light/dark theme currently in use.
 */
export function getTheme(options: GetThemeOptions = {}): ResolvedTheme {
  return getResolvedTheme(getThemePreference(options));
}

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
  defaultTheme = DEFAULT_THEME,
  storageKey = DEFAULT_THEME_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() =>
    getThemePreference({defaultTheme, storageKey}),
  );

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    getResolvedTheme(theme),
  );

  // Apply theme class before paint to avoid a light-theme flash on initial load.
  // (useLayoutEffect on the client, fall back to useEffect in non-DOM environments)
  const useIsomorphicLayoutEffect =
    typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    const resolved = getResolvedTheme(theme);

    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    setResolvedTheme(resolved);

    if (theme === 'system' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        const next = getResolvedTheme(theme);
        root.classList.remove('light', 'dark');
        root.classList.add(next);
        setResolvedTheme(next);
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  const value = {
    theme,
    resolvedTheme,
    setTheme: (theme: Theme) => {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, theme);
        } catch {
          // ignore (e.g. SSR, private mode, blocked storage)
        }
      }
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
