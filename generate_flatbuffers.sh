#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$project_dir/@openarcanum/agate/src/shared/entity/schemas"
exec flatc --js --json --gen-all --es6-js-export --short-names entity.fbs
