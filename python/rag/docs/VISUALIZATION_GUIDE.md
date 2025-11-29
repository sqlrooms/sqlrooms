# Embedding Visualization Guide

This guide shows you how to visualize your embeddings using UMAP for 2D projections.

## Quick Start

```bash
# 1. Install visualization dependencies
cd python/rag
uv pip install -e ".[viz]"

# 2. Generate UMAP visualization
uv run generate-umap-embeddings generated-embeddings/duckdb_docs.duckdb

# 3. Output is saved as: generated-embeddings/duckdb_docs_umap.parquet
```

## What You Get

The script generates a Parquet file with the following columns:

| Column      | Description                              | Example                                |
| ----------- | ---------------------------------------- | -------------------------------------- |
| `node_id`   | Unique node identifier                   | "node_0001"                            |
| `title`     | Document title from markdown frontmatter | "Window Functions"                     |
| `fileName`  | File name extracted from metadata        | "window_functions"                     |
| `file_path` | Full file path from metadata             | "/path/to/docs/window_functions.md"    |
| `text`      | Full document text                       | "# Window Functions\n\nWindow..."      |
| `x`         | UMAP X coordinate                        | -5.234                                 |
| `y`         | UMAP Y coordinate                        | 8.123                                  |
| `outdegree` | Number of outgoing links                 | 5                                      |
| `indegree`  | Number of incoming links                 | 12                                     |
| `topic`     | Automatically detected topic cluster     | "Window Functions / Aggregate / Query" |

## How It Works

### 1. Title Extraction

The script extracts titles in order of preference:

**a) From YAML frontmatter:**

```markdown
---
title: My Document Title
---

Document content...
```

**b) From first heading:**

```markdown
# My Document Title

Document content...
```

**c) From filename:**
If no title found, uses the filename as fallback.

### 2. Filename Extraction

Extracts filename from the JSON metadata column:

```json
{
  "_node_content": "...",
  "metadata": {
    "file_path": "/path/to/docs/AiModelParameters.md"
  }
}
```

Result: `fileName = "AiModelParameters"`

### 3. UMAP Projection

- Takes high-dimensional embeddings (e.g., 384 dimensions)
- Projects them to 2D space while preserving structure
- Similar documents cluster together

### 4. Topic Detection (Automatic)

**How it works:**

- Uses HDBSCAN clustering on UMAP coordinates
- Finds natural clusters in the 2D projection
- For each cluster:
  - Extracts top keywords using TF-IDF
  - Generates descriptive topic name (e.g., "Window Functions / Aggregate / SQL")
- Documents that don't fit any cluster are labeled "Uncategorized"

**Parameters:**

- `--min-cluster-size` - Minimum documents per cluster (default: 5)
- `--no-topics` - Disable topic detection entirely

**Example topics generated:**

- "Window Functions / Aggregate / Query"
- "JSON / Extensions / Data"
- "Performance / Optimization / Index"

## Usage Examples

### Basic Usage

```bash
# Generate with defaults (n_neighbors=15, min_dist=0.1)
uv run generate-umap-embeddings embeddings.duckdb
```

### Custom Parameters

```bash
# More global structure (larger neighborhoods)
uv run generate-umap-embeddings embeddings.duckdb --n-neighbors 30

# Tighter clusters
uv run generate-umap-embeddings embeddings.duckdb --min-dist 0.05

# Combine parameters
uv run generate-umap-embeddings embeddings.duckdb \
  --n-neighbors 30 \
  --min-dist 0.05 \
  --random-state 123

# Disable topic detection
uv run generate-umap-embeddings embeddings.duckdb --no-topics

# Adjust clustering sensitivity
uv run generate-umap-embeddings embeddings.duckdb --min-cluster-size 10
```

### Preview Mode

```bash
# Test with first 100 documents (faster)
uv run generate-umap-embeddings embeddings.duckdb --preview 100
```

### Custom Output

```bash
# Save to specific location
uv run generate-umap-embeddings embeddings.duckdb \
  --output visualizations/my_umap.parquet
```

## Visualization Examples

### Python + Matplotlib (Color by Topic)

