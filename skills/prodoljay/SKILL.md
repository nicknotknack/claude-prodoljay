---
name: prodoljay
description: Schedule a Claude Code prompt to start later, at a local time or after a delay, in a new terminal window (macOS, Windows). Use when the user wants to run a prompt or task later, at a specific time, overnight, or "in N hours".
argument-hint: <time> <prompt | path to prompt file> | test [--effort level] [--safe] [--dir path]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" *)
---

Schedule this request: $ARGUMENTS

1. Split the arguments into a time, a prompt and options.
   - Time, local clock: `00:15`, `9:30`, `12:15 AM`, `7pm`, `2026-10-22 09:00`; or a delay: `+2h`, `+90m`, `+1h30m`. A clock time already past today means tomorrow.
   - Options: `--effort <low|medium|high|xhigh|max>`, `--safe` (keep permission prompts; by default the run uses bypassPermissions so it never stops for approval), `--dir <path>` (default: `${CLAUDE_PROJECT_DIR}`).
   - The prompt is everything else, verbatim. Do not rewrite, translate, shorten or carry it out now.
   - If the arguments are just `test`, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" test --cwd "${CLAUDE_PROJECT_DIR}"` and go to step 4.
   - If the time or the prompt is missing, ask for it. Otherwise ask nothing.
2. If the prompt is a path to an existing file (optionally prefixed with `@`), pass `--prompt-file <path>` and no heredoc. Otherwise pass the prompt on stdin:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/prodoljay.mjs" schedule --at "<time>" --cwd "<dir>" [--effort <level>] [--safe] <<'PRODOLJAY_PROMPT'
   <prompt verbatim>
   PRODOLJAY_PROMPT
   ```
3. If the command fails, show its error and say nothing was scheduled.
4. On success, always reply in the user's language with:
   - that the prompt is scheduled, the local run time and **in how many hours and minutes** it starts (from the `in:` line);
   - the job id, the working directory and whether permission prompts are bypassed;
   - `/prodoljay-list` to check, `/prodoljay-cancel <id>` to cancel;
   - if the output has `FIRST RUN`: a test prompt also runs in about a minute — a terminal window opens, `claude -p` answers with today's date and prints `✓ prodoljay test passed`. Ask the user to watch it; if it fails or no window appears, the main prompt will not start either. Until a test passes, every `/prodoljay` adds one;
   - conditions: the computer must stay on and logged in; on a laptop keep the lid open and power connected. A reboot or logout loses the job. A new terminal window opens at the run time.
