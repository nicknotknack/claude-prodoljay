---
name: prodoljay-cancel
description: Cancel a prompt scheduled with /prodoljay, by id or all pending ones. Use when the user wants to cancel, remove or stop a scheduled prompt.
argument-hint: <id | all>
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" *)
---

Target: $ARGUMENTS

1. If no target is given, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" list`, show the pending jobs and ask which to cancel.
2. Otherwise run `node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" cancel <id|all>` (an id prefix works).
3. Report in the user's language what was cancelled. A job that already started runs in its own terminal window and cannot be cancelled here — tell the user to close that window.
