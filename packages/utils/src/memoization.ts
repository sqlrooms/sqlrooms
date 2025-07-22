/**
 * Creates a memoized version of a function that caches only the last result.
 * The cache is invalidated when any of the arguments change.
 * 
 * This is useful for expensive operations that are likely to be called 
 * multiple times with the same arguments, like database queries or API calls.
 * 
 * @param fn - The function to memoize
 * @returns A memoized version of the function
 * 
 * @example
 * ```ts
 * const expensiveQuery = async (userId: string, limit: number) => {
 *   return await database.query(`SELECT * FROM users WHERE id = ? LIMIT ?`, [userId, limit]);
 * };
 * 
 * const memoizedQuery = memoizeOnce(expensiveQuery);
 * 
 * // First call executes the function
 * const result1 = await memoizedQuery("123", 10);
 * 
 * // Second call with same arguments returns cached result
 * const result2 = await memoizedQuery("123", 10); // Uses cache
 * 
 * // Call with different arguments invalidates cache and executes function
 * const result3 = await memoizedQuery("456", 10); // Executes function
 * ```
 */
export function memoizeOnce<TArgs extends readonly unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  let lastArgs: TArgs | undefined;
  let lastResult: TReturn;
  let hasResult = false;

  return (...args: TArgs): TReturn => {
    // Check if we have a cached result and arguments haven't changed
    if (hasResult && lastArgs && argsEqual(lastArgs, args)) {
      return lastResult;
    }

    // Call the function and cache the result
    lastResult = fn(...args);
    lastArgs = args;
    hasResult = true;

    return lastResult;
  };
}

/**
 * Shallow comparison of two arrays to check if all elements are equal
 */
function argsEqual<T extends readonly unknown[]>(a: T, b: T): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}
