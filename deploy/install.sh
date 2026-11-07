#!/usr/bin/env bash
# Installazione su Ubuntu (testata sul modello Ubuntu LTS): eseguire come root dalla radice del progetto.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."   # funziona da qualsiasi cartella
[ -f package.json ] && [ -d server ] && [ -d public ] || { echo "Radice del progetto non trovata"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "Eseguire con sudo"; exit 1; }
apt-get update
apt-get install -y nodejs npm
node -e 'process.exit(+process.versions.node.split(".")[0] >= 18 ? 0 : 1)' || { echo "Serve Node.js >= 18 (vedi README)"; exit 1; }
id risiko >/dev/null 2>&1 || useradd --system --home /opt/risiko --shell /usr/sbin/nologin risiko
mkdir -p /opt/risiko
cp -r server public package.json /opt/risiko/
(cd /opt/risiko && npm install --omit=dev)
chown -R risiko:risiko /opt/risiko
cp deploy/risiko.service /etc/systemd/system/risiko.service
systemctl daemon-reload
systemctl enable --now risiko
sleep 2
echo "Servizio avviato. Credenziali admin (primo avvio):"
journalctl -u risiko --no-pager | grep -A1 "Amministratore creato" | head -3 || true
echo "Aprire: http://$(hostname -I | awk '{print $1}'):3000"
