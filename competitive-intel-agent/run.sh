#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Use portal-injected DATABASE_URL if set, otherwise use the linked DB URL
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://competitive_dp_agent:35516d9089be55d258198201c2fee385@localhost:5432/competitive_dp_agent"
fi
exec "$SCRIPT_DIR/.venv/bin/python" "$SCRIPT_DIR/web_dashboard.py"
