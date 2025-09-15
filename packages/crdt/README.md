# @sqlrooms/crdt

Generic CRDT utilities for SQLRooms with Yjs integration.

## createCrdtSlice

Create a slice for a SQLRooms/Zustand room store that mirrors selected parts of the state into one or more Yjs documents, and exposes an API to apply remote updates.

```ts
import {createCrdtSlice} from '@sqlrooms/crdt';

// Default mirrors state.config into a single doc named "config"
createCrdtSlice();

// Or select multiple docs
createCrdtSlice({
  selector: (state) => ({
    canvas: (state as any).config.canvas,
    ai: (state as any).config.ai,
  }),
});
```

APIs under `state.crdt`:

- `docs`: Map of key -> Y.Doc
- `applyRemoteUpdate(key, update)`
- `getDoc(key)`
- `encodeDocAsUpdate(key)`
- `teardown()`

This package focuses on Yjs doc management. Networking, awareness, and persistence are provided by higher-level packages.
