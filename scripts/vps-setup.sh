#!/usr/bin/env bash
# =============================================================================
# PerlMe VPS Setup Script
# Ubuntu 22.04 — No Docker — Native systemd services
#
# Usage:
#   LAPTOP_IP=1.2.3.4 DB_PASSWORD=yourpassword bash vps-setup.sh
#
# Or set the variables at the top of this file before running.
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# CONFIGURATION — set these before running
# -----------------------------------------------------------------------------
LAPTOP_IP="${LAPTOP_IP:-REPLACE_WITH_YOUR_LAPTOP_IP}"
DB_NAME="perlme"
DB_USER="perlme_user"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)}"
APP_DIR="/root/perlme"
LOKI_VERSION="3.4.2"
NODE_VERSION="20"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}[$(date '+%H:%M:%S')] $*${NC}"; }
warn()  { echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARN: $*${NC}"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')] ERROR: $*${NC}"; exit 1; }

[[ $EUID -ne 0 ]] && error "Run this script as root (sudo bash vps-setup.sh)"
[[ "$LAPTOP_IP" == "REPLACE_WITH_YOUR_LAPTOP_IP" ]] && \
    error "Set LAPTOP_IP before running: LAPTOP_IP=1.2.3.4 bash vps-setup.sh"

log "Starting PerlMe VPS setup..."
log "  App dir  : $APP_DIR"
log "  Laptop IP: $LAPTOP_IP"
log "  DB name  : $DB_NAME"

# =============================================================================
# 1. System update + base packages
# =============================================================================
log "1/12 — Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    curl wget git unzip openssl \
    software-properties-common gnupg2 \
    ca-certificates lsb-release \
    dnsutils snapd logrotate

# =============================================================================
# 2. Node.js 20 (system-wide via NodeSource — NOT NVM)
# =============================================================================
log "2/12 — Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
else
    log "  Node.js already installed: $(node --version)"
fi

# =============================================================================
# 3. pnpm + PM2
# =============================================================================
log "3/12 — Installing pnpm and PM2..."
if ! command -v pnpm &>/dev/null; then
    npm install -g pnpm
fi
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
    pm2 startup systemd -u root --hp /root | tail -1 | bash || true
fi

# =============================================================================
# 4. PostgreSQL
# =============================================================================
log "4/12 — Installing PostgreSQL..."
if ! command -v psql &>/dev/null; then
    apt-get install -y postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql

# Create DB user and database (idempotent)
log "  Configuring database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

# Detect Postgres version
PG_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"

# Allow laptop IP to connect remotely
if ! grep -q "${LAPTOP_IP}/32" "${PG_HBA}"; then
    log "  Allowing laptop IP ${LAPTOP_IP} in pg_hba.conf..."
    echo "host    ${DB_NAME}    ${DB_USER}    ${LAPTOP_IP}/32    scram-sha-256" >> "${PG_HBA}"
fi

# Listen on all interfaces so laptop can connect
if grep -q "^#listen_addresses" "${PG_CONF}"; then
    sed -i "s/^#listen_addresses = 'localhost'/listen_addresses = '*'/" "${PG_CONF}"
elif grep -q "^listen_addresses" "${PG_CONF}"; then
    sed -i "s/^listen_addresses = .*/listen_addresses = '*'/" "${PG_CONF}"
fi

systemctl restart postgresql

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"

# =============================================================================
# 5. Nginx
# =============================================================================
log "5/12 — Installing Nginx..."
if ! command -v nginx &>/dev/null; then
    apt-get install -y nginx
fi
systemctl enable nginx
systemctl start nginx

# =============================================================================
# 6. Certbot (via snap)
# =============================================================================
log "6/12 — Installing Certbot..."
if ! command -v certbot &>/dev/null; then
    snap install --classic certbot
    ln -sf /snap/bin/certbot /usr/bin/certbot
fi

