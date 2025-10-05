import {FileSystemTree} from '@webcontainer/api';

export const editableFilePath = '/src/App.jsx';
export const editableFileContents = `
import {createDuckDbSlice, useSql} from '@sqlrooms/duckdb';
import {createRoomSlice, createRoomStore, RoomStateProvider} from '@sqlrooms/room-store';

const {roomStore, useRoomStore} = createRoomStore(
  (set, get, store) => ({
    ...createRoomSlice()(set, get, store),
    ...createDuckDbSlice({})(set, get, store),
  }),
);


function MyRoom() {
  const queryResult = useSql({
    query: \`SELECT 'Hello, world!' as message\`,
  });
  const row = queryResult.data?.toArray()[0];
  return row ? \`Message: \${row.message}\` : 'Loading...';
}

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>SQLRooms in WebContainer</h1>
      <RoomStateProvider roomStore={roomStore}>
        <MyRoom />
      </RoomStateProvider>
    </div>
  )
}
`;

export const INITIAL_FILES_TREE: FileSystemTree = {
  'package.json': {
    file: {
      contents: `{
  "name": "vite-react-webcontainer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 5173"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@sqlrooms/room-store": "v0.26.0-rc.0",
    "@sqlrooms/duckdb": "v0.26.0-rc.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0"
  }
}`,
    },
  },
  'index.html': {
    file: {
      contents: `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
  </html>`,
    },
  },
  'vite.config.js': {
    file: {
      contents: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 }
});`,
    },
  },
  src: {
    directory: {
      'main.jsx': {
        file: {
          contents: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`,
        },
      },
      'App.jsx': {
        file: {
          contents: editableFileContents,
        },
      },
    },
  },
};
