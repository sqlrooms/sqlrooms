#!/bin/sh
# Run this as the Sprite service owner, never as root. Only namespace setup is
# privileged; Node and all package/configuration code execute after setpriv.
set -eu
[ "$#" = 2 ] || { echo 'Usage: sprite-service.sh RUNTIME_DIRECTORY SERVICE_CONFIG' >&2; exit 2; }
case "$1:$2" in /*:/*) ;; *) exit 2;; esac
owner_uid=$(id -u)
owner_gid=$(id -g)
[ "$owner_uid" -ne 0 ]
owner_name=$(id -un)
package_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec /usr/bin/sudo -n --preserve-env=OPENAI_API_KEY,ANTHROPIC_API_KEY \
  /usr/bin/unshare --mount --mount-proc \
  /usr/bin/setpriv --reuid="$owner_uid" --regid="$owner_gid" --clear-groups \
    --bounding-set=-all --inh-caps=-all --ambient-caps=-all \
    --no-new-privs --pdeathsig=KILL \
  /usr/bin/env HOME="$HOME" USER="$owner_name" LOGNAME="$owner_name" PATH="$1/bin:/usr/bin:/bin" \
  "$1/bin/node" "$package_root/bin/roomie-sprite.mjs" "$2"
