<!-- PR title must follow Conventional Commits, e.g. "feat(web): add session filter" -->

## Summary

<!-- What does this PR change, and why? -->

## Related issue

<!-- e.g. Closes #123 -->

## Checklist

- [ ] PR title follows Conventional Commits
- [ ] Respects the invariants in AGENTS.md (observer, never blocks a session, artifacts only, local only)
- [ ] `bun run lint`, `bun run typecheck`, and `bun test` pass
- [ ] `plugin/bin/hook.js` rebuilt and committed if `src/hook/` or `src/shared/` changed
- [ ] UI changes follow DESIGN.md, with light and dark screenshots
- [ ] Docs updated if behavior changed (README.md and README.ko.md kept in sync)
