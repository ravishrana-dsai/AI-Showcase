#!/bin/bash
# ──────────────────────────────────────────────
# Idea to PRD to Feature — Port 3003
# ──────────────────────────────────────────────

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo ""
echo "✦  Idea to PRD to Feature — Starting on port 3003..."
echo ""

# Check dependencies
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install --silent
fi

# Check API key
if [ ! -f ".env.local" ]; then
  echo "⚠  Warning: No .env.local file found"
  echo "  Copy .env.local.example and add your Gemini API key"
fi

echo -e "${GREEN}✦  Server starting on http://localhost:3003${NC}"
echo "   Press Ctrl+C to stop"
echo ""

# Start on port 3003 with its own build directory
NEXT_DIST_DIR=.next-3003 PORT=3003 npm run dev
