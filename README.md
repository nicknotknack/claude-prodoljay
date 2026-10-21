# prodoljay

Schedule a Claude Code prompt to start later. At the chosen time, a new terminal window opens and `claude` starts working on the prompt. The machine stays awake while it waits.

```
/prodoljay 00:15 build the frontend from SPEC.md
```

## Install

```bash
claude plugin marketplace add nicknotknack/claude-prodoljay
claude plugin install prodoljay@prodoljay
```

Requires Node.js 18+ and `claude` on your PATH. Tested on macOS. Windows support is implemented but has not been tested yet.

## Use

| Command | |
|---|---|
| `/prodoljay <time> <prompt>` | schedule a prompt |
| `/prodoljay <time> ./prompt.md` | use a file as the prompt |
| `/prodoljay-list` | show scheduled prompts |
| `/prodoljay-cancel <id \| all>` | cancel |
| `/prodoljay test` | run a test in one minute |

**Time:** `00:15` · `9:30` · `12:15 AM` · `7pm` · `2026-10-22 09:00` · `+2h` · `+1h30m`. A clock time that has already passed today means tomorrow.

**Options:**
- `--effort <level>` sets the effort level for the scheduled session.
- `--dir <path>` sets the working directory. The default is the current project.
- `--safe` keeps permission prompts on. Without it, the session runs with `bypassPermissions` so nothing blocks it overnight.

On the first schedule on a machine, prodoljay also runs a test one minute later. Watch the window that opens: it should print `✓ prodoljay test passed`.

## Good to know

- Keep the computer on and stay logged in. On a laptop, keep the lid open and the charger plugged in.
- A reboot or logout drops pending jobs. They show up as `lost` in `/prodoljay-list`.
- Jobs and logs are stored in `~/.claude/prodoljay/`.

## License

MIT
