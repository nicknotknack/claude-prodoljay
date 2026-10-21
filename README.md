# prodoljay

Schedule a Claude Code prompt to run later. At the scheduled time, prodoljay opens a new terminal window and starts `claude` with your prompt. The computer stays awake until then.

```
/prodoljay 00:15 build the frontend from SPEC.md
```

## Install

```bash
claude plugin marketplace add nicknotknack/claude-prodoljay
claude plugin install prodoljay@prodoljay
```

Requirements: Claude Code on macOS or Windows, Node.js 18+, and `claude` on your PATH.

## Usage

| Command | Description |
|---|---|
| `/prodoljay <time> <prompt>` | Schedule a prompt |
| `/prodoljay <time> <file>` | Schedule a prompt read from a file |
| `/prodoljay-list` | List scheduled prompts |
| `/prodoljay-cancel <id \| all>` | Cancel scheduled prompts |
| `/prodoljay test` | Run a test prompt in one minute |

**Time formats:** `00:15`, `12:15 AM`, `7pm`, `2026-10-22 09:00`, `+2h`, `+1h30m`. If a clock time has already passed today, the prompt runs tomorrow.

**Options:**
- `--effort <level>` — effort level for the scheduled session.
- `--dir <path>` — working directory. Defaults to the current project.
- `--safe` — keep permission prompts on. Without this flag, the session runs in `bypassPermissions` mode.

The first time you schedule a prompt on a computer, prodoljay also runs a test prompt one minute later to confirm that scheduling works.

## What it runs

All logic is in [`bin/prodoljay.mjs`](bin/prodoljay.mjs), a single Node.js file with no dependencies. It makes no network requests and sends no data anywhere.

- **Scheduling** starts a background Node.js process that waits until the run time.
- **Keeping the computer awake** uses `caffeinate` on macOS and `SetThreadExecutionState` through PowerShell on Windows.
- **Opening the terminal** uses `osascript` to open Terminal.app on macOS and `cmd /c start` on Windows.
- **Running the prompt** starts the `claude` CLI in the chosen directory. By default the session runs with `--permission-mode bypassPermissions`, so it can work unattended without asking for approval. Use `--safe` to keep permission prompts.
- **Storage** is limited to job files and logs in `~/.claude/prodoljay/`.

## Notes

- The computer must stay on and logged in. On a laptop, keep the lid open and the charger connected.
- Restarting or logging out drops pending prompts. They appear as `lost` in `/prodoljay-list`.

## Privacy

No data leaves your computer. See [PRIVACY.md](PRIVACY.md).

## Support

Telegram [@nicknotknack](https://t.me/nicknotknack) or [GitHub issues](https://github.com/nicknotknack/claude-prodoljay/issues).

## License

MIT
