# Publishing to PyPI

This document explains how to publish `sqlrooms-rag` to PyPI.

## Quick Reference

```bash
# 1. Update version in pyproject.toml to prerelease (e.g., 0.1.0a1)

# 2. Build the package
uv build

# 3. Test locally (optional)
uv venv test-env && source test-env/bin/activate
uv pip install dist/*.whl
prepare-embeddings --help
deactivate && rm -rf test-env

# 4. Publish to TestPyPI (recommended first)
export UV_PUBLISH_USERNAME=__token__
export UV_PUBLISH_PASSWORD=your-testpypi-token
uv publish --publish-url https://test.pypi.org/legacy/

# 5. Publish to PyPI
export UV_PUBLISH_PASSWORD=your-pypi-token
uv publish
```

## Package Structure (PyPI-Ready)

```
sqlrooms-rag/
├── sqlrooms_rag/           # ✅ Installable package
│   ├── __init__.py        # Public API exports
│   ├── prepare.py         # Core functionality
│   └── cli.py             # CLI entry points
├── examples/               # ❌ Not installed (development only)
│   ├── example_query.py
│   └── query_duckdb_direct.py
├── generated-embeddings/   # ❌ Not installed (output directory)
├── pyproject.toml         # ✅ Package metadata
├── README.md              # ✅ Package documentation
├── QUERYING.md            # ✅ Included in package
└── embeddings.md          # ✅ Reference documentation
```

## Pre-Publication Checklist

- [x] Package structure follows Python conventions
- [x] Main code in `sqlrooms_rag/` package
- [x] Examples separated from package code
- [x] CLI entry point defined in `pyproject.toml`
- [x] Public API exported from `__init__.py`
- [ ] Add LICENSE file
- [ ] Add CHANGELOG.md
- [ ] Update version number
- [ ] Test installation locally
- [ ] Add CI/CD for testing

## Building the Package

### Using uv (recommended)

```bash
# Build the package (creates wheel and source distribution)
uv build

# This creates:
# dist/sqlrooms_rag-0.1.0a1-py3-none-any.whl
# dist/sqlrooms_rag-0.1.0a1.tar.gz
```

### Verify the build

```bash
# Check what's in the wheel
unzip -l dist/sqlrooms_rag-0.1.0a1-py3-none-any.whl

# Should include:
# - sqlrooms_rag/__init__.py
# - sqlrooms_rag/prepare.py
# - sqlrooms_rag/cli.py
# - sqlrooms_rag/generate_umap.py
# Should NOT include:
# - examples/
# - generated-embeddings/
```

## Testing Locally

Before publishing, test the package locally:

```bash
# Install in a fresh virtual environment
uv venv test-env
source test-env/bin/activate
uv pip install dist/sqlrooms_rag-0.1.0a1-py3-none-any.whl

# Test the CLI
prepare-embeddings --help

# Test the Python API
python -c "from sqlrooms_rag import prepare_embeddings; print('OK')"

# Deactivate and cleanup
deactivate
rm -rf test-env
```

## Publishing to TestPyPI (Recommended First)

Test the publishing process on TestPyPI first:

```bash
# Upload to TestPyPI
uv publish --publish-url https://test.pypi.org/legacy/

# Test installation from TestPyPI
pip install --index-url https://test.pypi.org/simple/ --pre sqlrooms-rag
```

You'll need a TestPyPI account and API token from https://test.pypi.org/manage/account/token/

Set credentials via environment variables:

```bash
export UV_PUBLISH_USERNAME=__token__
export UV_PUBLISH_PASSWORD=your-testpypi-token-here
```

## Publishing to PyPI

Once tested on TestPyPI:

```bash
# Upload to PyPI (uv will prompt for credentials if not set)
uv publish

# Verify installation (use --pre for prerelease versions)
pip install --pre sqlrooms-rag

# Test it works
prepare-embeddings --help
```

You'll need a PyPI account and API token from https://pypi.org/manage/account/token/

Set credentials via environment variables:

```bash
export UV_PUBLISH_USERNAME=__token__
export UV_PUBLISH_PASSWORD=your-pypi-token-here
```

## Post-Publication

After publishing:

1. **Tag the release in git:**

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **Update documentation** with PyPI installation instructions

3. **Announce** the release (GitHub, social media, etc.)

## Version Bumping

For future releases, update the version in `pyproject.toml`:

```toml
[project]
name = "sqlrooms-rag"
version = "0.2.0"  # <-- Update this
```

Follow [Semantic Versioning](https://semver.org/) with [PEP 440](https://peps.python.org/pep-0440/) for prerelease versions:

- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

**Prerelease versions:**

- `0.1.0a1` - Alpha prerelease 1
- `0.1.0b1` - Beta prerelease 1
- `0.1.0rc1` - Release candidate 1
- `0.1.0` - Stable release

Users need `pip install --pre sqlrooms-rag` or `pip install sqlrooms-rag==0.1.0a1` to install prerelease versions.

## Package Maintenance

### Adding Dependencies

Add to `pyproject.toml`:

```toml
[project]
dependencies = [
    "new-package>=1.0.0",
]
```

### CLI Commands

Additional CLI commands can be added to `sqlrooms_rag/cli.py` and registered in `pyproject.toml`:

```toml
[project.scripts]
prepare-embeddings = "sqlrooms_rag.cli:main"
query-embeddings = "sqlrooms_rag.cli:query_main"  # New command
```

### API Exports

Public API is defined in `sqlrooms_rag/__init__.py`:

```python
from .prepare import prepare_embeddings
from .query import query_embeddings  # New export

__all__ = ["prepare_embeddings", "query_embeddings"]
```

## Continuous Integration

Consider setting up GitHub Actions for:

- Running tests on PRs
- Building wheels on tags
- Auto-publishing to PyPI on release tags

Example `.github/workflows/publish.yml`:

```yaml
name: Publish to PyPI

on:
  release:
    types: [published]

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install uv
        uses: astral-sh/setup-uv@v2
        with:
          version: 'latest'
      - name: Set up Python
        run: uv python install 3.11
      - name: Build package
        run: uv build
      - name: Publish to PyPI
        run: uv publish
        env:
          UV_PUBLISH_USERNAME: __token__
          UV_PUBLISH_PASSWORD: ${{ secrets.PYPI_TOKEN }}
```

## Troubleshooting

### Package not found after installation

- Check `pyproject.toml` has correct `packages` configuration
- Verify `__init__.py` exists in package directory
- Rebuild the package

### CLI command not working

- Check `[project.scripts]` entry point syntax
- Ensure function exists: `sqlrooms_rag.cli:main`
- Try reinstalling: `pip install -e .`

### Import errors

- Verify `__init__.py` exports are correct
- Check relative imports use `.prepare` not `prepare`
- Ensure all dependencies are listed in `pyproject.toml`
