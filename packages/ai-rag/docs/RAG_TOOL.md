# RAG Tool for AI Assistants

## Overview

The `createRagTool()` function creates an AI tool that enables semantic search through documentation and knowledge bases. When integrated with the AI slice, the assistant can search through embedded documentation to provide accurate, context-aware responses.

## Setup

### 1. Install Dependencies

```bash
npm install @sqlrooms/ai-rag @sqlrooms/ai openai
```

### 2. Prepare Embedding Database

First, prepare your documentation using the Python `sqlrooms_rag` package:

```bash
pip install sqlrooms-rag

python -m sqlrooms_rag.cli prepare-embeddings \
  docs/ \
  -o embeddings/docs.duckdb \
  --provider openai \
  --model text-embedding-3-small \
  --embed-dim 1536
```

### 3. Create Embedding Provider

Create a helper to generate embeddings (must match the model used during preparation):

```typescript
// src/embeddings.ts
import OpenAI from 'openai';
import type {EmbeddingProvider} from '@sqlrooms/ai-rag';

export function createOpenAIEmbeddingProvider(
  apiKey: string,
  model = 'text-embedding-3-small',
  dimensions = 1536,
): EmbeddingProvider {
  const client = new OpenAI({apiKey, dangerouslyAllowBrowser: true});

  return async (text: string) => {
    const response = await client.embeddings.create({
      model,
      input: text,
      dimensions,
    });
    return response.data[0].embedding;
  };
}
```

### 4. Configure Store

```typescript
// src/store.ts
import {createAiSlice} from '@sqlrooms/ai';
import {createRagSlice, createRagTool} from '@sqlrooms/ai-rag';
import {createOpenAIEmbeddingProvider} from './embeddings';

const {roomStore, useRoomStore} = createRoomStore({
  slices: [
    // 1. Add RAG slice
    createRagSlice({
      embeddingsDatabases: [
        {
          databaseFilePathOrUrl: './embeddings/docs.duckdb',
          databaseName: 'docs',
          embeddingProvider: createOpenAIEmbeddingProvider(
            process.env.OPENAI_API_KEY!,
          ),
          embeddingDimensions: 1536,
        },
      ],
    }),

    // 2. Add AI slice with RAG tool
    createAiSlice({
      tools: {
        // Add the RAG tool
        search_documentation: createRagTool(),

        // ... other tools
      },
    }),
  ],
});

// Make store globally available for tools
(globalThis as any).__ROOM_STORE__ = roomStore;

export {roomStore, useRoomStore};
```

## How It Works

### Tool Interface

The RAG tool is exposed to the AI as `search_documentation` with the following parameters:

```typescript
{
  query: string;        // The search query
  database?: string;    // Which database to search (optional)
  topK?: number;        // Number of results (default: 5, max: 20)
}
```

### Example AI Usage

When a user asks a question, the AI can decide to search documentation:

**User**: "How do I create a table in DuckDB?"

**AI Internal Process**:

1. Recognizes this requires DuckDB knowledge
2. Calls `search_documentation` tool:
   ```json
   {
     "query": "create table syntax DuckDB",
     "database": "duckdb_docs",
     "topK": 5
   }
   ```
3. Receives relevant documentation chunks
4. Synthesizes answer using retrieved context

**AI Response**: Based on the documentation, you can create a table in DuckDB using...

### Tool Output

The tool returns formatted results:

```typescript
{
  success: true,
  query: "create table syntax",
  database: "duckdb_docs",
  results: [
    {
      text: "CREATE TABLE statement creates...",
      score: 0.892,
      metadata: {file_path: "docs/sql/create.md"}
    },
    // ... more results
  ],
  context: "Formatted context for LLM",
  details: "Found 5 relevant documents in duckdb_docs"
}
```

## Multiple Databases

You can configure multiple documentation databases:

```typescript
createRagSlice({
  embeddingsDatabases: [
    {
      databaseName: 'duckdb_docs',
      databaseFilePathOrUrl: './embeddings/duckdb.duckdb',
      embeddingProvider: createOpenAIEmbeddingProvider(...),
      embeddingDimensions: 1536,
    },
    {
      databaseName: 'react_docs',
      databaseFilePathOrUrl: './embeddings/react.duckdb',
      embeddingProvider: createOpenAIEmbeddingProvider(...),
      embeddingDimensions: 1536,
    },
  ],
})
```

The AI will automatically search the appropriate database:

- Question about DuckDB → searches `duckdb_docs`
- Question about React → searches `react_docs`
- If unspecified → searches default (first) database

## Customizing the Tool

### Custom Description

