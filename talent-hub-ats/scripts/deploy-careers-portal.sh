#!/usr/bin/env bash
# =============================================================================
# deploy-careers-portal.sh — Build & deploy public careers app (apps/careers-portal)
#
# Prerequisites: ~/.dreamplay/credentials.json with apiKey (run /dpgo-login)
# Env: repo root `.env.careers.portal` (see apps/careers-portal/.env.careers.example)
#   - HIRING_PORTAL_URL — hiring portal origin, no trailing slash
#   - BASE_PATH / NEXT_PUBLIC_BASE_PATH — empty for careers.dreamplayai.com; /careers for Experiments path
# =============================================================================

set -e
cd "$(dirname "$0")/.."

APP_NAME="careers"
PORTAL_API="https://experiments.[company-domain]/api"
WEB_APP_DIR="apps/careers-portal"
ENV_FILE=".env.careers.portal"

API_KEY=$(jq -r '.apiKey // empty' ~/.dreamplay/credentials.json 2>/dev/null)
if [ -z "$API_KEY" ]; then
  echo "❌ No API key found. Run /dpgo-login first."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE not found at repo root. Copy apps/careers-portal/.env.careers.example"
  exit 1
fi

# Read BASE_PATH and NEXT_PUBLIC_BASE_PATH from env file (default /careers if key missing)
eval "$(python3 <<'PY'
import re
from pathlib import Path

def get(text: str, key: str, default: str) -> str:
    m = re.search(rf"^{re.escape(key)}=(.*)$", text, re.MULTILINE)
    if not m:
        return default
    return m.group(1).strip().strip('"').strip("'")

text = Path(".env.careers.portal").read_text(encoding="utf-8")
base = get(text, "BASE_PATH", "/careers")
pub = get(text, "NEXT_PUBLIC_BASE_PATH", base)
app = get(text, "APP_URL", "")
# bash-safe single-quoted strings
def shq(s: str) -> str:
    return "'" + s.replace("'", "'\"'\"'") + "'"

print(f"export CAREERS_BASE={shq(base)}")
print(f"export CAREERS_PUBLIC={shq(pub)}")
print(f"export APP_URL_DISPLAY={shq(app)}")
PY
)"

echo "✓ Step 1: $ENV_FILE found — build BASE_PATH='${CAREERS_BASE:-<empty>}' NEXT_PUBLIC_BASE_PATH='${CAREERS_PUBLIC:-<empty>}'"
if ! grep -qE '^[[:space:]]*HIRING_PORTAL_INTERNAL_URL=' "$ENV_FILE" 2>/dev/null; then
  echo "ℹ️  If the careers site lists no jobs on [Company] Experiments, set HIRING_PORTAL_INTERNAL_URL in $ENV_FILE (see apps/careers-portal/.env.careers.example) — public URL is often behind SSO for server-side fetch."
fi
echo "✓ Step 2: ~/.dreamplay/credentials.json apiKey present"

echo "→ Step 3: After deploy, Experiments app '$APP_NAME' must stay isPublic if you still use experiments.[company-domain]/careers; for careers.dreamplayai.com use DNS + your host."

echo "→ Building $WEB_APP_DIR..."
cd "$WEB_APP_DIR"
export BASE_PATH="${CAREERS_BASE}"
export NEXT_PUBLIC_BASE_PATH="${CAREERS_PUBLIC}"
npx next build 2>&1 | tail -12
cd ../..

BAKED=$(python3 -c "import json; print(json.load(open('$WEB_APP_DIR/.next/routes-manifest.json')).get('basePath',''))" 2>/dev/null || echo "__missing__")
if [ "$BAKED" != "${CAREERS_BASE}" ]; then
  echo "❌ Build basePath mismatch: routes-manifest has '${BAKED}' expected '${CAREERS_BASE}'."
  exit 1
fi

echo "→ Assembling deploy package..."
DEPLOY_DIR=$(mktemp -d)/deploy
mkdir -p "$DEPLOY_DIR"

