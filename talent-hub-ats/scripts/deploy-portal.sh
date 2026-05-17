#!/usr/bin/env bash
# =============================================================================
# deploy-portal.sh — Deploy hiring-portal to experiments.[company-domain]
#
# Usage:
#   bash scripts/deploy-portal.sh
#
# Requirements:
#   - ~/.dreamplay/credentials.json with apiKey (run /dpgo-login if missing)
#   - .env.portal in project root (copy from .env.portal.example and fill in)
# =============================================================================

set -e
cd "$(dirname "$0")/.."  # always run from project root

APP_NAME="hiring-portal"
BASE_PATH="/$APP_NAME"
PORTAL_API="https://experiments.[company-domain]/api"

# ── 0. Auth ──────────────────────────────────────────────────────────────────
API_KEY=$(jq -r '.apiKey // empty' ~/.dreamplay/credentials.json 2>/dev/null)
if [ -z "$API_KEY" ]; then
  echo "❌ No API key found. Run /dpgo-login first."
  exit 1
fi

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$PORTAL_API/apps")
if [ "$STATUS" != "200" ]; then
  echo "❌ API key invalid (HTTP $STATUS). Run /dpgo-login to refresh."
  exit 1
fi
echo "✓ Authenticated"

# ── 1. Check .env.portal ─────────────────────────────────────────────────────
if [ ! -f .env.portal ]; then
  echo "❌ .env.portal not found. Copy .env.portal.example and fill in values."
  exit 1
fi
echo "✓ .env.portal found"

# ── 2. Prisma generate (with all binary targets) ─────────────────────────────
echo "→ Generating Prisma client..."
packages/db/node_modules/.bin/prisma generate \
  --schema packages/db/prisma/schema.prisma 2>&1 | tail -3
echo "✓ Prisma client generated"

# ── 3. Build Next.js directly (NOT via turbo — turbo doesn't pass env vars) ──
echo "→ Building Next.js (this takes ~30s)..."
cd apps/web
BASE_PATH="$BASE_PATH" \
NEXT_PUBLIC_BASE_PATH="$BASE_PATH" \
  npx next build 2>&1 | tail -5
cd ../..

# Verify basePath baked in
BAKED=$(cat apps/web/.next/routes-manifest.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('basePath',''))" 2>/dev/null)
if [ "$BAKED" != "$BASE_PATH" ]; then
  echo "❌ Build has wrong basePath: '$BAKED' (expected '$BASE_PATH'). Aborting."
  exit 1
fi
echo "✓ Build complete (basePath: $BAKED)"

# ── 4. Assemble deploy folder ─────────────────────────────────────────────────
echo "→ Assembling deploy package..."
DEPLOY_DIR=$(mktemp -d)/deploy
mkdir -p "$DEPLOY_DIR"

