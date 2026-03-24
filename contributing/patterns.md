# Patterns

> When: writing or reviewing code that touches state, queries, or configs.

## Always Use `produce()` for State Updates

All state mutations must go through Immer's `produce()`. Never mutate state directly.

```typescript
// Correct
set((state) =>
  produce(state, (draft) => {
    draft.db.tables.push(newTable);
  }),
);

// Incorrect — will not trigger re-renders
set((state) => {
  state.db.tables.push(newTable);
  return state;
});
```

## Zustand Selectors for Performance

Select only what you need to avoid unnecessary re-renders:

```typescript
// Memoized, efficient — re-renders only when tables change
const tables = useRoomStore((state) => state.db.tables);

// Avoid unless you truly need the full store
const {db} = useRoomStore();
```

## Lifecycle Management

- Slices auto-initialize via `room.initialize()` on mount
- Clean up resources (subscriptions, timers) in the slice's `destroy()` method
- DuckDB connector is auto-created during initialization — don't create it manually

## Query Cancellation

`QueryHandle` supports `AbortSignal`:

```typescript
const handle = await db.executeSql(query);
handle.cancel(); // aborts query execution
```

## Schema Validation with Zod

All configs use Zod schemas. Always derive the TypeScript type from the schema:

```typescript
const MyConfigSchema = z.object({
  tableName: z.string(),
  limit: z.number().optional(),
});

type MyConfig = z.infer<typeof MyConfigSchema>;
```

## Arrow as the Data Format

The browser↔DuckDB boundary uses Apache Arrow serialization. When working with query results, expect `Table` objects from the `apache-arrow` package, not plain JS arrays.
