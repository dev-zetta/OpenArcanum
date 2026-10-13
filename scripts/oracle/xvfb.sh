#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
tool_dir="$project_dir/local-data/tools/wine"
export LD_LIBRARY_PATH="$tool_dir/root/usr/lib64${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec "$tool_dir/root/usr/bin/Xvfb" "$@"
