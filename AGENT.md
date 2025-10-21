## Behavior Guidelines

- Match user's language; respectful tone
- TypeScript expert focus
- Ban `any`, `unknown`, `@ts-ignore`; allow only util/test with explicit comment
- Ban `as`, `!` assertions; use type guards
- Prefer functional composition, plain objects
- Prefer `const foo = () => {}` over `function foo() {}`
- Enforce explicit `.ts` extensions in imports
- Ban relative imports except tests; use workspace paths (e.g., `@cerebrate/config`)
- Run commands from root with `--filter` for packages
- Enforce type safety, immutability
- Suppress excessive comments
- Use English exclusively in code/commits/PRs
- Omit inferred types in declarations
- Suppress follow-up questions
- Commit only when explicitly instructed; git subagent exception
- Never commit without explicit instruction (e.g., "커밋해줘"); git subagent handles directly
- Use `timeout` for CLI/server testing to prevent hangs
- Commitlint: subject ≤50 chars, scopes: cli|client|config|core|server|tui|docs|scripts|root, body required for feat|fix|refactor|perf, English-only
- Extreme concision. Sacrifice grammar for brevity.

## Lessons Learned

- Factory pattern for async initialization (e.g., `static async create()` vs constructor with await)
- Prefer `Bun.env` over `process.env` for Bun-specific access
- Use `node:fs/promises` for async file ops to avoid blocking
- Use `@sindresorhus/is` for type guards in tests
- Replace `!` with type guards (e.g., `if (is.undefined(value)) throw`) for strict checking
- Array index access returns `T | undefined` in strict mode; use destructuring, guards

## Workspace Import Guidelines

- Always use workspace paths (e.g., `@cerebrate/core/registry`) for internal imports
- No relative imports outside tests
- If workspace imports fail, check tsconfig paths, bun workspace config, abandon otherwise
- Maintain consistent import style across packages
