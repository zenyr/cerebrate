# Cerebrate

Cerebrate is a Man-in-the-Middle (MITM) MCP server designed to intelligently expose MCP functionalities from multiple downstream servers, optimizing token usage for AI client applications.

## Overview

Cerebrate acts as both an MCP client and server, intercepting and selectively exposing tools and resources from other MCP servers. This approach reduces unnecessary token consumption by providing only relevant functionalities to connected clients.

## Key Features

- **MITM Architecture**: Positions itself between AI client apps and MCP servers.
- **Selective Exposure**: Dynamically enables tools based on client requests.
- **Security**: Requires authentication codes stored in an encrypted SQLite database.
- **Port Configuration**: Defaults to 3878, configurable via `PORT` environment variable or arguments.

## Architecture

```
(AI Client App) --(MCP Protocol)--> (Cerebrate MCP Server)
     --> (Cerebrate MCP Clients) --(MCP Protocol)--> (Other MCP Servers)
```

## Installation

To install dependencies:

```bash
bun install
```

## Usage

1. Start Cerebrate as a local MCP server.
2. It pre-connects to registered MCP servers to gather capabilities.
3. Connect your AI client app using the required authentication code.
4. Request tool activations and executions as needed.

To run the project:

```bash
bun run [entry-point]
```

## Default Port

http://localhost:3878

## Future Ideas

- Implement API call reverse proxy endpoints to extract magic words and append relevant tools.
