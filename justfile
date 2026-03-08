# ── Settings ─────────────────────────────────────────────────────────

set shell := ["bash", "-euo", "pipefail", "-c"]

# ── Variables ────────────────────────────────────────────────────────

project_root := justfile_directory()
genie_dir := join(justfile_directory(), "genie")
genie_bin := "node dist/bin/genie.js"
default_review_base := "origin/main"
default_review_agent := "codex"
default_review_prompt := "Review this diff for bugs, behavioral regressions, missing tests, security issues, and style problems. Be concise and actionable."
default_review_timeout_seconds := "45"
fast_review_timeout_seconds := "15"

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
update: build
    {{ genie_bin }} update --force

# Remove build artifacts
[working-directory("genie")]
clean:
    -rm -rf dist

# ── Quality ──────────────────────────────────────────────────────────

# Run the main local quality gates
qa: typecheck test build

# Run the local CI-equivalent verification flow
ci: install typecheck test build
    @echo "Local CI checks passed"

# Run TypeScript type checking
[working-directory("genie")]
typecheck:
    bun run typecheck

# Run the full test suite
[working-directory("genie")]
test *args:
    bun test {{ args }}

# ── Review ───────────────────────────────────────────────────────────

# Review current branch changes with all Genie review agents using bounded, best-effort execution
[script("bash")]
review-all base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    cd "{{ genie_dir }}"
    for agent in codex claude gemini cursor; do
        echo "--- $agent ---"
        if timeout "{{ timeout }}"s {{ genie_bin }} review --agent "$agent" --base "{{ base }}"; then
            :
        else
            status=$?
            if [ "$status" -eq 124 ]; then
                echo "$agent review timed out after {{ timeout }}s"
            else
                echo "$agent review failed with exit code $status"
            fi
        fi
        echo ""
    done

# Run the all-agent review flow with a faster timeout for quick checks
review-fast base=default_review_base:
    @just review-all "{{ base }}" "{{ fast_review_timeout_seconds }}"

# Review current branch changes with one agent against a base ref
[script("bash")]
review-agent agent=default_review_agent base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    cd "{{ genie_dir }}"
    timeout "{{ timeout }}"s {{ genie_bin }} review --agent "{{ agent }}" --base "{{ base }}"

# Review only staged changes with one agent
[script("bash")]
review-staged agent=default_review_agent timeout=default_review_timeout_seconds:
    set -euo pipefail
    cd "{{ genie_dir }}"
    timeout "{{ timeout }}"s {{ genie_bin }} review --agent "{{ agent }}" --staged

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
    BODY=$(cd "{{ genie_dir }}" && timeout "{{ default_review_timeout_seconds }}"s {{ genie_bin }} review --agent "{{ agent }}" --base "{{ base }}")
    gh pr comment "$PR_NUMBER" --body "$BODY"

# Submit a formal PR review from the generated single-agent review output
[script("bash")]
review-submit action="comment" agent=default_review_agent base=default_review_base:
    set -euo pipefail
    case "{{ action }}" in
        comment|approve|request-changes) ;;
        *)
            echo "Invalid review action: {{ action }}"
            echo "Expected one of: comment, approve, request-changes"
            exit 1
            ;;
    esac
    PR_NUMBER=$(gh pr view --json number -q .number 2>/dev/null || true)
    if [ -z "$PR_NUMBER" ]; then
        echo "No open PR for the current branch."
        exit 0
    fi
    BODY=$(cd "{{ genie_dir }}" && timeout "{{ default_review_timeout_seconds }}"s {{ genie_bin }} review --agent "{{ agent }}" --base "{{ base }}")
    if [ "{{ action }}" = "comment" ]; then
        gh pr review "$PR_NUMBER" -b "$BODY"
    else
        gh pr review "$PR_NUMBER" --"{{ action }}" -b "$BODY"
    fi

# Approve the current pull request with the generated review body
review-approve agent=default_review_agent base=default_review_base:
    @just review-submit approve "{{ agent }}" "{{ base }}"

# Request changes on the current pull request with the generated review body
review-request-changes agent=default_review_agent base=default_review_base:
    @just review-submit request-changes "{{ agent }}" "{{ base }}"

# Print a Claude CLI review for the branch diff
[no-exit-message]
[script("bash")]
review-claude base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    if ! command -v claude >/dev/null 2>&1; then
        echo "claude CLI is not installed."
        exit 0
    fi
    timeout "{{ timeout }}"s sh -c 'git diff "$1"...HEAD | claude -p "$2" --output-format text' _ "{{ base }}" "{{ default_review_prompt }}"

# Print a Gemini CLI review for the branch diff
[no-exit-message]
[script("bash")]
review-gemini base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    if ! command -v gemini >/dev/null 2>&1; then
        echo "gemini CLI is not installed."
        exit 0
    fi
    timeout "{{ timeout }}"s sh -c 'git diff "$1"...HEAD | gemini -p "$2"' _ "{{ base }}" "{{ default_review_prompt }}"

# Print a Codex CLI review for the branch diff
[no-exit-message]
[script("bash")]
review-codex base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    if ! command -v codex >/dev/null 2>&1; then
        echo "codex CLI is not installed."
        exit 0
    fi
    timeout "{{ timeout }}"s sh -c '{ printf "%s\n\n" "$2"; git diff "$1"...HEAD; } | codex exec --sandbox read-only -o /dev/stdout -' _ "{{ base }}" "{{ default_review_prompt }}"

# Run Claude, Gemini, and Codex CLI reviews back-to-back with best-effort continuation
[script("bash")]
review-cli-all base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    for reviewer in claude gemini codex; do
        echo "--- $reviewer ---"
        if just "review-$reviewer" "{{ base }}" "{{ timeout }}"; then
            :
        else
            status=$?
            if [ "$status" -eq 124 ]; then
                echo "$reviewer review timed out after {{ timeout }}s"
            else
                echo "$reviewer review failed with exit code $status"
            fi
        fi
        echo ""
    done

# Run the direct CLI reviewer sweep with a faster timeout for quick checks
review-cli-fast base=default_review_base:
    @just review-cli-all "{{ base }}" "{{ fast_review_timeout_seconds }}"

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
