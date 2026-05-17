#!/bin/bash
# ──────────────────────────────────────────────
# Idea to PRD to Feature — One-click launcher
# Just double-click this file or run: ./start.sh
# ──────────────────────────────────────────────

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "✦  Idea to PRD to Feature — Starting up..."
echo ""

# ── 1. Check Node.js ──
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js is not installed.${NC}"
  echo "  Install it from https://nodejs.org (LTS version)"
  echo "  Or: brew install node"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# ── 2. Check npm ──
if ! command -v npm &>/dev/null; then
  echo -e "${RED}✗ npm not found.${NC}"
  read -p "Press Enter to exit..."
  exit 1
fi
echo -e "${GREEN}✓${NC} npm $(npm -v)"

# ── 3. Install dependencies (if needed) ──
if [ ! -d "node_modules" ]; then
  echo ""
  echo -e "${YELLOW}→ Installing dependencies (first time only)...${NC}"
  npm install --silent
  echo -e "${GREEN}✓${NC} Dependencies installed"
else
  echo -e "${GREEN}✓${NC} Dependencies already installed"
fi

# ── 4. Check API key ──
if [ ! -f ".env.local" ]; then
  echo ""
  echo -e "${YELLOW}⚠  No .env.local file found. You need a Gemini API key.${NC}"
  echo "  Get one free at: https://aistudio.google.com/apikey"
  echo ""
  read -p "  Paste your Gemini API key here: " api_key
  if [ -n "$api_key" ]; then
    echo "GEMINI_API_KEY=$api_key" > .env.local
    echo -e "${GREEN}✓${NC} API key saved to .env.local"
  else
    echo -e "${RED}✗ No key provided. The app will start but generation won't work.${NC}"
  fi
else
  echo -e "${GREEN}✓${NC} API key configured"
fi

# ── 5. Start the dev server ──
echo ""
echo -e "${GREEN}✦  Starting server...${NC}"
echo -e "   Open ${GREEN}http://localhost:3000${NC} in your browser"
echo -e "   Press Ctrl+C to stop"
echo ""

# Open browser after a short delay
(sleep 3 && open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null || start "http://localhost:3000" 2>/dev/null) &

npm run dev
