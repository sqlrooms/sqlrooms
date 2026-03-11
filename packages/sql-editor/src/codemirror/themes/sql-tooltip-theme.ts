import {Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {type BaseThemeOptions} from '@sqlrooms/codemirror';

/**
 * Creates theme styles specifically for SQL hover tooltips.
 * Only handles the base tooltip container - components use Tailwind classes for styling.
 */
export function createSqlTooltipTheme(
  options: BaseThemeOptions = {},
): Extension {
  const {isDark} = options;

  return EditorView.theme(
    {
      '.cm-tooltip-hover .cm-sql-hover-tooltip': {
        backgroundColor: 'var(--color-popover)',
        color: 'var(--color-popover-foreground)',
        border: '0',
        boxShadow: 'none',
        padding: '0',
        fontSize: 'inherit',
        lineHeight: 'inherit',
      },
    },
    {dark: isDark},
  );
}
