# Publishing SQLRooms and Roomie

Run all commands below from the repository root. SQLRooms and Roomie are
independently versioned Python distributions. These instructions do not publish
the independently maintained `sqlrooms-rag` package or the npm packages.

## Prerequisites

- Node 24, pnpm 11, uv, and Python >=3.10 available as `python`.
- PyPI permission to publish each target package. Verify ownership of the
  `roomie` name separately; an available-looking name does not establish rights
  to publish it.
- A compatible SQLRooms release published before Roomie. It must contain the
  shared runtime and application adapters used by Roomie.

```sh
pnpm install
```

Roomie requires `sqlrooms>=0.1.6,<0.2`. Its current upload preflight specifically
checks for a non-yanked SQLRooms **0.1.6** wheel on PyPI, even when a newer release
satisfies the dependency range. If changing the prerequisite version, update the
[release check](roomie/scripts/check_release.py) accordingly.

## PyPI Authentication

Uploads use `uvx twine upload`. Configure a PyPI API token authorized for the
package being released:

```sh
export TWINE_USERNAME=__token__
```

Supply the token securely through `TWINE_PASSWORD` using a secret manager or
enter it at Twine's password prompt. Switch credentials when needed between
packages. Do not commit tokens or paste them into chat. The release scripts do
not configure credentials or Trusted Publishing.

## Publish SQLRooms

The following example releases **0.1.6**. Choose an unpublished version for a new
release; skip this section if the compatible runtime is already published.

```sh
# Set the intended release version explicitly.
pnpm cli:version --target sqlrooms --set 0.1.6

# Build the UI and distributions, verify the wheel, and run Python checks.
pnpm cli:publish:dry --target sqlrooms
```

The dry run runs Python tests, lint, and formatting checks without uploading.
Once validation passes and PyPI authentication is configured:

```sh
# Rerun validation/builds and upload distributions to PyPI through Twine.
pnpm cli:publish --target sqlrooms

# Smoke-test the published package in an isolated tool environment.
uvx --from 'sqlrooms==0.1.6' sqlrooms --help
```

Artifacts are written to `python/dist/`. Default wheel verification selects the
version in `python/sqlrooms/package.json`, ignoring older-version wheels.

## Publish Roomie

After publishing the compatible SQLRooms runtime, choose Roomie's version. This
example uses **0.1.0** for the initial release.

```sh
pnpm cli:version --target roomie --set 0.1.0

# Build bundled assets and distributions, verify the wheel, and run checks.
pnpm roomie:publish:dry
```

The Roomie dry run builds its UI dependency graph, runs Python tests and Ruff,
and verifies bundled wheel contents. It installs the paired local checkout into
`python/.venv` with a development dependency override; it does **not** verify
public dependency resolution or run the PyPI prerequisite check.

Before uploading, install the built Roomie wheel in an isolated tool environment
with normal dependency resolution against PyPI:

```sh
uvx --from './python/roomie/dist/roomie-0.1.0-py3-none-any.whl' roomie --help
```

Also exercise workspace startup and the shared runtime integration using this
wheel against the published dependency; `--help` alone is only an installation
and CLI smoke test. Review the remaining platform and integration release gates
in [Roomie's verification record](roomie/VERIFICATION.md).

Once these checks pass and authentication is authorized for `roomie`:

```sh
# Rerun validation/builds, check the SQLRooms prerequisite, and upload.
pnpm cli:publish --target roomie

# Smoke-test the published Roomie package.
uvx --from 'roomie==0.1.0' roomie --help
```

Artifacts are written to `python/roomie/dist/`. The build synchronizes plugin
and bundled version metadata from `python/roomie/package.json`.

## Subsequent Releases

Publishing does not change versions. Bump only the package being released, or
use `--set` to choose its version explicitly:

```sh
pnpm cli:version --target sqlrooms --bump patch
pnpm cli:version --target roomie --bump patch
```

These are independent commands, not a requirement to bump both packages. Replace
the example versions in wheel paths and smoke-test commands with the versions
you intend to publish. PyPI does not allow replacing an already uploaded
artifact. The uploader uses `--skip-existing` and package-wide artifact globs,
so review the corresponding distribution directory for stale unpublished
artifacts before uploading.
