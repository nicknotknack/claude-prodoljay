---
name: prodoljay
description: Schedule a Claude Code prompt to start later, at a local time or after a delay, in a new terminal window. Use when the user wants to run a prompt later, at a specific time, overnight, or in N hours.
argument-hint: <time> <prompt | file> [--effort level] [--dir path] [--safe] | test
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" *)
---

Request: $ARGUMENTS

1. Parse the request.
   - `test` alone: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" test --cwd "${CLAUDE_PROJECT_DIR}"` and report the result.
   - Time: `00:15`, `12:15 AM`, `7pm`, `2026-10-22 09:00`, `+2h`, `+1h30m`.
   - Options: `--effort <level>`, `--dir <path>` (default `${CLAUDE_PROJECT_DIR}`), `--safe`.
   - Prompt: everything else, verbatim. Do not edit, translate or execute it.
   - Ask only if the time or the prompt is missing.
2. Schedule. If the prompt is a path to an existing file, pass `--prompt-file <path>`. Otherwise pass it on stdin:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" schedule --at "<time>" --cwd "<dir>" [--effort <level>] [--safe] <<'PRODOLJAY_PROMPT'
   <prompt>
   PRODOLJAY_PROMPT
   ```
3. If the command fails, show the error and state that nothing was scheduled.
4. On success, reply in the user's language, briefly:
   - the run time and how long until it starts (the `in:` line);
   - the job id and working directory;
   - `/prodoljay-list` to view, `/prodoljay-cancel <id>` to cancel;
   - if the output contains `FIRST RUN`: a test window opens in about a minute and should print `✓ prodoljay test passed`;
   - the computer must stay on and logged in; on a laptop, keep the lid open and the charger connected.
