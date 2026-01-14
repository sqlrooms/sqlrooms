/**
 * Map a font size token to a concrete Tailwind text size class.
 *
 * Accepts either bare tokens ("xs", "sm", "md", "lg", "base") or full class
 * names ("text-xs", "text-sm", etc.) and always returns a safe Tailwind class.
 */
export type FontSizeToken =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'base'
  | 'text-xs'
  | 'text-sm'
  | 'text-md'
  | 'text-lg'
  | 'text-base';

export function resolveFontSizeClass(
  token: FontSizeToken | string | undefined,
) {
  if (!token) return 'text-xs';

  // If the caller already passed a known text-* class, trust it.
  if (
    token === 'text-xs' ||
    token === 'text-sm' ||
    token === 'text-base' ||
    token === 'text-md' ||
    token === 'text-lg'
  ) {
    return token;
  }

  // Map bare tokens to Tailwind classes.
  switch (token) {
    case 'xs':
      return 'text-xs';
    case 'sm':
      return 'text-sm';
    case 'md':
      return 'text-base';
    case 'lg':
      return 'text-lg';
    case 'base':
      return 'text-base';
    default:
      return 'text-xs';
  }
}
