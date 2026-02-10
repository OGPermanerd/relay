#!/bin/bash
# EverySkill Design Contributor Setup
# Run with: curl -fsSL https://raw.githubusercontent.com/OGPermanerd/relay/master/scripts/contributor-setup.sh | bash
set -euo pipefail

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   EverySkill — Contributor Setup     ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# --- Detect OS ---
OS="$(uname -s)"
if [ "$OS" != "Darwin" ] && [ "$OS" != "Linux" ]; then
  echo "This script supports macOS and Linux. For Windows, see docs/design-contributor-setup.md"
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
  echo "⚠  Docker is required but not installed."
  if [ "$OS" = "Darwin" ]; then
    echo "   Download Docker Desktop: https://www.docker.com/products/docker-desktop/"
    echo "   Install it, start it, then re-run this script."
  else
    echo "   Install with: sudo apt-get install -y docker.io docker-compose-plugin"
    echo "   Then re-run this script."
  fi
  exit 1
fi

# --- Clone repo ---
PROJ_DIR="$HOME/projects/everyskill"
if [ -d "$PROJ_DIR" ]; then
  echo "Repository already exists at $PROJ_DIR — pulling latest..."
  cd "$PROJ_DIR" && git pull
else
  echo "Cloning EverySkill..."
  mkdir -p "$HOME/projects"
  git clone https://github.com/OGPermanerd/relay.git "$PROJ_DIR"
  cd "$PROJ_DIR"
fi

# --- Environment file ---
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Enter the Google OAuth credentials"
  echo "  (Trevor will send you these)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  read -rp "  AUTH_GOOGLE_ID: " GOOGLE_ID
  read -rp "  AUTH_GOOGLE_SECRET: " GOOGLE_SECRET

  if [ -n "$GOOGLE_ID" ] && [ -n "$GOOGLE_SECRET" ]; then
    if [ "$OS" = "Darwin" ]; then
      sed -i '' "s|^AUTH_GOOGLE_ID=.*|AUTH_GOOGLE_ID=\"$GOOGLE_ID\"|" .env.local
      sed -i '' "s|^AUTH_GOOGLE_SECRET=.*|AUTH_GOOGLE_SECRET=\"$GOOGLE_SECRET\"|" .env.local
    else
      sed -i "s|^AUTH_GOOGLE_ID=.*|AUTH_GOOGLE_ID=\"$GOOGLE_ID\"|" .env.local
      sed -i "s|^AUTH_GOOGLE_SECRET=.*|AUTH_GOOGLE_SECRET=\"$GOOGLE_SECRET\"|" .env.local
    fi
  fi
fi

# --- Database ---
echo "Starting database..."
pnpm docker:up
echo "Waiting for database to be ready..."
sleep 5

# --- Install deps ---
echo "Installing dependencies..."
pnpm install

# --- Push schema ---
echo "Setting up database schema..."
pnpm db:push 2>/dev/null || echo "Schema push had warnings (this is usually fine)"

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║             ✓ Setup complete!                       ║"
echo "  ╠══════════════════════════════════════════════════════╣"
echo "  ║                                                      ║"
echo "  ║  To start the app:                                   ║"
echo "  ║    cd ~/projects/everyskill                          ║"
echo "  ║    cd apps/web && pnpm dev                           ║"
echo "  ║    Then open http://localhost:2002                   ║"
echo "  ║                                                      ║"
echo "  ║  To use with Claude Desktop:                         ║"
echo "  ║    1. Open Claude Desktop                            ║"
echo "  ║    2. Start a new chat                               ║"
echo "  ║    3. Attach the project folder:                     ║"
echo "  ║       ~/projects/everyskill                          ║"
echo "  ║    4. Paste the welcome message Trevor sent you      ║"
echo "  ║                                                      ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""
