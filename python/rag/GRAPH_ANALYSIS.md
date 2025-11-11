# Document Graph Analysis

The UMAP embedding generator now includes automatic link extraction and network analysis capabilities, allowing you to visualize and analyze how documents reference each other.

## What It Does

### 1. Link Extraction

Automatically extracts markdown links from document text:

- Finds `[text](url)` patterns in all chunks
- Filters to internal/relative links only (excludes external http:// URLs)
- Normalizes paths for matching
- Maps links to actual documents in the collection

**Chunking-Aware:** Since documents are chunked during embedding preparation, link extraction handles this carefully:

- **Source Chunks**: Chunk-level granularity - only chunks containing actual markdown links have `outdegree > 0`
- **Target Documents**: Expands to all chunks - when a chunk links to a document, it creates edges to ALL chunks of that document
- This approach is accurate (respects where links actually appear) while acknowledging that we don't know which specific chunk of the target document is referenced

Example: If chunk 3 of "intro.md" has `[see this](window_functions.md)`, and "window_functions.md" has 5 chunks:

- Chunk 3 of "intro.md" gets `outdegree = 5` (links to all 5 target chunks)
- All 5 chunks of "window_functions.md" get `indegree += 1` (referenced by chunk 3)

### 2. Graph Construction

Builds a directed graph where:

- **Nodes** = Individual chunks
- **Edges** = From chunks with links to all chunks of target documents
- **Granularity** = Source chunks keep their individual connectivity; target documents expand to all chunks

### 3. Network Metrics

Calculates for each document:

- **Indegree**: How many other documents link TO this document (popularity/importance)
- **Outdegree**: How many other documents this document links TO (connectivity)

## Output Files

### Main File: `*_umap.parquet`

Includes network columns:

- `node_id` - Unique identifier (e.g., "node_0001")
- `indegree` - Number of incoming links
- `outdegree` - Number of outgoing links

### Links File: `*_umap_links.parquet`

Edge list for network visualization:

- `source_id` - Source node ID
- `target_id` - Target node ID

## Usage

### Default (links enabled)

```bash
uv run generate-umap-embeddings embeddings.duckdb
# Creates: embeddings_umap.parquet + embeddings_umap_links.parquet
```

### Disable link extraction

```bash
uv run generate-umap-embeddings embeddings.duckdb --no-links
```

## Example Output

```
🔗 Building link graph...
✓ Found 847 links across 412 documents

📊 Creating links table...
✓ Created links table with 847 edges

   Outdegree: avg=2.1, max=45
   Indegree: avg=2.1, max=67

Link statistics:
  Total links: 847
  Documents with outgoing links: 412
  Documents with incoming links: 389

Most referenced documents:
  Window Functions: 67 incoming links
  SQL Functions: 52 incoming links
  Data Types: 48 incoming links
  CREATE TABLE: 41 incoming links
  SELECT: 38 incoming links

Documents with most links:
  Introduction: 45 outgoing links
  Overview: 38 outgoing links
  Getting Started: 32 outgoing links
  Quick Reference: 28 outgoing links
  Index: 24 outgoing links
```

## Visualization Examples

### Network Graph (NetworkX + Matplotlib)

```python
import pandas as pd
import networkx as nx
import matplotlib.pyplot as plt

# Load data
nodes_df = pd.read_parquet('duckdb_docs_umap.parquet')
links_df = pd.read_parquet('duckdb_docs_umap_links.parquet')

# Create graph
G = nx.DiGraph()

# Add nodes with attributes
for idx, row in nodes_df.iterrows():
    G.add_node(
        row['node_id'],
        title=row['title'],
        x=row['x'],
        y=row['y'],
        topic=row.get('topic', 'Unknown'),
        indegree=row['indegree'],
        outdegree=row['outdegree']
    )

# Add edges
for idx, row in links_df.iterrows():
    G.add_edge(row['source_id'], row['target_id'])

# Visualize using UMAP coordinates
pos = {node: (data['x'], data['y']) for node, data in G.nodes(data=True)}

# Size nodes by indegree (importance)
node_sizes = [G.nodes[node]['indegree'] * 20 + 50 for node in G.nodes()]

# Color by topic
topics = list(set(nx.get_node_attributes(G, 'topic').values()))
topic_colors = {topic: i for i, topic in enumerate(topics)}
node_colors = [topic_colors[G.nodes[node]['topic']] for node in G.nodes()]

# Plot
plt.figure(figsize=(16, 12))
nx.draw_networkx_nodes(
    G, pos,
    node_size=node_sizes,
    node_color=node_colors,
    alpha=0.7,
    cmap='tab20'
)
nx.draw_networkx_edges(
    G, pos,
    edge_color='gray',
    alpha=0.2,
    arrows=True,
    arrowsize=10,
    width=0.5
)

# Label highly connected nodes
high_degree = [node for node in G.nodes() if G.nodes[node]['indegree'] > 10]
labels = {node: G.nodes[node]['title'][:20] for node in high_degree}
nx.draw_networkx_labels(G, pos, labels, font_size=8)

plt.title('Documentation Network Graph', fontsize=16)
plt.axis('off')
plt.tight_layout()
plt.savefig('network_graph.png', dpi=300, bbox_inches='tight')
plt.show()
```

### Interactive Network (PyVis)

```python
import pandas as pd
from pyvis.network import Network

# Load data
nodes_df = pd.read_parquet('duckdb_docs_umap.parquet')
links_df = pd.read_parquet('duckdb_docs_umap_links.parquet')

# Create network
net = Network(height='800px', width='100%', directed=True)

# Add nodes
for idx, row in nodes_df.iterrows():
    net.add_node(
        row['node_id'],
        label=row['title'],
        title=f"{row['title']}\nIn: {row['indegree']}, Out: {row['outdegree']}\nTopic: {row.get('topic', 'Unknown')}",
        size=row['indegree'] * 2 + 10,
        x=row['x'] * 100,
        y=row['y'] * 100
    )

# Add edges
for idx, row in links_df.iterrows():
    net.add_edge(row['source_id'], row['target_id'])

# Configure physics
net.set_options("""
{
  "physics": {
    "enabled": false
  },
  "edges": {
    "arrows": {
      "to": {"enabled": true, "scaleFactor": 0.5}
    },
    "color": {"opacity": 0.3}
  }
}
""")

# Save and show
net.show('network_interactive.html')
```

### Plotly Network Visualization

```python
import pandas as pd
import plotly.graph_objects as go

# Load data
nodes_df = pd.read_parquet('duckdb_docs_umap.parquet')
links_df = pd.read_parquet('duckdb_docs_umap_links.parquet')

# Create node ID to index mapping
node_to_idx = {row['node_id']: idx for idx, row in nodes_df.iterrows()}

# Create edge traces
edge_x = []
edge_y = []

for idx, row in links_df.iterrows():
    source_idx = node_to_idx.get(row['source_id'])
    target_idx = node_to_idx.get(row['target_id'])

    if source_idx is not None and target_idx is not None:
        x0 = nodes_df.loc[source_idx, 'x']
        y0 = nodes_df.loc[source_idx, 'y']
        x1 = nodes_df.loc[target_idx, 'x']
        y1 = nodes_df.loc[target_idx, 'y']

        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])

edge_trace = go.Scatter(
    x=edge_x, y=edge_y,
    line=dict(width=0.5, color='#888'),
    hoverinfo='none',
    mode='lines'
)

# Create node trace
node_trace = go.Scatter(
    x=nodes_df['x'],
    y=nodes_df['y'],
    mode='markers',
    hoverinfo='text',
    marker=dict(
        size=nodes_df['indegree'] * 2 + 5,
        color=nodes_df['indegree'],
        colorscale='Viridis',
        showscale=True,
        colorbar=dict(
            title="Indegree"
        ),
        line=dict(width=0.5, color='white')
    )
)

# Add hover text
node_trace.text = [
    f"{row['title']}<br>In: {row['indegree']}, Out: {row['outdegree']}<br>Topic: {row.get('topic', 'Unknown')}"
    for idx, row in nodes_df.iterrows()
]

# Create figure
fig = go.Figure(data=[edge_trace, node_trace],
    layout=go.Layout(
        title='Interactive Documentation Network',
        showlegend=False,
        hovermode='closest',
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        height=800
    )
)

fig.show()
```

## Analysis Examples

### Find Hub Documents

Documents that are highly referenced (high indegree):

```python
import pandas as pd

df = pd.read_parquet('duckdb_docs_umap.parquet')

# Top hubs (most referenced)
hubs = df.nlargest(20, 'indegree')[['title', 'indegree', 'topic']]
print("Hub documents (most referenced):")
print(hubs)

# Calculate hub score: indegree relative to total
total_links = df['indegree'].sum()
df['hub_score'] = df['indegree'] / total_links
```

### Find Authority Documents

Documents that link to many others (high outdegree):

```python
# Top authorities (most outgoing links)
authorities = df.nlargest(20, 'outdegree')[['title', 'outdegree', 'topic']]
print("Authority documents (most outgoing links):")
print(authorities)
```

### Find Isolated Documents

Documents with no incoming or outgoing links:

```python
# Find isolated documents
isolated = df[(df['indegree'] == 0) & (df['outdegree'] == 0)]
print(f"Found {len(isolated)} isolated documents:")
print(isolated[['title', 'topic']])
```

### Topic-Level Connectivity

Analyze connectivity between topics:

```python
import pandas as pd

nodes_df = pd.read_parquet('duckdb_docs_umap.parquet')
links_df = pd.read_parquet('duckdb_docs_umap_links.parquet')

# Create node_id to topic mapping
node_to_topic = dict(zip(nodes_df['node_id'], nodes_df['topic']))

# Count links between topics
topic_links = {}
for idx, row in links_df.iterrows():
    source_topic = node_to_topic.get(row['source_id'], 'Unknown')
    target_topic = node_to_topic.get(row['target_id'], 'Unknown')

    key = (source_topic, target_topic)
    topic_links[key] = topic_links.get(key, 0) + 1

# Show most common inter-topic links
sorted_links = sorted(topic_links.items(), key=lambda x: x[1], reverse=True)
print("Most common topic-to-topic links:")
for (source, target), count in sorted_links[:10]:
    print(f"  {source} → {target}: {count} links")
```

### PageRank Analysis

Find the most important documents using PageRank:

```python
import pandas as pd
import networkx as nx

# Load data
nodes_df = pd.read_parquet('duckdb_docs_umap.parquet')
links_df = pd.read_parquet('duckdb_docs_umap_links.parquet')

# Build graph
G = nx.DiGraph()
for idx, row in links_df.iterrows():
    G.add_edge(row['source_id'], row['target_id'])

# Calculate PageRank
pagerank = nx.pagerank(G)

# Add to dataframe
nodes_df['pagerank'] = nodes_df['node_id'].map(pagerank)

# Top documents by PageRank
top_pagerank = nodes_df.nlargest(20, 'pagerank')[['title', 'pagerank', 'indegree', 'topic']]
print("Most important documents (PageRank):")
print(top_pagerank)
```

### Community Detection

Find clusters of highly interconnected documents:

```python
import pandas as pd
import networkx as nx
from networkx.algorithms import community

# Load data
nodes_df = pd.read_parquet('duckdb_docs_umap.parquet')
links_df = pd.read_parquet('duckdb_docs_umap_links.parquet')

# Build undirected graph for community detection
G = nx.Graph()
for idx, row in links_df.iterrows():
    G.add_edge(row['source_id'], row['target_id'])

# Detect communities
communities = community.greedy_modularity_communities(G)

# Assign community labels
community_map = {}
for i, comm in enumerate(communities):
    for node in comm:
        community_map[node] = i

nodes_df['community'] = nodes_df['node_id'].map(community_map)

# Show community sizes
print(f"Found {len(communities)} communities")
print(nodes_df['community'].value_counts())
```

## Use Cases

### 1. Find Documentation Gaps

Identify important topics with few links:

```python
# Documents with high importance but low connectivity
df['connectivity'] = df['indegree'] + df['outdegree']
gaps = df[df['connectivity'] < df['connectivity'].quantile(0.25)]
print("Potential documentation gaps:")
print(gaps[['title', 'topic', 'connectivity']])
```

### 2. Improve Navigation

Find documents that should link to each other but don't:

```python
# Documents in same topic with no links
for topic in df['topic'].unique():
    topic_docs = df[df['topic'] == topic]
    # Check if they reference each other
    # Suggest adding links...
```

### 3. Content Organization

Identify natural groupings based on link structure:

```python
# Use community detection to find natural clusters
# Compare with existing topic structure
# Reorganize based on actual usage patterns
```

### 4. Quality Metrics

Track documentation health over time:

```python
metrics = {
    'total_documents': len(df),
    'total_links': df['outdegree'].sum(),
    'avg_connectivity': df[['indegree', 'outdegree']].sum(axis=1).mean(),
    'isolated_docs': len(df[(df['indegree'] == 0) & (df['outdegree'] == 0)]),
    'hub_docs': len(df[df['indegree'] > df['indegree'].quantile(0.9)]),
}
print("Documentation health metrics:")
print(metrics)
```

## Programmatic API

```python
from sqlrooms_rag import (
    load_embeddings_from_duckdb,
    extract_links_from_markdown,
    build_link_graph,
    calculate_graph_metrics,
    create_links_table,
)

# Load embeddings
df = load_embeddings_from_duckdb("embeddings.duckdb")

# Extract links from each document
for idx, row in df.iterrows():
    links = extract_links_from_markdown(row['text'])
    print(f"{row['fileName']}: {len(links)} links")

# Build graph
filename_to_idx = {row['fileName']: idx for idx, row in df.iterrows()}
outgoing, incoming = build_link_graph(df, filename_to_idx)

# Calculate metrics
outdegree, indegree = calculate_graph_metrics(len(df), outgoing, incoming)

# Create links table
node_ids = [f"node_{i:04d}" for i in range(len(df))]
links_df = create_links_table(outgoing, node_ids)
```

## Related Documentation

- [VISUALIZATION_GUIDE.md](./VISUALIZATION_GUIDE.md) - Complete visualization guide
- [TOPIC_DETECTION.md](./TOPIC_DETECTION.md) - Topic detection guide
- [README.md](./README.md) - Main package documentation
