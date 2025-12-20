# External Embedding APIs

This guide covers using external embedding APIs (like OpenAI) instead of local HuggingFace models.

## When to Use External APIs

### Use OpenAI (or other APIs) when:

- **Quality matters more than cost** - OpenAI embeddings are state-of-the-art
- **No local storage** - Don't want to download large model files
- **Consistency needed** - Same results across different machines
- **Small-medium datasets** - API costs are reasonable

### Use HuggingFace (local) when:

- **Cost matters** - Completely free, no usage limits
- **Large datasets** - API costs add up quickly
- **Privacy sensitive** - Data never leaves your machine
- **Offline use** - No internet required after initial model download
- **Fast iteration** - No API latency

## Supported Providers

### OpenAI

Currently the main external provider supported. Others can be added.

**Models:**

- `text-embedding-3-small` - 1536 dims, $0.02/1M tokens (recommended)
- `text-embedding-3-large` - 3072 dims, $0.13/1M tokens (highest quality)
- `text-embedding-ada-002` - 1536 dims, $0.10/1M tokens (legacy)

**Setup:**

1. Get API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Install required package:
   ```bash
   pip install llama-index-embeddings-openai
   ```
3. Set environment variable:
   ```bash
   export OPENAI_API_KEY=your_key_here
   ```

**Usage - CLI:**

```bash
# Using environment variable
export OPENAI_API_KEY=your_key_here
uv run prepare-embeddings docs -o kb.duckdb --provider openai

# Passing API key directly
uv run prepare-embeddings docs -o kb.duckdb \
  --provider openai \
  --api-key your_key_here

# Using larger model
uv run prepare-embeddings docs -o kb.duckdb \
  --provider openai \
  --model text-embedding-3-large

# Using reduced dimensions (v3 models only)
uv run prepare-embeddings docs -o kb.duckdb \
  --provider openai \
  --model text-embedding-3-small \
  --embed-dim 512
```

**Usage - Python API:**

```python
from sqlrooms_rag import prepare_embeddings
import os

# Using environment variable
prepare_embeddings(
    input_dir="docs",
    output_db="kb.duckdb",
    embedding_provider="openai",
    # API key from environment
)

# Passing API key directly
prepare_embeddings(
    input_dir="docs",
    output_db="kb.duckdb",
    embedding_provider="openai",
    api_key="your_key_here",
)

# Custom model and dimensions
prepare_embeddings(
    input_dir="docs",
    output_db="kb.duckdb",
    embedding_provider="openai",
    embed_model_name="text-embedding-3-large",
    embed_dim=1024,  # Reduced from 3072
)
```

## Cost Estimates

Based on OpenAI `text-embedding-3-small` at $0.02 per 1M tokens:

| Document Size             | Approximate Tokens | Estimated Cost |
| ------------------------- | ------------------ | -------------- |
| 100 pages (~50k words)    | ~65,000            | $0.0013        |
| 500 pages (~250k words)   | ~325,000           | $0.0065        |
| 1,000 pages (~500k words) | ~650,000           | $0.013         |
| 5,000 pages (~2.5M words) | ~3,250,000         | $0.065         |
| 10,000 pages (~5M words)  | ~6,500,000         | $0.13          |

**For `text-embedding-3-large`:** Multiply costs by ~6.5x

**Note:** Token counts vary based on content. These are estimates.

## Dimension Reduction

OpenAI's v3 models support **dimension reduction** without quality loss:

```python
# Full dimensions
prepare_embeddings(
    input_dir="docs",
    output_db="kb_full.duckdb",
    embedding_provider="openai",
    embed_model_name="text-embedding-3-small",
    embed_dim=1536,  # Full size
)

# Reduced dimensions (faster queries, smaller DB)
prepare_embeddings(
    input_dir="docs",
    output_db="kb_reduced.duckdb",
    embedding_provider="openai",
    embed_model_name="text-embedding-3-small",
    embed_dim=512,  # ~90% quality, 3x smaller
)
```

**Benefits of reduced dimensions:**

- Smaller database size (3-6x smaller)
- Faster similarity searches
- Lower memory usage
- Minimal quality loss (~5-10%)

**Recommended dimensions:**

- 512: Good balance (87-90% quality of full model)
- 1024: Better quality (93-95% of full model)
- 1536: Full quality (no reduction)

## Quality Comparison

Approximate quality ranking for English text:

1. **OpenAI text-embedding-3-large** (3072 dims) - Highest quality
2. **OpenAI text-embedding-3-small** (1536 dims) - Excellent quality
3. **BAAI/bge-base-en-v1.5** (768 dims) - Good local model
4. **BAAI/bge-small-en-v1.5** (384 dims) - Default, good enough
5. **all-MiniLM-L6-v2** (384 dims) - Fast but lower quality

For most applications, the **default HuggingFace model** (bge-small) provides good results at zero cost.

## OpenAI Token Limits

### The Limit

OpenAI embedding models have a **hard limit of 8192 tokens** per request. This is OpenAI's limit, not ours.

### Automatic Protection

The system automatically handles this for you:

1. **Validates all chunks** before sending to OpenAI
2. **Splits oversized chunks** (anything over 8000 tokens)
3. **Preserves metadata** during splitting
4. **Shows warnings** if splitting occurs

**You don't need to worry about this** - the system handles it automatically!

### Why Chunks Might Exceed 8192 Tokens

Even with reasonable settings, chunks can exceed limits because:

