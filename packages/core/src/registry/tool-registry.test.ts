import { describe, expect, test, beforeEach } from 'bun:test';
import { ToolRegistry } from './tool-registry';
import type { ScopeInfo } from './tool-registry';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockScope: ScopeInfo;
  let mockScope2: ScopeInfo;

  beforeEach(() => {
    registry = new ToolRegistry();
    
    mockScope = {
      name: 'filesystem',
      serverInfo: {
        name: 'filesystem-server',
        version: '1.0.0',
      },
      instructions: 'Use filesystem tools to read/write files',
      tools: [
        {
          name: 'read_file',
          description: 'Read file contents',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
            },
            required: ['path'],
          },
        },
        {
          name: 'write_file',
          description: 'Write file contents',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['path', 'content'],
          },
        },
      ],
      serverConfig: {
        name: 'filesystem',
        command: 'node',
        args: ['./filesystem-server.js'],
      },
    };

    mockScope2 = {
      name: 'github',
      serverInfo: {
        name: 'github-server',
        version: '2.0.0',
      },
      tools: [
        {
          name: 'create_issue',
          description: 'Create GitHub issue',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['title'],
          },
        },
      ],
      serverConfig: {
        name: 'github',
        command: 'bun',
        args: ['./github-server.ts'],
      },
    };
  });

  describe('registerScope', () => {
    test('should register a scope', () => {
      registry.registerScope(mockScope);
      expect(registry.getAvailableScopeNames()).toEqual(['filesystem']);
    });

    test('should register multiple scopes', () => {
      registry.registerScope(mockScope);
      registry.registerScope(mockScope2);
      expect(registry.getAvailableScopeNames()).toEqual(['filesystem', 'github']);
    });

    test('should overwrite existing scope with same name', () => {
      registry.registerScope(mockScope);
      const updatedScope = { ...mockScope, serverInfo: { name: 'updated', version: '2.0.0' } };
      registry.registerScope(updatedScope);
      expect(registry.getScopeInfo('filesystem')?.serverInfo.name).toBe('updated');
    });
  });

  describe('activateScope', () => {
    test('should activate registered scope', () => {
      registry.registerScope(mockScope);
      const result = registry.activateScope('filesystem');
      expect(result).toBe(true);
      expect(registry.getActiveScopeNames()).toEqual(['filesystem']);
    });

    test('should return false for unregistered scope', () => {
      const result = registry.activateScope('nonexistent');
      expect(result).toBe(false);
      expect(registry.getActiveScopeNames()).toEqual([]);
    });

    test('should allow activating same scope multiple times', () => {
      registry.registerScope(mockScope);
      registry.activateScope('filesystem');
      registry.activateScope('filesystem');
      expect(registry.getActiveScopeNames()).toEqual(['filesystem']);
    });

    test('should activate multiple scopes', () => {
      registry.registerScope(mockScope);
      registry.registerScope(mockScope2);
      registry.activateScope('filesystem');
      registry.activateScope('github');
      expect(registry.getActiveScopeNames()).toContain('filesystem');
      expect(registry.getActiveScopeNames()).toContain('github');
    });
  });

  describe('deactivateScope', () => {
    test('should deactivate active scope', () => {
      registry.registerScope(mockScope);
      registry.activateScope('filesystem');
      registry.deactivateScope('filesystem');
      expect(registry.getActiveScopeNames()).toEqual([]);
    });

    test('should safely handle deactivating non-active scope', () => {
      registry.registerScope(mockScope);
      registry.deactivateScope('filesystem');
      expect(registry.getActiveScopeNames()).toEqual([]);
    });

    test('should deactivate only specified scope', () => {
      registry.registerScope(mockScope);
      registry.registerScope(mockScope2);
      registry.activateScope('filesystem');
      registry.activateScope('github');
      registry.deactivateScope('filesystem');
      expect(registry.getActiveScopeNames()).toEqual(['github']);
    });
  });

  describe('getActiveScopeNames', () => {
    test('should return empty array when no scopes active', () => {
      expect(registry.getActiveScopeNames()).toEqual([]);
    });

    test('should return array of active scope names', () => {
      registry.registerScope(mockScope);
      registry.registerScope(mockScope2);
      registry.activateScope('filesystem');
      registry.activateScope('github');
      const names = registry.getActiveScopeNames();
      expect(names).toContain('filesystem');
      expect(names).toContain('github');
      expect(names.length).toBe(2);
    });
  });

  describe('getAvailableScopeNames', () => {
    test('should return empty array when no scopes registered', () => {
      expect(registry.getAvailableScopeNames()).toEqual([]);
    });

    test('should return array of registered scope names', () => {
      registry.registerScope(mockScope);
      registry.registerScope(mockScope2);
      expect(registry.getAvailableScopeNames()).toEqual(['filesystem', 'github']);
    });
  });

  describe('getExposedTools', () => {
    test('should return empty array when no scopes active', () => {
      registry.registerScope(mockScope);
      expect(registry.getExposedTools()).toEqual([]);
    });

    test('should return namespaced tools for active scope', () => {
      registry.registerScope(mockScope);
      registry.activateScope('filesystem');
      const tools = registry.getExposedTools();
      expect(tools.length).toBe(2);
      expect(tools[0]?.name).toBe('filesystem/read_file');
      expect(tools[1]?.name).toBe('filesystem/write_file');
    });

    test('should return tools from multiple active scopes', () => {
      registry.registerScope(mockScope);
      registry.registerScope(mockScope2);
      registry.activateScope('filesystem');
      registry.activateScope('github');
      const tools = registry.getExposedTools();
      expect(tools.length).toBe(3);
      expect(tools.map(t => t.name)).toContain('filesystem/read_file');
      expect(tools.map(t => t.name)).toContain('filesystem/write_file');
      expect(tools.map(t => t.name)).toContain('github/create_issue');
    });

    test('should preserve tool properties except name', () => {
      registry.registerScope(mockScope);
      registry.activateScope('filesystem');
      const tools = registry.getExposedTools();
      const readFileTool = tools.find(t => t.name === 'filesystem/read_file');
      expect(readFileTool?.description).toBe('Read file contents');
      expect(readFileTool?.inputSchema).toEqual({
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      });
    });
  });

  describe('getScopeByToolName', () => {
    test('should return scope info for valid namespaced tool', () => {
      registry.registerScope(mockScope);
      const scope = registry.getScopeByToolName('filesystem/read_file');
      expect(scope).toBeDefined();
      expect(scope?.name).toBe('filesystem');
    });

    test('should return undefined for unregistered scope', () => {
      const scope = registry.getScopeByToolName('nonexistent/tool');
      expect(scope).toBeUndefined();
    });

    test('should return undefined for invalid tool name format', () => {
      registry.registerScope(mockScope);
      // @ts-expect-error: testing invalid format
      const scope = registry.getScopeByToolName('invalidname');
      expect(scope).toBeUndefined();
    });

    test('should extract scope from multi-slash tool name', () => {
      registry.registerScope(mockScope);
      const scope = registry.getScopeByToolName('filesystem/nested/read_file');
      expect(scope?.name).toBe('filesystem');
    });
  });

  describe('getScopeInfo', () => {
    test('should return full scope info for registered scope', () => {
      registry.registerScope(mockScope);
      const info = registry.getScopeInfo('filesystem');
      expect(info).toBeDefined();
      expect(info?.name).toBe('filesystem');
      expect(info?.serverInfo.name).toBe('filesystem-server');
      expect(info?.tools.length).toBe(2);
    });

    test('should return undefined for unregistered scope', () => {
      const info = registry.getScopeInfo('nonexistent');
      expect(info).toBeUndefined();
    });
  });

  describe('getToolUsageGuide', () => {
    test('should return usage guide for registered scope', () => {
      registry.registerScope(mockScope);
      const guide = registry.getToolUsageGuide('filesystem');
      expect(guide).toContain('Scope "filesystem" activated');
      expect(guide).toContain('filesystem-server v1.0.0');
      expect(guide).toContain('Use filesystem tools to read/write files');
      expect(guide).toContain('filesystem/read_file: Read file contents');
      expect(guide).toContain('filesystem/write_file: Write file contents');
      expect(guide).toContain('Call format: {scope}/{toolName}');
    });

    test('should return undefined for unregistered scope', () => {
      const guide = registry.getToolUsageGuide('nonexistent');
      expect(guide).toBeUndefined();
    });

    test('should handle scope without instructions', () => {
      registry.registerScope(mockScope2);
      const guide = registry.getToolUsageGuide('github');
      expect(guide).toContain('Scope "github" activated');
      expect(guide).not.toContain('undefined');
    });

    test('should handle tool without description', () => {
      const scopeWithoutDesc: ScopeInfo = {
        ...mockScope,
        tools: [
          {
            name: 'test_tool',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      };
      registry.registerScope(scopeWithoutDesc);
      const guide = registry.getToolUsageGuide('filesystem');
      expect(guide).toContain('filesystem/test_tool: No description');
    });
  });

  describe('getScopeToolsInfo', () => {
    test('should return tools info for registered scope', () => {
      registry.registerScope(mockScope);
      const info = registry.getScopeToolsInfo('filesystem');
      expect(info).toBeDefined();
      expect(info?.scope).toBe('filesystem');
      expect(info?.tools.length).toBe(2);
      expect(info?.tools[0]?.name).toBe('read_file');
      expect(info?.tools[0]?.description).toBe('Read file contents');
    });

    test('should return undefined for unregistered scope', () => {
      const info = registry.getScopeToolsInfo('nonexistent');
      expect(info).toBeUndefined();
    });

    test('should handle empty description', () => {
      const scopeNoDesc: ScopeInfo = {
        ...mockScope,
        tools: [
          {
            name: 'test',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      };
      registry.registerScope(scopeNoDesc);
      const info = registry.getScopeToolsInfo('filesystem');
      expect(info?.tools[0]?.description).toBe('');
    });
  });

  describe('getAllScopesInfo', () => {
    test('should return empty array when no scopes registered', () => {
      const info = registry.getAllScopesInfo();
      expect(info).toEqual([]);
    });

    test('should return info for all registered scopes', () => {
      registry.registerScope(mockScope);
      registry.registerScope(mockScope2);
      const info = registry.getAllScopesInfo();
      expect(info.length).toBe(2);
      expect(info[0]?.scope).toBe('filesystem');
      expect(info[1]?.scope).toBe('github');
    });

    test('should include server info and tools', () => {
      registry.registerScope(mockScope);
      const info = registry.getAllScopesInfo();
      expect(info[0]?.serverInfo).toEqual({
        name: 'filesystem-server',
        version: '1.0.0',
      });
      expect(info[0]?.tools.length).toBe(2);
      expect(info[0]?.tools[0]?.name).toBe('read_file');
    });

    test('should include instructions if present', () => {
      registry.registerScope(mockScope);
      const info = registry.getAllScopesInfo();
      expect(info[0]?.instructions).toBe('Use filesystem tools to read/write files');
    });

    test('should handle scope without instructions', () => {
      registry.registerScope(mockScope2);
      const info = registry.getAllScopesInfo();
      expect(info[0]?.instructions).toBeUndefined();
    });
  });
});
