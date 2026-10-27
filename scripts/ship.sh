#!/usr/bin/env bash
# Ships one change everywhere: checks it, sends it to both phones as an over-the-air
# update, then pushes to GitHub, which makes Vercel rebuild the website
# (https://slip-budget.vercel.app). Same code, same data, one command.
#
#   ./scripts/ship.sh "What changed"
#   ./scripts/ship.sh --web          (website only: just the push)
#
# Commit first; this ships what's committed.
#
# Native changes (new native libraries, app.json) still need a store build; this warns
# instead of shipping an update the installed apps can't run.
# Not an npm script: package.json scripts count toward the native fingerprint, and so
# does .gitignore (keep local-only ignores in .git/info/exclude).
set -euo pipefail
cd "$(dirname "$0")/.."

web_only=false
if [[ "${1:-}" == "--web" ]]; then
  web_only=true
  shift
fi
msg="${1:-}"
if [[ "$web_only" == false && -z "$msg" ]]; then
  echo 'Usage: ./scripts/ship.sh "What changed"' >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ There are uncommitted changes. Commit them first, so the phones and the website get the same code." >&2
  exit 1
fi

echo "› Checking"
npx tsc --noEmit
npx eslint src
npx jest --silent

if [[ "$web_only" == false ]]; then
  # The phones only take updates built for their exact native code. After a new store
  # build, put its fingerprints here (eas build:list shows them as the runtime version).
  ios_built=7bcffcb265a4e9a9b21ced3a2c102bbb6a300202
  android_built=a7e92a385d504660f6550bf5e9e01b52afbe93dc
  fp() { npx expo-updates fingerprint:generate --platform "$1" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).hash))'; }
  if [[ "$(fp ios)" != "$ios_built" || "$(fp android)" != "$android_built" ]]; then
    echo "✗ This change touches native code, so the installed apps can't take it as an update." >&2
    echo "  It needs a new build. Ship the website alone with: ./scripts/ship.sh --web" >&2
    exit 1
  fi
  echo "› Updating the phones"
  npx eas-cli update --channel production --environment production --platform all --non-interactive -m "$msg"
fi

echo "› Publishing the website (Vercel builds it from GitHub)"
git push

# Wait for Vercel to finish building, so "Done" means the site has it.
if command -v vercel >/dev/null; then
  sleep 10
  for _ in $(seq 1 45); do
    state=$(vercel ls slip 2>/dev/null | grep -m1 -oE 'Ready|Error|Canceled|Building|Queued|Initializing' || true)
    [[ "$state" == "Ready" || "$state" == "Error" || "$state" == "Canceled" ]] && break
    sleep 8
  done
  if [[ "$state" != "Ready" ]]; then
    echo "✗ The website build didn't finish (${state:-unknown}). Check: vercel ls slip" >&2
    exit 1
  fi
fi

echo "✓ Done. The website has it now (refresh the page); phones pick it up on the next two opens."
