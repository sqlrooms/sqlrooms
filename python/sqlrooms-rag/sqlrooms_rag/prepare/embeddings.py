"""
Embedding model initialization for different providers.
"""

import os
from typing import Optional, Literal, Tuple

from llama_index.embeddings.huggingface import HuggingFaceEmbedding


def get_embedding_model(
    provider: Literal["huggingface", "openai"] = "huggingface",
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    embed_dim: Optional[int] = None,
    verbose: bool = True,
) -> Tuple:
    """
    Get an embedding model based on the provider.

    Args:
        provider: Either "huggingface" (local) or "openai" (API)
        model_name: Model name/identifier. Defaults depend on provider:
            - huggingface: "BAAI/bge-small-en-v1.5"
            - openai: "text-embedding-3-small"
        api_key: API key for external providers (required for OpenAI).
            If not provided, will look for OPENAI_API_KEY environment variable.
        embed_dim: Expected embedding dimension. If None, will be auto-detected.
        verbose: Whether to print progress messages

    Returns:
        Tuple of (embed_model, actual_embed_dim)

    Raises:
        ValueError: If API key is required but not provided
        ImportError: If required package is not installed
    """
    if provider == "huggingface":
        # Local HuggingFace embeddings (default)
        if model_name is None:
            model_name = "BAAI/bge-small-en-v1.5"

        if verbose:
            print(f"Loading HuggingFace embedding model: {model_name}...")

        embed_model = HuggingFaceEmbedding(model_name=model_name)

        # Test to get actual dimension
        test_embeddings = embed_model.get_text_embedding("test")
        actual_dim = len(test_embeddings)

        if verbose:
            print(f"Embedding dimension: {actual_dim}")

        if embed_dim and actual_dim != embed_dim:
            if verbose:
                print(f"Warning: Expected dimension {embed_dim}, got {actual_dim}")

        return embed_model, actual_dim

    elif provider == "openai":
        # OpenAI API embeddings
        try:
            from llama_index.embeddings.openai import OpenAIEmbedding
        except ImportError:
            raise ImportError(
                "OpenAI embeddings require 'llama-index-embeddings-openai'. "
                "Install with: pip install llama-index-embeddings-openai"
            )

        # Get API key
        if api_key is None:
            api_key = os.environ.get("OPENAI_API_KEY")

        if not api_key:
            raise ValueError(
                "OpenAI API key required. Provide via api_key parameter or "
                "set OPENAI_API_KEY environment variable."
            )

        # Set default model if not specified
        if model_name is None:
            model_name = "text-embedding-3-small"

        if verbose:
            print(f"Using OpenAI embedding model: {model_name}...")

        # Determine embedding dimension based on model
        dimension_map = {
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
            "text-embedding-ada-002": 1536,
        }

        if embed_dim is None:
            embed_dim = dimension_map.get(model_name, 1536)

        embed_model = OpenAIEmbedding(
            model=model_name,
            api_key=api_key,
            dimensions=embed_dim if "text-embedding-3" in model_name else None,
        )

        if verbose:
            print(f"Embedding dimension: {embed_dim}")
            print("Note: Using OpenAI API will incur costs per token")

        return embed_model, embed_dim

    else:
        raise ValueError(
            f"Unknown provider: {provider}. "
            f"Supported providers: 'huggingface', 'openai'"
        )
