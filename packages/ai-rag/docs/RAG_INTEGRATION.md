# RAG Integration - Complete Setup Guide

This document describes the complete RAG (Retrieval Augmented Generation) integration for SQLRooms AI applications.

## Overview

The RAG system enables AI assistants to search through documentation and knowledge bases using semantic search, providing accurate, context-aware responses based on embedded documentation.

### Key Advantages

- **Provider-Agnostic**: Uses Vercel AI SDK - works with OpenAI, Google, Anthropic, or custom providers
- **Secure**: API keys handled automatically via environment variables
- **Type-Safe**: Full TypeScript support with proper type inference
- **Per-Database Providers**: Each database can use a different embedding model
- **Metadata Validation**: Automatic dimension and model compatibility checking
- **Zero Configuration**: No need for `dangerouslyAllowBrowser` or manual API client setup

## Architecture

```
┌─────────────────────┐
│   User Question     │
│ "How to create a    │
│  table in DuckDB?"  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   AI Assistant      │
│  (Claude, GPT-4)    │
└──────────┬──────────┘
           │
           │ Decides to search docs
           ▼
┌─────────────────────┐
│  search_documentation│
│      Tool           │
└──────────┬──────────┘
           │
           │ Generates embedding
           ▼
┌─────────────────────┐
│ Embedding Provider  │
│  (OpenAI API)       │
└──────────┬──────────┘
           │
           │ Query vector
           ▼
┌─────────────────────┐
│   RAG Slice         │
│  (Vector Search)    │
└──────────┬──────────┘
           │
           │ Cosine similarity
           ▼
┌─────────────────────┐
│  DuckDB Database    │
│  (Embeddings)       │
└──────────┬──────────┘
           │
           │ Top-K results
           ▼
┌─────────────────────┐
│  Formatted Context  │
│  (Documentation)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   AI Response       │
│  "To create a table │
│   use CREATE TABLE  │
│   statement..."     │
└─────────────────────┘
```

## Components

### 1. Python Preparation Tool

Located in `python/rag/`:

- **Purpose**: Prepare embedding databases from markdown documentation
- **Package**: `sqlrooms-rag`
- **Functions**:
  - Chunk documents intelligently (markdown-aware)
  - Generate embeddings (OpenAI, HuggingFace)
  - Store in DuckDB with metadata
  - Create FTS index for hybrid search

### 2. TypeScript RAG Package

Located in `packages/rag/`:

- **`RagSlice.ts`**: Zustand slice for RAG state management
- **`createRagTool.tsx`**: AI tool for semantic search
- **`createAiEmbeddingProvider.ts`**: Generic embedding provider factory
- **Exports**:
  - `createRagSlice()` - State management
  - `createRagTool()` - AI tool
  - `createAiEmbeddingProvider()` - Generic embedding provider
  - Types: `EmbeddingProvider`, `EmbeddingDatabase`, `AiProvider`, etc.

### 3. Embedding Provider Helpers

Located in `examples/ai/src/embeddings.ts`:

- OpenAI wrapper using generic `createAiEmbeddingProvider()`
- Preset configurations (SMALL, SMALL_512, LARGE, etc.)
- Clean API using Vercel AI SDK
- Automatic API key handling from environment

### 4. Store Integration

Located in `examples/ai/src/store.ts`:

- Configure RAG slice with databases
- Add RAG tool to AI
- Make store globally available

## Complete Setup

### Step 1: Prepare Embeddings (Python)

```bash
# Install Python package
pip install sqlrooms-rag

# Prepare embeddings
python -m sqlrooms_rag.cli prepare-embeddings \
  docs/ \
  -o embeddings/docs.duckdb \
  --provider openai \
  --model text-embedding-3-small \
  --embed-dim 1536 \
  --api-key $OPENAI_API_KEY
```

This creates:

- `embeddings/docs.duckdb` - Database with embeddings
- `embeddings/docs.yaml` - Metadata (model, dimensions, stats)

### Step 2: Create Embedding Provider (TypeScript)

```typescript
// src/embeddings.ts
import {openai} from '@ai-sdk/openai';
import {createAiEmbeddingProvider} from '@sqlrooms/ai-rag';
import type {EmbeddingProvider} from '@sqlrooms/ai-rag';

// Generic function - works with any Vercel AI SDK provider
export function createOpenAIEmbeddingProvider(
  model: string = 'text-embedding-3-small',
  dimensions?: number,
): EmbeddingProvider {
  return createAiEmbeddingProvider(openai, model, dimensions);
}

// Preset configurations for convenience
export const OPENAI_EMBEDDING_CONFIGS = {
  SMALL: {model: 'text-embedding-3-small', dimensions: 1536},
  SMALL_512: {model: 'text-embedding-3-small', dimensions: 512},
  LARGE: {model: 'text-embedding-3-large', dimensions: 3072},
  LARGE_1024: {model: 'text-embedding-3-large', dimensions: 1024},
} as const;

export function createOpenAIEmbeddingProviderWithPreset(
  preset: keyof typeof OPENAI_EMBEDDING_CONFIGS,
): EmbeddingProvider {
  const config = OPENAI_EMBEDDING_CONFIGS[preset];
  return createOpenAIEmbeddingProvider(config.model, config.dimensions);
}
```

