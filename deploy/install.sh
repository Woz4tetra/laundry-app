#!/usr/bin/env bash
# Build the app and install it as a systemd service.
# Usage: sudo ./deploy/install.sh
#
# Requires Node 20+ and npm available on PATH for root.

set -euo pipefail

SERVICE_NAME="laundry-app"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

# Resolve the repo root from this script's location (deploy/ -> repo root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE="${SCRIPT_DIR}/${SERVICE_NAME}.service"

die() { echo "error: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "must run as root: sudo $0"

# The service runs as the user who invoked sudo (falls back to root), so the
# repo files and the SQLite database stay owned by a real user, not root.
SERVICE_USER="${SUDO_USER:-root}"
SERVICE_GROUP="$(id -gn "${SERVICE_USER}")"

# Node/npm must be discoverable. NODE_DIR is baked into the unit's PATH so the
# service finds node even when npm's shebang relies on it.
NPM_BIN="$(command -v npm)" || die "npm not found on PATH. Install Node 20+ first."
NODE_BIN="$(command -v node)" || die "node not found on PATH. Install Node 20+ first."
NODE_DIR="$(dirname "${NODE_BIN}")"

[ -f "${REPO_ROOT}/.env" ] || die ".env not found at ${REPO_ROOT}/.env
Copy it and fill in the secrets first:
  cp ${REPO_ROOT}/.env.example ${REPO_ROOT}/.env
  cd ${REPO_ROOT}/server && npm install && npm run gen-vapid   # paste keys into .env
  # also set APP_PASSCODE and a long random SESSION_SECRET"

echo "==> Repo:    ${REPO_ROOT}"
echo "==> Runs as: ${SERVICE_USER}:${SERVICE_GROUP}"
echo "==> Node:    ${NODE_BIN}"

# Run build steps as the service user so node_modules and dist aren't root-owned.
run_as_user() { runuser -u "${SERVICE_USER}" -- env PATH="${NODE_DIR}:${PATH}" "$@"; }

echo "==> Installing server dependencies (includes tsx; needed by 'npm start')..."
run_as_user "${NPM_BIN}" --prefix "${REPO_ROOT}/server" install

echo "==> Installing web dependencies and building the PWA..."
run_as_user "${NPM_BIN}" --prefix "${REPO_ROOT}/web" install
run_as_user "${NPM_BIN}" --prefix "${REPO_ROOT}/web" run build

# Ensure the default data directory exists and is owned by the service user.
install -d -o "${SERVICE_USER}" -g "${SERVICE_GROUP}" "${REPO_ROOT}/data"

echo "==> Writing ${UNIT_PATH}..."
sed \
  -e "s|__WORKDIR__|${REPO_ROOT}|g" \
  -e "s|__USER__|${SERVICE_USER}|g" \
  -e "s|__GROUP__|${SERVICE_GROUP}|g" \
  -e "s|__NPM__|${NPM_BIN}|g" \
  -e "s|__NODE_DIR__|${NODE_DIR}|g" \
  "${TEMPLATE}" > "${UNIT_PATH}"

echo "==> Enabling and starting the service..."
systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"

echo
echo "Done. The service is running."
echo "  Status:  systemctl status ${SERVICE_NAME}"
echo "  Logs:    journalctl -u ${SERVICE_NAME} -f"
echo "  Restart: sudo systemctl restart ${SERVICE_NAME}"
