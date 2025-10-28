# Repository Guidelines

## Critical Rules

- Never start implementation without explicit user approval for features, APIs, behavior, or architecture. If a user asks a question, answer only that question and stop.
- Finish discussions before coding: confirm the plan, get sign-off, then implement. Halt and escalate if you uncover structural parser or architecture issues.
- Manual edits only—do not use MultiEdit, scripted replacements, `sed`, `awk`, or ad-hoc automation for fixes.

## Session Startup Protocol

- Re-read `README.md`, `CODING-STANDARDS.md`, `ARCHITECTURE.md`, and this file at the beginning of every session and after long breaks.
- Inspect `.todos/` for active work. Create `YYYY-MM-DD-task-name.md` with context, decisions, affected files, and next steps for any effort that spans sessions; update or mark complete as you progress.

## Workflow Sequencing

- Follow the lint-first rule: run `./scripts/lint-all.sh` before `./scripts/build.sh`; rerun lint after code changes that follow a failing build.
- Use workspace scripts for all tooling. Never rely on global binaries or `npx`.
- Keep temporary analysis outputs in `.analysis/` and long test logs in `.tests/` using `npm test | tee .tests/run-<timestamp>.txt`.

## Project Layout & Code Style

- Core query builder: `packages/tinqer/src` with builds in `packages/tinqer/dist`; PostgreSQL adapter and integration harness live in their respective `packages/` subdirectories.
- TypeScript is `strict`; avoid `any`, use ESM with explicit `.js` extensions, static imports, two-space indentation, and Prettier defaults. Naming: files kebab-case, functions camelCase, types PascalCase, constants UPPER_SNAKE_CASE. Reserve comments for complex intent.

## Commands & Testing

- `npm run build`/`build:quick` compile all workspaces; `npm run test` runs the full Mocha suite; target packages via `npm run test:tinqer` or `npm run dev --workspace @tinqerjs/tinqer`.
- Enforce quality with `npm run lint`, `lint:fix`, `format:check`, and `typecheck`. Test files end with `*.test.ts`, colocate helpers in `tests/test-utils/`, and assert on generated SQL plus bound parameters.

## Delivery Checklist

- Confirm approvals, update `.todos/`, and ensure build, test, and lint succeed before review.
- Use Conventional Commit messages (`feat:`, `fix:`, `test:`). PRs must describe the problem, solution, verification commands, linked issues, and supply screenshots or SQL diffs for behavioral changes.
