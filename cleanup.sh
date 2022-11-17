#!/bin/bash

set -eu

echo "=> Cleanup"
cd /app/code

echo "==> media cache ..."
./bin/tootctl media remove --days=7

echo "==> orphaned media ..."
./bin/tootctl media remove-orphans

echo "==> preview cards.."
./bin/tootctl preview-cards remove --days=7
