#!/bin/sh
set -e

# Named volumes are root:root. Uploads, covers, and room recordings live in
# /recordings. Own the directory itself (not every existing file) so this
# user can create uploads/ and covers/, then drop root. Egress files stay
# as they are; unlink permission follows the directory.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /recordings
  chown nodejs:nodejs /recordings
  exec su-exec nodejs "$@"
fi

exec "$@"
