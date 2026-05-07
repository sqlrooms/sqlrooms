#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SPRITE_NAME="${SPRITE_NAME:-sqlrooms-cli-$(date +%Y%m%d-%H%M%S)}"
SPRITE_ORG="${SPRITE_ORG:-}"
APP_DIR="${APP_DIR:-/home/sprite/sqlrooms-cli}"
SERVICE_NAME="${SERVICE_NAME:-sqlrooms-cli}"
DB_PATH="${DB_PATH:-/home/sprite/sqlrooms-cli/sqlrooms.db}"
HTTP_PORT="${HTTP_PORT:-8080}"
WS_PORT="${WS_PORT:-4000}"
LOCAL_HTTP_PORT="${LOCAL_HTTP_PORT:-4173}"
LOCAL_WS_PORT="${LOCAL_WS_PORT:-4000}"
SQLROOMS_EXTRAS="${SQLROOMS_EXTRAS:-}"
SQLROOMS_SYNC="${SQLROOMS_SYNC:-0}"
PUBLIC_URL="${PUBLIC_URL:-1}"
RUN_PROXY="${RUN_PROXY:-0}"
SKIP_ROOT_BUILD="${SKIP_ROOT_BUILD:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"

usage() {
  cat <<'USAGE'
Deploy the local sqlrooms-cli package to a new Sprite.

Usage:
  scripts/deploy-sqlrooms-cli-to-sprite.sh [options]

Options:
  --name NAME          Sprite name. Default: sqlrooms-cli-YYYYmmdd-HHMMSS
  --org ORG           Sprites/Fly organization.
  --app-dir PATH      Remote install directory. Default: /home/sprite/sqlrooms-cli
  --db-path PATH      Remote DuckDB path. Default: /home/sprite/sqlrooms-cli/sqlrooms.db
  --http-port PORT    Remote UI HTTP port. Default: 8080
  --ws-port PORT      Remote DuckDB websocket port. Default: 4000
  --local-http PORT   Local proxied UI port. Default: 4173
  --local-ws PORT     Local proxied websocket port. Default: 4000
  --extras EXTRAS     sqlrooms-cli extras to install, e.g. connectors.
  --sync              Enable SQLRooms CRDT sync websocket support.
  --private           Keep the Sprite URL authenticated. Default is public.
  --proxy             Run sprite proxy after deployment for local debugging.
  --skip-build        Skip pnpm builds; still packages Python wheels for upload.
  --skip-root-build   Skip pnpm build before building the CLI UI bundle.
  -h, --help          Show this help.

Environment variables with matching uppercase names are also supported.

Notes:
  The script publishes the UI at the Sprite URL and tells the browser to use the
  Sprite websocket port URL for DuckDB, e.g. wss://<sprite>.sprites.dev:4000.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      SPRITE_NAME="$2"
      shift 2
      ;;
    --org)
      SPRITE_ORG="$2"
      shift 2
      ;;
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --db-path)
      DB_PATH="$2"
      shift 2
      ;;
    --http-port)
      HTTP_PORT="$2"
      shift 2
      ;;
    --ws-port)
      WS_PORT="$2"
      shift 2
      ;;
    --local-http)
      LOCAL_HTTP_PORT="$2"
      shift 2
      ;;
    --local-ws)
      LOCAL_WS_PORT="$2"
      shift 2
      ;;
    --extras)
      SQLROOMS_EXTRAS="$2"
      shift 2
      ;;
    --sync)
      SQLROOMS_SYNC=1
      shift
      ;;
    --private)
      PUBLIC_URL=0
      shift
      ;;
    --proxy)
      RUN_PROXY=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      SKIP_ROOT_BUILD=1
      shift
      ;;
    --skip-root-build)
      SKIP_ROOT_BUILD=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

sprite_exec() {
  if [[ -n "$SPRITE_ORG" ]]; then
    sprite exec -o "$SPRITE_ORG" -s "$SPRITE_NAME" "$@"
  else
    sprite exec -s "$SPRITE_NAME" "$@"
  fi
}

sprite_create() {
  if [[ -n "$SPRITE_ORG" ]]; then
    sprite create -o "$SPRITE_ORG" --skip-console "$SPRITE_NAME"
  else
    sprite create --skip-console "$SPRITE_NAME"
  fi
}

