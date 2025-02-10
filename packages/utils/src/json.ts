/**
 * Parse a JSON string and return the parsed object.
 * If the string is not valid JSON, return null.
 * @param json - The JSON string to parse.
 * @returns The parsed object or null if the string is not valid JSON.
 */
export function safeJsonParse<T>(json: string | undefined | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return null;
  }
}
