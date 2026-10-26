#!/bin/sh
# Explicit trusted runtime provisioning. Never copy a user's harness home or login.
set -eu
[ "$#" = 1 ] || { echo 'Usage: provision.sh NEW_ABSOLUTE_RUNTIME_DIRECTORY' >&2; exit 2; }
case "$1" in /*) ;; *) exit 2;; esac
[ "$(uname -s)" = Linux ]
[ ! -e "$1" ]
node_binary=$(node -p 'process.execPath')
bwrap_binary=$(command -v bwrap)
node -e 'if (process.versions.node.split(".")[0] !== "24") throw Error("Node 24 required")'
umask 022
mkdir -p "$1/bin"
cp "$node_binary" "$1/bin/node"
cp "$bwrap_binary" "$1/bin/bwrap"
npm install --prefix "$1" --ignore-scripts --no-audit --no-fund \
  @openai/codex@0.163.0 @anthropic-ai/claude-code@2.1.310
# The pinned Claude package requires its native-binary installer.
"$1/bin/node" "$1/node_modules/@anthropic-ai/claude-code/install.cjs"
ln -s ../node_modules/.bin/codex "$1/bin/codex"
ln -s ../node_modules/.bin/claude "$1/bin/claude"
"$1/bin/codex" --version
"$1/bin/claude" --version
