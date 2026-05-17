#!/bin/bash
# ===========================================
# Talent Hub - Database Setup (fix "denied access")
# ===========================================
# Run this when you see: "User talent_hub was denied access on the database talent_hub.public"
#
# Usage: ./scripts/setup-database.sh [--reset]
#   --reset  Reset Postgres volume (fixes stale permissions, wipes data)

set -e

cd "$(dirname "$0")/.."
RESET_VOLUME=false
[[ "$1" == "--reset" ]] && RESET_VOLUME=true

echo "==> Checking Docker..."
if command -v docker &>/dev/null; then
  echo "    Docker found."
  if [[ "$RESET_VOLUME" == "true" ]]; then
    echo "==> Resetting Postgres volume (fixes stale permissions)..."
    docker compose stop postgres 2>/dev/null || true
    rm -rf .docker-data/postgres 2>/dev/null || true
  fi
  if ! docker compose ps postgres 2>/dev/null | grep -q "Up"; then
    echo "==> Starting Postgres..."
    docker compose up -d postgres
    echo "==> Waiting for Postgres to be ready..."
    sleep 8
    until docker compose exec -T postgres pg_isready -U talent_hub 2>/dev/null; do
      sleep 2
    done
    echo "    Postgres is ready."
  else
    echo "    Postgres already running."
  fi
else
  echo "    Docker not found. Using system Postgres."
  echo "    Ensure user 'talent_hub' and database 'talent_hub' exist."
  echo "    Run as postgres superuser:"
  echo "      CREATE USER talent_hub WITH PASSWORD 'talent_hub_dev';"
  echo "      CREATE DATABASE talent_hub OWNER talent_hub;"
  echo "      GRANT ALL PRIVILEGES ON DATABASE talent_hub TO talent_hub;"
  echo "      GRANT ALL ON SCHEMA public TO talent_hub;"
  echo ""
  read -p "Press Enter when Postgres is ready..."
fi

echo "==> Pushing schema..."
npm run db:push

echo "==> Seeding demo data..."
npm run db:seed

echo ""
echo "==> Done. Start the dev server with: npm run dev"
