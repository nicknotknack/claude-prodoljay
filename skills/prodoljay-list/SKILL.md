---
name: prodoljay-list
description: Show prompts scheduled with /prodoljay — when they run, status, directory. Use when the user asks what is scheduled or whether a scheduled prompt ran.
argument-hint: [--all]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" *)
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" list $ARGUMENTS` and summarize it for the user in their language as a short table: id, status, run time (and "in N h M min" for pending), directory, prompt start.

Statuses: `pending` waiting; `launched` terminal opened; `running` claude is running; `finished` claude exited; `cancelled`; `failed` (show the error); `lost` the waiter process is gone (reboot or logout), so the prompt will not run — offer to schedule it again.

Jobs marked `[test]` are first-run checks: `finished` means scheduling works on this machine, `failed` means it does not — show the error and suggest `/prodoljay test` after fixing it.

Mention `/prodoljay-cancel <id>` if anything is pending. Without `--all`, finished and cancelled jobs older than a day are hidden.