# Standalone output
cp -r apps/web/.next/standalone/* "$DEPLOY_DIR/"

# Static assets (must be copied manually for standalone)
cp -r apps/web/.next/static "$DEPLOY_DIR/apps/web/.next/static"
cp -r apps/web/public "$DEPLOY_DIR/apps/web/public" 2>/dev/null || true

# Portal config
cp dreamplay.json "$DEPLOY_DIR/"

# Fix: Prisma engine binaries (standalone puts them under packages/db/node_modules/
# but Prisma runtime looks in node_modules/.prisma/client and node_modules/@prisma/client)
mkdir -p "$DEPLOY_DIR/node_modules/.prisma" "$DEPLOY_DIR/node_modules/@prisma"
cp -r "$DEPLOY_DIR/packages/db/node_modules/.prisma/client" "$DEPLOY_DIR/node_modules/.prisma/client"
cp -r "$DEPLOY_DIR/packages/db/node_modules/@prisma/client"  "$DEPLOY_DIR/node_modules/@prisma/client"

# Fix: Prisma CLI for db push on startup (not traced by Next.js, must be included manually)
mkdir -p "$DEPLOY_DIR/packages/db/node_modules/.bin"
cp -r packages/db/node_modules/prisma "$DEPLOY_DIR/packages/db/node_modules/prisma"
cp packages/db/node_modules/.bin/prisma "$DEPLOY_DIR/packages/db/node_modules/.bin/prisma"
chmod +x "$DEPLOY_DIR/packages/db/node_modules/.bin/prisma"  # zip strips execute bits

# Fix: @prisma/engines needed by Prisma CLI at runtime (not traced by Next.js)
cp -r packages/db/node_modules/@prisma/engines         "$DEPLOY_DIR/packages/db/node_modules/@prisma/engines"
cp -r packages/db/node_modules/@prisma/engines-version "$DEPLOY_DIR/packages/db/node_modules/@prisma/engines-version"
cp -r packages/db/node_modules/@prisma/fetch-engine    "$DEPLOY_DIR/packages/db/node_modules/@prisma/fetch-engine"
cp -r packages/db/node_modules/@prisma/get-platform    "$DEPLOY_DIR/packages/db/node_modules/@prisma/get-platform"
cp -r packages/db/node_modules/@prisma/debug           "$DEPLOY_DIR/packages/db/node_modules/@prisma/debug"

# Fix: schema.prisma needed by db push at runtime
mkdir -p "$DEPLOY_DIR/packages/db/prisma"
cp packages/db/prisma/schema.prisma "$DEPLOY_DIR/packages/db/prisma/schema.prisma"

# Env file baked into ZIP (chunked upload has no separate env param)
# Placed at deploy root (for start command: `. .env`) AND at apps/web/
# (server.js does process.chdir(__dirname) → Next.js loads .env from apps/web/)
cp .env.portal "$DEPLOY_DIR/.env"
cp .env.portal "$DEPLOY_DIR/apps/web/.env"

SIZE=$(du -sh "$DEPLOY_DIR" | cut -f1)
echo "✓ Deploy package assembled ($SIZE)"

# ── 5. Zip ────────────────────────────────────────────────────────────────────
echo "→ Zipping..."
ZIP_FILE="/tmp/dpgo-deploy-$APP_NAME.zip"
cd "$DEPLOY_DIR"
zip -r "$ZIP_FILE" . --exclude "*.log" > /dev/null
cd -
ZIP_SIZE=$(stat -f%z "$ZIP_FILE" 2>/dev/null || stat -c%s "$ZIP_FILE")
ZIP_MB=$(( ZIP_SIZE / 1024 / 1024 ))
echo "✓ ZIP: ${ZIP_MB}MB"

# ── 6. Upload & deploy ────────────────────────────────────────────────────────
DESCRIPTION="Talent Hub — In-house ATS built on Next.js"
THRESHOLD=$(( 100 * 1024 * 1024 ))

if [ "$ZIP_SIZE" -le "$THRESHOLD" ]; then
  echo "→ Uploading (single POST)..."
  RESULT=$(curl -s -X POST "$PORTAL_API/deploy" \
    -H "Authorization: Bearer $API_KEY" \
    -F "zip=@$ZIP_FILE" \
    -F "name=$APP_NAME" \
    -F "description=$DESCRIPTION" \
    -F "provisionDb=false" \
    -F "wipeDb=false")
else
  echo "→ Uploading in chunks (ZIP > 100MB)..."
  CHUNK_SIZE=$(( 50 * 1024 * 1024 ))
  TOTAL_CHUNKS=$(( (ZIP_SIZE + CHUNK_SIZE - 1) / CHUNK_SIZE ))
  UPLOAD_ID=$(uuidgen 2>/dev/null || date +%s%N | sha256sum | head -c 32)

  for i in $(seq 0 $(( TOTAL_CHUNKS - 1 ))); do
    echo "  Chunk $(( i + 1 ))/$TOTAL_CHUNKS..."
    dd if="$ZIP_FILE" bs=$CHUNK_SIZE skip=$i count=1 2>/dev/null | \
      curl -s -X POST "$PORTAL_API/upload/chunk" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/octet-stream" \
        -H "X-Upload-Id: $UPLOAD_ID" \
        -H "X-Chunk-Index: $i" \
        -H "X-Total-Chunks: $TOTAL_CHUNKS" \
        -H "X-Filename: $(basename $ZIP_FILE)" \
        --data-binary @- > /dev/null
  done

  echo "→ Assembling on server..."
  RESULT=$(curl -s -X POST "$PORTAL_API/upload/complete" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"uploadId\":\"$UPLOAD_ID\",\"deployType\":\"zip\",\"name\":\"$APP_NAME\",\"description\":\"$DESCRIPTION\",\"provisionDb\":false,\"wipeDb\":false}")
fi

# ── 7. Cleanup ────────────────────────────────────────────────────────────────
rm -rf "$ZIP_FILE" "$(dirname $DEPLOY_DIR)"

# ── 8. Result ─────────────────────────────────────────────────────────────────
SUCCESS=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('success','false'))" 2>/dev/null)

if [ "$SUCCESS" = "True" ] || echo "$RESULT" | grep -q '"success":true'; then
  echo ""
  echo "✅ Deployed! https://experiments.[company-domain]/$APP_NAME/"
else
  echo ""
  echo "❌ Deploy failed:"
  echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
  exit 1
fi
