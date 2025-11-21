# Embedding Providers Guide

## Overview

The `@sqlrooms/rag` package provides `createAiEmbeddingProvider()` - a generic function that works with any provider from the Vercel AI SDK. This allows you to use OpenAI, Google, Anthropic, or any custom provider with a consistent API.

## Installation

```bash
npm install @sqlrooms/rag ai @ai-sdk/openai
# Or for Google
npm install @sqlrooms/rag ai @ai-sdk/google
```

## Basic Usage

```typescript
import {createAiEmbeddingProvider} from '@sqlrooms/rag';
import {openai} from '@ai-sdk/openai';

const embeddingProvider = createAiEmbeddingProvider(
  openai,                      // Provider instance
  'text-embedding-3-small',    // Model ID
  1536                         // Dimensions (optional)
);
```

## Supported Providers

### OpenAI

```typescript
import {openai} from '@ai-sdk/openai';
import {createAiEmbeddingProvider} from '@sqlrooms/rag';

// text-embedding-3-small (1536d)
const provider = createAiEmbeddingProvider(
  openai,
  'text-embedding-3-small',
  1536,
);

// text-embedding-3-small with reduced dimensions (512d)
const provider512 = createAiEmbeddingProvider(
  openai,
  'text-embedding-3-small',
  512,
);

// text-embedding-3-large (3072d)
const providerLarge = createAiEmbeddingProvider(
  openai,
  'text-embedding-3-large',
  3072,
);

// Legacy ada-002 (1536d)
const providerAda = createAiEmbeddingProvider(
  openai,
  'text-embedding-ada-002',
  1536,
);
```

**API Key**: Set `OPENAI_API_KEY` environment variable or pass via `openai.apiKey`.

**Pricing** (as of 2024):
- text-embedding-3-small: $0.02 / 1M tokens
- text-embedding-3-large: $0.13 / 1M tokens

### Google

```typescript
import {google} from '@ai-sdk/google';
import {createAiEmbeddingProvider} from '@sqlrooms/rag';

// text-embedding-004 (768d)
const provider = createAiEmbeddingProvider(
  google,
  'text-embedding-004',
  768,
);

// Older models
const provider003 = createAiEmbeddingProvider(
  google,
  'embedding-001',
  768,
);
```

**API Key**: Set `GOOGLE_GENERATIVE_AI_API_KEY` environment variable.

**Pricing** (as of 2024):
- text-embedding-004: Free (rate limited)

### Anthropic

Anthropic doesn't currently provide embedding models, but you can use their completion models with OpenAI or Google embeddings.

### Custom Providers

You can create a custom provider that implements the `AiProvider` interface:

```typescript
import {createAiEmbeddingProvider, type AiProvider} from '@sqlrooms/rag';

// Custom provider that implements the interface
const myProvider: AiProvider = {
  textEmbeddingModel(modelId: string, settings?: {dimensions?: number}) {
    return {
      // Your custom implementation
      // Must be compatible with Vercel AI SDK's embed() function
    };
  },
};

const embeddingProvider = createAiEmbeddingProvider(
  myProvider,
  'my-custom-model',
  512,
);
```

## Complete Example

```typescript
import {createRagSlice, createAiEmbeddingProvider} from '@sqlrooms/rag';
import {openai} from '@ai-sdk/openai';
import {google} from '@ai-sdk/google';

// Set API keys in environment
// OPENAI_API_KEY=sk-...
// GOOGLE_GENERATIVE_AI_API_KEY=...

const embeddingsDatabases = [
  {
    databaseName: 'duckdb_docs',
    databaseFilePathOrUrl: './embeddings/duckdb_openai.duckdb',
    // Prepared with OpenAI text-embedding-3-small
    embeddingProvider: createAiEmbeddingProvider(
      openai,
      'text-embedding-3-small',
      1536,
    ),
    embeddingDimensions: 1536,
  },
  {
    databaseName: 'react_docs',
    databaseFilePathOrUrl: './embeddings/react_google.duckdb',
    // Prepared with Google text-embedding-004
    embeddingProvider: createAiEmbeddingProvider(
      google,
      'text-embedding-004',
      768,
    ),
    embeddingDimensions: 768,
  },
];

const store = createRoomStore({
  slices: [
    createRagSlice({embeddingsDatabases}),
    // ... other slices
  ],
});
```

## Matching Database Models

**Critical**: The embedding provider MUST match the model used when preparing the database.

### Check Database Metadata

```typescript
const metadata = await store.getState().rag.getMetadata('duckdb_docs');
console.log(metadata);
// {
//   provider: 'openai',
//   model: 'text-embedding-3-small',
//   dimensions: 1536,
//   chunkingStrategy: 'markdown-aware'
// }
```

### Create Matching Provider

