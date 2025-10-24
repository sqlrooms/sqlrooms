"""
Generate UMAP embeddings from a DuckDB embeddings database.

This module provides functionality to create 2D UMAP projections from high-dimensional
embeddings stored in DuckDB, suitable for visualization and analysis.
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Optional, List, Tuple, Dict, Set
from urllib.parse import unquote

import duckdb
import numpy as np
import pandas as pd
from sklearn.cluster import HDBSCAN
from sklearn.feature_extraction.text import TfidfVectorizer
from umap import UMAP


def extract_title_from_markdown(
    text: str, 
    metadata_json: Optional[str] = None,
    fallback: str = ""
) -> str:
    """
    Extract title from metadata, markdown frontmatter, or first heading.
    
    Priority order:
    1. Section title from metadata (if using markdown-aware chunking)
    2. YAML frontmatter title
    3. First markdown heading in text
    4. Fallback
    
    Args:
        text: Markdown text content
        metadata_json: Optional JSON metadata from LlamaIndex
        fallback: Fallback title if none found
        
    Returns:
        Extracted title or fallback
    """
    if not text or not text.strip():
        return fallback
    
    # Try to extract section title from metadata (from MarkdownNodeParser)
    if metadata_json:
        try:
            metadata = json.loads(metadata_json)
            
            # Check for header metadata added by MarkdownNodeParser
            # It stores section headers as 'Header_1', 'Header_2', etc.
            headers = []
            for key in sorted(metadata.keys()):
                if key.startswith('Header_'):
                    headers.append(metadata[key])
            
            if headers:
                # Use the deepest (most specific) header
                return headers[-1].strip()
        except (json.JSONDecodeError, Exception):
            pass
    
    # Try to extract from YAML frontmatter
    frontmatter_match = re.match(r'^---\s*\n(.*?)\n---\s*\n', text, re.DOTALL)
    if frontmatter_match:
        frontmatter = frontmatter_match.group(1)
        # Look for title field
        title_match = re.search(r'^title:\s*["\']?([^"\'\n]+)["\']?', frontmatter, re.MULTILINE)
        if title_match:
            return title_match.group(1).strip()
    
    # Try to find first # heading
    heading_match = re.search(r'^#\s+(.+?)$', text, re.MULTILINE)
    if heading_match:
        return heading_match.group(1).strip()
    
    # Try to find any heading
    any_heading_match = re.search(r'^#{1,6}\s+(.+?)$', text, re.MULTILINE)
    if any_heading_match:
        return any_heading_match.group(1).strip()
    
    return fallback


def extract_filename_from_metadata(metadata_json: str) -> Optional[str]:
    """
    Extract filename from metadata JSON.
    
    Args:
        metadata_json: JSON string containing metadata
        
    Returns:
        Filename without extension, or None if not found
    """
    try:
        if not metadata_json:
            return None
        
        metadata = json.loads(metadata_json)
        
        # Try to get file_path or file_name
        file_path = metadata.get('file_path') or metadata.get('file_name')
        
        if file_path:
            # Extract just the filename without extension
            path = Path(file_path)
            return path.stem  # filename without extension
        
        return None
    except (json.JSONDecodeError, Exception) as e:
        print(f"Warning: Failed to parse metadata JSON: {e}", file=sys.stderr)
        return None


def extract_filepath_from_metadata(metadata_json: str) -> Optional[str]:
    """
    Extract full file path from metadata JSON.
    
    Args:
        metadata_json: JSON string containing metadata
        
    Returns:
        Full file path, or None if not found
    """
    try:
        if not metadata_json:
            return None
        
        metadata = json.loads(metadata_json)
        
        # Try to get file_path or file_name
        file_path = metadata.get('file_path') or metadata.get('file_name')
        
        return file_path if file_path else None
    except (json.JSONDecodeError, Exception) as e:
        print(f"Warning: Failed to parse metadata JSON: {e}", file=sys.stderr)
        return None


def make_relative_path(file_path: str, all_paths: List[str]) -> str:
    """
    Convert an absolute path to a relative path from the documentation root.
    
    Tries to find a common base directory among all paths and makes the path relative to it.
    Falls back to the original path if no common base is found.
    
    Args:
        file_path: The file path to make relative
        all_paths: All file paths in the dataset (used to find common base)
        
    Returns:
        Relative path from documentation root
    """
    if not file_path:
        return file_path
    
    try:
        path_obj = Path(file_path)
        
        # If already relative, return as-is
        if not path_obj.is_absolute():
            return file_path
        
        # Try to find common base from all paths
        if all_paths:
            valid_paths = [Path(p) for p in all_paths if p]
            if valid_paths:
                # Find common parent
                try:
                    # Get all parent directories
                    all_parents = []
                    for p in valid_paths[:100]:  # Sample for performance
                        all_parents.extend(p.parents)
                    
                    # Find most common parent that's reasonably deep
                    from collections import Counter
                    parent_counts = Counter(all_parents)
                    
                    # Get the deepest common parent
                    for parent, count in parent_counts.most_common():
                        if count >= len(valid_paths) * 0.8:  # 80% of paths share this parent
                            try:
                                rel_path = path_obj.relative_to(parent)
                                return str(rel_path)
                            except ValueError:
                                continue
                except Exception:
                    pass
        
        # Fallback: just return the path as-is (or try to extract a reasonable relative part)
        # Look for common documentation root markers
        parts = path_obj.parts
        for i, part in enumerate(parts):
            if part.lower() in ['docs', 'documentation', 'doc', 'pages', 'content']:
                # Return from this point forward
                return str(Path(*parts[i:]))
        
        # Last resort: return original
        return file_path
        
    except Exception as e:
        print(f"Warning: Failed to make path relative: {e}", file=sys.stderr)
        return file_path


def load_embeddings_from_duckdb(db_path: str) -> pd.DataFrame:
    """
    Load embeddings and metadata from DuckDB.
    
    Args:
        db_path: Path to .duckdb file
        
    Returns:
        DataFrame with node_id, text, metadata_, embedding columns
    """
    print(f"📂 Loading embeddings from {db_path}...")
    
    conn = duckdb.connect(db_path, read_only=True)
    
    # Check if documents table exists
    tables = conn.execute("SHOW TABLES").fetchall()
    table_names = [t[0] for t in tables]
    
    if 'documents' not in table_names:
        raise ValueError(f"Table 'documents' not found in {db_path}. Available tables: {table_names}")
    
    # Get schema info
    schema = conn.execute("DESCRIBE documents").fetchall()
    print(f"   Schema: {len(schema)} columns")
    
    # Load data
    query = """
        SELECT 
            node_id,
            text,
            metadata_,
            embedding
        FROM documents
    """
    
    df = conn.execute(query).fetchdf()
    conn.close()
    
    print(f"✓ Loaded {len(df)} documents")
    return df


def generate_umap_embeddings(
    embeddings: np.ndarray,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
) -> np.ndarray:
    """
    Generate 2D UMAP embeddings.
    
    Args:
        embeddings: Array of shape (n_samples, n_dimensions)
        n_neighbors: UMAP n_neighbors parameter
        min_dist: UMAP min_dist parameter
        random_state: Random seed for reproducibility
        
    Returns:
        Array of shape (n_samples, 2) with x, y coordinates
    """
    print(f"🗺️  Generating UMAP embeddings...")
    print(f"   n_neighbors: {n_neighbors}")
    print(f"   min_dist: {min_dist}")
    print(f"   Input shape: {embeddings.shape}")
    
    reducer = UMAP(
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        random_state=random_state,
        verbose=True,
    )
    
    umap_embeddings = reducer.fit_transform(embeddings)
    
    print(f"✓ Generated UMAP embeddings: {umap_embeddings.shape}")
    return umap_embeddings


def clean_html_tags(text: str) -> str:
    """
    Remove HTML tags and entities from text.
    
    Args:
        text: Text potentially containing HTML
        
    Returns:
        Clean text with HTML removed
    """
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Remove HTML entities
    text = re.sub(r'&[a-zA-Z]+;', ' ', text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_keywords_from_texts(texts: List[str], n_keywords: int = 5) -> List[str]:
    """
    Extract top keywords from a list of texts using TF-IDF.
    
    Args:
        texts: List of text documents
        n_keywords: Number of top keywords to extract
        
    Returns:
        List of top keywords
    """
    try:
        # Clean HTML tags from all texts
        cleaned_texts = [clean_html_tags(text) for text in texts]
        
        # Use TF-IDF to find most important words
        vectorizer = TfidfVectorizer(
            max_features=100,
            stop_words='english',
            ngram_range=(1, 2),  # Include bigrams
            min_df=2,  # Must appear in at least 2 documents
        )
        
        tfidf_matrix = vectorizer.fit_transform(cleaned_texts)
        feature_names = vectorizer.get_feature_names_out()
        
        # Sum TF-IDF scores across all documents
        scores = np.asarray(tfidf_matrix.sum(axis=0)).ravel()
        
        # Get top keywords
        top_indices = scores.argsort()[-n_keywords:][::-1]
        keywords = [feature_names[i] for i in top_indices]
        
        return keywords
    except Exception as e:
        print(f"   Warning: Could not extract keywords: {e}")
        return []


def generate_topic_name(texts: List[str], cluster_id: int) -> str:
    """
    Generate a descriptive topic name for a cluster of documents.
    
    Args:
        texts: List of text documents in the cluster
        cluster_id: The cluster ID number
        
    Returns:
        Descriptive topic name
    """
    if not texts:
        return f"Topic {cluster_id}"
    
    # Extract keywords
    keywords = extract_keywords_from_texts(texts, n_keywords=3)
    
    if not keywords:
        return f"Topic {cluster_id}"
    
    # Create topic name from keywords
    # Capitalize first letter of each keyword
    topic_name = " / ".join([kw.title() for kw in keywords[:3]])
    
    return topic_name


def extract_links_from_markdown(text: str) -> List[str]:
    """
    Extract links from markdown text.
    
    Args:
        text: Markdown text content
        
    Returns:
        List of link targets (URLs/paths)
    """
    links = []
    
    # Match [text](url) pattern
    markdown_links = re.findall(r'\[([^\]]+)\]\(([^\)]+)\)', text)
    for _, url in markdown_links:
        # Clean up the URL
        url = url.split('#')[0]  # Remove anchors
        url = unquote(url)  # Decode URL encoding
        if url and not url.startswith(('http://', 'https://', 'mailto:', 'ftp://')):
            # Only include relative/internal links
            links.append(url)
    
    # Also match raw URLs (optional)
    # raw_links = re.findall(r'(?<!\()(\.{0,2}/[\w/\-\.]+\.md)', text)
    # links.extend(raw_links)
    
    return links


def normalize_path(path: str, base_file: Optional[str] = None) -> str:
    """
    Normalize a file path for comparison.
    
    Args:
        path: File path to normalize
        base_file: Base file for resolving relative paths
        
    Returns:
        Normalized path
    """
    # Remove leading ./
    path = path.lstrip('./')
    
    # Remove .md extension if present
    if path.endswith('.md'):
        path = path[:-3]
    
    # Handle relative paths if base_file provided
    if base_file and path.startswith('../'):
        base_dir = Path(base_file).parent
        resolved = (base_dir / path).resolve()
        path = str(resolved)
    
    return path.lower()


def build_link_graph(
    df: pd.DataFrame,
    filename_to_idx: Dict[str, int],
    filepaths: List[str],
) -> Tuple[Dict[int, Set[int]], Dict[int, Set[int]]]:
    """
    Build a directed graph of document links.
    
    Strategy:
    - Source: Keep at chunk level (only chunks with actual links have outdegree > 0)
    - Target: Expand to all chunks (link to document means link to ALL its chunks)
    
    Args:
        df: DataFrame with 'text' and 'fileName' columns
        filename_to_idx: Mapping from normalized filename to FIRST chunk index of that file
        filepaths: List of full file paths for each chunk
        
    Returns:
        Tuple of (outgoing_links, incoming_links) dictionaries at CHUNK level
    """
    print("🔗 Building link graph...")
    
    # Group chunks by source document
    doc_to_chunks = defaultdict(list)  # file_path -> list of chunk indices
    for idx, filepath in enumerate(filepaths):
        if filepath:
            doc_to_chunks[filepath].append(idx)
    
    print(f"   Found {len(doc_to_chunks)} unique documents across {len(df)} chunks")
    
    # Build chunk-level graph
    chunk_outgoing = defaultdict(set)  # chunk_idx -> set of target chunk indices
    chunk_incoming = defaultdict(set)  # chunk_idx -> set of source chunk indices
    
    total_markdown_links = 0
    chunks_with_links = 0
    matched_links = 0
    
    for idx, row in df.iterrows():
        source_filepath = filepaths[idx] if idx < len(filepaths) else None
        if not source_filepath:
            continue
        
        # Extract links from THIS chunk
        links = extract_links_from_markdown(row['text'])
        total_markdown_links += len(links)
        
        if not links:
            continue
        
        chunks_with_links += 1
        
        for link in links:
            # Try to find target document
            target_filepath = None
            
            # Strategy 1: Normalize with full file path context
            if source_filepath:
                normalized_link = normalize_path(link, source_filepath)
                if normalized_link in filename_to_idx:
                    first_chunk_idx = filename_to_idx[normalized_link]
                    if first_chunk_idx < len(filepaths):
                        target_filepath = filepaths[first_chunk_idx]
            
            # Strategy 2: Try normalizing without context
            if target_filepath is None:
                normalized_link = normalize_path(link)
                if normalized_link in filename_to_idx:
                    first_chunk_idx = filename_to_idx[normalized_link]
                    if first_chunk_idx < len(filepaths):
                        target_filepath = filepaths[first_chunk_idx]
            
            # Strategy 3: Try basename matching
            if target_filepath is None:
                link_basename = Path(link).stem.lower()
                for key, file_idx in filename_to_idx.items():
                    if Path(key).stem.lower() == link_basename:
                        if file_idx < len(filepaths):
                            target_filepath = filepaths[file_idx]
                            break
            
            # Strategy 4: Try relative path parts
            if target_filepath is None and '/' in link:
                link_parts = Path(link).parts
                if len(link_parts) >= 2:
                    relative_key = str(Path(*link_parts[-2:])).lower()
                    if relative_key.endswith('.md'):
                        relative_key = relative_key[:-3]
                    if relative_key in filename_to_idx:
                        first_chunk_idx = filename_to_idx[relative_key]
                        if first_chunk_idx < len(filepaths):
                            target_filepath = filepaths[first_chunk_idx]
            
            # If found, create links from THIS chunk to ALL chunks of target document
            if target_filepath and target_filepath != source_filepath:
                matched_links += 1
                target_chunks = doc_to_chunks[target_filepath]
                
                # This specific chunk links to all chunks of the target document
                chunk_outgoing[idx].update(target_chunks)
                
                # All target chunks receive an incoming link from this chunk
                for target_chunk_idx in target_chunks:
                    chunk_incoming[target_chunk_idx].add(idx)
    
    # Calculate statistics
    total_chunk_links = sum(len(targets) for targets in chunk_outgoing.values())
    matched_pct = (matched_links / total_markdown_links * 100) if total_markdown_links > 0 else 0
    
    print(f"✓ Found {total_markdown_links} markdown links in {chunks_with_links} chunks")
    print(f"✓ Matched {matched_links} links ({matched_pct:.1f}%)")
    print(f"✓ Created {total_chunk_links} chunk-to-chunk edges")
    
    return dict(chunk_outgoing), dict(chunk_incoming)


def calculate_graph_metrics(
    n_docs: int,
    outgoing_links: Dict[int, Set[int]],
    incoming_links: Dict[int, Set[int]],
) -> Tuple[List[int], List[int]]:
    """
    Calculate graph metrics for each document.
    
    Args:
        n_docs: Total number of documents
        outgoing_links: Dictionary of outgoing links
        incoming_links: Dictionary of incoming links
        
    Returns:
        Tuple of (outdegree_list, indegree_list)
    """
    outdegree = [len(outgoing_links.get(i, set())) for i in range(n_docs)]
    indegree = [len(incoming_links.get(i, set())) for i in range(n_docs)]
    
    return outdegree, indegree


def create_links_table(
    outgoing_links: Dict[int, Set[int]],
    node_ids: List[str],
) -> pd.DataFrame:
    """
    Create a links table for network visualization.
    
    Args:
        outgoing_links: Dictionary of outgoing links
        node_ids: List of node IDs for each document
        
    Returns:
        DataFrame with source_id and target_id columns
    """
    print("📊 Creating links table...")
    
    links_data = []
    for source_idx, targets in outgoing_links.items():
        source_id = node_ids[source_idx]
        for target_idx in targets:
            target_id = node_ids[target_idx]
            links_data.append({
                'source_id': source_id,
                'target_id': target_id,
            })
    
    links_df = pd.DataFrame(links_data)
    
    print(f"✓ Created links table with {len(links_df)} edges")
    
    return links_df


def cluster_documents(
    umap_coords: np.ndarray,
    texts: List[str],
    min_cluster_size: int = 5,
) -> Tuple[np.ndarray, Dict[int, str]]:
    """
    Cluster documents using HDBSCAN and generate topic names.
    
    Args:
        umap_coords: UMAP coordinates (n_samples, 2)
        texts: List of document texts
        min_cluster_size: Minimum size for a cluster
        
    Returns:
        Tuple of (cluster_labels, topic_names_dict)
    """
    print("🔍 Clustering documents...")
    print(f"   min_cluster_size: {min_cluster_size}")
    
    # Cluster using HDBSCAN
    clusterer = HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=3,
        cluster_selection_epsilon=0.5,
        metric='euclidean',
    )
    
    cluster_labels = clusterer.fit_predict(umap_coords)
    
    # Count clusters
    unique_labels = np.unique(cluster_labels)
    n_clusters = len(unique_labels[unique_labels >= 0])  # -1 is noise
    n_noise = np.sum(cluster_labels == -1)
    
    print(f"✓ Found {n_clusters} clusters ({n_noise} noise points)")
    
    # Generate topic names for each cluster
    print("🏷️  Generating topic names...")
    topic_names = {}
    
    for label in unique_labels:
        if label == -1:
            topic_names[-1] = "Uncategorized"
            continue
        
        # Get texts for this cluster
        cluster_mask = cluster_labels == label
        cluster_texts = [texts[i] for i in np.where(cluster_mask)[0]]
        
        # Generate topic name
        topic_name = generate_topic_name(cluster_texts, label)
        topic_names[label] = topic_name
        
        cluster_size = len(cluster_texts)
        print(f"   Cluster {label}: {topic_name} ({cluster_size} docs)")
    
    return cluster_labels, topic_names


def process_embeddings(
    df: pd.DataFrame,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
    detect_topics: bool = True,
    min_cluster_size: int = 5,
    extract_links: bool = True,
) -> Tuple[pd.DataFrame, Optional[pd.DataFrame]]:
    """
    Process embeddings and extract metadata.
    
    Args:
        df: DataFrame with embeddings
        n_neighbors: UMAP n_neighbors parameter
        min_dist: UMAP min_dist parameter
        random_state: Random seed
        detect_topics: Whether to detect topics via clustering
        min_cluster_size: Minimum cluster size for topic detection
        extract_links: Whether to extract document links and build graph
        
    Returns:
        Tuple of (documents_df, links_df)
        - documents_df: DataFrame with node_id, title, fileName, file_path, text, x, y, outdegree, indegree, topic
        - links_df: DataFrame with source_id, target_id (None if extract_links=False)
    """
    print("🔄 Processing embeddings...")
    
    # Convert embeddings to numpy array
    print("   Converting embeddings to numpy array...")
    embeddings_list = df['embedding'].tolist()
    embeddings = np.array(embeddings_list)
    
    # Generate UMAP
    umap_coords = generate_umap_embeddings(
        embeddings,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        random_state=random_state,
    )
    
    # Extract metadata
    print("📝 Extracting metadata...")
    titles = []
    filenames = []
    filepaths = []
    
    for idx, row in df.iterrows():
        # Extract filename from metadata
        filename = extract_filename_from_metadata(row['metadata_'])
        filenames.append(filename or "Unknown")
        
        # Extract full file path from metadata
        filepath = extract_filepath_from_metadata(row['metadata_'])
        filepaths.append(filepath or "")
        
        # Extract title from metadata/markdown (prioritizes section titles)
        title = extract_title_from_markdown(
            row['text'], 
            metadata_json=row['metadata_'],
            fallback=filename or "Untitled"
        )
        titles.append(title)
        
        if (idx + 1) % 100 == 0:
            print(f"   Processed {idx + 1}/{len(df)} documents...")
    
    # Convert absolute paths to relative paths for output
    print("📁 Converting to relative paths...")
    relative_filepaths = [make_relative_path(fp, filepaths) for fp in filepaths]
    
    # Generate node IDs
    node_ids = [f"node_{i:04d}" for i in range(len(df))]
    
    # Detect topics via clustering
    topics = None
    if detect_topics:
        try:
            cluster_labels, topic_names = cluster_documents(
                umap_coords,
                df['text'].tolist(),
                min_cluster_size=min_cluster_size,
            )
            # Map cluster labels to topic names
            topics = [topic_names[label] for label in cluster_labels]
        except Exception as e:
            print(f"⚠️  Warning: Topic detection failed: {e}")
            print("   Continuing without topics...")
            topics = None
    
    # Extract links and build graph
    links_df = None
    outdegree = None
    indegree = None
    
    if extract_links:
        try:
            # Build filename to index mapping using BOTH file_path and fileName
            filename_to_idx = {}
            for idx, (filepath, filename) in enumerate(zip(filepaths, filenames)):
                if filename and filename != 'Unknown':
                    # Add normalized filename (just the stem)
                    normalized_name = normalize_path(filename)
                    filename_to_idx[normalized_name] = idx
                    
                    # Also add normalized full path if available
                    if filepath:
                        normalized_path = normalize_path(filepath)
                        filename_to_idx[normalized_path] = idx
                        
                        # Also add just the relative path parts (e.g., "sql/window_functions")
                        path_obj = Path(filepath)
                        # Try various path combinations for better matching
                        if len(path_obj.parts) >= 2:
                            # Add last 2 parts: "sql/window_functions"
                            relative_2 = str(Path(*path_obj.parts[-2:])).lower()
                            if relative_2.endswith('.md'):
                                relative_2 = relative_2[:-3]
                            filename_to_idx[relative_2] = idx
                        
                        if len(path_obj.parts) >= 3:
                            # Add last 3 parts: "docs/sql/window_functions"
                            relative_3 = str(Path(*path_obj.parts[-3:])).lower()
                            if relative_3.endswith('.md'):
                                relative_3 = relative_3[:-3]
                            filename_to_idx[relative_3] = idx
            
            print(f"   Built lookup index with {len(filename_to_idx)} path variants for {len(filenames)} documents")
            
            # Build link graph
            outgoing_links, incoming_links = build_link_graph(df, filename_to_idx, filepaths)
            
            # Calculate metrics
            outdegree, indegree = calculate_graph_metrics(
                len(df),
                outgoing_links,
                incoming_links
            )
            
            # Create links table
            links_df = create_links_table(outgoing_links, node_ids)
            
            # Show statistics
            if outdegree:
                max_out = max(outdegree)
                max_in = max(indegree)
                avg_out = sum(outdegree) / len(outdegree)
                avg_in = sum(indegree) / len(indegree)
                
                print(f"   Outdegree: avg={avg_out:.1f}, max={max_out}")
                print(f"   Indegree: avg={avg_in:.1f}, max={max_in}")
                
        except Exception as e:
            print(f"⚠️  Warning: Link extraction failed: {e}")
            print("   Continuing without link data...")
            outdegree = [0] * len(df)
            indegree = [0] * len(df)
    else:
        outdegree = [0] * len(df)
        indegree = [0] * len(df)
    
    # Create result DataFrame
    result_data = {
        'node_id': node_ids,
        'title': titles,
        'fileName': filenames,
        'file_path': relative_filepaths,
        'text': df['text'].values,
        'x': umap_coords[:, 0],
        'y': umap_coords[:, 1],
        'outdegree': outdegree,
        'indegree': indegree,
    }
    
    if topics is not None:
        result_data['topic'] = topics
    
    result_df = pd.DataFrame(result_data)
    
    print(f"✓ Processed {len(result_df)} documents")
    return result_df, links_df


def save_to_parquet(df: pd.DataFrame, output_path: str):
    """
    Save DataFrame to parquet file.
    
    Args:
        df: DataFrame to save
        output_path: Path to output parquet file
    """
    print(f"💾 Saving to {output_path}...")
    
    # Ensure parent directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    df.to_parquet(output_path, engine='pyarrow', compression='snappy', index=False)
    
    file_size = Path(output_path).stat().st_size
    file_size_mb = file_size / (1024 * 1024)
    
    print(f"✓ Saved {len(df)} rows to {output_path}")
    print(f"   File size: {file_size_mb:.2f} MB")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Generate UMAP embeddings from DuckDB embeddings database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate UMAP with default settings
  generate-umap-embeddings embeddings.duckdb
  
  # Custom output path
  generate-umap-embeddings embeddings.duckdb --output my_umap.parquet
  
  # Custom UMAP parameters
  generate-umap-embeddings embeddings.duckdb --n-neighbors 30 --min-dist 0.05
  
  # Preview mode (process only first N documents)
  generate-umap-embeddings embeddings.duckdb --preview 100
        """,
    )
    
    parser.add_argument(
        'input_db',
        help='Path to input .duckdb file with embeddings',
    )
    
    parser.add_argument(
        '-o', '--output',
        help='Path to output parquet file (default: input_name_umap.parquet)',
    )
    
    parser.add_argument(
        '--n-neighbors',
        type=int,
        default=15,
        help='UMAP n_neighbors parameter (default: 15)',
    )
    
    parser.add_argument(
        '--min-dist',
        type=float,
        default=0.1,
        help='UMAP min_dist parameter (default: 0.1)',
    )
    
    parser.add_argument(
        '--random-state',
        type=int,
        default=42,
        help='Random seed for reproducibility (default: 42)',
    )
    
    parser.add_argument(
        '--preview',
        type=int,
        help='Preview mode: process only first N documents',
    )
    
    parser.add_argument(
        '--no-topics',
        action='store_true',
        help='Disable automatic topic detection',
    )
    
    parser.add_argument(
        '--min-cluster-size',
        type=int,
        default=5,
        help='Minimum cluster size for topic detection (default: 5)',
    )
    
    parser.add_argument(
        '--no-links',
        action='store_true',
        help='Disable link extraction and graph analysis',
    )
    
    args = parser.parse_args()
    
    # Validate input
    input_path = Path(args.input_db)
    if not input_path.exists():
        print(f"❌ Error: Input file not found: {args.input_db}", file=sys.stderr)
        print("\nPlease run the preparation script first:", file=sys.stderr)
        print("  prepare-embeddings ./docs -o embeddings.duckdb", file=sys.stderr)
        sys.exit(1)
    
    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = input_path.with_name(f"{input_path.stem}_umap.parquet")
    
    print("🚀 UMAP Embedding Generator")
    print("=" * 80)
    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")
    print("=" * 80)
    print()
    
    try:
        # Load embeddings
        df = load_embeddings_from_duckdb(str(input_path))
        
        # Preview mode
        if args.preview:
            print(f"⚠️  Preview mode: Using first {args.preview} documents")
            df = df.head(args.preview)
        
        # Process embeddings
        result_df, links_df = process_embeddings(
            df,
            n_neighbors=args.n_neighbors,
            min_dist=args.min_dist,
            random_state=args.random_state,
            detect_topics=not args.no_topics,
            min_cluster_size=args.min_cluster_size,
            extract_links=not args.no_links,
        )
        
        # Save documents
        save_to_parquet(result_df, str(output_path))
        
        # Save links if available
        if links_df is not None and not links_df.empty:
            links_path = output_path.with_name(f"{output_path.stem}_links.parquet")
            save_to_parquet(links_df, str(links_path))
            print(f"\n📊 Links saved to: {links_path}")
        
        print()
        print("=" * 80)
        print("✅ Success!")
        print("=" * 80)
        print()
        print("Sample data:")
        print(result_df.head())
        print()
        print(f"Columns: {list(result_df.columns)}")
        print(f"Shape: {result_df.shape}")
        print()
        print("Coordinate ranges:")
        print(f"  x: [{result_df['x'].min():.2f}, {result_df['x'].max():.2f}]")
        print(f"  y: [{result_df['y'].min():.2f}, {result_df['y'].max():.2f}]")
        
        # Show topic distribution if available
        if 'topic' in result_df.columns:
            print()
            print("Topic distribution:")
            topic_counts = result_df['topic'].value_counts()
            for topic, count in topic_counts.head(10).items():
                print(f"  {topic}: {count} documents")
            if len(topic_counts) > 10:
                print(f"  ... and {len(topic_counts) - 10} more topics")
        
        # Show link statistics if available
        if 'outdegree' in result_df.columns and result_df['outdegree'].sum() > 0:
            print()
            print("Link statistics:")
            print(f"  Total links: {result_df['outdegree'].sum()}")
            print(f"  Documents with outgoing links: {(result_df['outdegree'] > 0).sum()}")
            print(f"  Documents with incoming links: {(result_df['indegree'] > 0).sum()}")
            
            # Show top linked documents
            if result_df['indegree'].max() > 0:
                print()
                print("Most referenced documents:")
                top_referenced = result_df.nlargest(5, 'indegree')[['title', 'indegree']]
                for idx, row in top_referenced.iterrows():
                    print(f"  {row['title']}: {row['indegree']} incoming links")
            
            # Show most linking documents
            if result_df['outdegree'].max() > 0:
                print()
                print("Documents with most links:")
                top_linking = result_df.nlargest(5, 'outdegree')[['title', 'outdegree']]
                for idx, row in top_linking.iterrows():
                    print(f"  {row['title']}: {row['outdegree']} outgoing links")
        
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

