#!/bin/bash
# ──────────────────────────────────────────────
# Idea to PRD to Feature — Run Both Servers (3002 & 3003)
# ──────────────────────────────────────────────

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "✦  Idea to PRD to Feature — Starting BOTH servers..."
echo ""

# Check dependencies
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Check API key
if [ ! -f ".env.local" ]; then
  echo -e "${YELLOW}⚠  Warning: No .env.local file found${NC}"
  echo "  Copy .env.local.example and add your Gemini API key"
  echo ""
fi

echo -e "${GREEN}✦  Starting servers in parallel...${NC}"
echo -e "   ${BLUE}Server 1:${NC} http://localhost:3002"
echo -e "   ${BLUE}Server 2:${NC} http://localhost:3003"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Function to cleanup background processes on exit
cleanup() {
  echo ""
  echo "Stopping servers..."
  kill $PID1 $PID2 2>/dev/null
  exit
}

trap cleanup SIGINT SIGTERM

# Start both servers in background with separate build directories
NEXT_DIST_DIR=.next-3002 PORT=3002 npm run dev &
PID1=$!

# Wait a moment before starting the second server
sleep 3

NEXT_DIST_DIR=.next-3003 PORT=3003 npm run dev &
PID2=$!

# Wait for both processes
wait $PID1 $PID2
