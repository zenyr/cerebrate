import { ToolRegistry, type MCPServerConfig } from "@cerebrate/core/registry";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  private registry: ToolRegistry;
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig, registry: ToolRegistry) {
    this.config = config;
    this.registry = registry;
    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args || [],
      env: this.config.env,
    });
    this.client = new Client(
      {
        name: "cerebrate-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  async registerScope(scopeName: string): Promise<void> {
    const response = await this.client.listTools({});
    const tools = response.tools;

    const serverInfo = this.client.getServerVersion();
    if (!serverInfo) throw new Error("Server info not available");

    const instructions = this.client.getInstructions();

    this.registry.registerScope({
      name: scopeName,
      serverInfo,
      instructions,
      tools,
      serverConfig: this.config,
    });
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  async callTool(name: string, args: any): Promise<any> {
    return await this.client.callTool({ name, arguments: args });
  }
}
