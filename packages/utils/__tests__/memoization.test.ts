import {memoizeOnce} from '../src/memoization';

describe('memoizeOnce', () => {
  test('returns the same result for identical arguments', () => {
    let callCount = 0;
    const fn = (a: number, b: string) => {
      callCount++;
      return `${a}-${b}-${callCount}`;
    };

    const memoized = memoizeOnce(fn);

    const result1 = memoized(1, 'test');
    const result2 = memoized(1, 'test');

    expect(result1).toBe(result2);
    expect(result1).toBe('1-test-1');
    expect(callCount).toBe(1); // Function should only be called once
  });

  test('calls function again when arguments change', () => {
    let callCount = 0;
    const fn = (a: number) => {
      callCount++;
      return a * 2;
    };

    const memoized = memoizeOnce(fn);

    const result1 = memoized(5);
    const result2 = memoized(10); // Different argument
    const result3 = memoized(10); // Same as result2

    expect(result1).toBe(10);
    expect(result2).toBe(20);
    expect(result3).toBe(20);
    expect(callCount).toBe(2); // Called twice: for 5 and for 10
  });

  test('invalidates cache when any argument changes', () => {
    let callCount = 0;
    const fn = (a: number, b: string, c: boolean) => {
      callCount++;
      return `${a}-${b}-${c}`;
    };

    const memoized = memoizeOnce(fn);

    memoized(1, 'test', true);
    memoized(1, 'test', true); // Same arguments, should use cache
    memoized(1, 'test', false); // Different last argument
    memoized(1, 'different', true); // Different middle argument
    memoized(2, 'test', true); // Different first argument

    expect(callCount).toBe(4); // Called 4 times due to different arguments
  });

  test('works with async functions', async () => {
    let callCount = 0;
    const asyncFn = async (value: string) => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 1)); // Small delay
      return `async-${value}-${callCount}`;
    };

    const memoized = memoizeOnce(asyncFn);

    const result1 = await memoized('test');
    const result2 = await memoized('test');

    expect(result1).toBe(result2);
    expect(result1).toBe('async-test-1');
    expect(callCount).toBe(1);
  });

  test('handles different argument types correctly', () => {
    let callCount = 0;
    const fn = (...args: unknown[]) => {
      callCount++;
      return JSON.stringify(args) + `-${callCount}`;
    };

    const memoized = memoizeOnce(fn);

    // Test with objects
    const obj = {key: 'value'};
    const arr = [1, 2, 3]; // Store array in variable to reuse same reference
    const result1 = memoized(obj, arr);
    const result2 = memoized(obj, arr); // Same references

    expect(result1).toBe(result2);
    expect(callCount).toBe(1);

    // Test with different object (different reference, same content)
    const obj2 = {key: 'value'};
    const result3 = memoized(obj2, arr); // Different object reference

    expect(result3).not.toBe(result1);
    expect(callCount).toBe(2);
  });

  test('handles no arguments', () => {
    let callCount = 0;
    const fn = () => {
      callCount++;
      return `no-args-${callCount}`;
    };

    const memoized = memoizeOnce(fn);

    const result1 = memoized();
    const result2 = memoized();

    expect(result1).toBe(result2);
    expect(result1).toBe('no-args-1');
    expect(callCount).toBe(1);
  });

  test('handles undefined and null arguments', () => {
    let callCount = 0;
    const fn = (a: unknown, b: unknown) => {
      callCount++;
      return `${a}-${b}-${callCount}`;
    };

    const memoized = memoizeOnce(fn);

    const result1 = memoized(undefined, null);
    const result2 = memoized(undefined, null);
    const result3 = memoized(null, undefined); // Different order

    expect(result1).toBe(result2);
    expect(result1).toBe('undefined-null-1');
    expect(result3).toBe('null-undefined-2');
    expect(callCount).toBe(2);
  });

  test('preserves function context and return values', () => {
    const fn = function (this: {value: number}, multiplier: number) {
      return this.value * multiplier;
    };

    const context = {value: 10};
    const memoized = memoizeOnce(fn);

    const result1 = memoized.call(context, 3);
    const result2 = memoized.call(context, 3);

    expect(result1).toBe(30);
    expect(result2).toBe(30);
  });

  test('works correctly when switching between different argument sets', () => {
    let callCount = 0;
    const fn = (a: string, b: number) => {
      callCount++;
      return `${a}-${b}-${callCount}`;
    };

    const memoized = memoizeOnce(fn);

    // First set of arguments
    const result1a = memoized('hello', 1);
    const result1b = memoized('hello', 1); // Should use cache

    // Second set of arguments
    const result2a = memoized('world', 2);
    const result2b = memoized('world', 2); // Should use cache

    // Back to first set - should execute again (cache only holds last result)
    const result1c = memoized('hello', 1);

    expect(result1a).toBe('hello-1-1');
    expect(result1b).toBe('hello-1-1'); // Same as result1a
    expect(result2a).toBe('world-2-2');
    expect(result2b).toBe('world-2-2'); // Same as result2a
    expect(result1c).toBe('hello-1-3'); // New execution, not cached
    expect(callCount).toBe(3);
  });

  test('handles array arguments correctly', () => {
    let callCount = 0;
    const fn = (arr: number[]) => {
      callCount++;
      return arr.reduce((sum, val) => sum + val, 0);
    };

    const memoized = memoizeOnce(fn);

    const array1 = [1, 2, 3];
    const result1 = memoized(array1);
    const result2 = memoized(array1); // Same array reference

    expect(result1).toBe(6);
    expect(result2).toBe(6);
    expect(callCount).toBe(1);

    // Different array with same content
    const array2 = [1, 2, 3];
    const result3 = memoized(array2);

    expect(result3).toBe(6);
    expect(callCount).toBe(2); // Should execute again due to different reference
  });

  test('handles concurrent async calls correctly', async () => {
    let callCount = 0;
    let resolvePromise: (value: string) => void;

    const asyncFn = async (value: string) => {
      callCount++;
      // Create a Promise that we can control when it resolves
      const result = await new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });
      return `async-${value}-${result}`;
    };

    const memoized = memoizeOnce(asyncFn);

    // Make two concurrent calls with the same arguments
    const promise1 = memoized('test');
    const promise2 = memoized('test');

    // Both calls should return the same Promise instance
    expect(promise1).toBe(promise2);
    expect(callCount).toBe(1); // Function should only be called once

    // Resolve the promise
    resolvePromise!('completed');

    // Both promises should resolve to the same value
    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1).toBe('async-test-completed');
    expect(result2).toBe('async-test-completed');
    expect(result1).toBe(result2);
    expect(callCount).toBe(1); // Still only called once

    // Subsequent calls should use the cached result
    const result3 = await memoized('test');
    expect(result3).toBe('async-test-completed');
    expect(callCount).toBe(1); // Still only called once
  });
});
