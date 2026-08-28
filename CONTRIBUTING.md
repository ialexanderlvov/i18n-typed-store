# Contributing

Thanks for your interest in contributing to **i18n-typed-store**!

## Prerequisites

- Node.js `>=20.19` for repository tooling (see `.nvmrc` for the version used in development; published packages still support Node `>=20`, and CI tests Node 20/22/24)
- [pnpm](https://pnpm.io/) (the repo pins a version via `packageManager`)

## Getting started

```bash
pnpm install
pnpm build          # build all packages (tsup)
pnpm typecheck      # type-check source code and tests
pnpm test           # run all tests (vitest)
pnpm test:coverage  # run tests and enforce coverage thresholds
pnpm lint           # lint all packages (eslint)
pnpm format         # format with prettier
```

The repo is an [Nx](https://nx.dev) + pnpm monorepo with three packages under `packages/`:

| Package                                                       | Description                                            |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| [`i18n-typed-store`](./packages/i18n-typed-store)             | Framework-agnostic core (store, plurals, locale utils) |
| [`i18n-typed-store-react`](./packages/i18n-typed-store-react) | React hooks, Provider, SSR helpers                     |
| [`i18n-typed-store-nest`](./packages/i18n-typed-store-nest)   | NestJS module, service, decorators                     |

## Making changes

1. Create a branch off `main`.
2. Make your change with tests (`vitest`). Keep `pnpm typecheck`, `pnpm test`,
   `pnpm lint`, and `pnpm format:check` green.
3. Add a changeset describing the change:
    ```bash
    pnpm changeset
    ```
    Pick the affected package(s) and a semver bump (patch / minor / major). The
    changeset drives version bumps and the generated per-package `CHANGELOG.md`.
4. Open a pull request.

## Conventions

- TypeScript `strict` is on; avoid widening the public type surface unsoundly.
- Tabs for indentation, formatting enforced by Prettier (run `pnpm format`).
- Only `dist/` is published — keep the public API in each package's `src/index.ts`.

## CI

Every push and pull request runs the CI workflow (`.github/workflows/ci.yml`):
build, type-check, tests, lint, and format check across Node 20/22/24. On Node 24,
the test run also enforces package coverage thresholds.

## Releasing (maintainers)

Releases are automated with [changesets/action](https://github.com/changesets/action)
in `.github/workflows/ci.yml`: only after the complete Node 20/22/24 matrix
succeeds, merged changesets on `main` open/refresh a "release packages" PR;
merging that PR publishes to npm with provenance. Requires the `NPM_TOKEN`
repository secret.

Manual fallback:

```bash
pnpm publish:version   # checks + apply changeset versions
pnpm publish:release   # checks + publish to npm
```
