# query-websocket example

Uses the authenticated DuckDB transport from the consolidated `sqlrooms` Python
distribution. Build workspace packages before running examples.

```sh
pnpm build
cd python
uv run --package sqlrooms sqlrooms server --db-path ./example.duckdb --port 4000 --external-url http://localhost:5173
# In another terminal at the repository root:
pnpm dev query-websocket-example
```

Vite uses port 5173 (strict) for HMR and proxies `/auth.json`, `/api`,
`/ws/duckdb`, and `/ws/mcp-bridge` to port 4000. The explicit external URL
binds page authorization to this development origin. Run one example at a time.

The backend prints a private credential-file path. Use it from a local terminal
to request a single-use browser launch ticket:

```sh
python - /path/from/log/credential.json <<'PY'
import json, sys, urllib.request
from pathlib import Path
credential = json.loads(Path(sys.argv[1]).read_text())
request = urllib.request.Request(credential['apiUrl'] + '/api/auth/ticket',
    method='POST', headers={'Authorization': 'Bearer ' + credential['token']})
print(json.load(urllib.request.urlopen(request))['url'])
PY
```

Open the returned link. The example exchanges its fragment ticket, removes it
from the address bar, checks the backend binding and renews a tab-local page
credential. A backend restart needs a fresh link. Do not put native credentials
or provider keys in `VITE_*` variables or disable authentication.

For sync examples, change the room with `VITE_SYNC_ROOM_ID`; snapshots persist
in the database metadata namespace.

See [Python runtime documentation](../../python/sqlrooms/README.md) and
[migration](../../python/sqlrooms/MIGRATION.md) for the wire protocol and limits.
