# Effect.ts Refactoring Plan

## Overview

Refactor Cerebrate codebase to leverage Effect.ts for improved type safety, error handling, resource management, and testability.

**Effect Submodule:** `external/effect` (commit: f445b87)

## Current Pain Points

### Resource Management
- Manual cleanup (DB connections, HTTP servers, MCP clients)
- Lifecycle management prone to leaks
- No structured shutdown

### Error Handling
- 25+ generic `Error` throws
- Silent failures (try-catch for control flow)
- No error recovery strategies
- No typed error channels

### Async Complexity
- 101 async functions with implicit error propagation
- Manual timeout management via `Promise.race`
- No cancellation support
- Sequential ops where parallel viable

### Testing
- Manual mock setup
- No clear pure/impure separation
- Complex integration test setup/teardown

### Validation
- Runtime validation mixed with business logic
- No compile-time data flow guarantees

## Effect Packages to Use

| Package | Purpose |
|---------|---------|
| `@effect/platform-bun` | Bun runtime integration |
| `@effect/sql-sqlite-bun` | SQLite with Effect (auth store) |
| `@effect/rpc` | Typed RPC (MCP protocol) |
| `@effect/cli` | CLI framework |
| `@effect/vitest` | Testing utilities |

## Refactoring Phases

### Phase 1: Core Infrastructure (Week 1-2)

**1.1 Setup Effect Dependencies**
- Add Effect packages to workspace
- Configure tsconfig for Effect types
- Create base Layer infrastructure

**Files:**
- `package.json` (root)
- `packages/*/package.json`
- `tsconfig.base.json`

**1.2 Error Types & Services**
- Define typed error hierarchy
- Create service interfaces
- Establish Layer structure

**New Files:**
- `packages/core/src/errors.ts` - Typed error classes
- `packages/core/src/services/` - Service interfaces
- `packages/core/src/layers/` - Layer constructors

**Estimated Effort:** 16h

---

### Phase 2: Auth Store Refactoring (Week 2-3)

**2.1 AuthStore with Effect SQL**

**Target:** `packages/core/src/auth/store.ts` (133 LOC)

**Changes:**
- Replace `bun:sqlite` with `@effect/sql-sqlite-bun`
- Convert class methods to Effect pipelines
- Add resource management via `Layer.scoped`
- Implement typed errors (`InvalidAuthCodeError`, `DecryptionError`)

**Before:**
```typescript
static async create(dbPath?: string): Promise<AuthStore>
async insert(code: string): Promise<void>
async verify(code: string): Promise<boolean>
```

**After:**
```typescript
class AuthStore extends Effect.Service<AuthStore>()("AuthStore", {
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return {
      insert: (code: string) => Effect.gen(...),
      verify: (code: string) => Effect.gen(...),
      list: Effect.gen(...),
      delete: (code: string) => Effect.gen(...)
    }
  }),
  dependencies: [SqlLive]
})
```

**Benefits:**
- Automatic connection pooling
- Transaction support
- No manual cleanup
- Typed errors

**Tests to Update:**
- `packages/core/__tests__/auth/store.test.ts`

**Estimated Effort:** 24h

---

**2.2 Crypto Service**

**Target:** `packages/core/src/auth/crypto.ts` (68 LOC)

**Changes:**
- Remove `process.env` access
- Use `Config` for environment vars
- Add key rotation support
- Typed errors for crypto failures

**Before:**
```typescript
const ENCRYPTION_KEY = process.env.CEREBRATE_ENCRYPTION_KEY
export const encrypt = (text: string): string
```

**After:**
```typescript
class CryptoService extends Effect.Service<CryptoService>()("CryptoService", {
  effect: Effect.gen(function* () {
    const key = yield* Config.secret("CEREBRATE_ENCRYPTION_KEY")
    return {
      encrypt: (text: string) => Effect.try(...),
      decrypt: (text: string) => Effect.try(...)
    }
  })
})
```

**Estimated Effort:** 12h

---

### Phase 3: MCP Client Refactoring (Week 3-4)

**3.1 MCPClient with RPC**

**Target:** `packages/client/src/index.ts` (54 LOC)

**Changes:**
- Use `@effect/rpc` for MCP protocol
- Add retry logic via `Schedule`
- Connection state tracking
- Graceful disconnection

**Before:**
```typescript
async connect(): Promise<void>
async registerScope(name: string): Promise<void>
async disconnect(): Promise<void>
```

**After:**
```typescript
class MCPClient extends Effect.Service<MCPClient>()("MCPClient", {
  scoped: Effect.gen(function* () {
    const client = yield* Effect.acquireRelease(
      connect,
      (c) => c.disconnect()
    )
    return {
      registerScope: (name: string) =>
        Effect.retry(doRegister(name), Schedule.exponential("100 millis")),
      callTool: (request: CallToolRequest) => Effect.gen(...)
    }
  })
})
```

**Benefits:**
- Auto-retry on failure
- Connection cleanup guaranteed
- Type-safe protocol

**Estimated Effort:** 20h

---

### Phase 4: MCP Server Refactoring (Week 4-5)

**4.1 MCPServer Core**

**Target:** `packages/server/src/index.ts` (229 LOC)

**Changes:**
- Replace manual client Map with `Ref`
- Concurrent scope loading via `Effect.forEach`
- Structured request handling
- Graceful shutdown

**Before:**
```typescript
async loadScopes(configs: MCPServerConfig[]): Promise<void> {
  for (const config of configs) {
    const client = new MCPClient(config, this.registry)
    await client.connect()
    await client.registerScope(config.name)
    this.clients.set(config.name, client)
  }
}
```