You can modify the tool description to guide the AI:

```typescript
const ragTool = createRagTool();
ragTool.description = `Search DuckDB documentation for SQL syntax, functions, and features.
Use this for questions about:
- SQL syntax (CREATE, SELECT, INSERT, etc.)
- Built-in functions
- Extensions and features
- Performance optimization`;
```

### Custom Result Rendering

The tool includes a default React component for displaying results. You can customize it:

```typescript
import {createRagTool} from '@sqlrooms/ai-rag';

const ragTool = createRagTool();
ragTool.component = CustomRagResultComponent;
```

## Best Practices

### 1. Match Embedding Models

**Critical**: The embedding provider MUST match the model used during database preparation.

```typescript
// ✅ Correct - same model
// Prepared with: text-embedding-3-small (1536d)
embeddingProvider: createOpenAIEmbeddingProvider(
  apiKey,
  'text-embedding-3-small',
  1536,
);

// ❌ Wrong - different model
embeddingProvider: createOpenAIEmbeddingProvider(
  apiKey,
  'text-embedding-3-large',
  3072,
);
```

### 2. Descriptive Tool Names

Use clear tool names that help the AI understand when to use them:

```typescript
tools: {
  search_duckdb_docs: createRagTool(),  // Clear purpose
  search_api_reference: createRagTool(), // Specific scope
}
```

### 3. Reasonable topK Values

- **Small queries**: `topK: 3-5` (specific answers)
- **Exploratory queries**: `topK: 10-15` (broad context)
- **Maximum**: `topK: 20` (tool enforces this limit)

### 4. Guide the AI

Add context to your AI system instructions:

```typescript
createAiSlice({
  getInstructions: () => `
    You are an AI assistant with access to DuckDB documentation.
    
    When users ask about DuckDB:
    1. Use the search_documentation tool to find relevant information
    2. Synthesize the retrieved information into a clear answer
    3. Cite the documentation when possible
    
    Always search documentation before answering technical questions.
  `,
  tools: {
    search_documentation: createRagTool(),
  },
});
```

## Troubleshooting

### Tool Not Found

**Error**: "Tool search_documentation not found"

**Solution**: Ensure you're adding the tool to the AI slice:

```typescript
createAiSlice({
  tools: {
    search_documentation: createRagTool(), // Add this
  },
});
```

### Store Not Available

**Error**: "Store not available"

**Solution**: Make the store globally available:

```typescript
(globalThis as any).__ROOM_STORE__ = roomStore;
```

### Dimension Mismatch

**Error**: "Dimension mismatch: query has X dimensions, but database expects Y"

**Solution**: Check your database metadata and ensure the embedding provider matches:

```typescript
// Check database metadata
const metadata = await store.getState().rag.getMetadata('docs');
console.log(metadata); // {dimensions: 1536, model: 'text-embedding-3-small', ...}

// Use matching provider
embeddingProvider: createOpenAIEmbeddingProvider(
  apiKey,
  metadata.model, // Match the model
  metadata.dimensions, // Match the dimensions
);
```

### No Results

If searches return no results:

1. **Verify database**: Check if the database file exists and is not empty
2. **Check initialization**: Ensure `rag.initialize()` was called (automatic with tool)
3. **Test queries**: Try broader search terms
4. **Inspect data**: Use SQL to verify embeddings exist:
   ```sql
   SELECT COUNT(*) FROM docs.documents;
   ```

## Example Queries

### Good Queries

- ✅ "How to create a table in DuckDB"
- ✅ "DuckDB JSON functions"
- ✅ "Window functions syntax"
- ✅ "Performance optimization tips"

### Poor Queries

- ❌ "table" (too vague)
- ❌ "help" (too general)
- ❌ "DuckDB" (no specific question)

## Advanced: Custom Tool Logic

You can wrap `createRagTool()` with custom logic:

```typescript
function createSmartRagTool() {
  const baseTool = createRagTool();

  return {
    ...baseTool,
    execute: async (params) => {
      // Pre-process query
      const enhancedQuery = enhanceQuery(params.query);

      // Call base tool
      const result = await baseTool.execute({
        ...params,
        query: enhancedQuery,
      });

      // Post-process results
      if (result.llmResult.success) {
        result.llmResult.results = filterResults(result.llmResult.results);
      }

      return result;
    },
  };
}
```

## See Also

- [RAG Package README](../README.md) - Full RAG package documentation
- [Embedding Preparation](../../../python/rag/README.md) - Python tools for preparing embeddings
- [AI Tools Guide](../../ai/TOOLS.md) - General guide to AI tools
