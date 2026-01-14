/**
 * Mapping from shorthand tokens to Tailwind text-size classes.
 */
const TOKEN_TO_CLASS = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  base: 'text-base',
} as const;

export type FontSizeToken = keyof typeof TOKEN_TO_CLASS;

/**
 * Resolves a font-size token or Tailwind class to a concrete Tailwind class.
 *
 * @param token - A bare token ("xs", "sm", …) or a full Tailwind class ("text-xs", "text-2xl", …)
 * @returns A Tailwind text-size class string
 *
 * @example
 * resolveFontSizeClass('sm');         // "text-sm"
 * resolveFontSizeClass('text-4xl');   // "text-4xl"
 * resolveFontSizeClass(undefined);    // "text-xs"
 */
export function resolveFontSizeClass(
  token: FontSizeToken | string | undefined,
): string {
  if (!token) return 'text-xs';

  // Pass through any explicit Tailwind text-* class.
  if (token.startsWith('text-')) return token;

  // Look up shorthand tokens.
  return TOKEN_TO_CLASS[token as FontSizeToken] ?? 'text-xs';
}
