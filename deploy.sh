#!/bin/bash
# Deploy script for EverySkill (native PM2 in LXC)
# Usage: ./deploy.sh staging    — pull latest, build, deploy to staging
#        ./deploy.sh promote    — promote staging build to production
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

BUILDS_DIR="${PROJECT_DIR}/builds"
STAGING_DIR="${BUILDS_DIR}/staging"
PRODUCTION_DIR="${BUILDS_DIR}/production"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
err() { log "ERROR: $*" >&2; exit 1; }

health_check() {
  local port="$1"
  local name="$2"
  local max_attempts=6
  local attempt=1

  log "Waiting for ${name} health check on port ${port}..."
  sleep 5
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

build_app() {
  log "Pulling latest from master..."
  git pull origin master

  log "Installing dependencies..."
  pnpm install --frozen-lockfile

  log "Building Next.js app..."
  pnpm turbo build --filter=web

  # Copy static assets into standalone directory
  local standalone_dir="apps/web/.next/standalone/apps/web"
  log "Copying static assets into standalone build..."
  cp -r apps/web/.next/static "${standalone_dir}/.next/static"
  if [ -d "apps/web/public" ]; then
    cp -r apps/web/public "${standalone_dir}/public"
  fi

  log "Build complete"
}

# Copy the build output to an isolated environment directory
# so dev builds and other deploys can never clobber a running environment
install_build() {
  local target_dir="$1"
  local env_name="$2"
  local source_dir="apps/web/.next/standalone"

  log "Installing build to ${env_name} directory..."
  mkdir -p "${BUILDS_DIR}"

  # Atomic swap: build into .new, then rename
  rm -rf "${target_dir}.new"
  cp -r "${source_dir}" "${target_dir}.new"

  # Swap old → .old, new → current
  if [ -d "${target_dir}" ]; then
    rm -rf "${target_dir}.old"
    mv "${target_dir}" "${target_dir}.old"
  fi
  mv "${target_dir}.new" "${target_dir}"
  rm -rf "${target_dir}.old"

  log "Build installed to ${target_dir}"
}

deploy_staging() {
  build_app
  install_build "${STAGING_DIR}" "staging"

  log "Running migrations against staging DB..."
  (
    source .env.staging 2>/dev/null || true
    export DATABASE_URL
    pnpm db:migrate
  )

  log "Reloading everyskill-staging..."
  pm2 reload everyskill-staging --update-env 2>/dev/null \
    || pm2 start ecosystem.config.cjs --only everyskill-staging

  if ! health_check 2001 "staging"; then
    err "Staging health check failed — investigate logs: pm2 logs everyskill-staging"
  fi

  # Run staging smoke test (E2E) to verify pages load without client-side crashes
  log "Running staging smoke test..."
  if (cd apps/web && STAGING_URL="https://staging.everyskill.ai" npx playwright test tests/e2e/staging-smoke.spec.ts --reporter=line 2>&1); then
    log "Staging smoke test passed"
  else
    log "WARN: Staging smoke test failed — pages may have client-side errors. Check: npx playwright test tests/e2e/staging-smoke.spec.ts"
  fi

  log "Staging deploy complete"
}

promote_to_production() {
  echo ""
  echo "=== PRODUCTION PROMOTION ==="
  echo "This will:"
  echo "  1. Copy the staging build to production directory"
  echo "  2. Run migrations against production DB"
  echo "  3. Reload the production PM2 process"
  echo ""

  if [ ! -d "${STAGING_DIR}" ]; then
    err "No staging build found at ${STAGING_DIR}. Run './deploy.sh staging' first."
  fi

  read -rp "Continue? (y/N) " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    log "Aborted"
    exit 0
  fi

  # Back up current production build for rollback
  if [ -d "${PRODUCTION_DIR}" ]; then
    log "Backing up current production build..."
    rm -rf "${PRODUCTION_DIR}.bak"
    cp -r "${PRODUCTION_DIR}" "${PRODUCTION_DIR}.bak"
  fi

  # Promote staging build to production (copy, not move — staging stays intact)
  log "Promoting staging build to production..."
  rm -rf "${PRODUCTION_DIR}.new"
  cp -r "${STAGING_DIR}" "${PRODUCTION_DIR}.new"
  if [ -d "${PRODUCTION_DIR}" ]; then
    rm -rf "${PRODUCTION_DIR}.old"
    mv "${PRODUCTION_DIR}" "${PRODUCTION_DIR}.old"
  fi
  mv "${PRODUCTION_DIR}.new" "${PRODUCTION_DIR}"
  rm -rf "${PRODUCTION_DIR}.old"

  log "Running migrations against production DB..."
  (
    source .env.production 2>/dev/null || true
    export DATABASE_URL
    pnpm db:migrate
  )

  log "Reloading everyskill-prod..."
  pm2 reload everyskill-prod --update-env 2>/dev/null \
    || pm2 start ecosystem.config.cjs --only everyskill-prod

  if ! health_check 2000 "production"; then
    log "Production health check failed!"

    if [ -d "${PRODUCTION_DIR}.bak" ]; then
      log "Rolling back to previous build..."
      rm -rf "${PRODUCTION_DIR}"
      mv "${PRODUCTION_DIR}.bak" "${PRODUCTION_DIR}"
      pm2 reload everyskill-prod --update-env

      if health_check 2000 "production (rollback)"; then
        err "Rollback successful — previous version restored. Investigate the staging build."
      else
        err "Rollback also failed — manual intervention required!"
      fi
    else
      err "No previous build to roll back to — manual intervention required!"
    fi
  fi

  # Clean up backup on success
  rm -rf "${PRODUCTION_DIR}.bak"

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
    echo "  staging  — Pull, build, migrate, and deploy to staging (port 2001)"
    echo "  promote  — Promote current build to production (port 2000)"
    exit 1
    ;;
esac
