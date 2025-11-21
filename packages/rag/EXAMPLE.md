# RAG Example Usage

This example shows how to set up and use the RAG (Retrieval Augmented Generation) slice in a SQLRooms application.

## Complete Example

```typescript
import {createRoomStore} from '@sqlrooms/room-shell';
import {createDuckDbSlice} from '@sqlrooms/duckdb';
import {createRagSlice, EmbeddingResult} from '@sqlrooms/rag';

// 1. Create store with RAG slice
const store = createRoomStore({
  config: {
    name: 'rag-demo',
  },
  slices: [
    createDuckDbSlice(),
    createRagSlice({
      embeddingsDatabases: [
        {
          databaseFilePathOrUrl: '/embeddings/sqlrooms_docs.duckdb',
          databaseName: 'sqlrooms_docs',
        },
      ],
    }),
  ],
});

// 2. Initialize DuckDB and RAG
async function initializeApp() {
  await store.getState().db.initialize();
  await store.getState().rag.initialize();
  console.log('✓ RAG initialized');
}

// 3. Example: Search with OpenAI embeddings
async function searchWithOpenAI(query: string): Promise<EmbeddingResult[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: query,
    }),
  });

  const data = await response.json();
  const embedding = data.data[0].embedding;

  return store.getState().rag.queryEmbeddings(embedding, {
    topK: 5,
  });
}

// 4. Example: Search with a custom API
async function searchWithCustomAPI(query: string): Promise<EmbeddingResult[]> {
  // Your embedding service
  const embeddingResponse = await fetch('/api/embed', {
    method: 'POST',
    body: JSON.stringify({text: query}),
  });

  const {embedding} = await embeddingResponse.json();

  return store.getState().rag.queryEmbeddings(embedding, {
    topK: 10,
    databases: ['sqlrooms_docs'], // Optional: search specific DB
  });
}

// 5. Example: Display results in React component
function SearchResults({results}: {results: EmbeddingResult[]}) {
  return (
    <div>
      <h2>Search Results ({results.length})</h2>
      {results.map((result, i) => (
        <div key={result.nodeId} className="result">
          <div className="score">
            Score: {(result.score * 100).toFixed(1)}%
          </div>
          <div className="text">{result.text.slice(0, 200)}...</div>
          {result.metadata?.file_name && (
            <div className="source">Source: {result.metadata.file_name}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// 6. Example: React component with search
function DocumentSearch() {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<EmbeddingResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const searchResults = await searchWithCustomAPI(query);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        placeholder="Search documentation..."
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>
      {results.length > 0 && <SearchResults results={results} />}
    </div>
  );
}

// 7. Main app initialization
async function main() {
  await initializeApp();

  // Example searches
  const results1 = await searchWithCustomAPI('What is SQLRooms?');
  console.log('Found:', results1.length, 'results');

  const results2 = await searchWithCustomAPI('How to use DuckDB?');
  console.log('Found:', results2.length, 'results');

  // List attached databases
  const databases = store.getState().rag.listDatabases();
  console.log('Attached databases:', databases);
}
```

## Server-side Embedding Endpoint Example

Here's an example Next.js API route for generating embeddings:

```typescript
// pages/api/embed.ts
import {OpenAI} from 'openai';
import type {NextApiRequest, NextApiResponse} from 'next';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'});
  }

  const {text} = req.body;

  if (!text) {
    return res.status(400).json({error: 'Text is required'});
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    const embedding = response.data[0].embedding;

    res.status(200).json({embedding});
  } catch (error) {
    console.error('Embedding generation failed:', error);
    res.status(500).json({error: 'Failed to generate embedding'});
  }
}
```

## Using Transformers.js (Client-side)

For fully client-side search without a server:

```typescript
import {pipeline, env} from '@xenova/transformers';

// Configure transformers.js
env.allowLocalModels = false;

let embedder: any = null;

async function initializeEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

async function searchClientSide(query: string) {
  const model = await initializeEmbedder();

  // Generate embedding (runs in browser using WASM)
  const output = await model(query, {
    pooling: 'mean',
    normalize: true,
  });

  const embedding = Array.from(output.data);

  // Query the vector database
  return store.getState().rag.queryEmbeddings(embedding, {
    topK: 5,
  });
}
```

## RAG with LLM Integration

Combine search results with an LLM for full RAG:

```typescript
async function answerQuestion(question: string): Promise<string> {
  // 1. Search for relevant context
  const results = await searchWithOpenAI(question);

  // 2. Build context from top results
  const context = results
    .slice(0, 3)
    .map((r) => r.text)
    .join('\n\n');

  // 3. Call LLM with context
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Answer based on the provided context.',
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// Usage
const answer = await answerQuestion('How do I get started with SQLRooms?');
console.log('Answer:', answer);
```

## Multi-Database Search

Search across multiple embedding databases:

```typescript
const store = createRoomStore({
  config: {name: 'multi-db-rag'},
  slices: [
    createDuckDbSlice(),
    createRagSlice({
      embeddingsDatabases: [
        {
          databaseFilePathOrUrl: '/embeddings/docs.duckdb',
          databaseName: 'docs',
        },
        {
          databaseFilePathOrUrl: '/embeddings/api.duckdb',
          databaseName: 'api',
        },
        {
          databaseFilePathOrUrl: '/embeddings/examples.duckdb',
          databaseName: 'examples',
        },
      ],
    }),
  ],
});

// Search all databases
const allResults = await store.getState().rag.queryEmbeddings(embedding);

// Search specific databases
const docsOnly = await store.getState().rag.queryEmbeddings(embedding, {
  databases: ['docs'],
});

const docsAndApi = await store.getState().rag.queryEmbeddings(embedding, {
  databases: ['docs', 'api'],
});
```

## Caching for Performance

Add caching to avoid redundant embedding generation:

```typescript
const embeddingCache = new Map<string, number[]>();

async function generateEmbeddingWithCache(text: string): Promise<number[]> {
  const cacheKey = text.toLowerCase().trim();

  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  const embedding = await generateEmbedding(text);
  embeddingCache.set(cacheKey, embedding);

  return embedding;
}

async function searchWithCache(query: string) {
  const embedding = await generateEmbeddingWithCache(query);
  return store.getState().rag.queryEmbeddings(embedding);
}
```

## Error Handling

Robust error handling example:

```typescript
async function safeSearch(query: string): Promise<EmbeddingResult[]> {
  try {
    // Validate query
    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    // Generate embedding
    const embedding = await generateEmbedding(query);

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding generated');
    }

    // Query database
    const results = await store.getState().rag.queryEmbeddings(embedding, {
      topK: 10,
    });

    return results;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not initialized')) {
        // Retry with initialization
        await store.getState().rag.initialize();
        return safeSearch(query);
      }
    }

    console.error('Search failed:', error);
    throw error;
  }
}
```
