#!/usr/bin/env bash
# PreToolUse hook for `vercel deploy`, `vercel redeploy` and `vercel --prod`.
# The Hobby plan allows 100 deployments per rolling 24 hours, and every deployment counts, cancelled ones
# included (docs/vercel.md). This hook counts the last 24 hours with the Vercel API before a deploy and
# - denies it when the deploy would be rejected, saying when the next slot opens;
# - otherwise adds the count to Claude's context.
# It fails open: if it cannot count (no CLI, not signed in, no team id, API error) the deploy is allowed.
# It can only be turned off from the environment Claude Code runs in (VERCEL_DEPLOY_GUARD=off), not by
# anything written in the command, so Claude cannot talk its way past it.

LIMIT=100
BLOCK_AT=$((LIMIT - 1)) # at 99 a deploy of both projects would go over
WARN_AT=90

cmd=$(jq -r '.tool_input.command // ""')

# A deploying vercel command at the start of the command or after ; & | ( or a line break, optionally behind
# VAR=value prefixes and npx / pnpm exec. Plain mentions (commit messages, echo) do not match.
nl=$'\n'
re="(^|[;&|(${nl}])[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*((npx|bunx|pnpm[[:space:]]+(exec|dlx))[[:space:]]+)?vercel(@[^[:space:]]+)?[[:space:]]+(deploy|redeploy|--prod)([[:space:]);\&|]|\$)"
[[ "$cmd" =~ $re ]] || exit 0
[ "${VERCEL_DEPLOY_GUARD:-on}" = "off" ] && exit 0

say() { # say <context-or-reason> [deny]
  if [ "${2:-}" = "deny" ]; then
    jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  else
    jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$r}}'
  fi
  exit 0
}

# The team id: from the command itself, else from a linked project in this repository.
org=$(grep -oE 'VERCEL_ORG_ID=team_[A-Za-z0-9]+' <<<"$cmd" | head -1 | cut -d= -f2)
if [ -z "$org" ]; then
  org=$(jq -r '.orgId // empty' "${CLAUDE_PROJECT_DIR:-.}"/apps/*/.vercel/project.json "${CLAUDE_PROJECT_DIR:-.}"/.vercel/project.json 2>/dev/null | head -1)
fi
[ -n "$org" ] || say "Vercel deployment guard: no team id found (set VERCEL_ORG_ID in the command or link a project), so the 24-hour count was not checked. Remember the Hobby limit is $LIMIT deployments per 24 hours, cancelled ones included."

if ! command -v vercel >/dev/null 2>&1; then # the fnm Node is not always on the hook's PATH
  export PATH="$HOME/.local/share/fnm:$HOME/.fnm:$PATH"
  command -v fnm >/dev/null 2>&1 && eval "$(fnm env --shell bash 2>/dev/null)" && fnm use 22 >/dev/null 2>&1
fi
command -v vercel >/dev/null 2>&1 || say "Vercel deployment guard: the vercel CLI was not found, so the 24-hour count was not checked."

result=$(ORG="$org" LIMIT="$LIMIT" BLOCK_AT="$BLOCK_AT" python3 - <<'PY'
import json, os, subprocess, sys, time

org, limit, block_at = os.environ["ORG"], int(os.environ["LIMIT"]), int(os.environ["BLOCK_AT"])
now = time.time() * 1000
DAY = 24 * 3600 * 1000
created, seen, until = [], set(), None
try:
    for _ in range(10):
        url = f"/v6/deployments?limit=100&teamId={org}" + (f"&until={until}" if until else "")
        out = subprocess.run(["vercel", "api", url], capture_output=True, text=True, timeout=45)
        page = json.loads(out.stdout)["deployments"]
        fresh = [d for d in page if d["uid"] not in seen]
        if not fresh:
            break
        seen.update(d["uid"] for d in fresh)
        created += [d["created"] for d in fresh]
        until = min(d["created"] for d in fresh)
        if now - until > DAY:
            break
except Exception:
    sys.exit(1)
window = sorted(c for c in created if now - c < DAY)  # oldest first
count = len(window)
hours = at = None
if count >= block_at:
    # Allowed again at block_at - 1, once this many of the oldest have aged out.
    k = count - (block_at - 1)
    frees = window[k - 1] + DAY
    hours = max(0.0, (frees - now) / 3600000)
    at = time.strftime("%H:%M UTC", time.gmtime(frees / 1000))
print(json.dumps({"count": count, "hours": hours, "at": at}))
PY
)
[ $? -eq 0 ] && [ -n "$result" ] || say "Vercel deployment guard: could not read the deployments from the Vercel API (not signed in?), so the 24-hour count was not checked."

count=$(jq -r '.count' <<<"$result")
hours=$(jq -r '.hours // empty' <<<"$result")
at=$(jq -r '.at // empty' <<<"$result")

if [ "$count" -ge "$BLOCK_AT" ]; then
  say "Vercel deployment guard: $count deployments in the last 24 hours and the Hobby plan allows $LIMIT, so this deploy would be rejected (or push it over). The next slot opens in about $(LC_ALL=C awk "BEGIN{printf \"%.1f\", $hours}") hours${at:+, around $at}. Cancelled previews and Git-triggered deployments count too (docs/vercel.md). Wait, or have the owner turn the guard off with VERCEL_DEPLOY_GUARD=off in the environment Claude Code runs in." deny
fi

note="Vercel deployment guard: $count of $LIMIT deployments used in the last 24 hours; each project this command deploys uses one."
[ "$count" -ge "$WARN_AT" ] && note="$note Close to the limit: deploy only what is needed, in one batch."
say "$note"
