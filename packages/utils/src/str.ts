/**
 * Formats a number of bytes into a human-readable string with appropriate size units.
 * @param bytes - The number of bytes to format
 * @returns A string representation of the bytes with appropriate unit (Bytes, KB, MB, etc.)
 * @example
 * formatBytes(1024) // returns "1 KB"
 * formatBytes(1234567) // returns "1.18 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  let sizeValue = bytes / Math.pow(k, i);
  // Use floor to check if there's a non-zero fractional part, format accordingly
  sizeValue =
    sizeValue != Math.floor(sizeValue)
      ? parseFloat(sizeValue.toFixed(2))
      : Math.floor(sizeValue);

  return sizeValue + ' ' + sizes[i];
}

/**
 * Converts a camelCase string into a Title Case string.
 * @param camelCase - The camelCase string to convert
 * @returns A Title Case string with spaces between words
 * @example
 * camelCaseToTitle("myVariableName") // returns "My Variable Name"
 * camelCaseToTitle("URL") // returns "URL"
 */
export function camelCaseToTitle(camelCase: string): string {
  // Split the string into words on the camelCase boundaries
  const words = camelCase.match(/^[a-z]+|[A-Z][a-z]*/g);

  // If words are found, transform them and join into a title string
  if (words) {
    return words
      .map((word) => {
        // Capitalize the first letter of each word
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' '); // Join the words with space
  }

  // If no words were found, just capitalize the whole string
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

/**
 * Capitalizes the first letter of string
 * @param str - The string to capitalize
 * @returns A new string with the first letter capitalized
 * @example
 * capitalize("hello world") // returns "Hello world"
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
