# ── Settings ─────────────────────────────────────────────────────────

set shell := ["bash", "-euo", "pipefail", "-c"]

# ── Variables ────────────────────────────────────────────────────────

project_root := justfile_directory()
genie_dir := join(justfile_directory(), "genie")
genie_bin := "node dist/bin/genie.js"
genie_src_bin := "bun genie/src/bin/genie.ts"
review_runs_dir := join(justfile_directory(), ".review-runs")
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

# Start a reviewer in the background and write its output to a repo-local run directory
[private]
[script("bash")]
_review-start reviewer base timeout:
    set -euo pipefail
    cd "{{ project_root }}"
    mkdir -p "{{ review_runs_dir }}"
    run_id="$(date +%Y%m%d-%H%M%S)-{{ reviewer }}-$$-$RANDOM"
    run_dir="{{ review_runs_dir }}/$run_id"
    mkdir -p "$run_dir"
    printf '%s\n' "{{ reviewer }}" >"$run_dir/reviewer"
    printf '%s\n' "{{ base }}" >"$run_dir/base"
    printf '%s\n' "{{ timeout }}" >"$run_dir/timeout"
    printf '%s\n' "running" >"$run_dir/status"
    (
        if just _review-output "{{ reviewer }}" "{{ base }}" "{{ timeout }}" >"$run_dir/output.log" 2>"$run_dir/error.log"; then
            printf '%s\n' "success" >"$run_dir/status"
        else
            status=$?
            printf '%s\n' "$status" >"$run_dir/exit_code"
            if [ "$status" -eq 124 ]; then
                printf '%s\n' "timeout" >"$run_dir/status"
            else
                printf '%s\n' "failed" >"$run_dir/status"
            fi
        fi
    ) &
    pid=$!
    printf '%s\n' "$pid" >"$run_dir/pid"
    printf '%s\n' "$run_id"

# Report which reviewer paths are healthy before running review commands
[script("bash")]
review-ready base=default_review_base timeout="5":
    set -euo pipefail
    cd "{{ project_root }}"

    check() {
        local name="$1"
        shift
        printf "%-18s" "$name"
        if "$@" >/tmp/review-ready-"$name".out 2>/tmp/review-ready-"$name".err; then
            echo "ready"
        else
            status=$?
            if [ "$status" -eq 124 ]; then
                echo "timeout"
            else
                err="$(tr '\n' ' ' </tmp/review-ready-"$name".err | sed 's/  */ /g' | sed 's/^ //; s/ $//')"
                if [ -z "$err" ]; then
                    err="exit $status"
                fi
                echo "not-ready: $err"
            fi
        fi
        rm -f /tmp/review-ready-"$name".out /tmp/review-ready-"$name".err
    }

    if gh pr view --json number -q .number >/dev/null 2>&1; then
        echo "pr                open"
    else
        echo "pr                no-open-pr"
    fi

    check codex command -v codex
    check codex-review timeout "{{ timeout }}"s codex exec review --base "{{ base }}" -o /dev/null
    check claude command -v claude
    check claude-auth claude auth status
    check gemini command -v gemini
    check gemini-headless timeout "{{ timeout }}"s sh -c 'printf "hello" | gemini --extensions "" -p "say ok"'
    check genie-cursor timeout "{{ timeout }}"s sh -c 'cd "{{ project_root }}" && {{ genie_src_bin }} review --agent cursor --base "{{ base }}"'

# Render review output for a single reviewer using the strongest available path
[no-exit-message]
[private]
[script("bash")]
_review-output reviewer base timeout:
    set -euo pipefail
    cd "{{ project_root }}"
    case "{{ reviewer }}" in
        codex)
            if ! command -v codex >/dev/null 2>&1; then
                echo "codex CLI is not installed."
                exit 1
            fi
            tmp=$(mktemp)
            trap 'rm -f "$tmp"' EXIT
            timeout "{{ timeout }}"s codex exec review --base "{{ base }}" -o "$tmp"
            cat "$tmp"
            ;;
        claude)
            if ! command -v claude >/dev/null 2>&1; then
                echo "claude CLI is not installed."
                exit 1
            fi
            timeout "{{ timeout }}"s sh -c 'git diff "$1"...HEAD | claude -p "$2" --output-format text' _ "{{ base }}" "{{ default_review_prompt }}"
            ;;
        gemini)
            if ! command -v gemini >/dev/null 2>&1; then
                echo "gemini CLI is not installed."
                exit 1
            fi
            timeout "{{ timeout }}"s sh -c 'git diff "$1"...HEAD | gemini --extensions "" -p "$2"' _ "{{ base }}" "{{ default_review_prompt }}"
            ;;
        cursor)
            cd "{{ project_root }}"
            timeout "{{ timeout }}"s {{ genie_src_bin }} review --agent cursor --base "{{ base }}"
            ;;
        *)
            echo "Unknown reviewer: {{ reviewer }}"
            exit 1
            ;;
    esac

