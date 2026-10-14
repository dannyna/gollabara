# Contributing

Thanks for your interest in gollabara! This guide covers how to get from a clone to a merged pull request.

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md). All documentation, code, comments, and commit messages in this repository are written in **English**. The one exception is [README.ko.md](README.ko.md), the Korean translation of the README, and the product UI copy, which is Korean.

Before changing behavior, read the invariants in [AGENTS.md](AGENTS.md). gollabara observes sessions and never mediates them, and a change that breaks an invariant won't be merged however well it works.

## Getting started

Requires [bun](https://bun.sh) 1.3 or later. Use bun only, never npm, pnpm, or yarn.

```bash
git clone https://github.com/dannyna/gollabara.git
cd gollabara
bun install         # also installs the git hooks (lint-staged, commitlint)
bun run build
```

## Development workflow

1. Create a branch from `main` named `<type>/<short-topic>` (e.g. `feat/pause-session` or `fix/hook-timeout`).
2. Make focused changes. Keep each pull request to one logical change.
3. Run the checks below and make sure they pass.
4. Open a pull request and fill out the template.

```bash
bun run lint        # lint and format (code, Markdown, JSON, YAML)
bun run typecheck
bun test
bun run build       # bundles the hook and builds the web UI
```

If you change `src/hook/` or `src/shared/`, commit the rebuilt `plugin/bin/hook.js` too. CI fails when it doesn't match the source.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`, where `type` is one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, and so on. Breaking changes include a `BREAKING CHANGE:` footer. The commit-msg hook checks this locally.

## Pull requests

For anything beyond a small fix, start with an issue or a discussion so we can agree on the approach before you write code.

- Reference the issue your PR addresses (e.g. `Closes #123`).
- Use a Conventional Commit PR title. `main` takes squash merges only, so the title becomes the commit, and the `pr-title` check enforces it.
- Make sure CI is green and every review thread is resolved.
- UI changes follow [DESIGN.md](DESIGN.md). Include a screenshot of light and dark.

## Reporting bugs and requesting features

| You want to…                     | File it as…      | Humans                                                                              | Agents                                                                           |
| -------------------------------- | ---------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Report a bug or propose a fix    | an **Issue**     | [New issue](https://github.com/dannyna/gollabara/issues/new/choose)                 | [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE)                              |
| Request a feature or enhancement | a **Discussion** | [New discussion](https://github.com/dannyna/gollabara/discussions/categories/ideas) | [`.github/DISCUSSION_TEMPLATE/ideas.yml`](.github/DISCUSSION_TEMPLATE/ideas.yml) |

**Security vulnerabilities** → **do not** open a public issue. Follow
[SECURITY.md](./SECURITY.md) instead.
