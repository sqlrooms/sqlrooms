import * as React from 'react';
import {useTheme} from '../theme/theme-provider';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import {SunIcon, MoonIcon} from 'lucide-react';
import {cn} from '../lib/utils';
import {FC} from 'react';

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
    <SwitchPrimitives.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary/20 data-[state=unchecked]:bg-input',
        className,
      )}
      checked={theme === 'dark'}
      onCheckedChange={(checked) => {
        setTheme(checked ? 'dark' : 'light');
      }}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none flex h-4 w-4 items-center justify-center rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 dark:bg-zinc-900',
        )}
      >
        <SunIcon className="h-2.5 w-2.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 dark:text-primary" />
        <MoonIcon className="absolute h-2.5 w-2.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 dark:text-primary" />
      </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
  );
};
