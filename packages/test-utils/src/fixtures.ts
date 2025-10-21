import type { Tool, CallToolResult } from "@cerebrate/core/protocol/types";

/**
 * Common test fixtures for MCP testing
 */

/**
 * Sample tools for testing
 */
export const sampleTools = {
  /**
   * A simple echo tool that returns its input
   */
  echo: {
    name: "echo",
    description: "Echoes back the input message",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to echo back",
        },
      },
      required: ["message"],
    },
  } satisfies Tool,

  /**
   * A calculator tool for basic arithmetic
   */
  calculator: {
    name: "calculator",
    description: "Performs basic arithmetic operations",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
          description: "The operation to perform",
        },
        a: {
          type: "number",
          description: "First operand",
        },
        b: {
          type: "number",
          description: "Second operand",
        },
      },
      required: ["operation", "a", "b"],
    },
  } satisfies Tool,

  /**
   * A file reader tool (mock)
   */
  fileReader: {
    name: "read_file",
    description: "Reads a file from the filesystem",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to read",
        },
      },
      required: ["path"],
    },
  } satisfies Tool,
};

/**
 * Sample tool call results
 */
export const sampleResults = {
  /**
   * Successful text result
   */
  success: (text: string): CallToolResult => ({
    content: [
      {
        type: "text",
        text,
      },
    ],
  }),

  /**
   * Error result
   */
  error: (message: string): CallToolResult => ({
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    isError: true,
  }),

  /**
   * Echo result
   */
  echo: (message: string): CallToolResult => ({
    content: [
      {
        type: "text",
        text: `Echo: ${message}`,
      },
    ],
  }),

  /**
   * Calculator result
   */
  calculation: (result: number): CallToolResult => ({
    content: [
      {
        type: "text",
        text: `Result: ${result}`,
      },
    ],
  }),
};

/**
 * Sample server configurations for testing
 */
export const sampleServerConfigs = {
  /**
   * Stdio server configuration
   */
  stdio: (command: string, args: string[] = []) => ({
    command,
    args,
    transport: "stdio" as const,
  }),

  /**
   * HTTP/SSE server configuration
   */
  sse: (port: number, authCode?: string) => ({
    url: `http://localhost:${port}/sse`,
    transport: "sse" as const,
    ...(authCode && { authCode }),
  }),
};

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<void> {
  const {
    timeout = 5000,
    interval = 100,
    timeoutMessage = "Timeout waiting for condition",
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(timeoutMessage);
}

/**
 * Create a delay promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock tool implementation helpers
 */
export const mockToolHandlers = {
  /**
   * Echo handler
   */
  echo: async (args: { message: string }) => {
    return sampleResults.echo(args.message);
  },

  /**
   * Calculator handler
   */
  calculator: async (args: {
    operation: "add" | "subtract" | "multiply" | "divide";
    a: number;
    b: number;
  }) => {
    let result: number;
    switch (args.operation) {
      case "add":
        result = args.a + args.b;
        break;
      case "subtract":
        result = args.a - args.b;
        break;
      case "multiply":
        result = args.a * args.b;
        break;
      case "divide":
        if (args.b === 0) {
          return sampleResults.error("Division by zero");
        }
        result = args.a / args.b;
        break;
    }
    return sampleResults.calculation(result);
  },
};
