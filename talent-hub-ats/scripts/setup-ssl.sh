#!/bin/bash
# ===========================================
# Talent Hub - SSL Setup (Let's Encrypt)
# ===========================================
# Run on EC2 after deploy.sh. Requires: domain pointing to EC2, ports 80/443 open.
#
# Usage: ./scripts/setup-ssl.sh <domain> <email>
#   domain: e.g. talent-hub.yourcompany.com
#   email:  for Let's Encrypt expiry notifications

set -e

DOMAIN="${1:?Usage: $0 <domain> <email>}"
EMAIL="${2:?Usage: $0 <domain> <email>}"

cd "$(dirname "$0")/.."

echo "==> Setting up SSL for $DOMAIN"

# Ensure certbot-webroot exists (nginx serves this for ACME)
mkdir -p certbot-webroot

# Ensure ssl dir exists
mkdir -p ssl

# Check if certbot is installed
if ! command -v certbot &>/dev/null; then
  echo "==> Installing certbot..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update
    sudo apt-get install -y certbot
  elif command -v yum &>/dev/null; then
    sudo yum install -y certbot
  else
    echo "ERROR: Install certbot first. See https://certbot.eff.org/"
    exit 1
  fi
fi

# Get certificate (webroot mode - nginx must be running)
echo "==> Obtaining certificate from Let's Encrypt..."
sudo certbot certonly --webroot \
  -w "$(pwd)/certbot-webroot" \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --force-renewal

# Copy certs to ./ssl (docker mounts this)
echo "==> Copying certs to ssl/..."
sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ssl/
sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ssl/
sudo chown "$(whoami)" ssl/fullchain.pem ssl/privkey.pem

# Enable HTTPS config (disable HTTP-only, enable SSL)
echo "==> Enabling HTTPS in nginx..."
mv nginx/conf.d/01-http.conf nginx/conf.d/01-http.conf.disabled 2>/dev/null || true
cp nginx/conf.d/02-ssl.conf.template nginx/conf.d/02-ssl.conf

# Restart nginx to pick up SSL
echo "==> Restarting nginx..."
docker compose restart nginx

echo ""
echo "===================================="
echo "  HTTPS enabled for https://$DOMAIN"
echo "  Update .env: NEXTAUTH_URL and APP_URL to https://$DOMAIN"
echo "  Then: docker compose up -d"
echo "===================================="
echo ""
echo "To renew certs (add to crontab):"
echo "  0 0 1 * * certbot renew --webroot -w $(pwd)/certbot-webroot --quiet && cp /etc/letsencrypt/live/$DOMAIN/*.pem $(pwd)/ssl/ && docker compose -f $(pwd)/docker-compose.yml restart nginx"
