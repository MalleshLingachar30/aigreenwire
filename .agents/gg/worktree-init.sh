#!/usr/bin/env bash
set -euo pipefail

npm install

if [[ -f ../.env.local && ! -f .env.local ]]; then
  cp ../.env.local .env.local
fi
