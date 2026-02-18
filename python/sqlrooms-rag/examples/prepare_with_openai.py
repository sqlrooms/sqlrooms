#!/usr/bin/env python3
"""
Example: Prepare embeddings using OpenAI API instead of local HuggingFace models.

This demonstrates how to use external embedding APIs for generating vectors.
OpenAI embeddings offer:
- High quality embeddings
- No local model download (saves disk space)
- Consistent results across environments
- Faster on machines without GPU

Trade-offs:
- Costs money per token (see OpenAI pricing)
- Requires internet connection
- Slower for large datasets (API latency)
- Data sent to OpenAI

Cost estimate for OpenAI text-embedding-3-small:
- ~$0.02 per 1 million tokens
- 1000 pages of docs (~500k words) ≈ 650k tokens ≈ $0.013
"""

import os
from sqlrooms_rag import prepare_embeddings


def prepare_with_openai_small():
    """
    Use OpenAI's text-embedding-3-small model.
    
    Pros:
    - Cheapest OpenAI option ($0.02 / 1M tokens)
    - 1536 dimensions (good quality)
    - Faster than 3-large
    
    Dimension: 1536 (default)
    """
    # Get API key from environment
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable not set")
        print("Set it with: export OPENAI_API_KEY=your_key_here")
        return
    
    print("=" * 80)
    print("EXAMPLE 1: OpenAI text-embedding-3-small")
    print("=" * 80)
    print()
    
    prepare_embeddings(
        input_dir="../../docs",
        output_db="generated-embeddings/openai_small.duckdb",
        embedding_provider="openai",
        # model name defaults to "text-embedding-3-small"
        # embed_dim defaults to 1536
        api_key=api_key,
        chunk_size=512,
    )


def prepare_with_openai_large():
    """
    Use OpenAI's text-embedding-3-large model.
    
    Pros:
    - Highest quality OpenAI embeddings
    - 3072 dimensions (or configurable down to 256)
    
    Cons:
    - More expensive ($0.13 / 1M tokens)
    - Slower
    - Larger database size
    
    Dimension: 3072 (default, can be reduced)
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable not set")
        return
    
    print("\n\n" + "=" * 80)
    print("EXAMPLE 2: OpenAI text-embedding-3-large")
    print("=" * 80)
    print()
    
    prepare_embeddings(
        input_dir="../../docs",
        output_db="generated-embeddings/openai_large.duckdb",
        embedding_provider="openai",
        embed_model_name="text-embedding-3-large",
        embed_dim=3072,  # Full dimension
        api_key=api_key,
        chunk_size=512,
    )


def prepare_with_openai_reduced_dimensions():
    """
    Use OpenAI's text-embedding-3 with reduced dimensions.
    
    OpenAI's v3 models support dimension reduction while maintaining quality.
    Smaller dimensions = smaller database + faster queries.
    
    Good options:
    - 512 dimensions: ~90% quality of full model
    - 1024 dimensions: ~95% quality
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable not set")
        return
    
    print("\n\n" + "=" * 80)
    print("EXAMPLE 3: OpenAI with Reduced Dimensions (512)")
    print("=" * 80)
    print()
    
    prepare_embeddings(
        input_dir="../../docs",
        output_db="generated-embeddings/openai_reduced.duckdb",
        embedding_provider="openai",
        embed_model_name="text-embedding-3-small",
        embed_dim=512,  # Reduced from 1536
        api_key=api_key,
        chunk_size=512,
    )


def compare_providers():
    """
    Compare HuggingFace (local) vs OpenAI (API) embeddings.
    """
    print("=" * 80)
    print("COMPARISON: HuggingFace vs OpenAI")
    print("=" * 80)
    print()
    print("HuggingFace (BAAI/bge-small-en-v1.5):")
    print("  Pros:")
    print("    - Free (no API costs)")
    print("    - Fast for large datasets (local compute)")
    print("    - No data sent externally")
    print("    - Works offline")
    print("  Cons:")
    print("    - Requires ~150MB model download")
    print("    - Slower on CPU-only machines")
    print("    - 384 dimensions (lower than OpenAI)")
    print()
    print("OpenAI (text-embedding-3-small):")
    print("  Pros:")
    print("    - Higher quality embeddings")
    print("    - No local storage needed")
    print("    - 1536 dimensions")
    print("    - Consistent across environments")
    print("  Cons:")
    print("    - Costs ~$0.02 per 1M tokens")
    print("    - Requires internet connection")
    print("    - API latency per request")
    print("    - Data sent to OpenAI")
    print()
    print("Recommendation:")
    print("  - Development/Testing: HuggingFace (free, fast)")
    print("  - Production/Quality-sensitive: OpenAI (better embeddings)")
    print("  - Large datasets: HuggingFace (API costs add up)")
    print("  - Privacy-sensitive: HuggingFace (data stays local)")
    print()


def cost_estimate():
    """
    Estimate OpenAI embedding costs for common scenarios.
    """
    print("=" * 80)
    print("COST ESTIMATES (text-embedding-3-small at $0.02 / 1M tokens)")
    print("=" * 80)
    print()
    
    scenarios = [
        ("Small docs (100 pages, ~50k words)", 65_000, 0.0013),
        ("Medium docs (500 pages, ~250k words)", 325_000, 0.0065),
        ("Large docs (1000 pages, ~500k words)", 650_000, 0.013),
        ("Very large (5000 pages, ~2.5M words)", 3_250_000, 0.065),
        ("Massive (10000 pages, ~5M words)", 6_500_000, 0.13),
    ]
    
    for scenario, tokens, cost in scenarios:
        print(f"  {scenario}")
        print(f"    Tokens: ~{tokens:,}")
        print(f"    Cost: ~${cost:.4f}")
        print()
    
    print("Note: Costs are approximate. Actual token counts depend on content.")
    print("For text-embedding-3-large, multiply costs by ~6.5x")
    print()


if __name__ == "__main__":
    import sys
    
    # Check for API key
    if not os.environ.get("OPENAI_API_KEY"):
        print("=" * 80)
        print("SETUP REQUIRED")
        print("=" * 80)
        print()
        print("To use OpenAI embeddings, set your API key:")
        print("  export OPENAI_API_KEY=your_key_here")
        print()
        print("Get your API key from: https://platform.openai.com/api-keys")
        print()
        print("=" * 80)
        sys.exit(1)
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--small":
            prepare_with_openai_small()
        elif sys.argv[1] == "--large":
            prepare_with_openai_large()
        elif sys.argv[1] == "--reduced":
            prepare_with_openai_reduced_dimensions()
        elif sys.argv[1] == "--compare":
            compare_providers()
        elif sys.argv[1] == "--costs":
            cost_estimate()
        else:
            print(f"Unknown option: {sys.argv[1]}")
            print("Available options: --small, --large, --reduced, --compare, --costs")
    else:
        # Default: show information
        compare_providers()
        cost_estimate()
        print()
        print("To run examples:")
        print("  python prepare_with_openai.py --small")
        print("  python prepare_with_openai.py --large")
        print("  python prepare_with_openai.py --reduced")