**Note**: Uses `OPENAI_API_KEY` environment variable automatically via Vercel AI SDK.

### Step 3: Configure Store

```typescript
// src/store.ts
import {createAiSlice} from '@sqlrooms/ai';
import {createRagSlice, createRagTool} from '@sqlrooms/ai-rag';
import {createOpenAIEmbeddingProviderWithPreset} from './embeddings';

const {roomStore, useRoomStore} = createRoomStore({
  slices: [
    // 1. RAG Slice
    // Uses OPENAI_API_KEY environment variable automatically
    createRagSlice({
      embeddingsDatabases: [
        {
          databaseFilePathOrUrl: './embeddings/docs.duckdb',
          databaseName: 'docs',
          embeddingProvider: createOpenAIEmbeddingProviderWithPreset('SMALL'),
          embeddingDimensions: 1536,
        },
      ],
    }),

    // 2. AI Slice with RAG Tool
    createAiSlice({
      tools: {
        search_documentation: createRagTool(),
        // ... other tools
      },
      getInstructions: () => `
        You are an AI assistant with access to documentation.
        Use search_documentation when you need to look up information.
        Always search before answering technical questions.
      `,
    }),
  ],
});

// Make store available for tools
(globalThis as any).__ROOM_STORE__ = roomStore;

export {roomStore, useRoomStore};
```

### Step 4: Set Environment Variables

```bash
# .env or .env.local
OPENAI_API_KEY=sk-...
# Or for Google
GOOGLE_GENERATIVE_AI_API_KEY=...
```

### Step 5: Build and Run

```bash
# Build packages
pnpm build

# Run example
cd examples/ai
pnpm dev
```

The Vercel AI SDK automatically reads API keys from environment variables.

## Usage Examples

### User Interaction

**User**: "How do I create a table in DuckDB?"

**AI Process**:

1. Recognizes need for DuckDB knowledge
2. Calls `search_documentation` tool:
   ```json
   {
     "query": "create table DuckDB syntax",
     "database": "duckdb_docs",
     "topK": 5
   }
   ```
3. Tool generates embedding with OpenAI
4. Searches database with vector similarity
5. Returns top 5 relevant chunks
6. AI synthesizes answer from context

**AI Response**: "To create a table in DuckDB, use the CREATE TABLE statement..."

### Direct API Usage

You can also use RAG programmatically:

```typescript
// Initialize
await store.getState().rag.initialize();

// Search by text
const results = await store
  .getState()
  .rag.queryByText('How to create a table?', {topK: 5, database: 'docs'});

// Search with pre-computed embedding
const embedding = await embeddingProvider('table creation');
const results2 = await store.getState().rag.queryEmbeddings(embedding, {
  topK: 5,
});
```

## Multiple Databases

You can configure multiple databases with different providers:

```typescript
import {openai} from '@ai-sdk/openai';
import {google} from '@ai-sdk/google';
import {createAiEmbeddingProvider} from '@sqlrooms/ai-rag';

createRagSlice({
  embeddingsDatabases: [
    {
      databaseName: 'duckdb_docs',
      databaseFilePathOrUrl: './embeddings/duckdb.duckdb',
      // OpenAI text-embedding-3-small (1536d)
      embeddingProvider: createAiEmbeddingProvider(
        openai,
        'text-embedding-3-small',
        1536,
      ),
      embeddingDimensions: 1536,
    },
    {
      databaseName: 'react_docs',
      databaseFilePathOrUrl: './embeddings/react.duckdb',
      // OpenAI with reduced dimensions (512d) for faster queries
      embeddingProvider: createAiEmbeddingProvider(
        openai,
        'text-embedding-3-small',
        512,
      ),
      embeddingDimensions: 512,
    },
    {
      databaseName: 'python_docs',
      databaseFilePathOrUrl: './embeddings/python.duckdb',
      // Google text-embedding-004 (768d)
      embeddingProvider: createAiEmbeddingProvider(
        google,
        'text-embedding-004',
        768,
      ),
      embeddingDimensions: 768,
    },
  ],
});
```

The AI will search the appropriate database based on context.

## Key Features

### 1. Per-Database Embedding Providers

Each database can use a different embedding model from any Vercel AI SDK provider:

- **OpenAI**: text-embedding-3-small (1536d), text-embedding-3-large (3072d)
- **Google**: text-embedding-004 (768d)
- **Custom**: Any provider implementing the `AiProvider` interface

The generic `createAiEmbeddingProvider()` function works with all providers.

### 2. Metadata Validation

Automatic validation ensures compatibility:

- Checks embedding dimensions
- Verifies model matches
- Warns on mismatches

### 3. Semantic Search

Vector similarity (cosine) finds semantically similar content:

- Better than keyword search
- Understands context and meaning
- Works across different phrasings

### 4. AI Tool Integration

Seamless integration with AI assistants:

- Tool automatically called when needed
- Results formatted for LLM
- UI component for displaying results

