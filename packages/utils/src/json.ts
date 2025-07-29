/**
 * Parse a JSON string and return the parsed object.
 * If the string is not valid JSON, return undefined.
 * @param json - The JSON string to parse.
 * @returns The parsed object or undefined if the string is not valid JSON.
 */
export function safeJsonParse<T>(
  json: string | undefined | null,
): T | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}