```python
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Load data
df = pd.read_parquet('duckdb_docs_umap.parquet')

# Create scatter plot with topics
fig, ax = plt.subplots(figsize=(16, 10))

# Get unique topics and assign colors
if 'topic' in df.columns:
    topics = df['topic'].unique()
    colors = plt.cm.tab20(np.linspace(0, 1, len(topics)))
    topic_to_color = dict(zip(topics, colors))

    # Plot each topic with different color
    for topic in topics:
        mask = df['topic'] == topic
        topic_df = df[mask]
        ax.scatter(
            topic_df['x'],
            topic_df['y'],
            alpha=0.6,
            s=30,
            label=topic,
            c=[topic_to_color[topic]]
        )
else:
    ax.scatter(df['x'], df['y'], alpha=0.5, s=20, c='steelblue')

plt.title('Documentation Map (Colored by Topic)', fontsize=16)
plt.xlabel('UMAP Dimension 1')
plt.ylabel('UMAP Dimension 2')
plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=8)
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig('umap_topics.png', dpi=300, bbox_inches='tight')
plt.show()
```

### Python + Plotly (Interactive with Topics)

```python
import pandas as pd
import plotly.express as px

# Load data
df = pd.read_parquet('duckdb_docs_umap.parquet')

# Truncate text for hover display
df['text_preview'] = df['text'].str[:200] + '...'

# Create interactive scatter plot colored by topic
fig = px.scatter(
    df,
    x='x',
    y='y',
    color='topic' if 'topic' in df.columns else None,
    hover_data={
        'title': True,
        'fileName': True,
        'topic': True if 'topic' in df.columns else False,
        'text_preview': True,
        'x': ':.2f',
        'y': ':.2f',
    },
    hover_name='title',
    title='Interactive Documentation Map (Colored by Topic)',
    labels={'x': 'UMAP 1', 'y': 'UMAP 2'},
)

fig.update_traces(
    marker=dict(size=8, opacity=0.7, line=dict(width=0.5, color='white')),
)

fig.update_layout(
    width=1400,
    height=900,
    hovermode='closest',
    legend=dict(
        yanchor="top",
        y=0.99,
        xanchor="left",
        x=0.01,
        bgcolor="rgba(255,255,255,0.8)"
    )
)

# Save as interactive HTML
fig.write_html('umap_interactive.html')
fig.show()
```

### Python + Seaborn (Styled)

```python
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# Load data
df = pd.read_parquet('duckdb_docs_umap.parquet')

# Create styled plot
sns.set_theme(style='darkgrid')
plt.figure(figsize=(14, 10))

sns.scatterplot(
    data=df,
    x='x',
    y='y',
    alpha=0.6,
    s=50,
    color='#2E86AB',
    edgecolor='white',
    linewidth=0.5,
)

plt.title('Documentation Landscape', fontsize=18, pad=20)
plt.xlabel('UMAP Dimension 1', fontsize=14)
plt.ylabel('UMAP Dimension 2', fontsize=14)
plt.tight_layout()
plt.savefig('umap_styled.png', dpi=300)
plt.show()
```

### Observable Plot (JavaScript)

```javascript
import * as Plot from '@observablehq/plot';
import * as d3 from 'd3';

// Load parquet data
const data = await d3.parquet('duckdb_docs_umap.parquet');

// Create plot
const plot = Plot.plot({
  width: 1200,
  height: 800,
  marks: [
    Plot.dot(data, {
      x: 'x',
      y: 'y',
      title: (d) => `${d.title}\n${d.fileName}`,
      fill: 'steelblue',
      fillOpacity: 0.6,
      r: 4,
    }),
    Plot.text(
      data.slice(0, 20), // Label first 20 points
      {
        x: 'x',
        y: 'y',
        text: 'fileName',
        fontSize: 10,
        dy: -10,
      },
    ),
  ],
  grid: true,
});

document.body.appendChild(plot);
```

### D3.js (Full Custom)

```javascript
import * as d3 from 'd3';

// Load data
const data = await d3.parquet('duckdb_docs_umap.parquet');

// Set up dimensions
const width = 1200;
const height = 800;
const margin = {top: 20, right: 20, bottom: 40, left: 60};

// Create scales
const xScale = d3
  .scaleLinear()
  .domain(d3.extent(data, (d) => d.x))
  .range([margin.left, width - margin.right]);

const yScale = d3
  .scaleLinear()
  .domain(d3.extent(data, (d) => d.y))
  .range([height - margin.bottom, margin.top]);

// Create SVG
const svg = d3.create('svg').attr('width', width).attr('height', height);

// Add dots
svg
  .selectAll('circle')
  .data(data)
  .join('circle')
  .attr('cx', (d) => xScale(d.x))
  .attr('cy', (d) => yScale(d.y))
  .attr('r', 4)
  .attr('fill', 'steelblue')
  .attr('opacity', 0.6)
  .append('title')
  .text((d) => `${d.title}\n${d.fileName}`);

// Add axes
svg
  .append('g')
  .attr('transform', `translate(0,${height - margin.bottom})`)
  .call(d3.axisBottom(xScale));

svg
  .append('g')
  .attr('transform', `translate(${margin.left},0)`)
  .call(d3.axisLeft(yScale));

document.body.appendChild(svg.node());
```