### 5. Provider-Agnostic Design

Generic `createAiEmbeddingProvider()` works with any Vercel AI SDK provider:

- **OpenAI** - text-embedding-3-small, text-embedding-3-large
- **Google** - text-embedding-004
- **Anthropic** - (when supported)
- **Custom** - Implement `AiProvider` interface
- No direct SDK dependencies in rag package

## File Structure

```
sqlrooms/
├── packages/
│   └── rag/
│       ├── src/
│       │   ├── RagSlice.ts                   # State management
│       │   ├── createRagTool.tsx             # AI tool
│       │   ├── createAiEmbeddingProvider.ts  # Generic provider
│       │   └── index.ts                      # Exports
│       ├── README.md                         # Package docs
│       ├── RAG_TOOL.md                      # Tool usage guide
│       ├── RAG_INTEGRATION.md               # This file
│       └── EMBEDDING_PROVIDERS.md           # Provider guide
│
├── examples/
│   └── ai/
│       ├── src/
│       │   ├── embeddings.ts        # Provider wrappers
│       │   └── store.ts             # Store configuration
│       └── embeddings/              # Prepared databases
│           └── docs.duckdb
│
└── python/
    └── rag/
        ├── sqlrooms_rag/
        │   ├── prepare/             # Embedding preparation
        │   ├── query.py             # Query utilities
        │   └── cli.py               # CLI interface
        └── README.md                # Python package docs
```

## Best Practices

### 1. Model Consistency

**Always** match the embedding model between preparation and runtime:

```bash
# Preparation
--provider openai --model text-embedding-3-small --embed-dim 1536

# Runtime (must match)
embeddingProvider: createAiEmbeddingProvider(
  openai,
  'text-embedding-3-small',  # Same model
  1536                       # Same dimensions
)
```

### 2. Database Organization

Organize databases by topic:

```typescript
embeddingsDatabases: [
  {databaseName: 'duckdb_docs', ...},  # DuckDB documentation
  {databaseName: 'react_docs', ...},   # React documentation
  {databaseName: 'api_reference', ...}, # API docs
]
```

### 3. Chunking Strategy

For best results:

- Use markdown-aware chunking (`--markdown-chunking`)
- Appropriate chunk size (512-1024 tokens)
- Include header context (`--header-weight 3`)

### 4. AI Instructions

Guide the AI to use the tool effectively:

```typescript
getInstructions: () => `
  When answering questions:
  1. For technical questions, ALWAYS search documentation first
  2. Use specific, descriptive search queries
  3. Cite the documentation in your responses
  4. If no results found, say so clearly
`;
```

## Troubleshooting

### Issue: Tool not found

**Error**: "Tool search_documentation not found"

**Solution**: Add tool to AI slice:

```typescript
tools: {
  search_documentation: createRagTool(),
}
```

### Issue: Dimension mismatch

**Error**: "Dimension mismatch: expected 1536, got 384"

**Solution**: Check database metadata and use matching provider:

```typescript
const metadata = await store.getState().rag.getMetadata('docs');
// Use metadata.model and metadata.dimensions
```

### Issue: No results

**Possible causes**:

1. Database not initialized
2. Query too specific/vague
3. Wrong database selected
4. Embedding model mismatch

**Debug**:

```typescript
// Check databases
console.log(store.getState().rag.listDatabases());

// Check metadata
const metadata = await store.getState().rag.getMetadata('docs');
console.log(metadata);

// Test direct search
const results = await store.getState().rag.queryByText('test', {topK: 1});
console.log(results);
```

## Performance

### Embedding Generation

- OpenAI: ~100ms per query
- Local models: 50-200ms (depends on hardware)
- Caching recommended for repeated queries

### Database Size

- ~1MB per 1000 documents (1536d embeddings)
- Scales to millions of documents
- DuckDB provides fast similarity search

### Query Speed

- Vector search: 10-100ms (depends on database size)
- Results proportional to topK
- Near-instant for databases < 100k documents

## Security

### API Keys

- Store in environment variables (`OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, etc.)
- Never commit to version control
- Vercel AI SDK handles API keys securely from environment variables

### Database Access

- Databases attached as READ_ONLY
- No write access from client
- Safe for public-facing applications

### Browser Security

- Vercel AI SDK manages API calls securely
- No need for `dangerouslyAllowBrowser` flags
- API keys handled through environment configuration

## Next Steps

1. **Prepare your documentation**: Use Python package
2. **Configure store**: Add RAG slice and tool
3. **Test queries**: Verify search results
4. **Tune instructions**: Guide AI usage
5. **Monitor usage**: Track API costs and performance

## Resources

- [RAG Package README](../README.md) - Main package documentation
- [RAG Tool Guide](./RAG_TOOL.md) - AI tool usage guide
- [Embedding Providers Guide](./EMBEDDING_PROVIDERS.md) - Provider setup and comparison
- [Python Package Docs](../../../python/rag/README.md) - Database preparation
- [Example Implementation](../../../examples/ai/src/store.ts) - Working example
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs) - AI SDK documentation
