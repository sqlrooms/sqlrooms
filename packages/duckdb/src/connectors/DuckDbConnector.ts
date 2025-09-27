import {LoadFileOptions, StandardLoadOptions} from '@sqlrooms/room-config';
import * as arrow from 'apache-arrow';
import {TypeMap} from 'apache-arrow';

/**
 * Options for query execution
 */
export interface QueryOptions {
  /**
   * Optional external abort signal for coordinated cancellation.
   * When provided, the query will be cancelled if this signal is aborted.
   * This enables powerful composition patterns like cancelling multiple
   * queries together or integrating with other cancellable operations.
   */
  signal?: AbortSignal;
}

/**
 * Handle for managing query execution and cancellation.
 *
 * It is **Promise-like**, so you can either:
 *
 *  • `await handle` – the most ergonomic form, or
 *  • `await handle.result` – kept for backwards-compatibility.
 *
 * Additional capabilities:
 *  • Standard Promise API: `.then()`, `.catch()`, `.finally()`
 *  • `handle.cancel()` – cancel the running query.
 *  • `handle.signal` – `AbortSignal` that fires when the query is cancelled.
 *
 * @example
 * ```typescript
 * // Simple usage
 * const handle = connector.query('SELECT * FROM table');
 * const table = await handle; // no .result needed
 *
 * // With cancellation
 * const controller = new AbortController();
 * const handle = connector.query('SELECT * FROM large_table', { signal: controller.signal });
 * setTimeout(() => controller.abort(), 5000);
 *
 * // Manual cancel via the handle
 * const h = connector.query('SELECT * FROM table');
 * await someCondition;
 * await h.cancel();
 *
 * // Composable cancellation (multiple queries, one controller)
 * const controller = new AbortController();
 * const h1 = connector.query('SELECT * FROM table1', { signal: controller.signal });
 * const h2 = connector.query('SELECT * FROM table2', { signal: controller.signal });
 * // Later...
 * controller.abort(); // Cancels h1 and h2 together
 *
 * // Using Promise utilities
 * const [t1, t2] = await Promise.all([
 *   connector.query('select 1'),
 *   connector.query('select 2')
 * ]);
 * ```
 */
export type QueryHandle<T = any> = PromiseLike<T> & {
  /** Promise that resolves with query results */
  result: Promise<T>;

  /**
   * Method to cancel the query with optional cleanup.
   * This provides a clean abstraction over the underlying cancellation mechanism.
   */
  cancel: () => Promise<void>;

  /**
   * Read-only access to the abort signal for composability.
   *
   * Key benefits:
   * - **Event-driven**: Listen for abort events to update UI or perform cleanup
   * - **Integration**: Use with other Web APIs like fetch() that accept AbortSignal
   * - **Status checking**: Check if query is already cancelled with signal.aborted
   *
   * @example
   * ```typescript
   * // Listen for cancellation events
   * handle.signal.addEventListener('abort', () => {
   *   console.log('Query cancelled');
   *   updateUI('Operation cancelled');
   * });
   *
   * // Check cancellation status
   * if (handle.signal.aborted) {
   *   console.log('Query was already cancelled');
   * }
   *
   * // Use with other APIs
   * const response = await fetch('/api/data', { signal: handle.signal });
   * ```
   */
  signal: AbortSignal;

  /** Attach a callback for only the rejection of the Promise */
  catch: Promise<T>['catch'];

  /** Attach a callback that's invoked when the Promise is settled (fulfilled or rejected) */
  finally: Promise<T>['finally'];
};

/**
 * DuckDB connector interface with advanced query cancellation support
 *
 * This interface provides a hybrid approach that combines the simplicity of method-based
 * cancellation with the composability of Web Standards (AbortController/AbortSignal).
 *
 * ## Key Benefits of This Design
 *
 * ### 🔗 Composability
 * Cancel multiple queries with a single controller:
 * ```typescript
 * const controller = new AbortController();
 * const query1 = connector.query('SELECT * FROM table1', { signal: controller.signal });
 * const query2 = connector.query('SELECT * FROM table2', { signal: controller.signal });
 * controller.abort(); // Cancels both queries
 * ```
 *
 * ### 🌐 Integration with Web APIs
 * Use the same signal for queries and HTTP requests:
 * ```typescript
 * const controller = new AbortController();
 * const queryHandle = connector.query('SELECT * FROM table', { signal: controller.signal });
 * const response = await fetch('/api/data', { signal: controller.signal });
 * // controller.abort() cancels both the query and the HTTP request
 * ```
 *
 * ### 🎛️ Flexibility
 * Simple usage when you don't need external control, advanced when you do:
 * ```typescript
 * // Simple - internal cancellation management
 * const handle = connector.query('SELECT * FROM table');
 * handle.cancel();
 *
 * // Advanced - external cancellation control
 * const controller = new AbortController();
 * const handle = connector.query('SELECT * FROM table', { signal: controller.signal });
 * controller.abort();
 * ```
 *
 * ### 📡 Event-Driven
 * React to cancellation events for better UX:
 * ```typescript
 * handle.signal.addEventListener('abort', () => {
 *   showNotification('Query cancelled');
 *   hideLoadingSpinner();
 * });
 * ```
 *
 * ### ⏱️ Timeout Support
 * Built-in timeout capability with manual override:
 * ```typescript
 * const timeoutController = new AbortController();
 * setTimeout(() => timeoutController.abort(), 30000); // 30s timeout
 *
 * const handle = connector.query('SELECT * FROM large_table', {
 *   signal: timeoutController.signal
 * });
 *
 * // User can still cancel manually
 * cancelButton.onclick = () => timeoutController.abort();
 * ```
 *
 * ### 🏗️ Signal Composition
 * Combine multiple cancellation sources:
 * ```typescript
 * function combineSignals(...signals: AbortSignal[]): AbortSignal {
 *   const controller = new AbortController();
 *   signals.forEach(signal => {
 *     if (signal.aborted) controller.abort();
 *     else signal.addEventListener('abort', () => controller.abort());
 *   });
 *   return controller.signal;
 * }
 *
 * const userSignal = userController.signal;
 * const timeoutSignal = createTimeoutSignal(30000);
 * const combinedSignal = combineSignals(userSignal, timeoutSignal);
 *
 * const handle = connector.query('SELECT * FROM table', { signal: combinedSignal });
 * ```
 */
