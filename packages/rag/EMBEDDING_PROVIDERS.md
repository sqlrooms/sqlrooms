# Embedding Provider Examples

This guide shows how to implement embedding providers for the `@sqlrooms/rag` package to enable text-based queries using `queryByText()`.

## Overview

An embedding provider is a function that converts text into a vector embedding:

```typescript
type EmbeddingProvider = (text: string) => Promise<number[]>;
```

## Option 1: Configure at Creation

```typescript
const store = createRoomStore({
  slices: [
    createDuckDbSlice(),
    createRagSlice({
      embeddingsDatabases: [{...}],
      embeddingProvider: async (text) => {
        // Your embedding logic here
        return embedding;
      },
    }),
  ],
});

// Now you can query with text
const results = await store.getState().rag.queryByText('What is a window function?');
```

## Option 2: Set After Creation

```typescript
const store = createRoomStore({
  slices: [
    createDuckDbSlice(),
    createRagSlice({
      embeddingsDatabases: [{...}],
      // No provider initially
    }),
  ],
});

// Set provider later
store.getState().rag.setEmbeddingProvider(async (text) => {
  const embedding = await generateEmbedding(text);
  return embedding;
});

// Now you can query
const results = await store.getState().rag.queryByText('query text');
```

## Option 3: Use Pre-computed Embeddings

```typescript
// No provider needed - generate embeddings yourself
const embedding = await myEmbeddingService(query);
const results = await store.getState().rag.queryEmbeddings(embedding);
```

---

## Implementation Examples

### OpenAI API

```typescript
import OpenAI from 'openai';
import {createRagSlice, type EmbeddingProvider} from '@sqlrooms/rag';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const openaiProvider: EmbeddingProvider = async (text) => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });

  return response.data[0].embedding;
};

// Use in store
createRagSlice({
  embeddingsDatabases: [{...}],
  embeddingProvider: openaiProvider,
});

// Query with text
const results = await store.getState().rag.queryByText(
  'How do I use window functions?'
);
```

**Note:** OpenAI embeddings are 1536-dimensional, so make sure your database embeddings match!

### Transformers.js (Client-side, no server needed!)

```typescript
import {pipeline} from '@xenova/transformers';
import {createRagSlice, type EmbeddingProvider} from '@sqlrooms/rag';

// Initialize model once
let embedder: any = null;

const transformersProvider: EmbeddingProvider = async (text) => {
  // Lazy load the model
  if (!embedder) {
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
    );
  }

  // Generate embedding
  const output = await embedder(text, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
};

// Use in store
createRagSlice({
  embeddingsDatabases: [{...}],
  embeddingProvider: transformersProvider,
});

// Works entirely in the browser!
const results = await store.getState().rag.queryByText('query');
```

**Benefits:**

- ✅ Runs entirely in browser
- ✅ No API costs
- ✅ Works offline
- ✅ Privacy-friendly

**Considerations:**

- First load downloads model (~25MB)
- Model is cached for subsequent uses

### Custom API Endpoint

```typescript
import {type EmbeddingProvider} from '@sqlrooms/rag';

const customApiProvider: EmbeddingProvider = async (text) => {
  const response = await fetch('/api/embeddings', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text}),
  });

  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.statusText}`);
  }

  const {embedding} = await response.json();
  return embedding;
};

createRagSlice({
  embeddingsDatabases: [{...}],
  embeddingProvider: customApiProvider,
});
```

**Example API endpoint (Next.js):**

```typescript
// pages/api/embeddings.ts
import {OpenAI} from 'openai';
import type {NextApiRequest, NextApiResponse} from 'next';

const openai = new OpenAI();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'});
  }

  const {text} = req.body;

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    res.status(200).json({embedding: response.data[0].embedding});
  } catch (error) {
    console.error('Embedding error:', error);
    res.status(500).json({error: 'Failed to generate embedding'});
  }
}
```

### Cohere API

```typescript
import {CohereClient} from 'cohere-ai';
import {type EmbeddingProvider} from '@sqlrooms/rag';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

const cohereProvider: EmbeddingProvider = async (text) => {
  const response = await cohere.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
  });

  return response.embeddings[0];
};

createRagSlice({
  embeddingsDatabases: [{...}],
  embeddingProvider: cohereProvider,
});
```

### Anthropic (Claude with embeddings)

```typescript
// Note: Anthropic doesn't provide embeddings directly
// Use via a proxy or another service