```typescript
import {openai} from '@ai-sdk/openai';
import {createAiEmbeddingProvider} from '@sqlrooms/rag';

// Match the metadata
const embeddingProvider = createAiEmbeddingProvider(
  openai,                           // Provider matches 'openai'
  metadata.model,                   // Model matches
  metadata.dimensions               // Dimensions match
);
```

## Preparing Databases

Use the Python `sqlrooms_rag` package to prepare databases with different providers:

### OpenAI

```bash
python -m sqlrooms_rag.cli prepare-embeddings \
  docs/ \
  -o embeddings/docs_openai.duckdb \
  --provider openai \
  --model text-embedding-3-small \
  --embed-dim 1536 \
  --api-key $OPENAI_API_KEY
```

### HuggingFace (Local)

```bash
python -m sqlrooms_rag.cli prepare-embeddings \
  docs/ \
  -o embeddings/docs_local.duckdb \
  --provider huggingface \
  --model BAAI/bge-small-en-v1.5 \
  --embed-dim 384
```

**Note**: For HuggingFace models, you'll need to implement a custom provider or use a different client-side embedding solution (like Transformers.js) since the Vercel AI SDK doesn't currently support HuggingFace embeddings.

## Provider Comparison

| Provider | Model | Dimensions | Cost | Speed | Quality |
|----------|-------|-----------|------|-------|---------|
| OpenAI | text-embedding-3-small | 1536 | $0.02/1M | Fast | Excellent |
| OpenAI | text-embedding-3-small | 512 | $0.02/1M | Very Fast | Good |
| OpenAI | text-embedding-3-large | 3072 | $0.13/1M | Moderate | Best |
| Google | text-embedding-004 | 768 | Free | Fast | Excellent |

## Best Practices

### 1. Consistent Models

Always use the same model for preparation and querying:

```typescript
// ❌ Wrong - different models
// Prepared with: text-embedding-3-small
embeddingProvider: createAiEmbeddingProvider(
  openai,
  'text-embedding-3-large',  // Different model!
  3072
)

// ✅ Correct - same model
embeddingProvider: createAiEmbeddingProvider(
  openai,
  'text-embedding-3-small',  // Same model
  1536
)
```

### 2. Dimension Matching

Ensure dimensions match exactly:

```typescript
// ❌ Wrong - different dimensions
// Prepared with 1536 dimensions
embeddingProvider: createAiEmbeddingProvider(
  openai,
  'text-embedding-3-small',
  512  // Different dimensions!
)

// ✅ Correct - same dimensions
embeddingProvider: createAiEmbeddingProvider(
  openai,
  'text-embedding-3-small',
  1536  // Same dimensions
)
```

### 3. Environment Variables

Use environment variables for API keys:

```bash
# .env
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

```typescript
// No need to pass API keys explicitly
const embeddingProvider = createAiEmbeddingProvider(
  openai,  // Uses OPENAI_API_KEY automatically
  'text-embedding-3-small',
  1536,
);
```

### 4. Cost Optimization

For lower costs:
- Use smaller dimensions (512 vs 1536)
- Use Google (free tier)
- Cache embeddings when possible

```typescript
// Reduced dimensions = lower cost + faster
const embeddingProvider = createAiEmbeddingProvider(
  openai,
  'text-embedding-3-small',
  512,  // 3x faster, same cost per token
);
```

### 5. Error Handling

Always handle errors gracefully:

```typescript
try {
  const results = await store.getState().rag.queryByText('query');
} catch (error) {
  if (error.message.includes('dimension mismatch')) {
    // Check database metadata and update provider
  } else if (error.message.includes('API key')) {
    // Check environment variables
  }
  console.error('RAG query failed:', error);
}
```

## Troubleshooting

### "Failed to generate embedding"

**Cause**: API key missing or invalid

**Solution**: Check environment variables:
```bash
echo $OPENAI_API_KEY
echo $GOOGLE_GENERATIVE_AI_API_KEY
```

### "Dimension mismatch"

**Cause**: Query embedding dimensions don't match database

**Solution**: Check database metadata and update provider:
```typescript
const metadata = await store.getState().rag.getMetadata('docs');
const embeddingProvider = createAiEmbeddingProvider(
  openai,
  metadata.model,
  metadata.dimensions
);
```

### Poor Search Results

**Causes**:
1. Wrong embedding model
2. Different model versions
3. Database prepared with different settings

**Solution**: Re-prepare database with matching settings:
```bash
python -m sqlrooms_rag.cli prepare-embeddings \
  docs/ \
  -o embeddings/docs.duckdb \
  --provider openai \
  --model text-embedding-3-small \
  --embed-dim 1536 \
  --overwrite
```

## See Also

- [RAG Package README](./README.md)
- [RAG Tool Guide](./RAG_TOOL.md)
- [Python Package Docs](../../python/rag/README.md)
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
