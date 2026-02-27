import {Theme, useTheme} from '../theme/theme-provider';
import {useIsSystemPrefersDark} from './useIsSystemPrefersDark';

export function useDetermineTheme(
  explicitTheme?: Theme,
): Omit<Theme, 'system'> {
  const {theme: appTheme} = useTheme();
  const isSystemPrefersDark = useIsSystemPrefersDark();

  const isDark =
    explicitTheme === 'dark'
      ? true
      : explicitTheme === 'light'
        ? false
        : explicitTheme === 'system'
          ? isSystemPrefersDark
          : appTheme === 'dark' ||
            (appTheme === 'system' && isSystemPrefersDark);

  return isDark ? 'dark' : 'light';
}
