import { TextAttributes } from "@opentui/core";
import { render } from "@opentui/react";

function App() {
  // Placeholder for active scopes - in real implementation, this would be fetched from the server
  const activeScopes = ["filesystem", "github"]; // Example data

  return (
    <box flexDirection="column" padding={2}>
      <text attributes={TextAttributes.BOLD}>Cerebrate MCP Server Monitor</text>
      <text>Active Scopes:</text>
      {activeScopes.length > 0 ? (
        activeScopes.map((scope) => (
          <box key={scope} paddingLeft={2}>
            <text>• {scope}</text>
          </box>
        ))
      ) : (
        <box paddingLeft={2}>
          <text attributes={TextAttributes.DIM}>No active scopes</text>
        </box>
      )}
    </box>
  );
}

render(<App />);
