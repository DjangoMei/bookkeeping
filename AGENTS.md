# Repository workflow

This project is linked to `https://github.com/DjangoMei/bookkeeping.git`.

## Synchronization

- At the start of each coding task, fetch `origin` and update the checked-out branch from its upstream before editing.
- Only pull automatically when the working tree is clean. If there are local changes or a merge/rebase conflict, stop and report the state instead of stashing, discarding, or overwriting files.
- Use `git pull --rebase` for normal branch updates. Never force-push or rewrite shared history unless the user explicitly requests it.
- After completing and verifying a requested change, commit only the files belonging to that task and push the current branch to `origin`.
- Keep `main` tracking `origin/main`. Use a `codex/` feature branch for changes that should be reviewed through a pull request.
