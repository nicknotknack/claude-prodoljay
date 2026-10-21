# Privacy policy

prodoljay runs entirely on your computer.

- **What it stores:** the text of prompts you schedule, job metadata (run time, working directory, status, process id) and logs. Everything is kept in `~/.claude/prodoljay/` on your computer.
- **What it sends:** nothing. The plugin makes no network requests and has no server, analytics or telemetry.
- **Retention:** files stay on your computer until you delete them. Deleting `~/.claude/prodoljay/` removes all plugin data.
- **Third parties:** at the scheduled time, the plugin starts your local `claude` CLI with your prompt. That session is handled by Claude Code under Anthropic's terms, like any session you start yourself.

Questions: https://github.com/nicknotknack/claude-prodoljay/issues
