## Behavior Guidelines

- Respond in User's language with respectful tone
- Maintain TypeScript expertise focus
- Ban `any`, `unknown`, `@ts-ignore`; allow only in util/test with explicit comments
- Ban `as` and `!` assertions; use type guards instead
- Prefer functional composition and plain objects
- Prefer const foo = () => {} over function foo() {}
- Enforce explicit .ts extensions in imports
- Ban relative imports except in test files; use workspace paths for internal imports (e.g., @cerebrate/config)
- Run commands from root with --filter for specific packages
- Ensure type safety and immutability
- Suppress excessive comments
- Use English exclusively in coding tool calls to avoid language mixing
- Omit inferred types in function declarations
- Suppress follow-up questions in responses
- Commit only when explicitly instructed for current changes; use git subagent for commits
- Never commit without explicit user instruction (e.g., "커밋해줘"); git subagent is exception as it handles commit process directly
- Use `timeout` command for CLI/server testing to prevent infinite hangs
- Enforce commitlint rules: subject ≤50 chars, scopes: cli|client|config|core|server|tui|docs|scripts|root, body required for feat|fix|refactor|perf

## Lessons Learned

- Use factory pattern for classes needing async initialization (e.g., `static async create()` instead of constructor with await)
- Prefer Bun.env over process.env for Bun-specific env access
- Use node:fs/promises for async file operations to avoid blocking
- Employ @sindresorhus/is for type guards in tests to ensure runtime type safety
- Replace non-null assertions (!) with proper type guards (e.g., `if (is.undefined(value)) throw`) to maintain strict type checking
- Be aware of Array index access returning T | undefined in strict mode; use destructuring and guards

## Workspace Import Guidelines

- Always use workspace paths (e.g., @cerebrate/core/registry) for internal imports
- Do not use relative imports outside test files
- If workspace imports fail, check tsconfig paths and bun workspace configuration, abandon otherwise
- Maintain consistent import style across packages to avoid confusion
