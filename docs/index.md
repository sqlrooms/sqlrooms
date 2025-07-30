---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'SQLRooms'
  text: 'Build data-centric apps with DuckDB'
  tagline: An Open Source React Framework for Single-Node Data Analytics powered by DuckDB
  actions:
    - theme: brand
      text: What is SQLRooms?
      link: /overview
    - theme: alt
      text: Key Concepts
      link: /key-concepts
    - theme: alt
      text: Example Apps
      link: /examples
    # - theme: alt
    #   text: View on GitHub
    #   link: https://github.com/sqlrooms/sqlrooms
  image:
    # Must be in the public/ directory (see https://github.com/vuejs/vitepress/issues/4097#issuecomment-2261203743)
    src: /media/sqlrooms-ai.webp
    alt: SQLRooms AI

features:
  - title: Local Analytics, No Backend Required
    details: Leverage DuckDB's powerful SQL capabilities, enabling fast in browser data processing without a backend
  - title: Own Your Data
    details: Data remains on your local device for maximum privacy, sub-second analytics on large datasets, and offline functionality
  - title: Privacy-Preserving AI Integration
    details: Use agents that can write and execute SQL queries, and generate insights without sharing your data with model providers
  - title: Modular Architecture
    details: Pick and choose the functionality you need for composable, extensible applications, with integrations for popular data visualization libraries.
  - title: Modern UI Components
    details: Comprehensive set of React components including data tables, layouts, and visualization tools for building beautiful analytics interfaces
  - title: Offline Use
    details: Work with your data, run queries, and analyze results even without an internet connection. SQLRooms supports offline workflows using persistent storage via OPFS.
---

## Get Started in Minutes

Set up a simple room that loads and queries a single data table:

```tsx
const {roomStore, useRoomStore} = createRoomStore((set, get, store) => ({
  ...createRoomShellSlice({
    config: {
      dataSources: [
        {
          type: 'url',
          tableName: 'earthquakes',
          url: 'https://.../earthquakes.parquet',
        },
      ],
    },
  })(set, get, store),
}));

export const MyRoom = () => (
  <RoomShell roomStore={roomStore}>
    <MyComponent />
  </RoomShell>
);

function MyComponent() {
  const isTableReady = useRoomStore((state) =>
    Boolean(state.db.findTableByName('earthquakes')),
  );
  const queryResult = useSql<{maxMagnitude: number}>({
    query: `SELECT max(Magnitude) AS maxMagnitude FROM earthquakes`,
    enabled: isTableReady,
  });
  if (!isTableReady) return `Loading…`;
  const row = queryResult.data?.toArray()[0];
  return `Max earthquake magnitude: ${row?.maxMagnitude}`;
}
```

[Complete example on GitHub →](https://github.com/sqlrooms/examples/tree/main/minimal)

That's it! You've just built an app with a flexible store and UI that can be extended with various analytics, visualization and AI modules — all powered by client-side DuckDB with no backend required.

For a more comprehensive guide, see [Key Concepts](/key-concepts) and the [Getting Started](/getting-started) page.
