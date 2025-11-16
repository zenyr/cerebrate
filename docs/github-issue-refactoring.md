# Effect.ts Refactoring - Complete Migration Plan

## Description

Complete refactoring of Cerebrate codebase to leverage Effect.ts for improved type safety, error handling, resource management, and testability.

**Documentation:** See [docs/effect-refactoring-plan.md](../docs/effect-refactoring-plan.md) for detailed plan.

**Effect Submodule:** `external/effect` (commit: f445b87)

## Current Pain Points

- **Resource Management:** Manual cleanup, lifecycle leaks, no structured shutdown
- **Error Handling:** 25+ generic errors, silent failures, no recovery strategies
- **Async Complexity:** 101 async functions, manual timeouts, no cancellation
- **Testing:** Manual mocks, complex setup/teardown
- **Validation:** Mixed runtime validation, no compile-time guarantees

## Timeline

7-8 weeks, 212 hours estimated effort

## Task Breakdown

### Phase 1: Core Infrastructure (Week 1-2, 16h)
- [ ] #TASK1: Setup Effect dependencies and workspace configuration
- [ ] #TASK2: Define typed error hierarchy and service interfaces
- [ ] #TASK3: Create base Layer infrastructure

### Phase 2: Auth Store Refactoring (Week 2-3, 36h)
- [ ] #TASK4: Refactor AuthStore with @effect/sql-sqlite-bun
- [ ] #TASK5: Convert insert/verify/list/delete to Effect pipelines
- [ ] #TASK6: Add resource management via Layer.scoped
- [ ] #TASK7: Implement typed errors (InvalidAuthCodeError, DecryptionError)
- [ ] #TASK8: Refactor CryptoService with Config for env vars
- [ ] #TASK9: Update auth tests to Effect patterns

### Phase 3: MCP Client Refactoring (Week 3-4, 20h)
- [ ] #TASK10: Migrate MCPClient to @effect/rpc
- [ ] #TASK11: Add retry logic via Schedule
- [ ] #TASK12: Implement connection state tracking
- [ ] #TASK13: Add graceful disconnection with acquireRelease
- [ ] #TASK14: Update client tests

### Phase 4: MCP Server Refactoring (Week 4-5, 48h)
- [ ] #TASK15: Replace client Map with Ref for state management
- [ ] #TASK16: Implement concurrent scope loading via Effect.forEach
- [ ] #TASK17: Refactor request handlers with structured error handling
- [ ] #TASK18: Add graceful shutdown support
- [ ] #TASK19: Migrate stdio transport to @effect/platform Streams
- [ ] #TASK20: Migrate HTTP/SSE transport to @effect/platform
- [ ] #TASK21: Add structured logging via Effect.log
- [ ] #TASK22: Update server tests

### Phase 5: CLI & Config (Week 5-6, 40h)
- [ ] #TASK23: Refactor config loading with Config provider
- [ ] #TASK24: Remove silent error swallowing
- [ ] #TASK25: Add schema migration support
- [ ] #TASK26: Migrate CLI to @effect/cli
- [ ] #TASK27: Remove manual DI from CLI
- [ ] #TASK28: Add structured logging to CLI
- [ ] #TASK29: Update CLI tests

### Phase 6: Test Infrastructure (Week 6-7, 20h)
- [ ] #TASK30: Integrate @effect/vitest
- [ ] #TASK31: Replace manual cleanup with Effect.scoped
- [ ] #TASK32: Create test Layers for DI
- [ ] #TASK33: Migrate all 15 test files to Effect patterns

### Phase 7: Integration & Migration (Week 7-8, 32h)
- [ ] #TASK34: Remove all manual mocks from tests
- [ ] #TASK35: Verify test isolation
- [ ] #TASK36: Update README with Effect usage
- [ ] #TASK37: Add architecture decision records
- [ ] #TASK38: Create migration guide
- [ ] #TASK39: Benchmark performance before/after
- [ ] #TASK40: Verify startup time unchanged
- [ ] #TASK41: Run memory leak testing

## Success Metrics

- [ ] Zero `any`, `unknown`, `@ts-ignore`
- [ ] Zero `as`, `!` assertions
- [ ] All async ops cancellable
- [ ] No manual resource cleanup
- [ ] 100% test coverage maintained
- [ ] Startup time ≤ current baseline
- [ ] All errors typed and recoverable

## Affected Packages

- `@cerebrate/core` - Auth, registry, protocols
- `@cerebrate/server` - MCP server, transports
- `@cerebrate/client` - MCP client
- `@cerebrate/cli` - CLI commands, config
- `@cerebrate/test-utils` - Test infrastructure

## Dependencies

- Phase 1 blocks all others
- Phase 2 (Auth) independent
- Phase 3 (Client) required for Phase 4
- Phase 5 (CLI) depends on Phase 1
- Phase 6 (Tests) depends on Phases 2-4
- Phase 7 (Integration) depends on all

## References

- Effect Documentation: https://effect.website
- Effect Submodule: `external/effect/`
- Detailed Plan: [docs/effect-refactoring-plan.md](../docs/effect-refactoring-plan.md)
