# Automatic Topic Detection

The UMAP embedding generator now includes automatic topic detection and naming to make visualizations more meaningful and easier to explore.

## How It Works

### 1. Clustering with HDBSCAN

After generating 2D UMAP coordinates, the script uses **HDBSCAN** (Hierarchical Density-Based Spatial Clustering of Applications with Noise) to find natural clusters in the projection:

- Identifies dense regions as clusters
- Handles noise points (documents that don't fit any cluster)
- No need to specify the number of clusters in advance
- Works well with irregularly-shaped clusters

### 2. Topic Naming with TF-IDF

For each cluster, the script generates a descriptive topic name:

1. **Extract Keywords**: Uses TF-IDF to find the most important words in the cluster's documents
2. **Create Name**: Combines the top 3 keywords into a topic name
3. **Format**: Capitalizes and joins with " / " separator

### 3. Output

Each document gets a `topic` field in the output Parquet file with values like:

- `"Window Functions / Aggregate / Query"`
- `"JSON / Extensions / Data"`
- `"Performance / Optimization / Index"`
- `"Uncategorized"` (for documents that don't fit any cluster)

## Usage

### Default (Topic Detection Enabled)

```bash
uv run generate-umap-embeddings embeddings.duckdb
```

Output includes a `topic` column automatically.

### Disable Topic Detection

```bash
uv run generate-umap-embeddings embeddings.duckdb --no-topics
```

### Adjust Clustering Sensitivity

```bash
# Larger clusters (fewer, bigger topics)
uv run generate-umap-embeddings embeddings.duckdb --min-cluster-size 10

# Smaller clusters (more, specific topics)
uv run generate-umap-embeddings embeddings.duckdb --min-cluster-size 3
```

## Example Output

```
🔍 Clustering documents...
   min_cluster_size: 5
✓ Found 12 clusters (43 noise points)

🏷️  Generating topic names...
   Cluster 0: Window Functions / Aggregate / Query (87 docs)
   Cluster 1: JSON / Extensions / Data (65 docs)
   Cluster 2: Performance / Optimization / Index (54 docs)
   Cluster 3: Tables / Create / Schema (48 docs)
   Cluster 4: SQL / Select / Join (72 docs)
   ...

Topic distribution:
  Window Functions / Aggregate / Query: 87 documents
  SQL / Select / Join: 72 documents
  JSON / Extensions / Data: 65 documents
  Performance / Optimization / Index: 54 documents
  Tables / Create / Schema: 48 documents
  ...
```

## Visualization Examples

### Color by Topic (Matplotlib)

```python
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

df = pd.read_parquet('duckdb_docs_umap.parquet')

# Get unique topics and colors
topics = df['topic'].unique()
colors = plt.cm.tab20(np.linspace(0, 1, len(topics)))
topic_to_color = dict(zip(topics, colors))

# Plot each topic
fig, ax = plt.subplots(figsize=(16, 10))
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

plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
plt.title('Documentation Topics')
plt.tight_layout()
plt.show()
```

### Interactive (Plotly)

```python
import pandas as pd
import plotly.express as px

df = pd.read_parquet('duckdb_docs_umap.parquet')

fig = px.scatter(
    df,
    x='x',
    y='y',
    color='topic',
    hover_name='title',
    hover_data=['fileName', 'topic'],
    title='Interactive Documentation Map'
)

fig.show()
```

## Use Cases

### 1. Documentation Organization

Visualize how your documentation is organized and identify topics:

```python
# Count documents per topic
topic_counts = df['topic'].value_counts()
print(topic_counts)

# Find under-documented topics
sparse_topics = topic_counts[topic_counts < 10]
print("Needs more documentation:", list(sparse_topics.index))
```

### 2. Content Gap Analysis

Find topics that are isolated or under-represented:

```python
# Topics with few documents
small_clusters = df.groupby('topic').size()
gaps = small_clusters[small_clusters < 5]
print("Content gaps:", list(gaps.index))
```

### 3. Topic-Specific Search

Filter and search within specific topics:

```python
# Get all documents in a specific topic
sql_docs = df[df['topic'].str.contains('SQL')]

# Find closest documents within a topic
def find_similar_in_topic(query_title, topic_name, k=5):
    topic_docs = df[df['topic'] == topic_name]
    query_doc = topic_docs[topic_docs['title'] == query_title].iloc[0]

    # Calculate distances
    topic_docs['distance'] = np.sqrt(
        (topic_docs['x'] - query_doc['x'])**2 +
        (topic_docs['y'] - query_doc['y'])**2
    )

    return topic_docs.nsmallest(k, 'distance')[['title', 'distance']]

similar = find_similar_in_topic("Window Functions", "SQL / Select / Join")
print(similar)
```

### 4. Topic Evolution

Track how topics change over time (with multiple snapshots):

```python
# Compare topics between versions
old_df = pd.read_parquet('v1_umap.parquet')
new_df = pd.read_parquet('v2_umap.parquet')

old_topics = set(old_df['topic'].unique())
new_topics = set(new_df['topic'].unique())

print("New topics:", new_topics - old_topics)
print("Removed topics:", old_topics - new_topics)
```

## Parameters Explained

### `--min-cluster-size` (default: 5)

**Minimum number of documents to form a cluster.**

- **Small values (3-5)**: More, specific topics
  - Good for: Large documentation sets, detailed categorization
  - Example: 20+ topics
- **Medium values (5-10)**: Balanced (recommended)
  - Good for: Most use cases
  - Example: 10-15 topics
- **Large values (10-20)**: Fewer, broad topics
  - Good for: Small documentation sets, high-level categories
  - Example: 5-8 topics

### `--no-topics`

**Completely disable topic detection.**

Use when:

- You want to assign topics manually
- Performance is critical
- You're only interested in the 2D coordinates

## Programmatic API

```python
from sqlrooms_rag import (
    load_embeddings_from_duckdb,
    generate_umap_embeddings,
    cluster_documents,
    generate_topic_name
)

# Load embeddings
df = load_embeddings_from_duckdb("embeddings.duckdb")
embeddings = np.array(df['embedding'].tolist())

# Generate UMAP
umap_coords = generate_umap_embeddings(embeddings)

# Cluster and generate topics
cluster_labels, topic_names = cluster_documents(
    umap_coords,
    df['text'].tolist(),
    min_cluster_size=5
)

# Assign topics to dataframe
df['cluster'] = cluster_labels
df['topic'] = [topic_names[label] for label in cluster_labels]
```

## Tips

### For Better Topic Names

1. **Clean your documents** - Remove boilerplate, footers, etc.
2. **Use consistent language** - Similar documents should use similar terminology
3. **Longer documents** - More text = better keyword extraction

### For Better Clustering

1. **Adjust UMAP parameters**:

   ```bash
   # For tighter topic clusters
   uv run generate-umap-embeddings embeddings.duckdb \
     --n-neighbors 30 \
     --min-dist 0.01
   ```

2. **Filter noise**:

   ```python
   # Remove uncategorized documents
   df_clean = df[df['topic'] != 'Uncategorized']
   ```

3. **Merge similar topics manually**:
   ```python
   # Combine related topics
   df['topic'] = df['topic'].replace({
       'SQL / Query / Select': 'SQL Queries',
       'SQL / Select / Join': 'SQL Queries',
       'SQL / Where / Filter': 'SQL Queries',
   })
   ```

## Troubleshooting

**Too many "Uncategorized" documents:**

- Reduce `--min-cluster-size`
- Adjust UMAP parameters (lower `--min-dist`)

**Topics too generic (e.g., "The / And / For"):**

- Your documents may need better cleaning
- Stop words might not be filtered correctly
- Try different embedding models

**Too many topics:**

- Increase `--min-cluster-size`
- Adjust UMAP for more global structure (`--n-neighbors 30`)

**Topics don't make sense:**

- Review the documents in each cluster
- Consider manual topic assignment
- Try `--no-topics` and use alternative clustering

## Related Documentation

- [VISUALIZATION_GUIDE.md](./VISUALIZATION_GUIDE.md) - Complete visualization guide
- [README.md](../README.md) - Main package documentation
- [scripts/README.md](../scripts/README.md) - Script documentation
