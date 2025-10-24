# Text Query Options - Quick Reference

## Summary: 3 Ways to Query with Text

### Option 1: Configure Provider at Creation ✅ Recommended

```typescript
import {createRagSlice, type EmbeddingProvider} from '@sqlrooms/rag';

const embeddingProvider: EmbeddingProvider = async (text) => {
  // Your embedding generation logic
  const embedding = await generateEmbedding(text);
  return embedding;
};

const store = createRoomStore({
  slices: [
    createRagSlice({
      embeddingsDatabases: [{...}],
      embeddingProvider, // 👈 Configure here
    }),
  ],
});

// Now you can query with text
const results = await store.getState().rag.queryByText('query text');
```

### Option 2: Set Provider Dynamically

```typescript
const store = createRoomStore({
  slices: [
    createRagSlice({
      embeddingsDatabases: [{...}],
      // No provider initially
    }),
  ],
});

// Set provider after store creation
store.getState().rag.setEmbeddingProvider(async (text) => {
  const embedding = await generateEmbedding(text);
  return embedding;
});

// Now you can query
const results = await store.getState().rag.queryByText('query text');
```

### Option 3: Generate Embeddings Manually

```typescript
const store = createRoomStore({
  slices: [
    createRagSlice({
      embeddingsDatabases: [{...}],
      // No provider needed
    }),
  ],
});

// Generate embedding yourself
const embedding = await yourEmbeddingFunction('query text');

// Use queryEmbeddings() instead of queryByText()
const results = await store.getState().rag.queryEmbeddings(embedding);
```

---

## How to Calculate Embeddings from Query Text

The key is implementing an `EmbeddingProvider` function:

```typescript
type EmbeddingProvider = (text: string) => Promise<number[]>;
```

Here are the most common implementations:

### 1. OpenAI API (Most Common)

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const embeddingProvider: EmbeddingProvider = async (text) => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });

  return response.data[0].embedding;
};
```

**Pros:** High quality, reliable, production-ready  
**Cons:** Costs money, requires API key  
**Dimensions:** 1536

### 2. Transformers.js (Client-Side, Free!)

```typescript
import {pipeline} from '@xenova/transformers';

let embedder: any = null;

const embeddingProvider: EmbeddingProvider = async (text) => {
  if (!embedder) {
    // Lazy load model (cached after first use)
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  const output = await embedder(text, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
};
```

**Pros:** Free, runs in browser, no server needed, offline-capable  
**Cons:** First load downloads ~25MB model  
**Dimensions:** 384

### 3. Custom API Endpoint

```typescript
const embeddingProvider: EmbeddingProvider = async (text) => {
  const response = await fetch('/api/embeddings', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text}),
  });

  if (!response.ok) {
    throw new Error('Failed to generate embedding');
  }

  const {embedding} = await response.json();
  return embedding;
};
```

**Pros:** Full control, can hide API keys  
**Cons:** Need to implement server endpoint

### 4. Cohere API

```typescript
import {CohereClient} from 'cohere-ai';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

const embeddingProvider: EmbeddingProvider = async (text) => {
  const response = await cohere.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
  });

  return response.embeddings[0];
};
```

**Pros:** Good quality, affordable  
**Cons:** Requires API key

### 5. HuggingFace Inference API

```typescript
import {HfInference} from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

const embeddingProvider: EmbeddingProvider = async (text) => {
  const response = await hf.featureExtraction({
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    inputs: text,
  });

  return Array.from(response as number[]);
};
```

**Pros:** Many models available, free tier  
**Cons:** Rate limits, requires API key

---

## Complete Example: OpenAI Provider

```typescript
import {createRoomStore} from '@sqlrooms/room-shell';
import {createDuckDbSlice} from '@sqlrooms/duckdb';
import {createRagSlice, type EmbeddingProvider} from '@sqlrooms/rag';
import OpenAI from 'openai';

// 1. Create OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. Define embedding provider
const embeddingProvider: EmbeddingProvider = async (text) => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;
};