export interface DuckDbConnector {
  /**
   * Initialize the connector.
   * The function returns a promise that resolves when the connector is initialized.
   * Calling the initialize() function multiple times should not restart the initialization.
   * See BaseDuckDbConnector for an implementation example.
   */
  initialize(): Promise<void>;

  /**
   * Destroy the connector and clean up resources
   */
  destroy(): Promise<void>;

  /**
   * Execute a SQL query without returning a result
   *
   * @param sql SQL query to execute
   * @param options Optional query options including abort signal for coordinated cancellation
   * @returns QueryHandle containing:
   * - result: Promise that resolves when execution completes
   * - cancel: Method to cancel the query with cleanup
   * - signal: AbortSignal for composability with other cancellable operations
   *
   * @example
   * ```typescript
   * // Simple execution
   * const handle = connector.execute('CREATE TABLE test AS SELECT * FROM source');
   * await handle.result;
   *
   * // With external cancellation control
   * const controller = new AbortController();
   * const handle = connector.execute('DROP TABLE large_table', {
   *   signal: controller.signal
   * });
   *
   * // Cancel if it takes too long
   * setTimeout(() => controller.abort(), 5000);
   * ```
   */
  execute(sql: string, options?: QueryOptions): QueryHandle;

  /**
   * Execute a SQL query and return the result as an Arrow table
   *
   * @param query SQL query to execute
   * @param options Optional query options including abort signal for coordinated cancellation
   * @returns QueryHandle containing:
   * - result: Promise that resolves with Arrow table
   * - cancel: Method to cancel the query with cleanup
   * - signal: AbortSignal for composability with other cancellable operations
   *
   * @example
   * ```typescript
   * // Basic query
   * const handle = await connector.query('SELECT * FROM users WHERE active = true');
   * console.log(`Found ${table.numRows} active users`);
   *
   * // Query with timeout
   * const controller = new AbortController();
   * setTimeout(() => controller.abort(), 30000); // 30s timeout
   *
   * const handle = connector.query('SELECT * FROM very_large_table', {
   *   signal: controller.signal
   * });
   *
   * try {
   *   const result = await handle;
   *   console.log('Query completed within timeout');
   * } catch (error) {
   *   if (error.name === 'AbortError') {
   *     console.log('Query timed out');
   *   }
   * }
   * ```
   */
  query<T extends TypeMap = any>(
    query: string,
    options?: QueryOptions,
  ): QueryHandle<arrow.Table<T>>;

  /**
   * Execute a SQL query and return the result as a JSON object
   *
   * @param query SQL query to execute
   * @param options Optional query options including abort signal for coordinated cancellation
   * @returns QueryHandle containing:
   * - result: Promise that resolves with iterable of JSON objects
   * - cancel: Method to cancel the query with cleanup
   * - signal: AbortSignal for composability with other cancellable operations
   *
   * @example
   * ```typescript
   * // Simple JSON query
   * const users = await connector.queryJson('SELECT name, email FROM users LIMIT 10');
   * for (const user of users) {
   *   console.log(`${user.name}: ${user.email}`);
   * }
   *
   * // Coordinated cancellation with multiple operations
   * const operationController = new AbortController();
   *
   * const usersHandle = connector.queryJson('SELECT * FROM users', {
   *   signal: operationController.signal
   * });
   *
   * const ordersHandle = connector.queryJson('SELECT * FROM orders', {
   *   signal: operationController.signal
   * });
   *
   * // Cancel both queries if user navigates away
   * window.addEventListener('beforeunload', () => {
   *   operationController.abort();
   * });
   * ```
   */
  queryJson<T = Record<string, any>>(
    query: string,
    options?: QueryOptions,
  ): QueryHandle<Iterable<T>>;

  /**
   * Load a file into DuckDB and create a table
   * @param fileName - Path to the file to load
   * @param tableName - Name of the table to create
   * @param opts - Load options
   */
  loadFile(
    fileName: string | File,
    tableName: string,
    opts?: LoadFileOptions,
  ): Promise<void>;

  /**
   * Load an arrow table or an arrow IPC stream into DuckDB
   * @param table - Arrow table or arrow IPC stream to load
   * @param tableName - Name of the table to create
   */
  loadArrow(
    table: arrow.Table | Uint8Array,
    tableName: string,
    opts?: {schema?: string},
  ): Promise<void>;

  /**
   * Load JavaScript objects into DuckDB
   * @param data - Array of objects to load
   * @param tableName - Name of the table to create
   * @param opts - Load options
   */
  loadObjects(
    data: Record<string, unknown>[],
    tableName: string,
    opts?: StandardLoadOptions,
  ): Promise<void>;

  /** Internal hook for WebSocket connectors to send control messages */
  sendControlMessage?: (message: any) => void;

  /** Internal hook to add notification listeners on WebSocket connectors */
  addNotificationListener?: (fn: (payload: any) => void) => void;
}
