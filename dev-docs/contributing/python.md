# Python Workspace

> When: working on Python packages (CLI, server, or RAG).

## Setup

- Package manager: `uv`
- Python `>=3.10`
- Workspace root: `python/`

```bash
cd python
uv sync
```

## Packages

| Package        | Purpose                                    |
| -------------- | ------------------------------------------ |
| `sqlrooms`     | CLI, UI and unified ASGI DuckDB runtime    |
| `sqlrooms-rag` | RAG pipeline for document-grounded queries |

## Running Packages

```bash
# CLI
cd python/sqlrooms
uv run sqlrooms :memory:

# Server
cd python/sqlrooms
uv run sqlrooms server --db-path :memory: --port 4000
```
