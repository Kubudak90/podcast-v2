#!/bin/sh
# Vite bakes VITE_API_URL into the browser bundle. An empty value becomes ""
# and the client falls back to http://localhost:3001, so every visitor calls
# their own machine. Fail the image build instead.
set -e

trimmed=$(printf '%s' "${VITE_API_URL-}" | tr -d '[:space:]')
if [ -z "$trimmed" ]; then
  echo "VITE_API_URL build arg is required. An empty value makes the site call the visitor's localhost." >&2
  exit 1
fi
