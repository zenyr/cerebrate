# MCP Integration Tests

This directory contains integration tests for the MCP (Model Context Protocol) server and client implementations.

## Overview

The integration tests use the `@cerebrate/test-utils` package to create isolated server and client instances. This approach enables:

- **Concurrent testing**: Each test gets its own isolated instances
- **Stateful verification**: Tests can verify full request/response cycles
- **CI compatibility**: Tests run independently without shared state
- **Real protocol testing**: Tests actual MCP protocol behavior, not just mocks

## Test Structure

```
tests/integration/
├── server-client.test.ts    # Server/client integration tests
└── README.md                # This file
```

## Running Tests

### Run all integration tests
```bash
bun test tests/integration
```

### Run specific test file
```bash
bun test tests/integration/server-client.test.ts
```

### Run with coverage
```bash
bun test --coverage tests/integration
```

### Run in watch mode
```bash
bun test --watch tests/integration
```

## Writing Integration Tests

### Basic Server Test

```typescript
import { createTestServer, sampleTools } from "@cerebrate/test-utils";

test("should create server with tools", async () => {
  const server = await createTestServer({
    name: "my-test-server",
    tools: [sampleTools.echo],
    port: 0, // Random port
  });

  // Test server behavior...

  await server.cleanup(); // Always cleanup!
});
```

### Concurrent Server Tests

```typescript
import { createTestServers } from "@cerebrate/test-utils";

test("should handle multiple servers", async () => {
  const servers = await createTestServers([
    { name: "server-1", tools: [sampleTools.echo], port: 0 },
    { name: "server-2", tools: [sampleTools.calculator], port: 0 },
  ]);

  // Each server is isolated and runs on its own port

  await Promise.all(servers.map(s => s.cleanup()));
});
```

### Client-Server Integration Test

```typescript
import {
  createTestServer,
  createTestClient,
  sampleTools,
  sampleServerConfigs,
} from "@cerebrate/test-utils";

test("should connect client to server", async () => {
  // Create server
  const server = await createTestServer({
    tools: [sampleTools.echo],
    port: 0,
  });

  // Create client pointing to server
  const client = await createTestClient({
    serverConfig: sampleServerConfigs.sse(server.port!),
    scopeName: "test-scope",
  });

  await client.connect();

  // Test interactions...

  await client.cleanup();
  await server.cleanup();
});
```

## Best Practices

### 1. Always Cleanup Resources

```typescript
afterEach(async () => {
  if (serverInstance) {
    await serverInstance.cleanup();
    serverInstance = null;
  }
});
```

### 2. Use Random Ports for HTTP/SSE

```typescript
const server = await createTestServer({
  port: 0, // Let the system assign a random available port
});
```

### 3. Test Isolation

Each test should create its own instances:

```typescript
// ❌ Bad - shared state
let sharedServer;
beforeAll(async () => {
  sharedServer = await createTestServer({...});
});

// ✅ Good - isolated instances
test("should work", async () => {
  const server = await createTestServer({...});
  // test...
  await server.cleanup();
});
```

### 4. Concurrent Test Safety

Tests can run concurrently because each instance is isolated:

```typescript
// These can run in parallel safely
test.concurrent("test 1", async () => {
  const server = await createTestServer({ port: 0 });
  // ...
});

test.concurrent("test 2", async () => {
  const server = await createTestServer({ port: 0 });
  // ...
});
```

## Available Test Utilities

### Server Utilities
- `createTestServer(options)` - Create single isolated server
- `createTestServers(configs)` - Create multiple servers concurrently

### Client Utilities
- `createTestClient(options)` - Create single isolated client
- `createTestClients(configs)` - Create multiple clients concurrently
- `createMockStdioServerScript(options)` - Create mock stdio server

### Fixtures
- `sampleTools` - Pre-defined test tools (echo, calculator, fileReader)
- `sampleResults` - Result builders for common responses
- `sampleServerConfigs` - Config builders for stdio/SSE transports
- `mockToolHandlers` - Handler implementations for sample tools

### Helpers
- `waitFor(condition, options)` - Wait for async condition with timeout
- `delay(ms)` - Simple delay promise

## CI Configuration

Integration tests are configured to run in CI via the `test:ci` task in `turbo.json`:

```bash
# In CI
turbo run test:ci
```

This ensures all tests run with proper isolation and cleanup.

## Debugging Tests

### Verbose Output
```bash
bun test --verbose tests/integration
```

### Single Test
```bash
bun test tests/integration/server-client.test.ts -t "should create isolated server"
```

### Inspect Server State
```typescript
test("debug server", async () => {
  const server = await createTestServer({ port: 0 });

  console.log("Server ID:", server.id);
  console.log("Server port:", server.port);
  console.log("Registry scopes:", server.registry.getAllScopesInfo());
  console.log("Exposed tools:", server.registry.getExposedTools());

  await server.cleanup();
});
```

## Common Issues

### Port Already in Use
If you see port conflicts, make sure you're using `port: 0` for random ports.

### Cleanup Failures
Always use `afterEach` to cleanup instances, even if tests fail:

```typescript
afterEach(async () => {
  await instance?.cleanup();
});
```

### Timeout Issues
Increase timeout for slow operations:

```typescript
await waitFor(
  () => server.isReady,
  { timeout: 10000 } // 10 seconds
);
```