**After:**
```typescript
const loadScopes = (configs: ReadonlyArray<MCPServerConfig>) =>
  Effect.forEach(
    configs,
    (config) => MCPClient.pipe(
      Effect.provide(MCPClientLive(config)),
      Effect.flatMap((client) => client.registerScope(config.name))
    ),
    { concurrency: "unbounded" }
  )
```

**Benefits:**
- Parallel loading (faster startup)
- Type-safe client registry
- Auto-cleanup on shutdown

**Estimated Effort:** 28h

---

**4.2 Transport Layer**

**Target:**
- `packages/server/src/transports/stdio.ts`
- `packages/server/src/transports/http-sse.ts`

**Changes:**
- Use `@effect/platform` Streams
- Structured logging via `Effect.log`
- Resource-safe server lifecycle

**Estimated Effort:** 20h

---

### Phase 5: CLI & Config (Week 5-6)

**5.1 Config Loading**

**Target:** `packages/cli/src/config.ts` (42 LOC)

**Changes:**
- Replace Zod + async with `Config` provider
- Remove silent error swallowing
- Schema migration support

**Before:**
```typescript
export const loadConfig = async (configPath?: string): Promise<CerebrateConfig>
```

**After:**
```typescript
const ConfigLive = Layer.effect(
  Config.tag,
  Effect.gen(function* () {
    const path = yield* Config.string("CONFIG_PATH").pipe(
      Config.withDefault("~/.config/cerebrate/config.json5")
    )
    const content = yield* FileSystem.readFileString(path)
    return yield* Effect.try(() => configSchema.parse(JSON5.parse(content)))
  })
)
```

**Estimated Effort:** 16h

---

**5.2 CLI Commands**

**Target:** `packages/cli/src/cli.ts` (104 LOC)

**Changes:**
- Use `@effect/cli` for command definition
- Remove manual DI
- Structured logging

**Estimated Effort:** 24h

---

### Phase 6: Test Infrastructure (Week 6-7)

**6.1 Test Utilities**

**Target:** `packages/test-utils/src/` (all files)

**Changes:**
- Use `@effect/vitest` for Effect tests
- Replace manual cleanup with `Effect.scoped`
- Test Layers for DI

**New Patterns:**
```typescript
it.effect("should verify auth code", () =>
  Effect.gen(function* () {
    const store = yield* AuthStore
    yield* store.insert("test-code")
    const result = yield* store.verify("test-code")
    expect(result).toBe(true)
  }).pipe(
    Effect.provide(TestAuthStoreLive)
  )
)
```

**Estimated Effort:** 20h

---

### Phase 7: Integration & Migration (Week 7-8)

**7.1 Update All Tests**
- Migrate 15 test files to Effect patterns
- Remove manual mocks
- Verify test isolation

**7.2 Documentation**
- Update README with Effect usage
- Add architecture decision records
- Create migration guide

**7.3 Performance Validation**
- Benchmark before/after
- Verify startup time unchanged
- Memory leak testing

**Estimated Effort:** 32h

---

## Task Breakdown for Divide & Conquer

### High Priority (Core Functionality)

1. **Setup Effect Infrastructure** (Phase 1)
   - Subtasks: dependencies, tsconfig, base layers
   - Blocking: all other tasks

2. **Refactor AuthStore** (Phase 2.1)
   - Subtasks: SQL layer, insert, verify, list, delete, tests
   - Dependencies: Phase 1

3. **Refactor CryptoService** (Phase 2.2)
   - Subtasks: Config layer, encrypt, decrypt, tests
   - Dependencies: Phase 1

4. **Refactor MCPClient** (Phase 3)
   - Subtasks: connect, retry, registerScope, callTool, tests
   - Dependencies: Phase 1

5. **Refactor MCPServer** (Phase 4)
   - Subtasks: loadScopes, handlers, client registry, tests
   - Dependencies: Phase 3

### Medium Priority (CLI & Config)

6. **Refactor Config** (Phase 5.1)
   - Dependencies: Phase 1

7. **Refactor CLI** (Phase 5.2)
   - Dependencies: Phase 5.1

### Low Priority (Testing)

8. **Refactor Test Utils** (Phase 6)
   - Dependencies: Phase 2-4

9. **Integration & Docs** (Phase 7)
   - Dependencies: all above

---

## Success Metrics

- [ ] Zero `any`, `unknown`, `@ts-ignore`
- [ ] Zero `as`, `!` assertions
- [ ] All async ops cancellable
- [ ] No manual resource cleanup
- [ ] 100% test coverage maintained
- [ ] Startup time ≤ current baseline
- [ ] All errors typed and recoverable

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Learning curve steep | Pair on Phase 1, create examples |
| Bundle size increase | Tree-shaking verification, lazy loading |
| Breaking changes during refactor | Feature flags, parallel branches |
| Effect version updates | Pin submodule commit, test before bump |

---

## Timeline Summary

| Phase | Duration | Effort |
|-------|----------|--------|
| 1. Infrastructure | 1-2 weeks | 16h |
| 2. Auth | 1-2 weeks | 36h |
| 3. Client | 1-2 weeks | 20h |
| 4. Server | 1-2 weeks | 48h |
| 5. CLI | 1-2 weeks | 40h |
| 6. Tests | 1-2 weeks | 20h |
| 7. Integration | 1-2 weeks | 32h |
| **Total** | **7-8 weeks** | **212h** |

---

## References

- Effect Documentation: https://effect.website
- Effect Submodule: `external/effect/`
- Codebase Analysis: [from exploration above]
