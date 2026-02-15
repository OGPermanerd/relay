/**
 * Shared EverySkill frontmatter helpers.
 * Used by skill creation, fork, and inline suggestion apply flows.
 */

/**
 * Build the EverySkill frontmatter block with PostToolUse tracking hook.
 */
export function buildEverySkillFrontmatter(fields: {
  skillId: string;
  name: string;
  category: string;
  hoursSaved: number;
}): string {
  const trackingUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/api/track`
    : "http://localhost:2000/api/track";

  return [
    "---",
    `everyskill_skill_id: ${fields.skillId}`,
    `everyskill_skill_name: ${fields.name}`,
    `everyskill_category: ${fields.category}`,
    `everyskill_hours_saved: ${fields.hoursSaved}`,
    "hooks:",
    "  PostToolUse:",
    '    - matcher: "*"',
    "      hooks:",
    "        - type: command",
    "          command: >-",
    "            bash -c '",
    "            INPUT=$(cat);",
    '            TN=$(echo "$INPUT" | jq -r ".tool_name // empty" 2>/dev/null || echo "$INPUT" | grep -o "\\"tool_name\\":\\"[^\\"]*\\"" | cut -d\\" -f4 || echo "unknown");',
    `            PL="{\\"skill_id\\":\\"${fields.skillId}\\",\\"tool_name\\":\\"$TN\\",\\"ts\\":\\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\",\\"hook_event\\":\\"PostToolUse\\"}";`,
    '            SIG=$(echo -n "$PL" | openssl dgst -sha256 -hmac "${EVERYSKILL_API_KEY:-none}" 2>/dev/null | awk "{print \\$NF}");',
    `            RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${trackingUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer \${EVERYSKILL_API_KEY:-}" -H "X-EverySkill-Signature: $SIG" -d "$PL" --connect-timeout 5 --max-time 10 2>>/tmp/everyskill-track.log);`,
    `            if [ "$RESP" != "200" ] && [ "$RESP" != "000" ]; then sleep 5; curl -s -o /dev/null -X POST "${trackingUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer \${EVERYSKILL_API_KEY:-}" -H "X-EverySkill-Signature: $SIG" -d "$PL" --connect-timeout 5 --max-time 10 2>>/tmp/everyskill-track.log; fi;`,
    "            true",
    "            '",
    "          async: true",
    "          timeout: 30",
    "---",
    "",
  ].join("\n");
}

/**
 * Strip EverySkill frontmatter from skill content, returning only the body.
 * Only strips if the frontmatter block contains an everyskill_ field.
 */
export function stripEverySkillFrontmatter(content: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return content;
  // Only strip if the frontmatter contains an everyskill_ field
  if (/^everyskill_/m.test(match[1])) {
    return content.slice(match[0].length);
  }
  return content;
}
