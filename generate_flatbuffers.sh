#!/bin/sh
cd /home/maxli/OpenArcanum/@openarcanum/agate/src/shared/entity/schemas
#pushd "$(dirname $0)" >/dev/null
flatc --js --json --gen-all --es6-js-export --short-names entity.fbs
