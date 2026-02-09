#!/bin/bash
# Deploy script for EverySkill
# Usage: ./deploy.sh staging    — pull staging image and restart
#        ./deploy.sh promote    — tag staging as production and restart
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
IMAGE="ghcr.io/ogpermanerd/relay"

cd "$SCRIPT_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
err() { log "ERROR: $*" >&2; exit 1; }

validate_caddyfile() {
  log "Validating Caddyfile..."
  if docker compose -f "$COMPOSE_FILE" ps caddy --format '{{.State}}' 2>/dev/null | grep -q running; then
    docker compose -f "$COMPOSE_FILE" exec caddy caddy validate --config /etc/caddy/Caddyfile \
      || err "Caddyfile validation failed — aborting deploy"
  else
    log "Caddy not running, validating with standalone container..."
    docker run --rm -v "${SCRIPT_DIR}/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine \
      caddy validate --config /etc/caddy/Caddyfile \
      || err "Caddyfile validation failed — aborting deploy"
  fi
  log "Caddyfile valid"
}

health_check() {
  local port="$1"
  local name="$2"
  local max_attempts=6
  local attempt=1

  log "Waiting for ${name} health check on port ${port}..."
  sleep 10
  while [ $attempt -le $max_attempts ]; do
    if curl -sf "http://localhost:${port}/api/health" > /dev/null 2>&1; then
      log "${name} is healthy"
      return 0
    fi
    log "Health check attempt ${attempt}/${max_attempts} failed, waiting 5s..."
    sleep 5
    attempt=$((attempt + 1))
  done
  return 1
}

deploy_staging() {
  validate_caddyfile

  log "Pulling staging image..."
  docker pull "${IMAGE}:staging"

  log "Starting web-staging..."
  docker compose -f "$COMPOSE_FILE" up -d web-staging

  if ! health_check 2001 "staging"; then
    err "Staging health check failed — container may need investigation"
  fi

  log "Running migrations against staging DB..."
  docker compose -f "$COMPOSE_FILE" exec web-staging \
    node -e "require('./apps/web/node_modules/@everyskill/db/dist/migrate.js')" 2>/dev/null \
    || log "WARN: Migration runner not available, run migrations manually"

  # Reload Caddy config gracefully
  if docker compose -f "$COMPOSE_FILE" ps caddy --format '{{.State}}' 2>/dev/null | grep -q running; then
    log "Reloading Caddy configuration..."
    docker compose -f "$COMPOSE_FILE" exec caddy caddy reload --config /etc/caddy/Caddyfile
  fi

  log "Staging deploy complete"
}

promote_to_production() {
  validate_caddyfile

  echo ""
  echo "=== PRODUCTION PROMOTION ==="
  echo "This will:"
  echo "  1. Back up the production database"
  echo "  2. Tag the current staging image as production"
  echo "  3. Restart the production web service"
  echo ""
  read -rp "Continue? (y/N) " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    log "Aborted"
    exit 0
  fi

  # Back up production DB
  log "Backing up production database..."
  if [[ -x "${SCRIPT_DIR}/backup.sh" ]]; then
    "${SCRIPT_DIR}/backup.sh" --full
  else
    log "WARN: backup.sh not found or not executable, skipping backup"
  fi

  # Save current production image digest for rollback
  local prev_digest
  prev_digest=$(docker inspect --format='{{index .RepoDigests 0}}' "${IMAGE}:production" 2>/dev/null || echo "")

  log "Tagging staging as production..."
  docker tag "${IMAGE}:staging" "${IMAGE}:production"

  log "Running migrations against production DB..."
  docker compose -f "$COMPOSE_FILE" exec web-prod \
    node -e "require('./apps/web/node_modules/@everyskill/db/dist/migrate.js')" 2>/dev/null \
    || log "WARN: Migration runner not available, run migrations manually"

  log "Restarting web-prod..."
  docker compose -f "$COMPOSE_FILE" up -d web-prod

  if ! health_check 2000 "production"; then
    log "Production health check failed!"

    if [[ -n "$prev_digest" ]]; then
      log "Rolling back to previous production image..."
      docker pull "$prev_digest"
      docker tag "$prev_digest" "${IMAGE}:production"
      docker compose -f "$COMPOSE_FILE" up -d web-prod

      if health_check 2000 "production (rollback)"; then
        err "Rollback successful — previous version restored. Investigate the staging image."
      else
        err "Rollback also failed — manual intervention required!"
      fi
    else
      err "No previous production image to roll back to — manual intervention required!"
    fi
  fi

  # Reload Caddy config gracefully
  if docker compose -f "$COMPOSE_FILE" ps caddy --format '{{.State}}' 2>/dev/null | grep -q running; then
    log "Reloading Caddy configuration..."
    docker compose -f "$COMPOSE_FILE" exec caddy caddy reload --config /etc/caddy/Caddyfile
  fi

  log "Production promotion complete"
}

case "${1:-}" in
  staging)
    deploy_staging
    ;;
  promote)
    promote_to_production
    ;;
  *)
    echo "Usage: $0 {staging|promote}"
    echo ""
    echo "  staging  — Pull latest staging image and restart staging service"
    echo "  promote  — Tag staging as production and restart production service"
    exit 1
    ;;
esac
