'use client';

import {MoonIcon, SunIcon} from 'lucide-react';
import {FC} from 'react';
import {cn} from '../lib/utils';
import {useTheme} from '../theme/theme-provider';
import {Switch} from './switch';

/**
 * A theme toggle switch component that allows users to switch between light and dark themes.
 *
 * This component provides a visually appealing switch with sun/moon icons that animate smoothly
 * during theme transitions. It integrates with the theme context to manage theme state.
 *
 * Features:
 * - Smooth icon animations
 * - Accessible keyboard navigation
 * - Focus and hover states
 * - Customizable via className prop
 *
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <ThemeSwitch />
 *
 * // With custom styling
 * <ThemeSwitch className="my-custom-class" />
 *
 * // Within a theme provider
 * import { ThemeProvider } from '../theme/theme-provider';
 *
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <ThemeSwitch />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export const ThemeSwitch: FC<{
  /** Optional CSS class name for styling the switch container */
  className?: string;
}> = ({className}) => {
  const {theme, setTheme} = useTheme();

  return (
    <Switch
      className={cn('data-[state=checked]:bg-primary/20', className)}
      checked={theme === 'dark'}
      onCheckedChange={(checked) => {
        setTheme(checked ? 'dark' : 'light');
      }}
    >
      <Switch.Thumb className="bg-background flex items-center justify-center dark:bg-zinc-900">
        <SunIcon className="dark:text-primary h-2.5 w-2.5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <MoonIcon className="dark:text-primary absolute h-2.5 w-2.5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </Switch.Thumb>
    </Switch>
  );
};
