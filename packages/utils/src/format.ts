import * as d3Format from 'd3-format';

/**
 * Formats a number as a string with thousands separators and no decimal places.
 * Example: 1234567 -> "1,234,567"
 */
export const formatCount = d3Format.format(',.0f');

/**
 * Formats a number as a string with 4 significant digits and SI prefix.
 * Example: 1234567 -> "1.235M"
 */
export const formatCount4 = d3Format.format('.4~s');

/**
 * Formats a number as a string with thousands separators and SI prefix.
 * Example: 1234567 -> "1M"
 */
export const formatCountShort = d3Format.format(',.0s');

/**
 * Shortens a string to a specified maximum length by truncating and adding an ellipsis.
 * @param str - The string to shorten
 * @param maxLength - Maximum length of the resulting string (including ellipsis). Defaults to 10.
 * @returns The shortened string with ellipsis if truncated, or the original string if shorter than maxLength
 * @example
 * shorten("Hello World", 8) // Returns "Hello..."
 * shorten("Hi", 8) // Returns "Hi"
 */
export function shorten(str: string, maxLength = 10): string {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.substring(0, maxLength - 3)}…`;
}
