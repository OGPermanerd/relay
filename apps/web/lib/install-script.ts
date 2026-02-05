import type { DetectedOS } from "@/lib/os-detection";

/**
 * Generate a platform install script for the detected OS.
 *
 * - macOS/Linux: Bash script that merges relay-skills into Claude Desktop config
 * - Windows: PowerShell script that merges relay-skills into Claude Desktop config
 *
 * All scripts safely read existing config, merge the relay-skills entry,
 * and write back -- they never overwrite existing MCP server entries.
 */
export function generateInstallScript(
  os: DetectedOS,
  baseUrl: string
): {
  content: string;
  filename: string;
} {
  if (os === "windows") {
    return {
      filename: "install-relay-mcp.ps1",
      content: `# Relay MCP Server Install Script
# Merges relay-skills into existing MCP config

$ErrorActionPreference = "Stop"

$ConfigDir = "$env:APPDATA\\Claude"
$ConfigFile = "$ConfigDir\\claude_desktop_config.json"

# Create directory if needed
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}

# Read existing config or start fresh
if (Test-Path $ConfigFile) {
    $Existing = Get-Content $ConfigFile -Raw
} else {
    $Existing = '{}'
}

# Use node to safely merge JSON
$MergeScript = @"
const existing = JSON.parse(process.argv[1]);
if (!existing.mcpServers) existing.mcpServers = {};
existing.mcpServers['relay-skills'] = {
  command: 'npx',
  args: ['-y', '@relay/mcp']
};
console.log(JSON.stringify(existing, null, 2));
"@

$Result = node -e $MergeScript $Existing
$Result | Set-Content $ConfigFile -Encoding UTF8

# Report install to Relay (non-blocking, failure OK)
try {
  $ApiKey = ""
  if (Test-Path $ConfigFile) {
    $Config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
    if ($Config.mcpServers.'relay-skills'.env.RELAY_API_KEY) {
      $ApiKey = $Config.mcpServers.'relay-skills'.env.RELAY_API_KEY
    }
  }
  $Body = @{ key = $ApiKey; platform = "claude-desktop"; os = "windows" } | ConvertTo-Json
  Invoke-WebRequest -Uri "${baseUrl}/api/install-callback" -Method POST -ContentType "application/json" -Body $Body -UseBasicParsing | Out-Null
} catch { }

Write-Host "Relay MCP server installed successfully!"
Write-Host "Config written to: $ConfigFile"
Write-Host "Restart Claude Desktop to activate."
`,
    };
  }

  // macOS and Linux share a bash script with OS-specific path detection
  return {
    filename: "install-relay-mcp.sh",
    content: `#!/bin/bash
# Relay MCP Server Install Script
# Merges relay-skills into existing MCP config

set -e

CONFIG_DIR="$HOME/Library/Application Support/Claude"
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

# Linux path override
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CONFIG_DIR="$HOME/.config/Claude"
  CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
fi

# Create directory if needed
mkdir -p "$CONFIG_DIR"

# Read existing config or start fresh
if [ -f "$CONFIG_FILE" ]; then
  EXISTING=$(cat "$CONFIG_FILE")
else
  EXISTING='{}'
fi

# Use node to safely merge JSON (avoids jq dependency)
node -e "
  const existing = JSON.parse(process.argv[1]);
  if (!existing.mcpServers) existing.mcpServers = {};
  existing.mcpServers['relay-skills'] = {
    command: 'npx',
    args: ['-y', '@relay/mcp']
  };
  console.log(JSON.stringify(existing, null, 2));
" "$EXISTING" > "$CONFIG_FILE"

# Report install to Relay (non-blocking, failure OK)
RELAY_API_KEY=""
if [ -f "$CONFIG_FILE" ]; then
  RELAY_API_KEY=$(node -e "try{const c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const s=c.mcpServers&&c.mcpServers['relay-skills'];if(s&&s.env&&s.env.RELAY_API_KEY)console.log(s.env.RELAY_API_KEY)}catch{}" "$CONFIG_FILE" 2>/dev/null || true)
fi
curl -s -X POST "${baseUrl}/api/install-callback" \\
  -H "Content-Type: application/json" \\
  -d "{\\"key\\":\\"$RELAY_API_KEY\\",\\"platform\\":\\"claude-desktop\\",\\"os\\":\\"$(uname -s | tr '[:upper:]' '[:lower:]')\\"}" \\
  > /dev/null 2>&1 || true

echo 'Relay MCP server installed successfully!'
echo "Config written to: $CONFIG_FILE"
echo 'Restart Claude Desktop to activate.'
`,
  };
}

/**
 * Trigger a client-side file download using Blob and anchor element.
 */
export function downloadScript(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get human-readable instructions for running the install script.
 */
export function getRunInstructions(os: DetectedOS): string {
  if (os === "windows") {
    return "powershell -ExecutionPolicy Bypass -File install-relay-mcp.ps1";
  }
  return "chmod +x install-relay-mcp.sh && ./install-relay-mcp.sh";
}
