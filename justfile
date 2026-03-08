# ── Settings ─────────────────────────────────────────────────────────

set shell := ["bash", "-euo", "pipefail", "-c"]

# ── Variables ────────────────────────────────────────────────────────

project_root := justfile_directory()
genie_dir := join(justfile_directory(), "genie")
genie_bin := "node dist/bin/genie.js"
default_review_base := "origin/main"
default_review_agent := "codex"

# ── Default ──────────────────────────────────────────────────────────
# Show available recipes

default:
    @just --list --unsorted

# ── Development ──────────────────────────────────────────────────────

# Install genie dependencies
[working-directory("genie")]
install:
    bun install --frozen-lockfile

# Build the genie CLI
[working-directory("genie")]
build:
    bun run build

# Update the local linked genie install
[working-directory("genie")]
update:
    {{ genie_bin }} update --force

# Remove build artifacts
[working-directory("genie")]
clean:
    -rm -rf dist

# ── Quality ──────────────────────────────────────────────────────────

# Run the main local quality gates
qa: typecheck test build

# Run TypeScript type checking
[working-directory("genie")]
typecheck:
    bun run typecheck

# Run the full test suite
[working-directory("genie")]
test *args:
    bun test {{ args }}

# ── Review ───────────────────────────────────────────────────────────

# Review current branch changes with all configured agents against a base ref
[working-directory("genie")]
review-all base=default_review_base:
    {{ genie_bin }} review --all --base {{ base }}

# Review current branch changes with one agent against a base ref
[working-directory("genie")]
review-agent agent=default_review_agent base=default_review_base:
    {{ genie_bin }} review --agent {{ agent }} --base {{ base }}

# Review only staged changes with one agent
[working-directory("genie")]
review-staged agent=default_review_agent:
    {{ genie_bin }} review --agent {{ agent }} --staged

# Print the stable JSON schema for review automation
[working-directory("genie")]
review-schema:
    {{ genie_bin }} review --json-schema

# Check provider installation/auth status before running AI reviews
[script("bash")]
review-doctor provider="":
    set -euo pipefail
    cd "{{ genie_dir }}"
    if [ -n "{{ provider }}" ]; then
        {{ genie_bin }} providers doctor --provider "{{ provider }}" --json
    else
        {{ genie_bin }} providers doctor --json
    fi

# Post a single-agent review as a PR comment when a PR exists for the branch
[script("bash")]
review-comment agent=default_review_agent base=default_review_base:
    set -euo pipefail
    PR_NUMBER=$(gh pr view --json number -q .number 2>/dev/null || true)
    if [ -z "$PR_NUMBER" ]; then
        echo "No open PR for the current branch."
        exit 0
    fi
    BODY=$(cd "{{ genie_dir }}" && {{ genie_bin }} review --agent "{{ agent }}" --base "{{ base }}")
    gh pr comment "$PR_NUMBER" --body "$BODY"

# ── Git ──────────────────────────────────────────────────────────────

# Show repo status and recent commits
status:
    @git status --short --branch
    @echo ""
    @git log --oneline -5

# Watch PR checks for the current branch when a PR exists
ci-watch:
    gh pr checks --watch

# Open the current PR in the browser
pr-open:
    gh pr view --web
