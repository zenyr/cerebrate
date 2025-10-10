### Integration Approach

Hono integrates with MCP (Model Context Protocol) server via SSE (Server-Sent Events) by providing a custom `SSETransport` class that implements the `Transport` interface from the official MCP TypeScript SDK. This transport bridges Hono's streaming capabilities with MCP's communication protocol, enabling bidirectional messaging over HTTP. The official SDK is designed for Express, but Hono's response handling (e.g., headers added post-response) causes issues, so this library offers a Hono-compatible alternative inspired by [a PR in the MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk/pull/178).

Hono serves as the web framework to:
- Handle SSE connections via `streamSSE` for real-time server-to-client pushes.
- Process HTTP POST requests for client-to-server messages.
- Manage multiple concurrent sessions using a session ID-based lookup.

The transport uses SSE for server-initiated messages (e.g., tool responses) and HTTP POST for client-initiated messages (e.g., tool calls), ensuring compatibility with MCP's JSON-RPC protocol.

### Key Code Snippets

#### SSETransport Class (src/sse.ts)
```typescript
export class SSETransport implements Transport {
  private _sessionId: string;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(private messageUrl: string, private stream: SSEStreamingApi) {
    this._sessionId = crypto.randomUUID();
    this.stream.onAbort(() => void this.close());
  }

  get sessionId(): string { return this._sessionId; }

  async start(): Promise<void> {
    await this.stream.writeSSE({ event: 'ping', data: '' });
    await this.stream.writeSSE({ event: 'endpoint', data: `${this.messageUrl}?sessionId=${this.sessionId}` });
  }

  async handlePostMessage(context: Context): Promise<Response> {
    // Validates content-type, size, parses JSON, calls onmessage
    const body = await context.req.json() as unknown;
    await this.handleMessage(body);
    return context.text('Accepted', 202);
  }

  async send(message: JSONRPCMessage): Promise<void> {
    await this.stream.writeSSE({ event: 'message', data: JSON.stringify(message) });
  }

  // Additional methods for message handling, closing, etc.
}
```

- **start()**: Initiates SSE by sending a 'ping' (keep-alive) and 'endpoint' event with the POST URL including sessionId.
- **handlePostMessage()**: Processes incoming POST requests, validates JSON-RPC messages, and triggers `onmessage`.
- **send()**: Pushes messages to the client via SSE 'message' events.

#### Usage Example (from README.md)
```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { SSETransport } from 'hono-mcp-server-sse-transport';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const mcpServer = new McpServer({ name: 'your-mcp-server-name', version: '1.0.0' }, { capabilities: { tools: {} } });
// Add tools...

const app = new Hono();
const transports: { [sessionId: string]: SSETransport } = {};

app.get('/sse', (c) => {
  return streamSSE(c, async (stream) => {
    const transport = new SSETransport('/messages', stream);
    transports[transport.sessionId] = transport;
    stream.onAbort(() => delete transports[transport.sessionId]);
    await mcpServer.connect(transport);
    while (true) await stream.sleep(60000); // Keep-alive
  });
});

app.post('/messages', async (c) => {
  const sessionId = c.req.query('sessionId');
  const transport = transports[sessionId];
  if (!transport) return c.text('No transport found for sessionId', 400);
  return await transport.handlePostMessage(c);
});

serve({ fetch: app.fetch, port: 3000 });
```

- **GET /sse**: Establishes SSE connection, creates transport, connects MCP server, and maintains session.
- **POST /messages**: Routes client messages to the appropriate transport based on sessionId.

### Setup Instructions

1. **Installation**: `pnpm add -D hono-mcp-server-sse-transport` (or npm/yarn equivalent).
2. **Dependencies**: Requires Hono, `@hono/node-server`, `@modelcontextprotocol/sdk`, and `hono/streaming`.
3. **Configuration**:
   - Create an MCP server instance with tools/capabilities.
   - Set up Hono app with `/sse` (SSE endpoint) and `/messages` (POST endpoint).
   - Use a transports map for session management (supports multiple clients).
4. **Running**: Use `@hono/node-server`'s `serve` to start the server (e.g., on port 3000).
5. **Environment**: Ensure Node.js runtime for crypto.randomUUID() and Hono's Node adapter.

### Relevant Documentation/README Content

- **Overview**: Addresses incompatibility with official MCP SDK for Hono; provides SSE-based transport until official support.
- **Limitations**: Workaround for Hono's response handling; inspired by MCP SDK PR #178.
- **License**: MIT.
- **Changelog**: Tracks versions (latest v0.0.7 as of May 22, 2025); includes bug fixes and improvements.
- **No Issues/PRs**: Repository has 0 open issues/PRs, indicating stability for basic use.