const anthropicProvider: EmbeddingProvider = async (text) => {
  const response = await fetch('https://your-embedding-proxy.com/embed', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({text}),
  });

  const {embedding} = await response.json();
  return embedding;
};
```

### HuggingFace Inference API

```typescript
import {HfInference} from '@huggingface/inference';
import {type EmbeddingProvider} from '@sqlrooms/rag';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

const huggingfaceProvider: EmbeddingProvider = async (text) => {
  const response = await hf.featureExtraction({
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    inputs: text,
  });

  // HuggingFace returns various formats, handle accordingly
  return Array.from(response as number[]);
};

createRagSlice({
  embeddingsDatabases: [{...}],
  embeddingProvider: huggingfaceProvider,
});
```

---

## Advanced Patterns

### Caching Embeddings

```typescript
const embeddingCache = new Map<string, number[]>();

const cachedProvider: EmbeddingProvider = async (text) => {
  const cacheKey = text.toLowerCase().trim();

  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  const embedding = await generateEmbedding(text);
  embeddingCache.set(cacheKey, embedding);

  return embedding;
};
```

### Retry Logic

```typescript
const providerWithRetry: EmbeddingProvider = async (text) => {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await generateEmbedding(text);
    } catch (error) {
      lastError = error as Error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw new Error(`Failed after ${maxRetries} retries: ${lastError?.message}`);
};
```

### Fallback Provider

```typescript
const fallbackProvider: EmbeddingProvider = async (text) => {
  try {
    // Try primary provider
    return await openaiProvider(text);
  } catch (error) {
    console.warn('Primary provider failed, using fallback:', error);
    // Fallback to Transformers.js
    return await transformersProvider(text);
  }
};
```

### Rate Limiting

```typescript
import pLimit from 'p-limit';

const limit = pLimit(5); // Max 5 concurrent requests

const rateLimitedProvider: EmbeddingProvider = async (text) => {
  return limit(() => generateEmbedding(text));
};
```

---

## Complete Example: React Component

```typescript
import {useState} from 'react';
import {useRoomStore} from './store';
import type {EmbeddingResult} from '@sqlrooms/rag';

function DocumentSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EmbeddingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const store = useRoomStore();

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Query directly with text - provider handles embedding generation
      const searchResults = await store.rag.queryByText(query, {
        topK: 10,
      });

      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search documentation..."
          disabled={loading}
        />
        <button onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <div style={{color: 'red'}}>Error: {error}</div>}

      {results.length > 0 && (
        <div>
          <h3>Results ({results.length})</h3>
          {results.map((result) => (
            <div key={result.nodeId}>
              <div>Score: {(result.score * 100).toFixed(1)}%</div>
              <div>{result.text.slice(0, 200)}...</div>
              {result.metadata?.file_name && (
                <small>Source: {result.metadata.file_name}</small>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Choosing the Right Provider

| Provider            | Best For         | Pros                     | Cons                   |
| ------------------- | ---------------- | ------------------------ | ---------------------- |
| **OpenAI**          | Production apps  | High quality, reliable   | Costs $, API required  |
| **Transformers.js** | Privacy, offline | Free, client-side        | Large initial download |
| **Cohere**          | Production apps  | Good quality, affordable | API required           |
| **HuggingFace**     | Experimentation  | Many models, free tier   | Rate limits            |
| **Custom API**      | Enterprise       | Full control             | Need to maintain       |

## Embedding Dimension Compatibility

**Important:** Your query embeddings must match your database embeddings in dimension!

Common dimensions:

- `text-embedding-ada-002` (OpenAI): **1536**
- `BAAI/bge-small-en-v1.5`: **384**
- `all-MiniLM-L6-v2`: **384**
- `all-mpnet-base-v2`: **768**

Make sure to use the **same model** for both:

1. Preparing embeddings (Python `sqlrooms-rag`)
2. Querying embeddings (TypeScript provider)

---

## Migration from queryEmbeddings

**Before:**

```typescript
// Manual embedding generation
const embedding = await generateEmbedding(query);
const results = await store.rag.queryEmbeddings(embedding);
```

**After:**

```typescript
// Automatic embedding generation
const results = await store.rag.queryByText(query);
```

**Both work!** `queryEmbeddings` is still available if you want full control.

---

## Troubleshooting

### "No embedding provider configured"

Configure a provider:

```typescript
store.rag.setEmbeddingProvider(myProvider);
```

### Dimension mismatch errors

Ensure your provider uses the same model dimensions as your database embeddings.

### Slow queries

- Cache embeddings for repeated queries
- Use client-side models (Transformers.js) to avoid network latency
- Batch process multiple queries if possible

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [Examples](./EXAMPLE.md) - Complete integration examples
- [TypeScript API](./src/RagSlice.ts) - Source code and types
