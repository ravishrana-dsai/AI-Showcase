#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Claude Usage Tracker — Full Setup Script
# Installs mitmproxy, trusts its CA cert, configures system proxy,
# and launches both mitmproxy and the Electron tray app together.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PROXY_PORT=9876
MITM_CERT_DIR="$HOME/.mitmproxy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ADDON_PATH="$SCRIPT_DIR/mitm_hook.py"
LOG_FILE="$APP_DIR/mitmproxy.log"
NETWORK_SERVICE="Wi-Fi"

GREEN='\033[0;32m'
AMBER='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║     Claude Usage Tracker — Full Setup    ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Check for Python 3 ─────────────────────────────────────────────────────
echo -e "${BOLD}[1/6] Checking Python 3...${RESET}"
if ! command -v python3 &>/dev/null; then
  echo -e "${RED}✗ Python 3 not found. Install it from python.org or via Homebrew:${RESET}"
  echo "    brew install python"
  exit 1
fi
PYTHON=$(command -v python3)
echo -e "${GREEN}✓ Found: $($PYTHON --version)${RESET}"

# ── 2. Install mitmproxy ──────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[2/6] Installing mitmproxy...${RESET}"
if command -v mitmdump &>/dev/null; then
  echo -e "${GREEN}✓ Already installed: $(mitmdump --version | head -1)${RESET}"
else
  pip3 install mitmproxy --quiet
  echo -e "${GREEN}✓ mitmproxy installed${RESET}"
fi

# ── 3. Generate mitmproxy CA certificate ─────────────────────────────────────
echo ""
echo -e "${BOLD}[3/6] Generating mitmproxy CA certificate...${RESET}"
if [ ! -f "$MITM_CERT_DIR/mitmproxy-ca-cert.pem" ]; then
  # Run mitmdump briefly to generate the cert
  timeout 3 mitmdump --listen-port "$PROXY_PORT" 2>/dev/null || true
fi
if [ -f "$MITM_CERT_DIR/mitmproxy-ca-cert.pem" ]; then
  echo -e "${GREEN}✓ Certificate exists at $MITM_CERT_DIR/mitmproxy-ca-cert.pem${RESET}"
else
  echo -e "${RED}✗ Could not generate certificate. Run manually: mitmdump --listen-port $PROXY_PORT${RESET}"
  exit 1
fi

# ── 4. Trust the certificate in macOS Keychain ───────────────────────────────
echo ""
echo -e "${BOLD}[4/6] Trusting mitmproxy CA in macOS Keychain...${RESET}"
echo -e "${AMBER}  (You may be prompted for your password)${RESET}"

CERT_FINGERPRINT=$(openssl x509 -in "$MITM_CERT_DIR/mitmproxy-ca-cert.pem" -fingerprint -noout 2>/dev/null | cut -d= -f2 | tr -d ':')
ALREADY_TRUSTED=$(security find-certificate -a -Z /Library/Keychains/System.keychain 2>/dev/null | grep -i "$CERT_FINGERPRINT" || echo "")

if [ -n "$ALREADY_TRUSTED" ]; then
  echo -e "${GREEN}✓ Certificate already trusted${RESET}"
else
  sudo security add-trusted-cert \
    -d -r trustRoot \
    -k /Library/Keychains/System.keychain \
    "$MITM_CERT_DIR/mitmproxy-ca-cert.pem"
  echo -e "${GREEN}✓ Certificate trusted in System Keychain${RESET}"
fi

# ── 5. Set macOS system proxy ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[5/6] Setting macOS system proxy (${NETWORK_SERVICE})...${RESET}"

# Detect active network service if Wi-Fi isn't found
if ! networksetup -listallnetworkservices 2>/dev/null | grep -q "^${NETWORK_SERVICE}$"; then
  NETWORK_SERVICE=$(networksetup -listallnetworkservices 2>/dev/null | grep -v "^\*" | head -2 | tail -1)
  echo -e "${AMBER}  Wi-Fi not found, using: $NETWORK_SERVICE${RESET}"
fi

networksetup -setwebproxy "$NETWORK_SERVICE" 127.0.0.1 "$PROXY_PORT"
networksetup -setsecurewebproxy "$NETWORK_SERVICE" 127.0.0.1 "$PROXY_PORT"
networksetup -setproxybypassdomains "$NETWORK_SERVICE" "localhost" "127.0.0.1" "*.local"

echo -e "${GREEN}✓ System proxy set: 127.0.0.1:${PROXY_PORT} for $NETWORK_SERVICE${RESET}"

# ── 6. Write Claude Code env vars to shell profile ────────────────────────────
echo ""
echo -e "${BOLD}[6/6] Configuring Claude Code env vars...${RESET}"
SHELL_PROFILE=""
if [ -f "$HOME/.zshrc" ]; then SHELL_PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.bash_profile" ]; then SHELL_PROFILE="$HOME/.bash_profile"
elif [ -f "$HOME/.bashrc" ]; then SHELL_PROFILE="$HOME/.bashrc"
fi

MARKER="# Claude Usage Tracker"
if [ -n "$SHELL_PROFILE" ] && ! grep -q "$MARKER" "$SHELL_PROFILE"; then
  cat >> "$SHELL_PROFILE" << EOF

$MARKER
export HTTP_PROXY=http://127.0.0.1:${PROXY_PORT}
export HTTPS_PROXY=http://127.0.0.1:${PROXY_PORT}
export ANTHROPIC_BASE_URL=http://127.0.0.1:${PROXY_PORT}
# End Claude Usage Tracker
EOF
  echo -e "${GREEN}✓ Env vars added to $SHELL_PROFILE${RESET}"
  echo -e "${AMBER}  Run: source $SHELL_PROFILE  (or restart terminal)${RESET}"
else
  if [ -n "$SHELL_PROFILE" ]; then
    echo -e "${GREEN}✓ Env vars already present in $SHELL_PROFILE${RESET}"
  else
    echo -e "${AMBER}  No shell profile found — add manually:${RESET}"
    echo "    export HTTP_PROXY=http://127.0.0.1:${PROXY_PORT}"
    echo "    export HTTPS_PROXY=http://127.0.0.1:${PROXY_PORT}"
  fi
fi

# ── Done — launch ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║           Setup complete! ✓              ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""
echo -e "Starting mitmproxy + Electron app..."
echo ""

# Launch mitmproxy in background, log to file
mitmdump \
  --listen-host 127.0.0.1 \
  --listen-port "$PROXY_PORT" \
  --ssl-insecure \
  --set confdir="$MITM_CERT_DIR" \
  -s "$ADDON_PATH" \
  >> "$LOG_FILE" 2>&1 &
MITM_PID=$!
echo -e "${GREEN}✓ mitmproxy running (PID $MITM_PID, log: $LOG_FILE)${RESET}"

# Give mitmproxy a moment to bind
sleep 1

# Launch Electron app from app directory
cd "$APP_DIR"
if command -v electron &>/dev/null; then
  electron . &
elif [ -f "./node_modules/.bin/electron" ]; then
  ./node_modules/.bin/electron . &
else
  echo -e "${AMBER}Electron not found in PATH. Run: npm start${RESET}"
fi

echo ""
echo -e "${GREEN}${BOLD}All running. Look for the Claude icon in your menu bar.${RESET}"
echo ""
echo -e "To stop the proxy later:"
echo -e "  kill $MITM_PID"
echo -e "  networksetup -setwebproxystate \"$NETWORK_SERVICE\" off"
echo -e "  networksetup -setsecurewebproxystate \"$NETWORK_SERVICE\" off"
echo ""