This setup enables MCP servers to run on Hono with SSE for efficient, real-time communication, handling JSON-RPC messages bidirectionally.

### Direct Implementation Using fetch-to-node's toReqRes and toFetchResponse

This guide provides a detailed implementation of a custom `SSETransport` class that integrates Hono with an MCP (Model Context Protocol) server using Server-Sent Events (SSE) transport. Unlike the existing `hono-mcp-server-sse-transport` module, this approach avoids Hono-specific streaming APIs and instead leverages `fetch-to-node`'s `toReqRes` and `toFetchResponse` methods to bridge Hono's request/response handling with Node.js HTTP APIs. This allows the transport to work with standard Node.js `ServerResponse` objects for SSE streaming.

#### Prerequisites
- Hono (for web framework)
- `@modelcontextprotocol/sdk` (for MCP server and types)
- `fetch-to-node` (for bridging Hono to Node.js HTTP)
- Node.js runtime (for `crypto.randomUUID` and HTTP handling)

#### Understanding the Transport Interface
The MCP SDK defines a `Transport` interface that handles bidirectional JSON-RPC messaging. Key methods include:
- `start()`: Initializes the transport (e.g., sends SSE headers and initial events).
- `send(message)`: Sends JSON-RPC messages (e.g., server responses via SSE).
- `close()`: Closes the connection.
- Callbacks: `onclose`, `onerror`, `onmessage` for handling connection lifecycle and incoming messages.
- `sessionId`: Unique identifier for the session.

The custom `SSETransport` implements this interface using Node.js `ServerResponse` for SSE, bridged via `fetch-to-node`.

#### Custom SSETransport Implementation
Here's the custom `SSETransport` class. It uses `ServerResponse` (obtained via `toReqRes`) to handle SSE streaming, avoiding Hono's `streamSSE` API.

```typescript
import { Transport, JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/shared/transport.js";
import { IncomingMessage, ServerResponse } from "http";

export class SSETransport implements Transport {
  private _sessionId: string;
  private res: ServerResponse;
  private messageUrl: string;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;

  constructor(messageUrl: string, res: ServerResponse) {
    this._sessionId = crypto.randomUUID();
    this.messageUrl = messageUrl;
    this.res = res;

    // Handle response end/close
    res.on('close', () => this.close());
    res.on('finish', () => this.close());
  }

  get sessionId(): string {
    return this._sessionId;
  }

  async start(): Promise<void> {
    // Set SSE headers
    this.res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial ping and endpoint
    await this.writeSSE({ event: 'ping', data: '' });
    await this.writeSSE({
      event: 'endpoint',
      data: `${this.messageUrl}?sessionId=${this.sessionId}`,
    });
  }

  private async writeSSE({ event, data }: { event: string; data: string }): Promise<void> {
    this.res.write(`event: ${event}\n`);
    this.res.write(`data: ${data}\n\n`);
  }

  async send(message: JSONRPCMessage): Promise<void> {
    await this.writeSSE({ event: 'message', data: JSON.stringify(message) });
  }

  async handlePostMessage(req: IncomingMessage): Promise<void> {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const message = JSON.parse(body) as JSONRPCMessage;
        await this.handleMessage(message);
      } catch (error) {
        this.onerror?.(error as Error);
      }
    });
  }

  private async handleMessage(message: JSONRPCMessage): Promise<void> {
    this.onmessage?.(message);
  }

  async close(): Promise<void> {
    if (!this.res.headersSent) {
      this.res.writeHead(200);
    }
    this.res.end();
    this.onclose?.();
  }
}
```

**Key Implementation Notes**:
- **Constructor**: Takes `messageUrl` (for POST endpoint) and `ServerResponse` (from `toReqRes`). Generates a unique `sessionId`.
- **start()**: Sets SSE headers and sends initial `ping` and `endpoint` events to establish the stream.
- **send()**: Serializes JSON-RPC messages as SSE `message` events.
- **handlePostMessage()**: Processes incoming POST requests by parsing JSON and triggering `onmessage`.
- **writeSSE()**: Helper to write SSE-formatted data to the response stream.
- **close()**: Ends the response and calls `onclose`.

#### Setting Up Routes in Hono
Use Hono to define SSE and POST routes. The custom transport is instantiated per connection, and `fetch-to-node` bridges Hono's context to Node.js APIs.