1. **Markdown-aware chunking** respects document structure
   - A single giant markdown section becomes one chunk
   - Some docs have 50K+ word sections!

2. **Header weighting** multiplies chunk size
   - `header_weight=3` repeats headers 3 times
   - A 3000 token chunk becomes 9000 tokens

3. **Long technical content**
   - Code blocks, tables, lists add up fast

### Recommended Settings

**Recommended for OpenAI (safest):**

```bash
# Conservative settings to avoid token limit issues
uv run prepare-embeddings docs -o kb.duckdb \
  --provider openai \
  --chunk-size 256 \
  --header-weight 1
```

**Default (may require splitting):**

```bash
uv run prepare-embeddings docs -o kb.duckdb --provider openai
# Uses chunk_size=512, header_weight=3
# Chunks automatically split if >6000 estimated tokens
```

**If you still get token limit errors:**

```bash
# Minimum chunk size
uv run prepare-embeddings docs -o kb.duckdb \
  --provider openai \
  --chunk-size 128 \
  --no-header-weighting

# Or disable markdown chunking (size-based only)
uv run prepare-embeddings docs -o kb.duckdb \
  --provider openai \
  --chunk-size 256 \
  --no-markdown-chunking
```

### HuggingFace (No Limits)

Local models don't have strict token limits:

```bash
# Can use larger chunks and higher header weights
uv run prepare-embeddings docs -o kb.duckdb \
  --chunk-size 1024 \
  --header-weight 5
```

## Performance Characteristics

### HuggingFace (Local)

**First run:**

- Downloads model (~150MB)
- Caches locally
- Embeddings: ~100-500 docs/sec (CPU)
- Embeddings: ~1000+ docs/sec (GPU)

**Subsequent runs:**

- No download needed
- Same speed as first run

### OpenAI (API)

**Every run:**

- API latency: ~100-300ms per request
- Batch size: ~2048 tokens per request
- Rate limits apply
- Throughput: ~50-200 docs/sec

**Note:** OpenAI is slower for large datasets due to API overhead.

## Security Considerations

### API Keys

**Never commit API keys to version control!**

Good practices:

```bash
# Use environment variables
export OPENAI_API_KEY=your_key_here

# Or use .env file (add to .gitignore)
echo "OPENAI_API_KEY=your_key_here" > .env
source .env
```

### Data Privacy

**When using external APIs:**

- Your document content is sent to the API provider
- Review provider's data retention policies
- Consider compliance requirements (GDPR, HIPAA, etc.)

**For sensitive data:**

- Use local HuggingFace models
- Data never leaves your machine
- No external dependencies

## Error Handling

Common errors and solutions:

### Missing API Key

```
Error: OpenAI API key required...
```

**Solution:** Set `OPENAI_API_KEY` environment variable

### Missing Package

```
ImportError: OpenAI embeddings require 'llama-index-embeddings-openai'
```

**Solution:** `pip install llama-index-embeddings-openai`

### Rate Limit Exceeded

```
Error: Rate limit exceeded...
```

**Solution:** Add delay between requests or upgrade OpenAI tier

### Invalid Dimensions

```
Error: Dimension reduction not supported for this model
```

**Solution:** Only v3 models support dimension reduction. Use full dimensions with ada-002.

### Token Limit Exceeded

```
Error: This model's maximum context length is 8192 tokens, however you requested X tokens
```

**This error should not happen anymore!** The system now automatically:

- Validates all chunks before sending to OpenAI
- Splits any chunk over 8000 tokens
- Shows warnings if splitting occurs

**If you still see this error:**

1. Update to latest version of the code
2. Use smaller chunks: `--chunk-size 256`
3. Reduce header weight: `--header-weight 1`
4. Report as a bug (this shouldn't happen!)

## Examples

See `examples/prepare_with_openai.py` for complete working examples:

```bash
# Show comparison and cost estimates
python examples/prepare_with_openai.py

# Use small model
python examples/prepare_with_openai.py --small

# Use large model
python examples/prepare_with_openai.py --large

# Use reduced dimensions
python examples/prepare_with_openai.py --reduced

# Compare providers
python examples/prepare_with_openai.py --compare

# Show cost estimates
python examples/prepare_with_openai.py --costs
```

## Future Providers

Potential providers to add:

- **Anthropic** - Claude embeddings (when available)
- **Cohere** - Cohere Embed v3
- **Voyage AI** - Specialized embeddings
- **Azure OpenAI** - Enterprise OpenAI
- **Google Vertex AI** - PaLM embeddings

Open an issue if you need a specific provider!

## Troubleshooting

### Embeddings seem low quality

1. Try a larger model (3-large vs 3-small)
2. Increase chunk_size for more context
3. Use full dimensions (don't reduce)
4. Check if markdown chunking is appropriate

### Too expensive

1. Switch to HuggingFace (free)
2. Use dimension reduction (512 dims)
3. Increase chunk_size (fewer chunks = fewer tokens)
4. Cache results and reuse

### Too slow

1. For large datasets: Use HuggingFace
2. For small datasets: Speed difference negligible
3. Consider running overnight for big jobs

## References

- [OpenAI Embeddings Documentation](https://platform.openai.com/docs/guides/embeddings)
- [OpenAI Pricing](https://openai.com/pricing)
- [Dimension Reduction Guide](https://platform.openai.com/docs/guides/embeddings/use-cases)
- [HuggingFace Models](https://huggingface.co/models?pipeline_tag=sentence-similarity)
