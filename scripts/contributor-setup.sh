#!/bin/bash
# Design Contributor Setup Script
# Customize the variables below for your project, then contributors can run:
# curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/master/scripts/contributor-setup.sh | bash
set -euo pipefail

# ============================================================
# CUSTOMIZE THESE FOR YOUR PROJECT
# ============================================================
PROJECT_NAME="EverySkill"
REPO_URL="https://github.com/OGPermanerd/relay.git"
PROJ_DIR="$HOME/everyskill"
DB_START_CMD="pnpm docker:up"
DB_SETUP_CMD="pnpm db:push"
INSTALL_CMD="pnpm install"
DEV_SERVER_START_CMD="cd apps/web && pnpm dev"
DEV_SERVER_PORT=2002
# ============================================================

echo ""
echo "  +--------------------------------------+"
echo "  |   $PROJECT_NAME — Contributor Setup  |"
echo "  +--------------------------------------+"
echo ""

# --- Detect OS ---
OS="$(uname -s)"
if [ "$OS" != "Darwin" ] && [ "$OS" != "Linux" ]; then
  echo "This script supports macOS and Linux. For Windows, see the onboarding doc."
  exit 1
fi

# --- Homebrew (macOS only) ---
if [ "$OS" = "Darwin" ] && ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
fi

# --- Git ---
if ! command -v git &>/dev/null; then
  echo "Installing git..."
  if [ "$OS" = "Darwin" ]; then brew install git; else sudo apt-get install -y git; fi
fi

# --- Node.js 22+ ---
if ! command -v node &>/dev/null || [ "$(node -e 'console.log(parseInt(process.version.slice(1)))')" -lt 22 ]; then
  echo "Installing Node.js 22..."
  if [ "$OS" = "Darwin" ]; then
    brew install node@22
  else
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
fi

# --- pnpm ---
if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi

# --- Docker ---
if ! command -v docker &>/dev/null; then
  echo ""
  echo "Docker is required but not installed."
  if [ "$OS" = "Darwin" ]; then
    echo "   Download Docker Desktop: https://www.docker.com/products/docker-desktop/"
    echo "   Install it, start it, then re-run this script."
  else
    echo "   Install with: sudo apt-get install -y docker.io docker-compose-plugin"
    echo "   Then re-run this script."
  fi
  exit 1
fi

# --- Claude Code ---
if ! command -v claude &>/dev/null; then
  echo "Installing Claude Code..."
  npm install -g @anthropic-ai/claude-code
fi

# --- Clone repo ---
if [ -d "$PROJ_DIR" ]; then
  echo "Repository already exists at $PROJ_DIR — pulling latest..."
  cd "$PROJ_DIR" && git pull
else
  echo "Cloning $PROJECT_NAME..."
  mkdir -p "$(dirname "$PROJ_DIR")"
  git clone "$REPO_URL" "$PROJ_DIR"
  cd "$PROJ_DIR"
fi

# --- Environment file ---
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo ""
  echo "  ----------------------------------------"
  echo "  Fill in your credentials in .env.local"
  echo "  (ask the project lead for these values)"
  echo "  ----------------------------------------"
  echo ""
fi

# --- Database ---
echo "Starting database..."
$DB_START_CMD
echo "Waiting for database to be ready..."
sleep 5

# --- Install deps ---
echo "Installing dependencies..."
$INSTALL_CMD

# --- Push schema ---
echo "Setting up database schema..."
$DB_SETUP_CMD 2>/dev/null || echo "Schema setup had warnings (this is usually fine)"

echo ""
echo "  +----------------------------------------------+"
echo "  |           Setup complete!                     |"
echo "  +----------------------------------------------+"
echo "  |                                              |"
echo "  |  To start the app:                           |"
echo "  |    cd $PROJ_DIR"
echo "  |    $DEV_SERVER_START_CMD"
echo "  |    Then open http://localhost:$DEV_SERVER_PORT |"
echo "  |                                              |"
echo "  |  To use with Claude Code:                    |"
echo "  |    cd $PROJ_DIR"
echo "  |    claude                                    |"
echo "  |                                              |"
echo "  +----------------------------------------------+"
echo ""
