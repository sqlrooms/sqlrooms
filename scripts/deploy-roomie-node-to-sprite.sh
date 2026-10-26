#!/usr/bin/env bash
# Initial installation only. Keeps the existing Sprite URL authentication policy.
set -euo pipefail
if [[ $# != 3 ]]; then
  echo 'Usage: deploy-roomie-node-to-sprite.sh SPRITE TARBALL HTTPS_ORIGIN' >&2
  exit 2
fi
sprite_name=$1
archive=$2
origin=$3
[[ "$sprite_name" =~ ^[a-z0-9][a-z0-9-]*$ ]] || exit 2
[[ -f "$archive" ]] || exit 2
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
node --input-type=module - "$origin" "$stage/config.json" <<'JS'
import {writeFileSync} from 'node:fs';
const origin = process.argv[2];
if (new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin)
  throw Error('Expected an exact HTTPS origin');
writeFileSync(process.argv[3], JSON.stringify({
  directory: '/home/sprite/roomie-workspace',
  port: 8080,
  publicOrigin: origin,
}) + '\n');
JS
cat > "$stage/install.sh" <<'REMOTE'
#!/bin/sh
set -eu
node -e 'if (process.versions.node.split(".")[0] !== "24" || Number(process.versions.node.split(".")[1]) < 9) throw Error("Node 24.9–24.x required")'
# Refuse an existing install or workspace: updates require an explicit stop/backup.
[ ! -e /home/sprite/roomie-service ]
[ ! -e /home/sprite/roomie-workspace ]
umask 077
mkdir /home/sprite/roomie-service
cp /tmp/roomie-service-config.json /home/sprite/roomie-service/config.json
npm install --prefix /home/sprite/roomie-service --ignore-scripts --no-audit --no-fund /tmp/roomie-service-release.tgz
sprite-env services create roomie --cmd "$(command -v node)" \
  --args /home/sprite/roomie-service/node_modules/@sqlrooms/roomie-node/bin/roomie-sprite.mjs,/home/sprite/roomie-service/config.json \
  --http-port 8080 --no-stream
rm /tmp/roomie-service-release.tgz /tmp/roomie-service-config.json /tmp/roomie-service-install.sh
REMOTE
sprite exec -s "$sprite_name" \
  --file "$archive:/tmp/roomie-service-release.tgz" \
  --file "$stage/config.json:/tmp/roomie-service-config.json" \
  --file "$stage/install.sh:/tmp/roomie-service-install.sh" \
  sh /tmp/roomie-service-install.sh
