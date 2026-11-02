#!/usr/bin/env bash
# PreToolUse hook for `git commit`: implemented means documented.
# - Always reminds Claude to review the docs before committing.
# - Blocks the commit when code/config changed but no documentation file did,
#   unless the command contains NO_DOCS_NEEDED (explicit, deliberate override).

cmd=$(jq -r '.tool_input.command // ""')

# Only act on commands that contain a git commit (also inside `git add && git commit` chains).
[[ "$cmd" == *"git commit"* ]] || exit 0

code_re='^(apps/|packages/|\.github/|\.claude/|package\.json$|pnpm-workspace\.yaml$|tsconfig|release-please-config\.json$|\.release-please-manifest\.json$)'
docs_re='^(docs/|README\.md$|CONTRIBUTING\.md$|.*/README\.md$)'

changed=$(git status --porcelain | sed -E 's/^.{3}//; s/.* -> //')
code_changed=$(printf '%s\n' "$changed" | grep -E "$code_re" | grep -vE '(^|/)pnpm-lock\.yaml$')
docs_changed=$(printf '%s\n' "$changed" | grep -E "$docs_re")

reminder="Docs check: implemented means documented. Before this commit, review docs/ (plan.md status, stack.md, apis.md, glossary.md, ADRs in docs/adr/), READMEs and CONTRIBUTING.md, and update whatever this change affects."

if [ -n "$code_changed" ] && [ -z "$docs_changed" ] && [[ "$cmd" != *NO_DOCS_NEEDED* ]]; then
  jq -n --arg r "$reminder Code or config changed but no documentation file did. Update the docs, or if none are affected, rerun the commit with NO_DOCS_NEEDED=1 as a prefix (for example: NO_DOCS_NEEDED=1 git commit ...)." \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
else
  jq -n --arg r "$reminder" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$r}}'
fi