# Check DNS before attempting cert issuance
SERVER_IP=$(curl -s ifconfig.me || echo "")
DNS_IP=$(dig +short pearlmeinc.api.com A 2>/dev/null | tail -1 || echo "")

if [[ "$DNS_IP" == "$SERVER_IP" ]]; then
    log "  DNS is live. Issuing SSL certificate..."
    certbot --nginx -d pearlmeinc.api.com \
        --non-interactive --agree-tos \
        --email admin@pearlmeinc.api.com \
        --redirect || warn "Certbot failed — run manually: certbot --nginx -d pearlmeinc.api.com"
else
    warn "DNS for pearlmeinc.api.com does not point to this server yet."
    warn "  Expected : $SERVER_IP"
    warn "  Got      : ${DNS_IP:-'(no result)'}"
    warn "  Run certbot manually once DNS is live: certbot --nginx -d pearlmeinc.api.com"
fi

# =============================================================================
# 7. Grafana
# =============================================================================
log "7/12 — Installing Grafana..."
if ! command -v grafana-server &>/dev/null; then
    mkdir -p /etc/apt/keyrings
    wget -q -O - https://apt.grafana.com/gpg.key \
        | gpg --dearmor \
        | tee /etc/apt/keyrings/grafana.gpg > /dev/null
    echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" \
        | tee /etc/apt/sources.list.d/grafana.list
    apt-get update -qq
    apt-get install -y grafana
fi
systemctl enable grafana-server
systemctl start grafana-server

# =============================================================================
# 8. Loki
# =============================================================================
log "8/12 — Installing Loki ${LOKI_VERSION}..."
if ! command -v loki &>/dev/null; then
    wget -q "https://github.com/grafana/loki/releases/download/v${LOKI_VERSION}/loki-linux-amd64.zip" \
        -O /tmp/loki.zip
    unzip -qo /tmp/loki.zip -d /tmp/loki-bin
    install -m 755 /tmp/loki-bin/loki-linux-amd64 /usr/local/bin/loki
    rm -rf /tmp/loki-bin /tmp/loki.zip
fi

mkdir -p /etc/loki /var/lib/loki/chunks /var/lib/loki/rules /var/lib/loki/index /var/lib/loki/index_cache /var/lib/loki/compactor

# Copy config if repo is already cloned
[[ -f "${APP_DIR}/loki/loki-config.yaml" ]] && \
    cp "${APP_DIR}/loki/loki-config.yaml" /etc/loki/loki-config.yaml

cat > /etc/systemd/system/loki.service << 'EOF'
[Unit]
Description=Loki Log Aggregation System
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/loki -config.file=/etc/loki/loki-config.yaml
Restart=on-failure
RestartSec=10s

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable loki
systemctl start loki || warn "Loki failed to start — check: journalctl -u loki"

# =============================================================================
# 9. Promtail
# =============================================================================
log "9/12 — Installing Promtail ${LOKI_VERSION}..."
if ! command -v promtail &>/dev/null; then
    wget -q "https://github.com/grafana/loki/releases/download/v${LOKI_VERSION}/promtail-linux-amd64.zip" \
        -O /tmp/promtail.zip
    unzip -qo /tmp/promtail.zip -d /tmp/promtail-bin
    install -m 755 /tmp/promtail-bin/promtail-linux-amd64 /usr/local/bin/promtail
    rm -rf /tmp/promtail-bin /tmp/promtail.zip
fi

mkdir -p /etc/promtail /var/lib/promtail

[[ -f "${APP_DIR}/loki/promtail-config.yaml" ]] && \
    cp "${APP_DIR}/loki/promtail-config.yaml" /etc/promtail/promtail-config.yaml

cat > /etc/systemd/system/promtail.service << 'EOF'
[Unit]
Description=Promtail Log Shipper
After=network.target loki.service

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/promtail -config.file=/etc/promtail/promtail-config.yaml
Restart=on-failure
RestartSec=10s

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable promtail
systemctl start promtail || warn "Promtail failed to start — check: journalctl -u promtail"

