#!/usr/bin/env bash
# Stop and remove the laundry-app systemd service and its Compose stack.
# Usage: sudo ./deploy/uninstall.sh [--purge-data]
#
# Stopping the service runs `docker compose down`. By default the SQLite
# database (<repo>/data) and .env are left untouched. Pass --purge-data to also
# delete the database and remove the built image.

set -euo pipefail

SERVICE_NAME="laundry-app"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

die() { echo "error: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "must run as root: sudo $0"

PURGE_DATA=false
[ "${1:-}" = "--purge-data" ] && PURGE_DATA=true

# Resolve a compose command for the purge path (down -v).
COMPOSE=""
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
  echo "==> Stopping and disabling ${SERVICE_NAME} (runs compose down)..."
  systemctl disable --now "${SERVICE_NAME}" 2>/dev/null || true
else
  echo "==> ${SERVICE_NAME} not registered; nothing to stop."
fi

if [ -f "${UNIT_PATH}" ]; then
  echo "==> Removing ${UNIT_PATH}..."
  rm -f "${UNIT_PATH}"
fi

systemctl daemon-reload
systemctl reset-failed "${SERVICE_NAME}" 2>/dev/null || true

if [ "${PURGE_DATA}" = true ]; then
  echo "==> Tearing down containers + volumes and removing the image..."
  [ -n "${COMPOSE}" ] && (cd "${REPO_ROOT}" && ${COMPOSE} down -v --rmi local 2>/dev/null || true)
  echo "==> Purging database at ${REPO_ROOT}/data..."
  rm -rf "${REPO_ROOT}/data"
else
  echo "==> Left database, .env, and image in place (use --purge-data to remove them)."
fi

echo "Done. Service removed."
