# Header Weighting in Embeddings

## Overview

Header weighting gives markdown headers more influence in the embedding vectors by repeating them multiple times in the chunk text before generating embeddings.

## How It Works

When a markdown document is chunked, each section's header can be prepended to the chunk text. By repeating the header multiple times, it occupies more tokens in the chunk, giving it proportionally more weight in the final embedding vector.

### Example

**Original markdown:**
```markdown
# Authentication

Authentication is handled via JWT tokens.
Users must include the token in the Authorization header.
```

**With `header_weight=3`:**
```
Authentication
Authentication
Authentication

Authentication is handled via JWT tokens.
Users must include the token in the Authorization header.
```

This makes the embedding vector heavily weighted toward "Authentication", improving retrieval for queries like:
- "How do I authenticate?"
- "What is the authentication method?"
- "Authentication setup"

## Configuration

### Python API

```python
from sqlrooms_rag import prepare_embeddings

# Default header weight (3x)
prepare_embeddings("docs/", "kb.duckdb")

# Higher header weight for better header-based retrieval
prepare_embeddings("docs/", "kb.duckdb", header_weight=5)

# Lower header weight
prepare_embeddings("docs/", "kb.duckdb", header_weight=1)

# Disable header weighting
prepare_embeddings("docs/", "kb.duckdb", include_headers_in_chunks=False)
```

### CLI

```bash
# Default (3x weight)
prepare-embeddings docs/ -o kb.duckdb

# Custom weight
prepare-embeddings docs/ -o kb.duckdb --header-weight 5

# Disable header weighting
prepare-embeddings docs/ -o kb.duckdb --no-header-weighting
```

## Choosing the Right Weight

| Weight | Use Case |
|--------|----------|
| 1 | Minimal header emphasis, content-focused retrieval |
| 3 | **Default** - Balanced header and content retrieval |
| 5 | Strong header emphasis for documentation/API references |
| 7-10 | Maximum header weight for highly structured docs |

## Trade-offs

**Benefits:**
- Better retrieval for header-based queries
- Improved semantic matching for topic searches
- Helps with hierarchical document navigation

**Considerations:**
- Increases chunk token count (may reduce content per chunk)
- Very high weights (>10) may over-emphasize headers
- Not needed for documents without clear header structure

## Performance Impact

Header weighting adds negligible overhead during embedding preparation:
- No additional API calls or embeddings generated
- Only increases text length within each chunk
- Final database size remains similar