```typescript
import { Hono } from 'hono';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSETransport } from './SSETransport'; // Your custom class
import { toReqRes, toFetchResponse } from 'fetch-to-node';

const app = new Hono();
const transports = new Map<string, SSETransport>();

// MCP Server setup
const mcpServer = new Server(
  { name: 'example-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);
// Add tools, handlers, etc.

// SSE Route: Establishes SSE connection
app.get('/sse', async (c) => {
  const { req, res } = toReqRes(c.req.raw); // Bridge Hono to Node.js
  const transport = new SSETransport('/messages', res);
  transports.set(transport.sessionId, transport);

  // Clean up on close
  res.on('close', () => transports.delete(transport.sessionId));

  await mcpServer.connect(transport);
  return toFetchResponse(res); // Convert back to Hono Response
});

// POST Route: Handles client messages
app.post('/messages', async (c) => {
  const sessionId = c.req.query('sessionId');
  const transport = transports.get(sessionId);
  if (!transport) {
    return c.text('Invalid session', 400);
  }

  const { req } = toReqRes(c.req.raw);
  await transport.handlePostMessage(req);
  return c.text('Accepted', 202);
});

// Start server (e.g., with Bun or Node.js adapter)
```

**Route Explanations**:
- **GET /sse**: Converts Hono's request to Node.js `IncomingMessage`/`ServerResponse` via `toReqRes`. Creates and connects the transport. Returns the response via `toFetchResponse`.
- **POST /messages**: Retrieves the transport by `sessionId`, converts the request, and delegates to `handlePostMessage`.

#### Usage of toReqRes and toFetchResponse
- **`toReqRes(c.req.raw)`**: Converts Hono's `Request` object to Node.js `IncomingMessage` and `ServerResponse`. This bridges Hono's async/Response-based API to Node.js's stream-based HTTP handling. `req` is used for reading POST bodies, `res` for writing SSE data.
- **`toFetchResponse(res)`**: Converts the Node.js `ServerResponse` back to a Hono-compatible `Response`. This allows the streaming SSE response to be returned from the Hono route handler.

These methods enable the custom transport to use Node.js HTTP primitives while integrating seamlessly with Hono's routing.

#### Connecting to MCP Server
In the SSE route, after creating the transport:
```typescript
await mcpServer.connect(transport);
```
This attaches the transport to the MCP server, enabling message handling. The server will call `transport.send()` for outgoing messages and listen for `transport.onmessage` for incoming ones.

#### Setup Instructions
1. **Install Dependencies**:
   ```
   npm install hono @modelcontextprotocol/sdk fetch-to-node
   ```

2. **Implement SSETransport**: Save the class in a file (e.g., `SSETransport.ts`).

3. **Configure Hono App**: Set up routes as shown. Ensure MCP server is initialized with tools/capabilities.

4. **Run the Server**:
   - Use a Node.js adapter like `@hono/node-server`:
     ```typescript
     import { serve } from '@hono/node-server';
     serve({ fetch: app.fetch, port: 3000 });
     ```
   - Or with Bun: `Bun.serve({ fetch: app.fetch, port: 3000 });`

5. **Test**: Connect an MCP client to `http://localhost:3000/sse`. Client messages go to `POST /messages?sessionId=<id>`.

#### Comparison with hono-mcp-server-sse-transport Module
- **Existing Module Approach**:
  - Uses Hono's `streamSSE` API directly for streaming.
  - Transport class (`SSETransport`) wraps `SSEStreamingApi` (Hono-specific).
  - No need for `fetch-to-node`; operates within Hono's ecosystem.
  - Pros: Simpler, no Node.js bridging, better Hono integration.
  - Cons: Tied to Hono's streaming API; less flexible for non-Hono environments.

- **Custom Implementation (This Guide)**:
  - Uses Node.js `ServerResponse` for SSE, bridged via `fetch-to-node`.
  - Transport class works with standard Node.js HTTP APIs.
  - Pros: More portable (can adapt to other frameworks), explicit control over HTTP handling, aligns with official MCP SDK patterns.
  - Cons: Requires `fetch-to-node` for bridging, slightly more complex setup due to API conversion.
  - Differences: The existing module avoids Node.js APIs entirely, while this uses `toReqRes`/`toFetchResponse` for compatibility. The custom version is inspired by the official `SSEServerTransport` but customized for Hono without external dependencies beyond `fetch-to-node`.

This custom approach provides a lightweight, framework-agnostic SSE transport while maintaining Hono compatibility through `fetch-to-node`. For production, consider error handling, authentication, and session management.