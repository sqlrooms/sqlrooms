import {Theme, useTheme} from '../theme/theme-provider';
import {useIsSystemPrefersDark} from './useIsSystemPrefersDark';

export function useIsDarkTheme(explicitTheme?: Theme): boolean {
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

  return isDark;
}
