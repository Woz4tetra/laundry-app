#!/usr/bin/env bash
# Build the Docker image and install the app as a systemd service that manages
# the Compose stack.
# Usage: sudo ./deploy/install.sh
#
# Requires Docker with Compose (the `docker compose` plugin, or the older
# `docker-compose` binary).

set -euo pipefail

SERVICE_NAME="laundry-app"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

# Resolve the repo root from this script's location (deploy/ -> repo root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE="${SCRIPT_DIR}/${SERVICE_NAME}.service"

die() { echo "error: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "must run as root: sudo $0"

# Docker + Compose must be present. Prefer the v2 plugin (`docker compose`),
# fall back to the standalone v1 binary (`docker-compose`).
command -v docker >/dev/null 2>&1 || die "docker not found. Install Docker first."
DOCKER_BIN="$(command -v docker)"
if "${DOCKER_BIN}" compose version >/dev/null 2>&1; then
  COMPOSE="${DOCKER_BIN} compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="$(command -v docker-compose)"
else
  die "Docker Compose not found. Install the compose plugin or docker-compose."
fi

[ -f "${REPO_ROOT}/.env" ] || die ".env not found at ${REPO_ROOT}/.env
Copy it and fill in the secrets first:
  cp ${REPO_ROOT}/.env.example ${REPO_ROOT}/.env
  cd ${REPO_ROOT}/server && npm install && npm run gen-vapid   # paste keys into .env
  # also set APP_PASSCODE and a long random SESSION_SECRET"

echo "==> Repo:    ${REPO_ROOT}"
echo "==> Compose: ${COMPOSE}"

# Build the image now so the service starts fast at boot. $COMPOSE is left
# unquoted on purpose so "docker compose" splits into command + subcommand.
echo "==> Building the Docker image..."
(cd "${REPO_ROOT}" && ${COMPOSE} build)

echo "==> Writing ${UNIT_PATH}..."
sed \
  -e "s|__WORKDIR__|${REPO_ROOT}|g" \
  -e "s|__COMPOSE__|${COMPOSE}|g" \
  "${TEMPLATE}" > "${UNIT_PATH}"

echo "==> Enabling and starting the service..."
systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"

echo
echo "Done. The Compose stack is running under systemd."
echo "  Status:   systemctl status ${SERVICE_NAME}"
echo "  Logs:     docker logs -f ${SERVICE_NAME}"
echo "  Rebuild:  sudo systemctl reload ${SERVICE_NAME}   # after a code change"
echo "  Stop:     sudo systemctl stop ${SERVICE_NAME}"
