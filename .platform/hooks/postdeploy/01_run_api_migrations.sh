#!/bin/bash
set -euo pipefail

cd /var/app/current

echo "Running API migrations..."
npm --workspace apps/api run migrate
echo "API migrations complete."