cp -r "$WEB_APP_DIR/.next/standalone/"* "$DEPLOY_DIR/"
cp -r "$WEB_APP_DIR/.next/static" "$DEPLOY_DIR/$WEB_APP_DIR/.next/static"
cp -r "$WEB_APP_DIR/public" "$DEPLOY_DIR/$WEB_APP_DIR/public" 2>/dev/null || true

cp "$WEB_APP_DIR/dreamplay.json" "$DEPLOY_DIR/"

cp "$ENV_FILE" "$DEPLOY_DIR/.env"
cp "$ENV_FILE" "$DEPLOY_DIR/$WEB_APP_DIR/.env"

ZIP_FILE="/tmp/dpgo-deploy-$APP_NAME.zip"
cd "$DEPLOY_DIR"
zip -r "$ZIP_FILE" . --exclude "*.log" > /dev/null
cd -
ZIP_SIZE=$(stat -f%z "$ZIP_FILE" 2>/dev/null || stat -c%s "$ZIP_FILE")
ZIP_MB=$(( ZIP_SIZE / 1024 / 1024 ))
echo "✓ ZIP ${ZIP_MB}MB"

DESCRIPTION="Talent Hub — Public careers site (Next.js)"
THRESHOLD=$(( 100 * 1024 * 1024 ))

if [ "$ZIP_SIZE" -le "$THRESHOLD" ]; then
  RESULT=$(curl -s -X POST "$PORTAL_API/deploy" \
    -H "Authorization: Bearer $API_KEY" \
    -F "zip=@$ZIP_FILE" \
    -F "name=$APP_NAME" \
    -F "description=$DESCRIPTION" \
    -F "provisionDb=false" \
    -F "wipeDb=false")
else
  CHUNK_SIZE=$(( 50 * 1024 * 1024 ))
  TOTAL_CHUNKS=$(( (ZIP_SIZE + CHUNK_SIZE - 1) / CHUNK_SIZE ))
  UPLOAD_ID=$(uuidgen 2>/dev/null || date +%s%N | sha256sum | head -c 32)
  for i in $(seq 0 $(( TOTAL_CHUNKS - 1 ))); do
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
  RESULT=$(curl -s -X POST "$PORTAL_API/upload/complete" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"uploadId\":\"$UPLOAD_ID\",\"deployType\":\"zip\",\"name\":\"$APP_NAME\",\"description\":\"$DESCRIPTION\",\"provisionDb\":false,\"wipeDb\":false}")
fi

rm -rf "$ZIP_FILE" "$(dirname "$DEPLOY_DIR")"

SUCCESS=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('success','false'))" 2>/dev/null)
if [ "$SUCCESS" = "True" ] || echo "$RESULT" | grep -q '"success":true'; then
  if [ -n "$APP_URL_DISPLAY" ]; then
    echo "✅ Deployed. APP_URL from $ENV_FILE: $APP_URL_DISPLAY"
  else
    echo "✅ Deployed! https://experiments.[company-domain]/$APP_NAME/ (set APP_URL= in $ENV_FILE to show your canonical URL here)"
  fi
  APPS_JSON=$(curl -s -H "Authorization: Bearer $API_KEY" "$PORTAL_API/apps")
  IS_PUB=$(echo "$APPS_JSON" | python3 -c "import json,sys; apps=json.load(sys.stdin); a=next((x for x in apps if x.get('name')=='$APP_NAME'), None); print('true' if a and a.get('isPublic') else ('missing' if not a else 'false'))" 2>/dev/null || echo "unknown")
  case "$IS_PUB" in
    true)  echo "✓ Experiments: isPublic=true for '$APP_NAME'." ;;
    false) echo "⚠ Experiments: isPublic=false for '$APP_NAME' (only matters if you use experiments.[company-domain] path)." ;;
    missing) echo "⚠ Experiments: app '$APP_NAME' not listed yet." ;;
    *)     echo "⚠ Experiments: could not read isPublic." ;;
  esac
  echo "✓ Redeploy hiring-portal (bash scripts/deploy-portal.sh) so redirects use NEXT_PUBLIC_CAREERS_SITE_URL."
else
  echo "❌ Deploy failed:"
  echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
  exit 1
fi
