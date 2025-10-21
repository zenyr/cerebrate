# Testing Guide

This document describes the testing infrastructure for Cerebrate, including the MCP integration test suite and type checking setup.

## Table of Contents

- [Overview](#overview)
- [MCP Integration Test Suite](#mcp-integration-test-suite)
- [Type Checking](#type-checking)
- [Running Tests](#running-tests)
- [CI/CD](#cicd)

## Overview

Cerebrate uses a comprehensive testing strategy that includes:

1. **Unit Tests**: Testing individual components in isolation
2. **Integration Tests**: Testing MCP server/client interactions end-to-end
3. **Type Checking**: Ensuring type safety across all packages

## MCP Integration Test Suite

### Architecture

The integration test suite is designed for **stateful, concurrent testing** of MCP server and client behavior.

**Key Features:**

- **Isolated Instances**: Each test creates its own server/client instances
- **Concurrent Testing**: Tests can run in parallel without conflicts
- **Stateful Verification**: Tests verify full request/response cycles
- **CI Ready**: Designed to run reliably in CI environments

### Test Utilities Package

Located in `packages/test-utils/`, this package provides:

#### Server Utilities

```typescript
import { createTestServer } from '@cerebrate/test-utils';

const server = await createTestServer({
  name: 'my-server',
  tools: [/* tools */],
  port: 0, // Random port for isolation
});

// Use server...

await server.cleanup();
```

**API:**

- `createTestServer(options)` - Create a single isolated server
- `createTestServers(configs)` - Create multiple servers concurrently

**Options:**

- `name?: string` - Server identifier
- `version?: string` - Server version
- `tools?: Tool[]` - Custom tools to register
- `port?: number` - HTTP/SSE port (use 0 for random)

#### Client Utilities

```typescript
import { createTestClient } from '@cerebrate/test-utils';

const client = await createTestClient({
  serverConfig: {
    url: `http://localhost:${port}/sse`,
    transport: 'sse',
  },
  scopeName: 'my-scope',
});

await client.connect();

// Use client...

await client.cleanup();
```

**API:**

- `createTestClient(options)` - Create a single isolated client
- `createTestClients(configs)` - Create multiple clients concurrently

#### Test Fixtures

Pre-defined tools and helpers for common test scenarios:

```typescript
import {
  sampleTools,          // echo, calculator, fileReader
  sampleResults,        // success, error, echo, calculation
  sampleServerConfigs,  // stdio, sse config builders
  mockToolHandlers,     // Handler implementations
  waitFor,              // Wait for async conditions
  delay,                // Simple delay
} from '@cerebrate/test-utils';
```

### Integration Test Examples

Located in `tests/integration/`, examples include:

#### 1. Basic Server Test

```typescript
test("should create isolated server instance", async () => {
  const server = await createTestServer({
    name: "test-server",
    tools: [sampleTools.echo],
  });

  expect(server.server).toBeDefined();
  expect(server.registry).toBeDefined();

  await server.cleanup();
});
```

#### 2. Concurrent Servers

```typescript
test("should handle multiple servers concurrently", async () => {
  const servers = await createTestServers([
    { name: "server-1", tools: [sampleTools.echo], port: 0 },
    { name: "server-2", tools: [sampleTools.calculator], port: 0 },
  ]);

  // Each server runs independently on its own port
  expect(servers[0].port).not.toBe(servers[1].port);

  await Promise.all(servers.map(s => s.cleanup()));
});
```

#### 3. Client-Server Integration

```typescript
test("should connect client to server", async () => {
  const server = await createTestServer({
    tools: [sampleTools.echo],
    port: 0,
  });

  const client = await createTestClient({
    serverConfig: sampleServerConfigs.sse(server.port!),
  });

  await client.connect();

  // Test interactions...

  await client.cleanup();
  await server.cleanup();
});
```

### Best Practices

#### 1. Always Cleanup

Use `afterEach` to ensure cleanup even if tests fail:

```typescript
afterEach(async () => {
  await instance?.cleanup();
});
```

#### 2. Use Random Ports

Always use `port: 0` for HTTP/SSE to avoid port conflicts:

```typescript
const server = await createTestServer({ port: 0 });
```

#### 3. Isolate Tests

Create new instances for each test:

```typescript
// ❌ Bad - shared state
let sharedServer;
beforeAll(async () => {
  sharedServer = await createTestServer({});
});

// ✅ Good - isolated
test("works", async () => {
  const server = await createTestServer({});
  // ...
  await server.cleanup();
});
```

#### 4. Enable Concurrent Testing

Tests with isolated instances can run concurrently:

```typescript
test.concurrent("test 1", async () => {
  const server = await createTestServer({ port: 0 });
  // ...
});

test.concurrent("test 2", async () => {
  const server = await createTestServer({ port: 0 });
  // ...
});
```

## Type Checking

All packages include TypeScript type checking via the `type-check` script.

### Package-Level Type Checking

Each package in `packages/` has:

```json
{
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

Run type checking for a specific package:

```bash
cd packages/core
bun run type-check
```

### Monorepo-Wide Type Checking

Type check all packages at once using Turbo:

```bash
bun run type-check
```

This runs `tsc --noEmit` in all packages concurrently.

### Type Check Configuration

Type checking is configured in `turbo.json`:

```json
{
  "tasks": {
    "type-check": {
      "inputs": ["src/**/*", "package.json", "tsconfig.json"],
      "outputs": []
    }
  }
}
```

### CI Type Checking

In CI, type checking runs as part of the build pipeline:

```bash
turbo run type-check
```

## Running Tests

### All Tests

Run all tests across all packages:

```bash
bun test
```

### With Coverage

```bash
bun test --coverage
```

### Specific Package

```bash
bun test --filter=@cerebrate/core
```

### Integration Tests Only

```bash
bun test tests/integration
```

### Watch Mode

```bash
bun test --watch
```

### CI Mode

```bash
bun run test:ci
# or
turbo run test
```

## CI/CD

### GitHub Actions Workflow

Recommended workflow for CI:

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.22

      - name: Install dependencies
        run: bun install

      - name: Type check
        run: bun run type-check

      - name: Lint
        run: bun run lint

      - name: Test
        run: bun run test:ci

      - name: Integration tests
        run: bun test tests/integration
```

### Turbo Cache

Turbo caches test and type-check results for faster CI:

- Type checking: Cached based on source files and configs
- Tests: Cached based on source files and configs
- Lint: Cached based on source files

Remote caching can be configured for even faster CI runs.

## Package Structure

```
cerebrate/
├── packages/
│   ├── cli/              # CLI implementation
│   ├── client/           # MCP client
│   ├── config/           # Shared configs
│   ├── core/             # Core protocol & registry
│   ├── server/           # MCP server
│   ├── test-utils/       # Test utilities (NEW)
│   └── tui/              # Terminal UI
├── tests/
│   └── integration/      # Integration tests (NEW)
├── package.json          # Root package (workspaces)
├── turbo.json            # Turbo configuration
└── TESTING.md            # This file
```

## Troubleshooting

### Port Conflicts

If you see port conflicts, ensure you're using `port: 0` for random ports:

```typescript
const server = await createTestServer({ port: 0 });
```

### Type Check Failures

If type checking fails:

1. Ensure dependencies are installed: `bun install`
2. Check TypeScript version: `bun --version`
3. Clear caches: `rm -rf .turbo node_modules`
4. Reinstall: `bun install`

### Test Timeouts

Increase timeout for slow operations:

```typescript
await waitFor(
  () => condition,
  { timeout: 10000 } // 10 seconds
);
```

### Cleanup Not Running

Always use `afterEach` for cleanup:

```typescript
let instance: TestServerInstance | null = null;

afterEach(async () => {
  if (instance) {
    await instance.cleanup();
    instance = null;
  }
});
```

## Resources

- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [Turbo Documentation](https://turbo.build/repo/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)

## Contributing

When adding new tests:

1. Use the test utilities from `@cerebrate/test-utils`
2. Ensure tests are isolated and can run concurrently
3. Always cleanup resources in `afterEach`
4. Add type checking for new packages
5. Update this document if adding new testing patterns