# =============================================================================
# 10. Nginx site config
# =============================================================================
log "10/12 — Configuring Nginx..."
CERT_PATH="/etc/letsencrypt/live/pearlmeinc.api.com/fullchain.pem"

# Always write an HTTP-only config so the ACME challenge works when certbot runs later
cat > /etc/nginx/sites-available/pearlmeinc.api.com << 'NGINXHTTP'
server {
    listen 80;
    listen [::]:80;
    server_name pearlmeinc.api.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}
NGINXHTTP

ln -sf /etc/nginx/sites-available/pearlmeinc.api.com /etc/nginx/sites-enabled/pearlmeinc.api.com
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

if [[ -f "$CERT_PATH" ]]; then
    # SSL certs exist — load the full HTTPS config
    if [[ -f "${APP_DIR}/nginx/pearlmeinc.api.com.conf" ]]; then
        cp "${APP_DIR}/nginx/pearlmeinc.api.com.conf" /etc/nginx/sites-available/pearlmeinc.api.com
        nginx -t && systemctl reload nginx
        log "  Full HTTPS Nginx config loaded."
    fi
else
    warn "SSL certs not yet issued — HTTP-only Nginx config is active."
    warn "After DNS is live, run:"
    warn "  certbot --nginx -d pearlmeinc.api.com"
    warn "Then apply the full config:"
    warn "  cp ${APP_DIR}/nginx/pearlmeinc.api.com.conf /etc/nginx/sites-available/pearlmeinc.api.com && nginx -t && systemctl reload nginx"
fi

# =============================================================================
# 11. Firewall (ufw)
# =============================================================================
log "11/12 — Configuring firewall..."
apt-get install -y -qq ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP (Certbot + redirect)'
ufw allow 443/tcp  comment 'HTTPS'
ufw allow from "${LAPTOP_IP}" to any port 5432 proto tcp comment 'PostgreSQL — laptop only'
ufw allow from "${LAPTOP_IP}" to any port 3000 proto tcp comment 'Grafana — laptop only'
ufw --force enable
log "  Firewall rules active."

# =============================================================================
# 12. logrotate for backend logs
# =============================================================================
log "12/12 — Setting up log rotation..."
mkdir -p "${APP_DIR}/logs"

cat > /etc/logrotate.d/perlme << EOF
${APP_DIR}/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        pm2 reloadLogs 2>/dev/null || true
    endscript
}
EOF

# =============================================================================
# Done — print summary
# =============================================================================
echo ""
echo "============================================================"
log "Setup complete!"
echo "============================================================"
echo ""
echo "  DATABASE_URL=${DATABASE_URL}"
echo ""
echo "Next steps:"
echo "  1. Clone the repo (if not already):"
echo "     git clone https://github.com/BrianKimurgor/pearlmeinc.git ${APP_DIR}"
echo ""
echo "  2. Create the .env file:"
echo "     cp ${APP_DIR}/backend/.env.example ${APP_DIR}/backend/.env"
echo "     nano ${APP_DIR}/backend/.env"
echo "     (set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, etc.)"
echo ""
echo "  3. Build and start the backend:"
echo "     cd ${APP_DIR}/backend"
echo "     pnpm install --frozen-lockfile"
echo "     pnpm build"
echo "     node dist/drizzle/migrate.js"
echo "     pm2 start ecosystem.config.js --env production"
echo "     pm2 save"
echo ""
echo "  4. Point Grafana at Loki:"
echo "     Open http://${LAPTOP_IP}:3000 in your browser (Grafana)"
echo "     Login: admin / admin (change on first login)"
echo "     Add datasource: Loki → URL: http://127.0.0.1:3100"
echo ""
echo "  5. If DNS is not yet live, run Certbot manually once it is:"
echo "     certbot --nginx -d pearlmeinc.api.com"
echo ""
