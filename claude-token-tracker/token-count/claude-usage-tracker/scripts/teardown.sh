#!/usr/bin/env bash
# Claude Usage Tracker — Teardown
# Disables system proxy and stops mitmproxy

set -euo pipefail

NETWORK_SERVICE="Wi-Fi"
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}Claude Usage Tracker — Disabling proxy...${RESET}"
echo ""

# Detect network service
if ! networksetup -listallnetworkservices 2>/dev/null | grep -q "^${NETWORK_SERVICE}$"; then
  NETWORK_SERVICE=$(networksetup -listallnetworkservices 2>/dev/null | grep -v "^\*" | head -2 | tail -1)
fi

networksetup -setwebproxystate "$NETWORK_SERVICE" off
networksetup -setsecurewebproxystate "$NETWORK_SERVICE" off
echo -e "${GREEN}✓ System proxy disabled for $NETWORK_SERVICE${RESET}"

# Kill mitmproxy if running
if pgrep -f mitmdump &>/dev/null; then
  pkill -f mitmdump
  echo -e "${GREEN}✓ mitmproxy stopped${RESET}"
else
  echo "  mitmproxy was not running"
fi

echo ""
echo -e "${GREEN}${BOLD}Proxy removed. Claude products will connect directly again.${RESET}"
echo ""
echo "To re-enable: bash scripts/setup.sh"
echo ""
