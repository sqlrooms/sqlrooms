# SQLRooms AI Next.js Demo App

This example demonstrates how to use the SQLRooms AI module with Next.js, showcasing both client-side and server-side integration.

## Features

- **Server-side AI Processing**: Chat requests are handled by a Next.js API route (`app/api/chat/route.ts`) using Vercel AI SDK v5
- **Client-side AI Interface**: Uses SQLRooms AI components for a rich chat experience
- **Custom Tools**: Includes a toy web search tool to demonstrate tool calling
- **Session Management**: Supports multiple conversation sessions with persistence
- **Model Configuration**: Easily switch between different AI models and providers

## Architecture

### Client-Side

The client-side code is similar to the `ai-core` example but configured to use a server endpoint:

- `app/store.ts`: Creates the room store with AI slice, pointing to `/api/chat` endpoint
- `components/main-view.tsx`: Main UI with chat interface and settings panel
- `components/WebSearchToolResult.tsx`: Custom component for displaying web search tool results

### Server-Side

- `app/api/chat/route.ts`: Next.js API route that handles chat requests using Vercel AI SDK v5
  - Implements the `webSearch` tool as a demonstration
  - Streams responses back to the client
  - Sends tool results back to the client via message annotations

## Getting Started

### Prerequisites

- Node.js >= 22
- OpenAI API key (or other supported AI provider)

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

## Usage

Click the settings icon to configure your AI provider and model, enter your API key in the provider settings, select a model from the dropdown, and start chatting! Try asking it to search the web.

Example prompts:

- "Search the web for the latest news on AI"
- "What can you tell me about machine learning?"
- "Use the web search tool to find information about Next.js"

## Key Differences from ai-core Example

The main difference from the `ai-core` example is that this uses a **server-side endpoint** for AI processing:

- In `ai-core`: AI processing happens entirely in the browser
- In `ai-nextjs`: AI processing happens on the server via the `/api/chat` endpoint

This approach:

- ✅ Keeps API keys secure (they never leave the server)
- ✅ Can use server-side only tools and data
- ✅ Can implement caching and rate limiting
- ✅ Reduces client-side bundle size

## Customization

### Adding Custom Tools

To add your own tools, modify both:

1. **Client-side** (`app/store.ts`): Add tool definition in `createAiSlice` tools object
2. **Server-side** (`app/api/chat/route.ts`): Add the actual tool implementation

### Using Different AI Models

Update the model in `app/api/chat/route.ts`:

```typescript
const result = streamText({
  model: openai('gpt-4o-mini'), // or any other supported model
  // ...
});
```

## Learn More

- [SQLRooms Documentation](https://sqlrooms.dev)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Next.js Documentation](https://nextjs.org/docs)
