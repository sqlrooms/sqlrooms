# @sqlrooms/app-runtime

`@sqlrooms/app-runtime` defines the iframe runtime bridge used by generated
HTML apps in SQLRooms. It owns the protocol between a sandboxed app iframe and
the SQLRooms host; it does not own project authoring, bundling, or WebContainer
startup.

## Runtime Scope

The first supported app surface is the `html-app` stateful block. The same
bridge contract can also be reused by artifact shells and WebContainer previews,
but the block remains the durable v1 state model.

The app-facing API is intentionally small:

```js
const result = await window.sqlrooms.query(
  'select region, sum(revenue) as revenue from sales group by region',
);
console.log(result.rows);
```

TypeScript apps may use the client entrypoint:

```ts
import {createAppClient} from '@sqlrooms/app-runtime/client';

const app = createAppClient();
const result = await app.query('select * from sales limit 100');
```

## Threat Model

Generated apps are treated as untrusted code. They run in a sandboxed iframe and
must not receive direct access to DuckDB connectors, the room store, filesystem
APIs, host DOM nodes, command execution, or mutation-capable host services.

The host grants explicit capabilities and handles every request. The initial
capability set is deliberately narrow:

- read-only `query`
- optional table/schema discovery
- optional initial data payloads

The v1 runtime explicitly excludes:

- write queries
- filesystem access
- host DOM access
- room store mutation
- command execution
- network access as an app-runtime capability

Read-only query handling starts with `state.db.sqlSelectToJson` as the SQL
classification gate. Hosts should additionally enforce single-statement input,
row limits, timeout handling, and JSON-serializable result bounds before data
crosses into the iframe.

## Relation To WebContainer

`@sqlrooms/webcontainer` answers how a generated project is authored, edited,
built, and served. `@sqlrooms/app-runtime` answers what a rendered app can ask
the SQLRooms host to do.

WebContainer previews can attach the same host bridge to their preview iframe,
and generated Vite apps can import the client entrypoint or use an injected
`window.sqlrooms` global. WebContainer should not grow its own separate data
bridge.