## Use Cases

### 1. Documentation Explorer

Build an interactive web app where users can:

- Click on points to view documents
- Search and highlight related topics
- Navigate documentation visually

### 2. Content Clustering Analysis

Identify document clusters:

```python
from sklearn.cluster import DBSCAN
import pandas as pd

df = pd.read_parquet('duckdb_docs_umap.parquet')

# Cluster documents
clustering = DBSCAN(eps=2.0, min_samples=3).fit(df[['x', 'y']])
df['cluster'] = clustering.labels_

# Visualize clusters
import plotly.express as px
fig = px.scatter(df, x='x', y='y', color='cluster', hover_name='title')
fig.show()
```

### 3. Content Gap Analysis

Find areas with sparse documentation:

```python
import pandas as pd
import numpy as np

df = pd.read_parquet('duckdb_docs_umap.parquet')

# Find isolated points (potential gaps)
from sklearn.neighbors import NearestNeighbors

knn = NearestNeighbors(n_neighbors=5)
knn.fit(df[['x', 'y']])
distances, _ = knn.kneighbors(df[['x', 'y']])

# Points with large distances to neighbors = gaps
df['isolation_score'] = distances.mean(axis=1)
gaps = df.nlargest(20, 'isolation_score')

print("Potential content gaps:")
print(gaps[['title', 'fileName', 'isolation_score']])
```

### 4. Similarity Browser

Build a "find similar documents" feature:

```python
import pandas as pd
from sklearn.neighbors import NearestNeighbors

df = pd.read_parquet('duckdb_docs_umap.parquet')

# Build KNN index
knn = NearestNeighbors(n_neighbors=6)  # 5 neighbors + self
knn.fit(df[['x', 'y']])

def find_similar(title, k=5):
    idx = df[df['title'] == title].index[0]
    point = df.loc[idx, ['x', 'y']].values.reshape(1, -1)
    distances, indices = knn.kneighbors(point, n_neighbors=k+1)

    # Exclude self
    similar = df.iloc[indices[0][1:]]
    return similar[['title', 'fileName']]

# Usage
print(find_similar("Window Functions"))
```

## UMAP Parameters Explained

### `n_neighbors` (default: 15)

Controls local vs. global structure:

- **5-10**: Focus on local structure
  - Tighter, more granular clusters
  - Good for finding very similar documents
- **15-20**: Balanced (recommended)
  - Good mix of local and global structure
  - Natural clustering
- **30-50**: Focus on global structure
  - Shows overall document organization
  - Better for understanding broad topics

### `min_dist` (default: 0.1)

Controls cluster tightness:

- **0.0-0.05**: Very tight clusters
  - Points can overlap
  - Clear separation between groups
- **0.1-0.2**: Moderate spacing (recommended)
  - Balanced visualization
  - Easy to see individual points
- **0.3-0.5**: Loose spacing
  - Points spread out
  - Better for dense datasets

### `random_state` (default: 42)

Random seed for reproducibility:

- Use same value for consistent results
- Change to explore different projections

## Tips & Tricks

### For Large Datasets

```bash
# Use preview mode first
uv run generate-umap-embeddings embeddings.duckdb --preview 500

# Then generate full visualization
uv run generate-umap-embeddings embeddings.duckdb
```

### For Better Clusters

```bash
# Increase n_neighbors and decrease min_dist
uv run generate-umap-embeddings embeddings.duckdb \
  --n-neighbors 30 \
  --min-dist 0.01
```

### For Spread Out Points

```bash
# Decrease n_neighbors and increase min_dist
uv run generate-umap-embeddings embeddings.duckdb \
  --n-neighbors 5 \
  --min-dist 0.5
```

## Troubleshooting

**Out of memory:**

```bash
uv run generate-umap-embeddings embeddings.duckdb --preview 1000
```

**UMAP too slow:**

```bash
uv run generate-umap-embeddings embeddings.duckdb --n-neighbors 5
```

**Can't read parquet in JavaScript:**

```bash
# Use DuckDB-WASM or convert to JSON
python -c "import pandas as pd; pd.read_parquet('file.parquet').to_json('file.json')"
```

## Related Documentation

- [scripts/README.md](../scripts/README.md) - Detailed script documentation
- [README.md](../README.md) - Main package documentation
- [UMAP Documentation](https://umap-learn.readthedocs.io/) - Official UMAP docs