sprite_url() {
  if [[ -n "$SPRITE_ORG" ]]; then
    sprite url -o "$SPRITE_ORG" -s "$SPRITE_NAME"
  else
    sprite url -s "$SPRITE_NAME"
  fi
}

sprite_url_public() {
  if [[ -n "$SPRITE_ORG" ]]; then
    sprite url update -o "$SPRITE_ORG" -s "$SPRITE_NAME" --auth public
  else
    sprite url update -s "$SPRITE_NAME" --auth public
  fi
}

sprite_proxy() {
  if [[ -n "$SPRITE_ORG" ]]; then
    exec sprite proxy -o "$SPRITE_ORG" -s "$SPRITE_NAME" "$@"
  else
    exec sprite proxy -s "$SPRITE_NAME" "$@"
  fi
}

cleanup() {
  if [[ -n "${WORK_DIR:-}" && -d "$WORK_DIR" ]]; then
    rm -rf "$WORK_DIR"
  fi
}
trap cleanup EXIT

require_cmd sprite
require_cmd pnpm
require_cmd uv
require_cmd tar

WORK_DIR="$(mktemp -d)"
WHEEL_DIR="$WORK_DIR/wheels"
BUNDLE="$WORK_DIR/sqlrooms-cli-wheels.tgz"
REMOTE_INSTALL="$WORK_DIR/install-sqlrooms-cli-on-sprite.sh"
mkdir -p "$WHEEL_DIR"

echo "Building local SQLRooms packages..."
if [[ "$SKIP_BUILD" != "1" ]]; then
  if [[ "$SKIP_ROOT_BUILD" != "1" ]]; then
    (cd "$ROOT_DIR" && pnpm build)
  fi
  (cd "$ROOT_DIR/python/sqlrooms-cli" && pnpm build:ui)
else
  echo "Skipping pnpm builds; using the existing bundled CLI UI."
  if [[ ! -f "$ROOT_DIR/python/sqlrooms-cli/sqlrooms/web/static/index.html" ]]; then
    echo "Missing bundled CLI UI at python/sqlrooms-cli/sqlrooms/web/static/index.html." >&2
    echo "Run once without --skip-build so the UI is built and copied into the Python package." >&2
    exit 1
  fi
fi
uv build --project "$ROOT_DIR/python" --package sqlrooms-server --wheel --out-dir "$WHEEL_DIR"
uv build --project "$ROOT_DIR/python" --package sqlrooms-cli --wheel --out-dir "$WHEEL_DIR"
tar -C "$WHEEL_DIR" -czf "$BUNDLE" .

cat >"$REMOTE_INSTALL" <<'REMOTE'
#!/usr/bin/env bash
set -euo pipefail

: "${APP_DIR:?}"
: "${SERVICE_NAME:?}"
: "${DB_PATH:?}"
: "${HTTP_PORT:?}"
: "${WS_PORT:?}"
: "${SQLROOMS_EXTERNAL_URL:?}"
: "${SQLROOMS_EXTERNAL_WS_URL:?}"

mkdir -p "$APP_DIR/wheels" "$(dirname "$DB_PATH")"
tar -C "$APP_DIR/wheels" -xzf "$APP_DIR/sqlrooms-cli-wheels.tgz"

python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/python" -m pip install --upgrade pip wheel

server_wheel="$(find "$APP_DIR/wheels" -maxdepth 1 -name 'sqlrooms_server-*.whl' | head -n 1)"
cli_wheel="$(find "$APP_DIR/wheels" -maxdepth 1 -name 'sqlrooms_cli-*.whl' | head -n 1)"
if [[ -z "$server_wheel" || -z "$cli_wheel" ]]; then
  echo "Could not find sqlrooms-server and sqlrooms-cli wheels in $APP_DIR/wheels" >&2
  exit 1
fi

cli_requirement="$cli_wheel"
if [[ -n "${SQLROOMS_EXTRAS:-}" ]]; then
  cli_requirement="${cli_wheel}[${SQLROOMS_EXTRAS}]"
fi
"$APP_DIR/venv/bin/pip" install --force-reinstall "$server_wheel" "$cli_requirement"

sync_args=()
if [[ "${SQLROOMS_SYNC:-0}" == "1" ]]; then
  sync_args=(--sync)
fi

