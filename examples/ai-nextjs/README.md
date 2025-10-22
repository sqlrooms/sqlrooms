# SQLRooms AI Next.js Demo App

This example demonstrates how to use the SQLRooms AI module with Next.js, showcasing both client-side and server-side integration using Vercel AI SDK v5.

## Features

- **Server-side AI Processing**: Chat requests are handled by a Next.js API route (`app/api/chat/route.ts`) using Vercel AI SDK v5
- **Client-side AI Interface**: Uses SQLRooms AI components for a rich chat experience
- **Hybrid Tool System**: Demonstrates both server-side tools (web search) and client-side tools (weather)
- **Session Management**: Supports multiple conversation sessions with persistence
- **Model Configuration**: Easily switch between different AI models and providers
- **Theme Support**: Built-in dark/light theme switching

## Architecture

### Client-Side

The client-side code is similar to the `ai-core` example but configured to use a server endpoint:

- `app/store.ts`: Creates the room store with AI slice, pointing to `/api/chat` endpoint
- `components/main-view.tsx`: Main UI with chat interface and settings panel
- `components/WebSearchToolResult.tsx`: Custom component for displaying web search tool results
- `app/lib/tools.ts`: Defines both client-side and server-side tools using OpenAssistant utils

### Server-Side

- `app/api/chat/route.ts`: Next.js API route that handles chat requests using Vercel AI SDK v5
  - Uses `createOpenAICompatible` for flexible model support
  - Implements hybrid tool system (server-side web search + client-side weather)
  - Streams responses back to the client using `createUIMessageStream`
  - Sends tool results back to the client via message annotations

## Getting Started

### Prerequisites

- Node.js >= 22
- OpenAI API key (or other supported AI provider)
- pnpm package manager

### Installation

From the repository root, install dependencies:

```bash
pnpm install
```

Navigate to the example directory:

```bash
cd examples/ai-nextjs
```

Create a `.env.local` file with your API key:

```bash
OPENAI_API_KEY=your-api-key-here
```

**Note**: The API key is only used server-side and never exposed to the client.

### Running the App

Build all SQLRooms packages (from repository root):

```bash
pnpm build
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser

## Key Differences from ai-core Example

The main difference from the `ai-core` example is that this uses a **hybrid server-client architecture** for AI processing:

- In `ai-core`: AI processing happens entirely in the browser
- In `ai-nextjs`: AI processing happens on the server via the `/api/chat` endpoint

This approach:

- ✅ Keeps API keys secure (they never leave the server)
- ✅ Supports both server-side and client-side tools
- ✅ Reduces client-side bundle size
- ✅ Better performance for complex operations

## Customization

### Adding Custom Tools

To add your own tools, modify the `app/lib/tools.ts` file:

1. **Server-side tools**: Add to `serverTools` array - these execute on the server
2. **Client-side tools**: Add to `clientTools` array - these execute in the browser

Both tool types are automatically registered with the AI system through the `getServerAiSDKTools()` and `getClientTools()` functions.

### Using Different AI Models

Models are configured in `config.ts` and can be selected through the UI. The API route uses `createOpenAICompatible` to support various model providers:

```typescript
const modelClient = createOpenAICompatible({
  apiKey: process.env.OPENAI_API_KEY,
  name: modelProvider, // e.g., 'openai', 'anthropic', etc.
  baseURL: 'https://api.openai.com/v1',
});
const languageModel = modelClient.chatModel(model);
```

### Customizing the UI

The main UI components are in the `components/` directory:

- `main-view.tsx`: Main chat interface
- `app-shell.tsx`: Application shell wrapper
- `WebSearchToolResult.tsx`: Custom tool result display component

## Learn More

- [SQLRooms Documentation](https://sqlrooms.dev)
- [Vercel AI SDK v5](https://sdk.vercel.ai)
- [Next.js Documentation](https://nextjs.org/docs)
- [OpenAssistant Utils](https://github.com/openassistant/utils) - Tool system utilities