// 3. Create store with provider
export const store = createRoomStore({
  config: {name: 'rag-app'},
  slices: [
    createDuckDbSlice(),
    createRagSlice({
      embeddingsDatabases: [
        {
          databaseFilePath: './embeddings/docs.duckdb',
          databaseName: 'docs',
        },
      ],
      embeddingProvider, // 👈 Pass provider
    }),
  ],
});

// 4. Initialize
await store.getState().db.initialize();
await store.getState().rag.initialize();

// 5. Query with text!
const results = await store
  .getState()
  .rag.queryByText('How do I use window functions in DuckDB?', {topK: 5});

console.log(results);
// [
//   {score: 0.85, text: "...", nodeId: "...", metadata: {...}},
//   {score: 0.82, text: "...", nodeId: "...", metadata: {...}},
//   ...
// ]
```

---

## Complete Example: Transformers.js (No Server!)

```typescript
import {createRoomStore} from '@sqlrooms/room-shell';
import {createDuckDbSlice} from '@sqlrooms/duckdb';
import {createRagSlice, type EmbeddingProvider} from '@sqlrooms/rag';
import {pipeline} from '@xenova/transformers';

// 1. Create embedder (lazy-loaded)
let embedder: any = null;

// 2. Define embedding provider
const embeddingProvider: EmbeddingProvider = async (text) => {
  if (!embedder) {
    console.log('Loading embedding model...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Model loaded!');
  }

  const output = await embedder(text, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
};

// 3. Create store with provider
export const store = createRoomStore({
  config: {name: 'rag-app'},
  slices: [
    createDuckDbSlice(),
    createRagSlice({
      embeddingsDatabases: [
        {
          databaseFilePath: './embeddings/docs.duckdb',
          databaseName: 'docs',
        },
      ],
      embeddingProvider, // 👈 Pass provider
    }),
  ],
});

// 4. Initialize
await store.getState().db.initialize();
await store.getState().rag.initialize();

// 5. Query with text - works entirely in browser!
const results = await store
  .getState()
  .rag.queryByText('How do I use window functions in DuckDB?', {topK: 5});

console.log(results);
```

---

## Important: Embedding Dimension Compatibility

⚠️ **Critical:** Your query embeddings must match your database embeddings!

When preparing embeddings with Python:

```bash
# Using BAAI/bge-small-en-v1.5 (384 dimensions)
prepare-embeddings ./docs -o docs.duckdb --model BAAI/bge-small-en-v1.5
```

Your TypeScript provider must use a **compatible model**:

✅ **Correct:**

```typescript
// Both use 384-dimensional embeddings
const embeddingProvider: EmbeddingProvider = async (text) => {
  // Use the SAME model or compatible dimensions
  const embedder = await pipeline(
    'feature-extraction',
    'Xenova/bge-small-en-v1.5', // 384 dims - matches Python!
  );
  // ...
};
```

❌ **Incorrect:**

```typescript
// Different dimensions won't work!
const embeddingProvider: EmbeddingProvider = async (text) => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002', // 1536 dims - mismatch!
    input: text,
  });
  return response.data[0].embedding;
};
```

**Common embedding dimensions:**

- `BAAI/bge-small-en-v1.5`: **384**
- `all-MiniLM-L6-v2`: **384**
- `all-mpnet-base-v2`: **768**
- `text-embedding-ada-002` (OpenAI): **1536**

---

## When to Use Each Method

| Method                | Best For        | Use Case                                            |
| --------------------- | --------------- | --------------------------------------------------- |
| **queryByText()**     | Most users      | Simple text queries, automatic embedding generation |
| **queryEmbeddings()** | Advanced users  | Full control, batch processing, custom logic        |
| **OpenAI Provider**   | Production apps | High quality, reliable, don't mind API costs        |
| **Transformers.js**   | Privacy/offline | Free, client-side, no server needed                 |
| **Custom API**        | Enterprise      | Hide API keys, custom logic, multi-tenant           |

---

## Related Documentation

- **[EMBEDDING_PROVIDERS.md](./EMBEDDING_PROVIDERS.md)** - Detailed provider examples
- **[README.md](./README.md)** - Main package documentation
- **[EXAMPLE.md](./EXAMPLE.md)** - Complete integration examples
