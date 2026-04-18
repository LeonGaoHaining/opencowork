import { tool } from '@langchain/core/tools';
import { getMCPClient } from '../../mcp';

export function buildMCPCatalogText(): string {
  const mcpClient = getMCPClient();
  const servers = mcpClient.listServers();

  if (servers.length === 0) {
    return '当前没有已配置的 MCP 连接。';
  }

  const connectedServers = servers.filter((server) => server.status === 'connected');
  if (connectedServers.length === 0) {
    return '当前没有已连接的 MCP 服务。';
  }

  return connectedServers
    .map((server) => {
      if (server.tools.length === 0) {
        return `- ${server.name} (connected): 无可用工具`;
      }

      const toolLines = server.tools.map((mcpTool) => {
        const description = mcpTool.description || '无描述';
        return `  - ${server.name}.${mcpTool.name}: ${description}`;
      });

      return [`- ${server.name} (connected):`, ...toolLines].join('\n');
    })
    .join('\n');
}

export const listMCPToolsTool = tool(
  async (): Promise<{ success: boolean; output: string }> => {
    try {
      return {
        success: true,
        output: `当前可用的 MCP 工具:\n${buildMCPCatalogText()}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, output: `获取 MCP 工具失败: ${errorMessage}` };
    }
  },
  {
    name: 'list_mcp_tools',
    description:
      '列出当前已连接的 MCP 服务及其可用工具。当用户询问有哪些 MCP、MCP 工具、docs 工具或外部工具能力时使用。',
  }
);
