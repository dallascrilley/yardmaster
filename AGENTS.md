# AGENTS.md

Repository scope: this file applies to the entire `genie-cli` repository.

## MANDATORY: Use TD for Task Management

- Use `td` as the source of truth for task tracking in this repo.
- At the start of each new conversation/session, run `td usage --new-session`.
- During execution, keep task state updated in TD instead of ad-hoc notes.
- Before finishing work, ensure TD reflects current status and next actions.
