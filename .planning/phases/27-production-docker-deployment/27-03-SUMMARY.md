---
phase: 27-production-docker-deployment
plan: 03
subsystem: infrastructure
tags: [backup, restore, encryption, luks, gpg, postgresql, ops]
dependency-graph:
  requires: []
  provides: [backup-scripts, restore-scripts, luks-runbook]
  affects: [27-04-deploy-to-production]
tech-stack:
  added: []
  patterns: [encrypted-pipeline-backup, gpg-symmetric-aes256, dropbear-remote-unlock]
key-files:
  created:
    - docker/backup.sh
    - docker/restore.sh
    - docker/LUKS-RUNBOOK.md
  modified: []
decisions:
  - id: backup-pipeline-no-temp
    description: "Dump-compress-encrypt in single pipeline with no unencrypted temp files on disk"
    rationale: "SOC2 compliance -- data at rest must always be encrypted; streaming pipeline avoids plaintext exposure"
  - id: separate-luks-and-backup-passphrases
    description: "LUKS disk encryption and GPG backup encryption use separate passphrases"
    rationale: "Defense in depth -- compromising one passphrase does not compromise the other layer"
  - id: dropbear-port-2222
    description: "Dropbear SSH in initramfs listens on port 2222, not 22"
    rationale: "Avoids conflict with main SSH daemon; known-hosts fingerprint differs from post-boot SSH"
metrics:
  duration: ~2 min
  completed: 2026-02-07
---

# Phase 27 Plan 03: Backup/Restore Scripts and LUKS Runbook Summary

GPG-encrypted PostgreSQL backup pipeline with off-site rsync to Hetzner Storage Box, interactive restore script, and comprehensive LUKS full-disk encryption runbook with Dropbear remote unlock.

## What Was Done

### Task 1: Create backup, restore scripts and LUKS runbook

Created three operational files in `docker/`:

**backup.sh** -- Automated PostgreSQL backup with encryption and off-site storage:
- Streams `pg_dump | gzip | gpg` in a single pipeline (no unencrypted temp file on disk)
- Supports `--full` flag for daily full backups vs hourly snapshots
- All config via environment variables with sensible defaults
- Transfers encrypted backups to Hetzner Storage Box via rsync (port 23)
- Cleans up local backups older than 90 days (configurable)
- Cron-ready with logging support

**restore.sh** -- Interactive restore from encrypted backup:
- Requires explicit `RESTORE` confirmation before proceeding
- Lists available backups if no file specified
- Streams `gpg decrypt | gunzip | psql` pipeline
- Same environment variable configuration as backup.sh

**LUKS-RUNBOOK.md** -- Complete LUKS full-disk encryption procedure:
- Hetzner Rescue Mode boot and disk partitioning
- LUKS2 format with AES-256-XTS and argon2id KDF
- OS installation on encrypted volume (debootstrap)
- Dropbear SSH in initramfs for remote LUKS unlock (port 2222)
- fstab/crypttab configuration
- Reboot test and verification steps
- Emergency procedures: KVM console unlock, lost passphrase
- Key custodian policy (minimum 2 custodians, quarterly testing)
- Distinction between LUKS encryption and backup encryption layers

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Single streaming pipeline (dump/compress/encrypt) | No unencrypted temp files touch disk -- SOC2 data-at-rest compliance |
| Separate LUKS and backup passphrases | Defense in depth; one compromise does not expose the other |
| Dropbear on port 2222 | Avoids conflict with post-boot SSH daemon |
| 90-day local retention default | Balance between storage cost and recovery window |
| rsync on port 23 for Storage Box | Hetzner Storage Box SFTP standard port |

## Deviations from Plan

### Incidental File Changes

The pre-commit hook (lint-staged) swept in two previously-unstaged changes from other Wave 1 plans:
- `apps/web/middleware.ts`: Added `/api/health` to public paths
- `apps/web/next.config.ts`: Added `output: "standalone"` and `outputFileTracingRoot`

These changes are from plans 27-01/27-02 and are correct for Phase 27, but were not part of this plan's scope. They were picked up by lint-staged during the commit hook run.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8e62b10 | feat(27-03): add backup/restore scripts and LUKS encryption runbook |

## Verification

- [x] `docker/backup.sh` exists and is executable
- [x] `docker/restore.sh` exists and is executable
- [x] `docker/LUKS-RUNBOOK.md` exists
- [x] `bash -n` syntax check passes for both scripts

## Next Phase Readiness

- Backup/restore scripts ready for deployment to production server
- LUKS runbook must be executed manually before any production deployment
- Scripts assume `everyskill-postgres` container name (matches docker-compose.yml)
- `/etc/everyskill/backup-passphrase` file must be created on production server

## Self-Check: PASSED
