"""
Chunk validation and splitting for token limit compliance.
"""

import uuid
from copy import deepcopy


def count_tokens(text: str) -> int:
    """
    Estimate token count for text.
    
    Uses a conservative approximation: ~3 characters per token.
    This overestimates slightly to ensure we stay well under API limits.
    
    For technical text with code, markdown, and special characters,
    the actual token count can be higher than the 4 char/token rule.
    
    Args:
        text: Text to count tokens for
    
    Returns:
        Estimated token count (conservative/higher estimate)
    """
    # Use 3 chars per token for conservative estimate
    # Technical text often has more tokens per character
    return len(text) // 3


def validate_and_split_chunks(
    nodes: list,
    max_tokens: int = 5000,
    verbose: bool = True
) -> list:
    """
    Validate chunk sizes and split any that exceed token limits.
    
    This is important for external APIs (like OpenAI) that have strict
    token limits per request (8192 tokens). We use 5000 for safety:
    - Conservative token estimation (3 chars/token, not perfect)
    - Header weighting already applied to text
    - Technical content (code, tables) has higher token density
    - Better safe than sorry - splitting works fine
    - Large margin accounts for estimation errors
    
    Why chunks can be large:
    - Markdown-aware chunking respects document structure
    - Some documents have huge sections (tables, code)
    - Header weighting multiplies the text (2x-3x)
    
    Args:
        nodes: List of llama-index Node objects
        max_tokens: Maximum tokens per chunk (default: 5000, well under OpenAI's 8192 limit)
        verbose: Whether to print progress messages
    
    Returns:
        List of validated nodes (may include split chunks)
    """
    validated_nodes = []
    oversized_count = 0
    split_count = 0
    
    for node in nodes:
        text = node.text if hasattr(node, 'text') else str(node)
        token_count = count_tokens(text)
        
        if token_count <= max_tokens:
            # Chunk is fine, keep as-is
            validated_nodes.append(node)
        else:
            # Chunk is too large, need to split
            oversized_count += 1
            
            # Split by sentences to try to maintain coherence
            sentences = text.split('. ')
            current_chunk = []
            current_tokens = 0
            
            for sentence in sentences:
                sentence_tokens = count_tokens(sentence)
                
                # If single sentence is too large, split it by character count
                if sentence_tokens > max_tokens:
                    # Split this sentence into smaller pieces
                    # Use very conservative char count (2 chars/token for safety)
                    chunk_size_chars = max_tokens * 2
                    for i in range(0, len(sentence), chunk_size_chars):
                        piece = sentence[i:i + chunk_size_chars]
                        
                        # Double-check the piece isn't still too large
                        if count_tokens(piece) > max_tokens:
                            # If still too large, split even smaller (1 char/token!)
                            smaller_chunk_size = max_tokens
                            for j in range(0, len(piece), smaller_chunk_size):
                                tiny_piece = piece[j:j + smaller_chunk_size]
                                new_node = deepcopy(node)
                                new_node.text = tiny_piece
                                # Generate new unique ID for split chunk
                                new_node.node_id = str(uuid.uuid4())
                                validated_nodes.append(new_node)
                                split_count += 1
                        else:
                            # Create new node with same metadata
                            new_node = deepcopy(node)
                            new_node.text = piece
                            # Generate new unique ID for split chunk
                            new_node.node_id = str(uuid.uuid4())
                            validated_nodes.append(new_node)
                            split_count += 1
                    continue
                
                # Check if adding this sentence would exceed limit
                if current_tokens + sentence_tokens > max_tokens and current_chunk:
                    # Save current chunk
                    new_node = deepcopy(node)
                    new_node.text = '. '.join(current_chunk) + '.'
                    # Generate new unique ID for split chunk
                    new_node.node_id = str(uuid.uuid4())
                    validated_nodes.append(new_node)
                    split_count += 1
                    
                    # Start new chunk
                    current_chunk = [sentence]
                    current_tokens = sentence_tokens
                else:
                    # Add sentence to current chunk
                    current_chunk.append(sentence)
                    current_tokens += sentence_tokens
            
            # Don't forget the last chunk
            if current_chunk:
                new_node = deepcopy(node)
                new_node.text = '. '.join(current_chunk)
                if not current_chunk[-1].endswith('.'):
                    new_node.text += '.'
                # Generate new unique ID for split chunk
                new_node.node_id = str(uuid.uuid4())
                validated_nodes.append(new_node)
                split_count += 1
    
    if verbose and oversized_count > 0:
        print(f"⚠ Found {oversized_count} oversized chunks (>{max_tokens} tokens)")
        print(f"✓ Split into {split_count} smaller chunks")
        print(f"✓ Total chunks: {len(validated_nodes)} (was {len(nodes)})")
    
    # Final safety check: verify no chunks exceed limit
    final_oversized = [
        (i, node, count_tokens(node.text if hasattr(node, 'text') else str(node)))
        for i, node in enumerate(validated_nodes)
        if count_tokens(node.text if hasattr(node, 'text') else str(node)) > max_tokens
    ]
    
    if final_oversized:
        if verbose:
            print(f"⚠ WARNING: {len(final_oversized)} chunks still exceed {max_tokens} tokens after splitting!")
            for i, node, tokens in final_oversized[:3]:  # Show first 3
                text_preview = (node.text if hasattr(node, 'text') else str(node))[:100]
                print(f"  Chunk {i}: {tokens} tokens - '{text_preview}...'")
            if len(final_oversized) > 3:
                print(f"  ... and {len(final_oversized) - 3} more")
            print(f"\nThese will likely cause API errors. Consider:")
            print(f"  1. Using --chunk-size 256 or smaller")
            print(f"  2. Using --header-weight 1 or --no-header-weighting")
            print(f"  3. Preprocessing very large markdown sections")
    
    return validated_nodes

