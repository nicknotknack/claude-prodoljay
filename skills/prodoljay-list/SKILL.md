---
name: prodoljay-list
description: List prompts scheduled with /prodoljay, with their run time and status. Use when the user asks what is scheduled or whether a scheduled prompt ran.
argument-hint: [--all]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" *)
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" list $ARGUMENTS` and show the result as a short table in the user's language: id, status, run time (with time remaining for pending jobs), directory, prompt.

Statuses: `pending`, `launched`, `running`, `finished`, `cancelled`, `failed` (include the error), `lost` (the computer restarted or the user logged out; offer to reschedule). `[test]` marks a test job.

Without `--all`, jobs that ended more than a day ago are hidden.
