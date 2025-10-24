# RAG Scripts

Utility scripts for working with embedding databases.

## Installation

Install with visualization dependencies:

```bash
cd python/rag
uv pip install -e ".[viz]"
```

Or manually install dependencies:

```bash
uv pip install umap-learn pyarrow pandas
```

## Scripts

### `generate-umap-embeddings` - Generate 2D UMAP Visualizations

Generate UMAP embeddings from a DuckDB embeddings database for visualization purposes.

**What it does:**

- Reads embeddings from a `.duckdb` file
- Applies UMAP dimensionality reduction to create a 2D projection
- Extracts titles from markdown frontmatter
- Extracts filenames from metadata JSON
- Saves results as a Parquet file

**Output columns:**

- `title` - Extracted from markdown frontmatter or file name
- `fileName` - Extracted from metadata JSON (e.g., "AiModelParameters")
- `text` - Full document text
- `x`, `y` - UMAP coordinates for 2D visualization

#### Usage

**Basic usage:**

```bash
# Generate UMAP from embeddings database
uv run generate-umap-embeddings generated-embeddings/duckdb_docs.duckdb

# Output: generated-embeddings/duckdb_docs_umap.parquet
```

**Custom output:**

```bash
uv run generate-umap-embeddings embeddings.duckdb --output my_visualization.parquet
```

**Custom UMAP parameters:**

```bash
# More neighbors = more global structure
uv run generate-umap-embeddings embeddings.duckdb --n-neighbors 30

# Smaller min-dist = tighter clusters
uv run generate-umap-embeddings embeddings.duckdb --min-dist 0.05

# Combine parameters
uv run generate-umap-embeddings embeddings.duckdb \
  --n-neighbors 30 \
  --min-dist 0.05 \
  --random-state 123
```

**Preview mode:**

```bash
# Process only first 100 documents for quick testing
uv run generate-umap-embeddings embeddings.duckdb --preview 100
```

#### UMAP Parameters

- `--n-neighbors` (default: 15)
  - Controls how UMAP balances local vs global structure
  - Smaller values (5-10): More local structure, tighter clusters
  - Larger values (30-50): More global structure, preserves overall shape
- `--min-dist` (default: 0.1)
  - Minimum distance between points in the embedding
  - Smaller values (0.0-0.05): Points cluster more tightly
  - Larger values (0.1-0.5): Points spread out more
- `--random-state` (default: 42)
  - Random seed for reproducibility
  - Use same value for consistent results

#### Example Output

```bash
$ uv run generate-umap-embeddings generated-embeddings/duckdb_docs.duckdb

🚀 UMAP Embedding Generator
================================================================================
Input:  generated-embeddings/duckdb_docs.duckdb
Output: generated-embeddings/duckdb_docs_umap.parquet
================================================================================

📂 Loading embeddings from generated-embeddings/duckdb_docs.duckdb...
   Schema: 4 columns
✓ Loaded 1842 documents

🔄 Processing embeddings...
   Converting embeddings to numpy array...
🗺️  Generating UMAP embeddings...
   n_neighbors: 15
   min_dist: 0.1
   Input shape: (1842, 384)
✓ Generated UMAP embeddings: (1842, 2)

📝 Extracting metadata...
   Processed 100/1842 documents...
   Processed 200/1842 documents...
   ...
✓ Processed 1842 documents

💾 Saving to generated-embeddings/duckdb_docs_umap.parquet...
✓ Saved 1842 rows to generated-embeddings/duckdb_docs_umap.parquet
   File size: 2.34 MB

================================================================================
✅ Success!
================================================================================

Sample data:
                title                fileName                                               text         x         y
0  Window Functions      window_functions  # Window Functions\n\nWindow functions perform...  -5.234    8.123
1       JSON Support        json_functions  # Working with JSON\n\nDuckDB has extensive su...   3.456   -2.789
2      S3 Integration      s3_integration  # Amazon S3 Integration\n\nDuckDB can read and...   1.234    5.678
...

Columns: ['title', 'fileName', 'text', 'x', 'y']
Shape: (1842, 5)

Coordinate ranges:
  x: [-15.23, 18.45]
  y: [-12.67, 14.89]
```

#### Visualizing the Results

Once you have the Parquet file, you can visualize it in many ways:

**Python (Matplotlib):**

```python
import pandas as pd
import matplotlib.pyplot as plt

# Load data
df = pd.read_parquet('duckdb_docs_umap.parquet')

# Create scatter plot
plt.figure(figsize=(12, 8))
plt.scatter(df['x'], df['y'], alpha=0.5, s=10)

# Add labels for some points
for idx in range(min(20, len(df))):
    plt.annotate(
        df.iloc[idx]['title'],
        (df.iloc[idx]['x'], df.iloc[idx]['y']),
        fontsize=8,
        alpha=0.7
    )

plt.title('DuckDB Documentation UMAP')
plt.xlabel('UMAP 1')
plt.ylabel('UMAP 2')
plt.tight_layout()
plt.savefig('umap_visualization.png', dpi=300)
plt.show()
```

**Python (Plotly - Interactive):**

```python
import pandas as pd
import plotly.express as px

df = pd.read_parquet('duckdb_docs_umap.parquet')

fig = px.scatter(
    df,
    x='x',
    y='y',
    hover_data=['title', 'fileName'],
    hover_name='title',
    title='DuckDB Documentation UMAP',
)

fig.update_traces(marker=dict(size=5, opacity=0.6))
fig.write_html('umap_interactive.html')
fig.show()
```

**JavaScript (with DuckDB-WASM):**

```typescript
import * as duckdb from '@duckdb/duckdb-wasm';
import * as Plot from '@observablehq/plot';

// Load parquet file
const conn = await duckdb.connect();
await conn.query(
  `CREATE TABLE umap AS SELECT * FROM 'duckdb_docs_umap.parquet'`,
);
const result = await conn.query('SELECT * FROM umap');
const data = result.toArray();

// Create plot
const plot = Plot.plot({
  marks: [
    Plot.dot(data, {
      x: 'x',
      y: 'y',
      title: (d) => `${d.title}\n${d.fileName}`,
      fill: 'steelblue',
      fillOpacity: 0.6,
    }),
  ],
  width: 800,
  height: 600,
});

document.body.appendChild(plot);
```

#### Use Cases

1. **Explore document clusters** - See which documents are semantically similar
2. **Quality check embeddings** - Verify that similar documents cluster together
3. **Interactive documentation browser** - Build visual navigation interfaces
4. **Content gap analysis** - Identify under-documented areas
5. **Similarity visualization** - Show relationships between topics

#### Troubleshooting

**Out of memory:**

```bash
# Use preview mode for large datasets
uv run generate-umap-embeddings embeddings.duckdb --preview 1000
```

**UMAP too slow:**

```bash
# Reduce n_neighbors for faster computation
uv run generate-umap-embeddings embeddings.duckdb --n-neighbors 5
```

**Points too clustered:**

```bash
# Increase min_dist
uv run generate-umap-embeddings embeddings.duckdb --min-dist 0.3
```

**Points too spread out:**

```bash
# Decrease min_dist
uv run generate-umap-embeddings embeddings.duckdb --min-dist 0.01
```

---

## Related Documentation

- [Python Package README](../README.md)
- [Examples](../examples/README.md)
- [UMAP Documentation](https://umap-learn.readthedocs.io/)