cat >"$APP_DIR/run-sqlrooms-cli.sh" <<RUNNER
#!/usr/bin/env bash
set -euo pipefail
exec "$APP_DIR/venv/bin/sqlrooms" \\
  --host 0.0.0.0 \\
  --port "$HTTP_PORT" \\
  --ws-port "$WS_PORT" \\
  --external-url "$SQLROOMS_EXTERNAL_URL" \\
  --external-ws-url "$SQLROOMS_EXTERNAL_WS_URL" \\
  --no-open-browser \\
  "$DB_PATH" \\
  "\${@}"
RUNNER
chmod +x "$APP_DIR/run-sqlrooms-cli.sh"

if [[ "${#sync_args[@]}" -gt 0 ]]; then
  sed -i 's/--no-open-browser \\/--no-open-browser \\\n  --sync \\/' "$APP_DIR/run-sqlrooms-cli.sh"
fi

sprite-env services create "$SERVICE_NAME" --cmd "$APP_DIR/run-sqlrooms-cli.sh"
sleep 2
"$APP_DIR/venv/bin/python" - <<PY
import sys
import urllib.request

url = "http://127.0.0.1:$HTTP_PORT/api/config"
try:
    with urllib.request.urlopen(url, timeout=10) as response:
        if response.status != 200:
            raise RuntimeError(f"unexpected HTTP status {response.status}")
except Exception as exc:
    print(f"SQLRooms service did not become healthy at {url}: {exc}", file=sys.stderr)
    sys.exit(1)
PY
REMOTE
chmod +x "$REMOTE_INSTALL"

echo "Creating Sprite: $SPRITE_NAME"
sprite_create

SPRITE_URL="$(sprite_url | grep -Eo 'https://[^[:space:]]+' | head -n 1)"
if [[ -z "$SPRITE_URL" ]]; then
  echo "Could not determine Sprite URL from 'sprite url' output." >&2
  exit 1
fi
SPRITE_URL="${SPRITE_URL%/}"
SPRITE_HOST="${SPRITE_URL#https://}"
SPRITE_WS_URL="wss://$SPRITE_HOST/ws/duckdb"

echo "Uploading wheels and starting sqlrooms-cli service..."
sprite_exec mkdir -p "$APP_DIR"
sprite_exec \
  --file "$BUNDLE:$APP_DIR/sqlrooms-cli-wheels.tgz" \
  --file "$REMOTE_INSTALL:$APP_DIR/install-sqlrooms-cli-on-sprite.sh" \
  --env "APP_DIR=$APP_DIR,SERVICE_NAME=$SERVICE_NAME,DB_PATH=$DB_PATH,HTTP_PORT=$HTTP_PORT,WS_PORT=$WS_PORT,SQLROOMS_EXTRAS=$SQLROOMS_EXTRAS,SQLROOMS_SYNC=$SQLROOMS_SYNC,SQLROOMS_EXTERNAL_URL=$SPRITE_URL,SQLROOMS_EXTERNAL_WS_URL=$SPRITE_WS_URL" \
  bash "$APP_DIR/install-sqlrooms-cli-on-sprite.sh"

if [[ "$PUBLIC_URL" == "1" ]]; then
  sprite_url_public
fi

echo
echo "Sprite deployed: $SPRITE_NAME"
echo "Remote service: $SERVICE_NAME"
echo "Online UI: $SPRITE_URL"
echo "Online DuckDB websocket: $SPRITE_WS_URL"
echo "Internal DuckDB websocket port: $WS_PORT"
echo
echo "Sprite URL settings:"
sprite_url
echo

if [[ "$RUN_PROXY" == "1" ]]; then
  echo "Opening optional local proxy. Visit: http://localhost:$LOCAL_HTTP_PORT"
  echo "The local websocket will be available at: ws://localhost:$LOCAL_WS_PORT"
  echo "Press Ctrl+C to stop the proxy; the Sprite service remains installed."
  sprite_proxy "$LOCAL_HTTP_PORT:$HTTP_PORT" "$LOCAL_WS_PORT:$WS_PORT"
fi

echo "To open a local debugging proxy later, run:"
echo "  sprite proxy ${SPRITE_ORG:+-o $SPRITE_ORG }-s $SPRITE_NAME $LOCAL_HTTP_PORT:$HTTP_PORT $LOCAL_WS_PORT:$WS_PORT"
