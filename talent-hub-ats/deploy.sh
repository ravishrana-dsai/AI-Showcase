#!/bin/bash
# ===========================================
# Talent Hub - EC2 Deployment Script
# ===========================================
# Run this on your EC2 instance after cloning the repo.
# Requires: Docker, Docker Compose v2, git

set -e

FIRST_RUN=false

echo "==> Checking .env..."
if [ ! -f .env ]; then
  if [ -f .env.production.example ]; then
    echo "ERROR: .env not found. Copy .env.production.example to .env and fill in your values."
    echo "  cp .env.production.example .env"
    echo "  nano .env"
    exit 1
  fi
fi

echo "==> Preparing directories..."
mkdir -p certbot-webroot ssl

echo "==> Building and starting services..."
docker compose pull postgres redis minio nginx
docker compose build app
docker compose up -d postgres redis minio

echo "==> Waiting for Postgres to be ready..."
until docker compose exec -T postgres pg_isready -U talent_hub > /dev/null 2>&1; do
  sleep 1
done
echo "    Postgres is ready."

echo "==> Pushing database schema..."
# Use db push (schema in repo); use migrate deploy if you have migrations/
docker compose run --rm --no-deps \
  -e DATABASE_URL="${DATABASE_URL}" \
  app \
  sh -c "cd packages/db && npx prisma db push --schema=prisma/schema.prisma"

# Check if this is the first run (no users exist yet)
USER_COUNT=$(docker compose run --rm --no-deps \
  -e DATABASE_URL="${DATABASE_URL}" \
  app \
  sh -c "cd packages/db && node -e \"
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.user.count().then(n => { console.log(n); process.exit(0); }).catch(() => { console.log(0); process.exit(0); });
  \"" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  FIRST_RUN=true
  echo "==> First run detected - seeding initial data..."
  docker compose run --rm --no-deps \
    -e DATABASE_URL="${DATABASE_URL}" \
    app \
    sh -c "cd packages/db && npm run seed"
fi

echo "==> Starting app and nginx..."
docker compose up -d

echo "==> Waiting for MinIO bucket..."
docker compose up minio-init

echo ""
echo "===================================="
echo "  Talent Hub is live!"
echo "  URL: ${NEXTAUTH_URL:-http://localhost}"
if [ "$FIRST_RUN" = "true" ]; then
  echo ""
  echo "  Default login (change after first login):"
  echo "  Email:    admin@dream-sports.com"
  echo "  Password: admin123"
fi
echo "===================================="
