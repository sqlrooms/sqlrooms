/**
 * Generates a random string of specified length
 * @param length - The length of the random string to generate
 * @returns Random string containing uppercase letters, lowercase letters, and numbers
 * @example
 * ```ts
 * const random = genRandomStr(10); // e.g., "aB3kF9mN2x"
 * ```
 */
export function genRandomStr(length: number) {
  return Array.from(
    (function* () {
      for (let i = 0; i < length; i++) {
        const v = Math.floor(Math.random() * (26 * 2 + 10));
        if (v < 26) {
          yield String.fromCharCode(v + 65); // 'A' - 'Z'
        } else if (v < 52) {
          yield String.fromCharCode(v + 71); // 'a' - 'z'
        } else {
          yield String.fromCharCode(v + 48); // '0' - '9'
        }
      }
    })(),
  ).join('');
}
