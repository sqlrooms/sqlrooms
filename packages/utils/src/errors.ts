/**
 * Extracts and formats an error message for display, removing common prefixes and truncating at first newline
 * @param e - Error object or any other value that can be converted to string
 * @returns Cleaned up error message string
 * @deprecated
 * @example
 * ```ts
 * getErrorMessageForDisplay(new Error("Query failed: Error: Invalid syntax\nMore details...")); // "Invalid syntax"
 * ```
 */
export const getErrorMessageForDisplay = (e: unknown) => {
  let msg = e instanceof Error ? e.message : String(e);
  msg = msg.replace(/Query failed: Error: /, '');
  const firstNl = msg.indexOf('\n');
  return firstNl >= 0 ? msg.substring(0, firstNl) : msg;
};
