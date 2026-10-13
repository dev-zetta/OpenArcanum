#!/usr/bin/env bash
# Project-local Fedora Wine (new WoW64); never changes the system installation.
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
tool_dir="$project_dir/local-data/tools/wine"
native_dir="$tool_dir/root/usr/lib64/wine-wow64/wine"
if [[ ! -x "$tool_dir/root/usr/bin/wine64" ]]; then
  printf '%s\n' 'Local Wine is missing. Run scripts/oracle/install-wine.sh first.' >&2
  exit 1
fi
export WINEPREFIX="${WINEPREFIX:-$project_dir/local-data/reference/wineprefix}"
WINEPREFIX="$(realpath -m -- "$WINEPREFIX")"
case "$WINEPREFIX" in
  "$project_dir/local-data/reference/"*) ;;
  *) printf '%s\n' 'The oracle WINEPREFIX must be inside project/local-data/reference.' >&2; exit 1 ;;
esac
export WINESERVER="$tool_dir/root/usr/bin/wineserver64"
export WINELOADER="$tool_dir/root/usr/bin/wine64"
export WINEDLLPATH="$native_dir${WINEDLLPATH:+:$WINEDLLPATH}"
export LD_LIBRARY_PATH="$native_dir/x86_64-unix:$tool_dir/root/usr/lib64${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export XDG_CACHE_HOME="$project_dir/local-data/reference/cache"
export XDG_CONFIG_HOME="$project_dir/local-data/reference/config"
export XDG_DATA_HOME="$project_dir/local-data/reference/data"
# Disable desktop-menu integration and optional .NET/HTML installers for the oracle.
export WINEDLLOVERRIDES="${WINEDLLOVERRIDES:-winemenubuilder.exe=;mscoree,mshtml=}"
export WINEDEBUG="${WINEDEBUG:--all}"
mingw_dir="$tool_dir/root/usr/x86_64-w64-mingw32/sys-root/mingw/bin"
mingw_windows="Z:${mingw_dir//\//\\}"
export WINEPATH="$mingw_windows${WINEPATH:+;$WINEPATH}"
mkdir -p -- "$XDG_CACHE_HOME" "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$(dirname -- "$WINEPREFIX")"
if [[ "${1:-}" == --server ]]; then
  shift
  exec "$WINESERVER" "$@"
fi
exec "$tool_dir/root/usr/bin/wine64" "$@"
