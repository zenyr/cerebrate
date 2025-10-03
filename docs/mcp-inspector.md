### MCP Inspector Quick Reference

**Overview**: Developer tool for testing/debugging MCP (Model Context Protocol) servers. Supports GUI (web UI) and CLI modes. Connects via stdio, SSE, or streamable HTTP.

#### Installation
- Via bunx (no permanent install): `bunx --bun @modelcontextprotocol/inspector`
- Requirements: Bun (compatible with Node.js >=22.7.5)

#### Basic Usage
- **GUI Mode** (default): `bunx --bun @modelcontextprotocol/inspector node build/index.js` → Opens browser at http://localhost:6274
- **CLI Mode**: Add `--cli` flag: `bunx --bun @modelcontextprotocol/inspector --cli node build/index.js`
- **With Config File**: `bunx --bun @modelcontextprotocol/inspector --config path/to/mcp.json --server serverName`
- **Remote Server**: `bunx --bun @modelcontextprotocol/inspector --cli https://my-server.com` (auto-detects transport)
- **Environment Vars**: `-e KEY=value`
- **Ports**: CLIENT_PORT=8080 SERVER_PORT=9000 (default 6274/6277)

#### API Methods (CLI)
- `tools/list`: List available tools
- `tools/call`: Call a tool (use --tool-name and --tool-arg)
- `resources/list`: List resources
- `resources/read`: Read a resource (use --uri)
- `prompts/list`: List prompts
- `prompts/get`: Get a prompt (use --name and --arg)
- `logging/list`: Show logs/notifications

#### CLI Commands
- List tools: `--method tools/list`
- Call tool: `--method tools/call --tool-name <name> --tool-arg key=value [--tool-arg key2=value2]`
- List resources: `--method resources/list`
- List prompts: `--method prompts/list`
- Remote with headers: `--header "X-API-Key: token"`

#### Examples
- **Inspect Local Server (GUI)**: `bunx --bun @modelcontextprotocol/inspector node dist/index.js`
- **List Tools (CLI)**: `bunx --bun @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list`
- **Call Tool (CLI)**: `bunx --bun @modelcontextprotocol/inspector --cli node dist/index.js --method tools/call --tool-name search --tool-arg query="AI news"`
- **Remote SSE Server**: `bunx --bun @modelcontextprotocol/inspector --cli https://example.com/sse --method tools/list`
- **With Config**: `bunx --bun @modelcontextprotocol/inspector --cli --config mcp.json --server my-server --method resources/list`

#### GUI Features
- Tabs: Resources, Prompts, Tools, Notifications
- Export configs (mcp.json) for reuse
- Authentication: Bearer token for SSE
- Security: Localhost binding by default; use HOST=0.0.0.0 for network access (caution)

#### Process Management and Hanging
- **GUI Mode Process Hanging**: GUI mode starts a web server that keeps the server process running indefinitely. Use `timeout` to prevent hangs during testing: `timeout 30 bunx --bun @modelcontextprotocol/inspector node dist/index.js`
- **Timeout Usage for CLI Control**: For CLI operations, use `timeout` to avoid indefinite waits: `timeout 10 bunx --bun @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list`
- **Preventing Hangs in Testing**: Always wrap inspector commands in `timeout` for automated tests or CI to prevent processes from hanging: `timeout 60 bunx --bun @modelcontextprotocol/inspector --cli https://example.com/sse --method tools/list`

#### Cerebrate Project Scenarios
- **CLI-Only Access**: For cerebrate server testing without GUI: `bunx --bun @modelcontextprotocol/inspector --cli node packages/server/dist/index.js --method tools/list`
- **Process Management in Development**: Use timeout for quick checks: `timeout 15 bunx --bun @modelcontextprotocol/inspector --cli --config example-config.json --server cerebrate-server --method resources/list`
- **Debugging Server Hangs**: Test with timeout to identify hanging endpoints: `timeout 30 bunx --bun @modelcontextprotocol/inspector --cli node packages/server/dist/index.js --method tools/call --tool-name list-files --tool-arg path="."`

#### Notes
- Auto-opens browser in GUI mode with auth token
- Supports Docker: `docker run --rm --network host -p 6274:6274 -p 6277:6277 ghcr.io/modelcontextprotocol/inspector:latest`
- Docs: https://modelcontextprotocol.io/docs/tools/inspector
- Repo: https://github.com/modelcontextprotocol/inspector