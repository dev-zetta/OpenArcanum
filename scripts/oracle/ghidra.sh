#!/usr/bin/env bash
set -euo pipefail
oracle_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
readarray -t oracle_tools < <(python3 - "$oracle_root" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1]) / 'local-data/tools'
for name in ('ghidra', 'jdk'):
    record = root / name / 'provenance.json'
    if not record.exists():
        raise SystemExit('Run python3 scripts/oracle/install-ghidra.py first')
    print(root / name / json.loads(record.read_text())['directory'])
PY
)
if [[ "${#oracle_tools[@]}" -ne 2 ]]; then exit 1; fi
export JAVA_HOME="${oracle_tools[1]}"
export PATH="$JAVA_HOME/bin:$PATH"
if [[ "${1:-}" == "--headless" ]]; then
  shift
  exec "${oracle_tools[0]}/support/analyzeHeadless" "$@"
fi
exec "${oracle_tools[0]}/support/launch.sh" fg jdk Ghidra 2G "" ghidra.GhidraRun "$@"
