#!/bin/bash

set -eu

echo "=> Cleanup cached media"

cd /app/code
./bin/tootctl media remove
