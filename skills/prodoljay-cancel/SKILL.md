---
name: prodoljay-cancel
description: Cancel prompts scheduled with /prodoljay, by id or all pending ones. Use when the user wants to cancel a scheduled prompt.
argument-hint: <id | all>
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" *)
---

Target: $ARGUMENTS

1. If no target is given, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" list`, show the pending jobs and ask which one to cancel.
2. Otherwise run `node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" cancel <target>`. An id prefix is enough.
3. Report what was cancelled in the user's language. A job that has already started cannot be cancelled; the user can close its terminal window instead.
