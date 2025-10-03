import { TextAttributes } from "@opentui/core";
import { render } from "@opentui/react";
import { ToolRegistry, type MCPServerConfig } from "@cerebrate/core/registry";
import { MCPClient } from "@cerebrate/client";

async function loadConfig(): Promise<{ mcpServers?: Record<string, MCPServerConfig> }> {
  const configPath = `${process.env.HOME}/.config/cerebrate/settings.json5`;
  try {
    const config = await Bun.file(configPath).json();
    return config;
  } catch {
    return {};
  }
}

async function initializeRegistry(): Promise<ToolRegistry> {
  const registry = new ToolRegistry();
  const config = await loadConfig();
  const configs: MCPServerConfig[] = Object.entries(config.mcpServers || {}).map(
    ([name, serverConfig]) => ({
      ...serverConfig,
      name,
    })
  );

  for (const config of configs) {
    try {
      const client = new MCPClient(config, registry);
      await client.connect();
      await client.registerScope(config.name);
    } catch (error) {
      console.error(`Failed to load scope ${config.name}:`, error);
    }
  }

  return registry;
}

function App({ registry }: { registry: ToolRegistry }) {
  const activeScopes = registry.getActiveScopeNames();
  const availableScopes = registry.getAvailableScopeNames();

  return (
    <box flexDirection="column" flexGrow={1}>
      <box padding={1}>
        <text attributes={TextAttributes.BOLD}>Cerebrate TUI - MCP Server Monitor</text>
      </box>

      <box flexDirection="row" flexGrow={1}>
        <box flexDirection="column" width={30} padding={1}>
          <text attributes={TextAttributes.BOLD}>Active Scopes</text>
          {activeScopes.length === 0 ? (
            <text attributes={TextAttributes.DIM}>No active scopes</text>
          ) : (
            activeScopes.map((scope) => (
              <text key={scope}>• {scope}</text>
            ))
          )}

          <box marginTop={2} />
          <text attributes={TextAttributes.BOLD}>Available Scopes</text>
          {availableScopes.length === 0 ? (
            <text attributes={TextAttributes.DIM}>No available scopes</text>
          ) : (
            availableScopes.map((scope) => (
              <text key={scope}>• {scope}</text>
            ))
          )}
        </box>

        <box flexDirection="column" flexGrow={1} padding={1}>
          <text attributes={TextAttributes.BOLD}>Recent Tool Calls</text>
          <text attributes={TextAttributes.DIM}>Not implemented yet</text>
          {/* TODO: Display recent tool calls */}
        </box>
      </box>

      <box padding={1}>
        <text attributes={TextAttributes.DIM}>Press 'q' to quit</text>
      </box>
    </box>
  );
}

async function main() {
  const registry = await initializeRegistry();
  render(<App registry={registry} />);
}

main().catch(console.error);
