# Query Cancellation in DuckDbConnector

The DuckDbConnector now supports query cancellation through a unified `QueryHandle` interface with full composability support. All query methods (`execute`, `query`, `queryJson`) now return a `QueryHandle` that provides immediate access to cancellation functionality and signal composability.

## QueryHandle Interface

```typescript
interface QueryOptions {
  signal?: AbortSignal; // Optional external abort signal
}

// Promise-like intersection – can be awaited directly *or* via .result
type QueryHandle<T = any> = PromiseLike<T> & {
  result: Promise<T>; // Underlying promise (kept for backwards-compatibility)
  cancel: () => Promise<void>; // Method to cancel the query
  signal: AbortSignal; // Read-only abort signal for composability
};
```

## Usage Examples

### Basic Query with Cancellation

```typescript
import {createWasmDuckDbConnector} from './connectors/createDuckDbConnector';

const connector = createWasmDuckDbConnector();
await connector.initialize();

// Start a query and get immediate access to cancellation
const queryHandle = connector.query('SELECT * FROM large_table');
console.log('Query started');

// Cancel the query if needed (e.g., user clicks cancel button)
setTimeout(() => {
  queryHandle.cancel();
}, 5000);

try {
  const result = await queryHandle;
  console.log('Query completed:', result.numRows);
} catch (error) {
  console.log('Query was cancelled or failed:', error.message);
}
```

### Composable Cancellation - Multiple Queries with Shared Controller

```typescript
// Create a master abort controller for a series of operations
const masterController = new AbortController();

// Start multiple queries that can all be cancelled together
const query1 = connector.query('SELECT COUNT(*) FROM table1', {
  signal: masterController.signal,
});
const query2 = connector.query('SELECT AVG(price) FROM products', {
  signal: masterController.signal,
});
const query3 = connector.queryJson('SELECT * FROM users LIMIT 100', {
  signal: masterController.signal,
});

// Cancel all queries at once
setTimeout(() => {
  console.log('Cancelling all queries...');
  masterController.abort(); // This cancels all three queries
}, 3000);

try {
  const results = await Promise.allSettled([query1, query2, query3]);

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`Query ${index + 1} completed`);
    } else {
      console.log(`Query ${index + 1} failed:`, result.reason.message);
    }
  });
} catch (error) {
  console.log('Error in query execution:', error.message);
}
```

### Integration with Other Cancellable Operations

```typescript
// Create a shared abort controller for the entire operation
const operationController = new AbortController();

async function performComplexOperation() {
  try {
    // Step 1: Run a query
    const queryHandle = connector.query(
      'SELECT id, data FROM source_table WHERE condition = ?',
      {signal: operationController.signal},
    );

    const queryResult = await queryHandle;

    // Step 2: Make HTTP requests using the same signal
    const response = await fetch('/api/process-data', {
      method: 'POST',
      body: JSON.stringify(queryResult),
      signal: operationController.signal, // Same signal!
    });

    // Step 3: Another query with the same cancellation
    const finalQuery = connector.execute(
      'INSERT INTO results SELECT * FROM processed_data',
      {signal: operationController.signal},
    );

    await finalQuery;
    console.log('Complex operation completed');
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Operation was cancelled');
    } else {
      console.log('Operation failed:', error.message);
    }
  }
}

// Start the operation
performComplexOperation();

// Cancel the entire operation (queries + HTTP requests) after 10 seconds
setTimeout(() => {
  operationController.abort();
}, 10000);
```

### Advanced Signal Composition

```typescript
// Create timeout-based cancellation
function createTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// Combine multiple signals
function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  signals.forEach((signal) => {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort());
    }
  });

  return controller.signal;
}

// Usage: Query with both user cancellation and timeout
const userController = new AbortController();
const timeoutSignal = createTimeoutSignal(30000); // 30 second timeout
const combinedSignal = combineSignals(userController.signal, timeoutSignal);

const queryHandle = connector.query('SELECT * FROM very_large_table', {
  signal: combinedSignal,
});

// User can still cancel manually
document.getElementById('cancel-btn').onclick = () => {
  userController.abort();
};

try {
  const result = await queryHandle;
  console.log('Query completed within timeout');
} catch (error) {
  console.log('Query cancelled or timed out:', error.message);
}
```

### Listening to Cancellation Events

```typescript
const queryHandle = connector.query('SELECT * FROM table');

// Listen for cancellation
queryHandle.signal.addEventListener('abort', () => {
  console.log('Query was cancelled');
  // Update UI, clean up resources, etc.
});

// Check if already cancelled
if (queryHandle.signal.aborted) {
  console.log('Query was already cancelled');
}

// Cancel after some condition
if (someCondition) {
  await queryHandle.cancel();
}
```

## Migration from Old API

### Before (Old API)

```typescript
const {data, qid} = await connector.query('SELECT * FROM table');
console.log('Query ID:', qid);
console.log('Results:', data.numRows);
```

### After (New API)

```typescript
// Simple usage (no external signal)
const queryHandle = connector.query('SELECT * FROM table');
console.log('Query started');
const data = await queryHandle;
console.log('Results:', data.numRows);

// With external cancellation control
const controller = new AbortController();
const queryHandle = connector.query('SELECT * FROM table', {
  signal: controller.signal,
});
// controller.abort() to cancel
const data = await queryHandle;
```

## Implementation Notes

- **Hybrid Approach**: Combines the simplicity of `.cancel()` with the composability of `AbortSignal`
- **Optional External Control**: Pass your own `AbortSignal` for coordinated cancellation across multiple operations
- **Automatic Internal Management**: If no signal is provided, one is created internally
- **Signal Chaining**: External signals are chained to internal controllers for proper cleanup
- **Web Standards Compliant**: Uses standard `AbortController`/`AbortSignal` APIs
- **Composable**: Signals can be shared across queries, HTTP requests, and other cancellable operations
- **Event-Driven**: Listen for abort events to update UI or perform cleanup
