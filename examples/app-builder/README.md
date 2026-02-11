### [AI App Builder](https://sqlrooms-ai.netlify.app/)

[Github repo](https://github.com/sqlrooms/examples/tree/main/app-builder)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/app-builder?embed=1&file=src/main.tsx)

<video src="/media/examples/sqlrooms-ai-app-builder-2x.mp4" alt="SQLRooms AI App builder" width="450"  controls loop muted></video>

A SQLRooms app that builds SQLRooms apps—demonstrating recursive bootstrapping. The outer app runs an AI assistant on the left and a code editor in the middle, while the right third hosts the inner app which compiles on the fly and executes in a browser-based virtual environment powered by [StackBlitz WebContainers](https://github.com/stackblitz/webcontainer-core).

Features:

- AI-assisted app generation via [SQLRooms AI assistant](/api/ai/)
- Live code editing with instant preview
- In-browser compilation and execution (no server required, except for the model)
- Recursive bootstrapping pattern

To create a new project from this example:

```bash
npx giget gh:sqlrooms/examples/app-builder my-new-app/
```

#### Running locally

```sh
npm install
npm run dev
```
