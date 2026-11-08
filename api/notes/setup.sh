#!/usr/bin/env bash
# Puts the note wall's API on Cloudflare. Run it from the repo, after making a free Cloudflare
# account:
#
#   bash api/notes/setup.sh
#
# The first time, it opens your browser to log in to Cloudflare. Then it makes the notes database,
# sets up its tables, publishes the API and points the gallery at it (gallery/notes-config.js).
# It's safe to run again: it never deletes notes, and running it later just publishes any changes.

set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "Installing Cloudflare's tool (wrangler)"
npm install --no-fund --no-audit --loglevel=error

say "Logging in to Cloudflare"
npx wrangler whoami 2>/dev/null | grep -q 'You are logged in' || npx wrangler login

say "The notes database"
if grep -q 'SET_BY_SETUP' wrangler.toml; then
  npx wrangler d1 create tommoore-notes >/dev/null 2>&1 || true
  ID="$(npx wrangler d1 list --json | node -e '
    const list = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const db = list.find((d) => d.name === "tommoore-notes");
    if (!db) process.exit(1);
    console.log(db.uuid);
  ')" || { echo "Couldn't make the database. Check you're logged in to the right Cloudflare account."; exit 1; }
  sed -i.bak "s/SET_BY_SETUP/$ID/" wrangler.toml && rm wrangler.toml.bak
  echo "Made database $ID"
else
  echo "Already set up"
fi
npx wrangler d1 migrations apply tommoore-notes --remote

say "Publishing the API"
DEPLOY_LOG="$(mktemp)"
if ! npx wrangler deploy 2>&1 | tee "$DEPLOY_LOG"; then
  if grep -q 'workers.dev subdomain' "$DEPLOY_LOG"; then
    echo
    echo "Your Cloudflare account needs a workers.dev name first. Open the link above, pick a short"
    echo "name (e.g. tommoore), then run this script again. Everything done so far is kept."
  fi
  exit 1
fi
URL="$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | head -n 1 || true)"
rm -f "$DEPLOY_LOG"

if [ -n "$URL" ]; then
  say "Pointing the gallery at it"
  sed -i.bak "s#https://[A-Za-z0-9.-]*\.workers\.dev#$URL#; s#https://tommoore-notes\.SET_BY_SETUP#$URL#" ../../gallery/notes-config.js
  rm ../../gallery/notes-config.js.bak
  curl -fsS "$URL/api/notes?limit=1" >/dev/null && echo "The API is answering at $URL/api/notes"
  say "Done"
  echo "Commit wrangler.toml and gallery/notes-config.js, then publish the site as usual."
else
  echo "Published, but couldn't spot the API's address above. Put it in gallery/notes-config.js by hand."
fi
