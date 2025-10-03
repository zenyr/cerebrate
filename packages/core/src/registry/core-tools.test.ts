import { describe, expect, test } from 'bun:test';
import { ENABLE_TOOLS, LIST_AVAILABLE_SCOPES, EXECUTE_TOOL, CORE_TOOLS } from './core-tools';

describe('core-tools', () => {
  describe('ENABLE_TOOLS', () => {
    test('should have correct name', () => {
      expect(ENABLE_TOOLS.name).toBe('enableTools');
    });

    test('should have description', () => {
      expect(ENABLE_TOOLS.description).toContain('Activate MCP server scope');
      expect(ENABLE_TOOLS.description).toContain('{scope}/{tool}');
    });

    test('should have proper input schema', () => {
      expect(ENABLE_TOOLS.inputSchema.type).toBe('object');
      expect(ENABLE_TOOLS.inputSchema.properties).toBeDefined();
      const properties = ENABLE_TOOLS.inputSchema.properties as Record<string, { type: string; description?: string }>;
      expect(properties.scope).toBeDefined();
      expect(properties.scope?.type).toBe('string');
      expect(ENABLE_TOOLS.inputSchema.required).toEqual(['scope']);
    });

    test('should have scope parameter description', () => {
      const properties = ENABLE_TOOLS.inputSchema.properties as Record<string, { type: string; description?: string }>;
      expect(properties.scope?.description).toContain('MCP server namespace');
    });
  });

  describe('LIST_AVAILABLE_SCOPES', () => {
    test('should have correct name', () => {
      expect(LIST_AVAILABLE_SCOPES.name).toBe('listAvailableScopes');
    });

    test('should have description', () => {
      expect(LIST_AVAILABLE_SCOPES.description).toContain('List all available MCP server scopes');
      expect(LIST_AVAILABLE_SCOPES.description).toContain('tools');
    });

    test('should have proper input schema with no parameters', () => {
      expect(LIST_AVAILABLE_SCOPES.inputSchema.type).toBe('object');
      expect(LIST_AVAILABLE_SCOPES.inputSchema.properties).toBeDefined();
      expect(Object.keys(LIST_AVAILABLE_SCOPES.inputSchema.properties ?? {})).toHaveLength(0);
    });

    test('should not have required parameters', () => {
      expect(LIST_AVAILABLE_SCOPES.inputSchema.required).toBeUndefined();
    });
  });

  describe('CORE_TOOLS', () => {
    test('should contain all core tools', () => {
      expect(CORE_TOOLS).toHaveLength(3);
      expect(CORE_TOOLS).toContain(ENABLE_TOOLS);
      expect(CORE_TOOLS).toContain(LIST_AVAILABLE_SCOPES);
      expect(CORE_TOOLS).toContain(EXECUTE_TOOL);
    });

    test('should export tools in correct order', () => {
      expect(CORE_TOOLS[0]).toBe(ENABLE_TOOLS);
      expect(CORE_TOOLS[1]).toBe(LIST_AVAILABLE_SCOPES);
    });

    test('all tools should have valid Tool structure', () => {
      CORE_TOOLS.forEach((tool) => {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      });
    });
  });
});