# Review current branch changes with all Genie review agents using bounded, best-effort execution
[script("bash")]
review-all base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    cd "{{ project_root }}"
    for agent in codex claude gemini cursor; do
        echo "--- $agent ---"
        if just _review-output "$agent" "{{ base }}" "{{ timeout }}"; then
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

# Start a single reviewer asynchronously and print the run id
[script("bash")]
review-async reviewer=default_review_agent base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    run_id="$(just --quiet _review-start "{{ reviewer }}" "{{ base }}" "{{ timeout }}")"
    echo "started $run_id reviewer={{ reviewer }} base={{ base }} timeout={{ timeout }}"

# Start all reviewers asynchronously and print their run ids
[script("bash")]
review-async-all base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    for reviewer in codex claude gemini cursor; do
        run_id="$(just --quiet _review-start "$reviewer" "{{ base }}" "{{ timeout }}")"
        echo "started $run_id reviewer=$reviewer base={{ base }} timeout={{ timeout }}"
    done

# Show recent async review runs and their status
[script("bash")]
review-status:
    set -euo pipefail
    mkdir -p "{{ review_runs_dir }}"
    found=0
    for run_dir in $(find "{{ review_runs_dir }}" -maxdepth 1 -mindepth 1 -type d | sort -r); do
        found=1
        run_id="$(basename "$run_dir")"
        reviewer="$(cat "$run_dir/reviewer" 2>/dev/null || echo unknown)"
        status="$(cat "$run_dir/status" 2>/dev/null || echo missing)"
        base="$(cat "$run_dir/base" 2>/dev/null || echo unknown)"
        echo "$run_id reviewer=$reviewer status=$status base=$base"
    done
    if [ "$found" -eq 0 ]; then
        echo "No async review runs found."
    fi

# Tail the output of an async review run
[script("bash")]
review-tail run_id="latest" lines="80":
    set -euo pipefail
    if [ "{{ run_id }}" = "latest" ]; then
        run_dir="$(find "{{ review_runs_dir }}" -maxdepth 1 -mindepth 1 -type d | sort -r | head -n 1)"
    else
        run_dir="{{ review_runs_dir }}/{{ run_id }}"
    fi
    if [ -z "${run_dir:-}" ]; then
        echo "No async review runs found."
        exit 1
    fi
    if [ ! -d "$run_dir" ]; then
        echo "Unknown review run: {{ run_id }}"
        exit 1
    fi
    echo "--- status ---"
    cat "$run_dir/status"
    echo ""
    echo "--- output ---"
    tail -n "{{ lines }}" "$run_dir/output.log" 2>/dev/null || true
    if [ -s "$run_dir/error.log" ]; then
        echo ""
        echo "--- errors ---"
        tail -n "{{ lines }}" "$run_dir/error.log"
    fi

# Review current branch changes with one agent against a base ref
[script("bash")]
review-agent agent=default_review_agent base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    just _review-output "{{ agent }}" "{{ base }}" "{{ timeout }}"

# Review only staged changes with one agent
[script("bash")]
review-staged agent=default_review_agent timeout=default_review_timeout_seconds:
    set -euo pipefail
    cd "{{ project_root }}"
    timeout "{{ timeout }}"s {{ genie_src_bin }} review --agent "{{ agent }}" --staged

# Print the stable JSON schema for review automation
[script("bash")]
review-schema:
    set -euo pipefail
    cd "{{ project_root }}"
    {{ genie_src_bin }} review --json-schema

# Check provider installation/auth status before running AI reviews
[script("bash")]
review-doctor provider="":
    set -euo pipefail
    cd "{{ project_root }}"
    if [ -n "{{ provider }}" ]; then
        {{ genie_src_bin }} providers doctor --provider "{{ provider }}" --json
    else
        {{ genie_src_bin }} providers doctor --json
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
    BODY=$(just _review-output "{{ agent }}" "{{ base }}" "{{ default_review_timeout_seconds }}")
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
    BODY=$(just _review-output "{{ agent }}" "{{ base }}" "{{ default_review_timeout_seconds }}")
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
    just _review-output claude "{{ base }}" "{{ timeout }}"

# Print a Gemini CLI review for the branch diff
[no-exit-message]
[script("bash")]
review-gemini base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    just _review-output gemini "{{ base }}" "{{ timeout }}"

# Print a prompt-driven Codex CLI review for the branch diff
[no-exit-message]
[script("bash")]
review-codex base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    timeout "{{ timeout }}"s sh -c '{ printf "%s\n\n" "$2"; git diff "$1"...HEAD; } | codex exec --sandbox read-only -o /dev/stdout -' _ "{{ base }}" "{{ default_review_prompt }}"

# Run the dedicated Codex review command against a base ref
[no-exit-message]
[script("bash")]
review-codex-dedicated base=default_review_base timeout=default_review_timeout_seconds:
    set -euo pipefail
    just _review-output codex "{{ base }}" "{{ timeout }}"

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
