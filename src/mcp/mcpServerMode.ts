import http, { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import { getMemoryService } from '../memory';
import { SkillMarket } from '../skills/skillMarket';
import { loadMCPConfig } from './mcpConfig';

export interface MCPServerModeStatus {
  running: boolean;
  port: number | null;
}

type MCPServerHandler = (body?: any) => Promise<any>;

type MCPStandardServer = {
  connect: (transport: unknown) => Promise<void>;
  close: () => Promise<void>;
  registerTool: (
    name: string,
    config: {
      description?: string;
      inputSchema?: Record<string, z.ZodTypeAny>;
    },
    cb: (args: Record<string, unknown> | undefined) => Promise<unknown>
  ) => void;
  sendToolListChanged: () => void;
};

type MCPStandardTransport = {
  close: () => Promise<void>;
  handleRequest: (req: IncomingMessage, res: ServerResponse, parsedBody?: unknown) => Promise<void>;
};

interface RegisteredMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: MCPServerHandler;
}

export class MCPServerMode {
  private server: http.Server | null = null;
  private port: number | null = null;
  private handlers: Map<string, RegisteredMCPTool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  registerTool(
    name: string,
    handler: MCPServerHandler,
    description: string = `OpenCowork exposed tool: ${name}`,
    inputSchema: Record<string, unknown> = {}
  ): void {
    this.handlers.set(name, {
      name,
      description,
      inputSchema,
      handler,
    });
  }

  private registerDefaultTools(): void {
    this.registerTool(
      'memory:read',
      async () => {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
        return getMemoryService(homeDir).read();
      },
      'Read persistent memory'
    );
    this.registerTool(
      'skill:list',
      async () => new SkillMarket().listInstalledSkills(),
      'List skills'
    );
  }

  private isAuthorized(req: IncomingMessage): boolean {
    const authConfig = loadMCPConfig().server.auth;
    if (!authConfig?.token) {
      return true;
    }

    if (authConfig.type !== 'bearer') {
      return true;
    }

    const authorization = req.headers.authorization;
    return authorization === `Bearer ${authConfig.token}`;
  }

  async startServer(port: number): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        if (!req.url) {
          res.statusCode = 404;
          res.end();
          return;
        }

        if (!this.isAuthorized(req)) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        const requestUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

        if (requestUrl.pathname === '/mcp') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Method not allowed.' },
                id: null,
              })
            );
            return;
          }

          const parsedBody = await this.readJsonBody(req);
          const { server, transport } = await this.createStandardServerInstance();
          res.on('close', () => {
            void transport.close().catch((error) => {
              console.warn('[MCPServerMode] Failed to close request transport:', error);
            });
            void server.close().catch((error) => {
              console.warn('[MCPServerMode] Failed to close request server:', error);
            });
          });
          await transport.handleRequest(req, res, parsedBody);
          return;
        }

        if (req.method === 'GET' && requestUrl.pathname === '/tools') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              tools: Array.from(this.handlers.values()).map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
              })),
            })
          );
          return;
        }

        if (req.method === 'POST' && requestUrl.pathname.startsWith('/tools/')) {
          const toolName = decodeURIComponent(
            requestUrl.pathname.replace('/tools/', '').replace('/call', '')
          );
          const registeredTool = this.handlers.get(toolName);
          if (!registeredTool) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Tool not found' }));
            return;
          }

          const body = await this.readJsonBody(req);
          const result = await registeredTool.handler(body);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }

        res.statusCode = 404;
        res.end();
      } catch (error: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.listen(port, () => {
        this.port = port;
        resolve();
      });
      this.server?.on('error', reject);
    });
  }

  async stopServer(): Promise<void> {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    this.server = null;
    this.port = null;
  }

  getStatus(): MCPServerModeStatus {
    return {
      running: this.server !== null,
      port: this.port,
    };
  }

  private async readJsonBody(req: IncomingMessage): Promise<any> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    return raw ? JSON.parse(raw) : {};
  }

  private async createStandardServerInstance(): Promise<{
    server: MCPStandardServer;
    transport: MCPStandardTransport;
  }> {
    const [{ McpServer }, { StreamableHTTPServerTransport }] = await Promise.all([
      import('@modelcontextprotocol/sdk/server/mcp.js'),
      import('@modelcontextprotocol/sdk/server/streamableHttp.js'),
    ]);

    const mcpServer = new McpServer({
      name: 'OpenCowork',
      version: '0.10.9',
    });

    for (const registeredTool of this.handlers.values()) {
      this.registerStandardTool(
        registeredTool.name,
        registeredTool.handler,
        registeredTool.description,
        registeredTool.inputSchema,
        mcpServer as unknown as MCPStandardServer
      );
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await mcpServer.connect(transport);

    return {
      server: mcpServer as unknown as MCPStandardServer,
      transport: transport as unknown as MCPStandardTransport,
    };
  }

  private registerStandardTool(
    name: string,
    handler: MCPServerHandler,
    description: string,
    inputSchema: Record<string, unknown>,
    server: MCPStandardServer
  ): void {
    server.registerTool(
      name,
      {
        description,
        inputSchema: this.convertInputSchemaToZodShape(inputSchema),
      },
      async (args?: Record<string, unknown>) =>
        this.wrapStandardToolResult(await handler(args || {}))
    );
  }

  private convertInputSchemaToZodShape(
    inputSchema: Record<string, unknown>
  ): Record<string, z.ZodTypeAny> | undefined {
    const entries = Object.entries(inputSchema || {});
    if (entries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(entries.map(([key, value]) => [key, this.convertSchemaValue(value)]));
  }

  private convertSchemaValue(value: unknown): z.ZodTypeAny {
    if (typeof value !== 'string') {
      return z.unknown();
    }

    const isOptional = value.endsWith('?');
    const normalized = isOptional ? value.slice(0, -1) : value;

    let schema: z.ZodTypeAny;
    switch (normalized) {
      case 'string':
        schema = z.string();
        break;
      case 'number':
        schema = z.number();
        break;
      case 'boolean':
        schema = z.boolean();
        break;
      case 'object':
        schema = z.object({}).passthrough();
        break;
      default:
        schema = z.unknown();
        break;
    }

    return isOptional ? schema.optional() : schema;
  }

  private wrapStandardToolResult(result: unknown): {
    content: Array<{ type: 'text'; text: string }>;
    structuredContent?: Record<string, unknown>;
  } {
    if (
      result &&
      typeof result === 'object' &&
      'content' in result &&
      Array.isArray((result as { content?: unknown }).content)
    ) {
      return result as {
        content: Array<{ type: 'text'; text: string }>;
        structuredContent?: Record<string, unknown>;
      };
    }

    if (typeof result === 'string') {
      return {
        content: [{ type: 'text', text: result }],
      };
    }

    const structuredContent =
      result && typeof result === 'object' && !Array.isArray(result)
        ? (result as Record<string, unknown>)
        : undefined;

    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'undefined' ? 'null' : JSON.stringify(result, null, 2),
        },
      ],
      ...(structuredContent ? { structuredContent } : {}),
    };
  }
}

let serverModeInstance: MCPServerMode | null = null;

export function getMCPServerMode(): MCPServerMode {
  if (!serverModeInstance) {
    serverModeInstance = new MCPServerMode();
  }
  return serverModeInstance;
}

export function resetMCPServerMode(): void {
  serverModeInstance = null;
}
