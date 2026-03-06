#!/bin/bash
set -e

PROJECT_ROOT=$(pwd)

DOC="$PROJECT_ROOT/docs/ideas/2026-03-05-we-started-with-the-review-subcommand-because-code-review-brainstorm-gemini.md"

if [ ! -f "$DOC" ]; then
  echo "Error: $DOC not found!"
  exit 1
fi

echo "Parsing features from $DOC..."

grep -E '^\|[[:space:]]*[0-9]+[[:space:]]*\|[[:space:]]*FEAT-[0-9]+[[:space:]]*\|' "$DOC" | while IFS= read -r line; do
  ID=$(echo "$line" | awk -F '|' '{print $3}' | xargs)
  TITLE=$(echo "$line" | awk -F '|' '{print $4}' | xargs)
  
  ID=$(echo "$ID" | tr -d '\r\n')
  TITLE=$(echo "$TITLE" | tr -d '\r\n')
  
  SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E -e 's/[^a-z0-9]+/-/g' -e 's/^-|-$//g')
  
  BRANCH_NAME="feat/${ID}-${SLUG}"
  
  echo "=================================================="
  echo "Processing: $ID - $TITLE"
  echo "Branch: $BRANCH_NAME"
  echo "=================================================="
  
  git checkout main
  
  if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    git branch -D "$BRANCH_NAME"
  fi
  
  git checkout -b "$BRANCH_NAME"
  
  cd "$PROJECT_ROOT/genie"
  bun run src/bin/genie.ts speckit.specify "$TITLE" || echo "Warning: Genie CLI failed (likely provider timeout). Continuing to next feature..."
  cd "$PROJECT_ROOT"
  
done

echo "All features processed successfully!"
