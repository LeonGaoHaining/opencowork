# OpenCowork v0.8 技术规格说明书

| 项目     | 内容       |
| -------- | ---------- |
| 版本     | v0.8       |
| 更新日期 | 2026-04-06 |
| 状态     | 规划中     |
| 基于PRD  | v3.2       |
| 前置版本 | v0.7       |

---

## 目录

1. [版本目标](#1-版本目标)
2. [技术架构](#2-技术架构)
3. [核心模块设计](#3-核心模块设计)
   - [3.1 WebFetchTool 定义](#31-webfetchtool-定义)
   - [3.2 UARotationManager UA轮换管理](#32-uarotationmanager-ua轮换管理)
   - [3.3 HTMLConverter HTML格式转换](#33-htmlconverter-html格式转换)
   - [3.4 ProxyHandler 代理处理](#34-proxyhandler-代理处理)
   - [3.5 CookieManager Cookie管理](#35-cookiemanager-cookie管理)
   - [3.6 WebSearchTool 搜索工具](#36-websearchtool-搜索工具)
4. [文件结构](#4-文件结构)
5. [Tool注册与集成](#5-tool注册与集成)
6. [错误处理](#6-错误处理)
7. [实施计划](#7-实施计划)
8. [成功指标](#8-成功指标)

---

## 1. 版本目标

**目标**: 轻量级HTTP工具 + Exa AI搜索集成

### 核心目标

| 目标               | 说明                                          |
| ------------------ | --------------------------------------------- |
| **WebFetch Tool**  | 轻量级HTTP GET/POST，支持UA重试、代理、Cookie |
| **WebSearch 集成** | Exa AI搜索接入，支持实时网页搜索              |
| **工具链完善**     | 文档、单元测试、错误码规范                    |

### 与 v0.7 关系

| 组件     | v0.7 实现          | v0.8 增强                    |
| -------- | ------------------ | ---------------------------- |
| Tool系统 | Skill/Connector    | 新增 WebFetch/WebSearch Tool |
| Executor | Browser/CLI/Vision | 新增 HTTP Executor           |
| Agent    | mainAgent          | WebFetch作为可用Tool         |

### 版本功能

| 功能                | 周期       | 交付标准                   | 优先级 |
| ------------------- | ---------- | -------------------------- | ------ |
| **WebFetch 工具**   | Week 39-40 | 基础HTTP GET/POST + UA重试 | P0     |
| **HTML格式转换**    | Week 40    | Markdown/Text/Html输出     | P0     |
| **Cookie/代理支持** | Week 41-42 | 高级配置选项               | P1     |
| **WebSearch 集成**  | Week 42-43 | Exa AI搜索接入             | P1     |
| **工具链完善**      | Week 43    | 文档 + 单元测试            | P1     |

---

## 2. 技术架构

### 2.1 技术选型

| 项目          | 选型                       | 理由                               |
| ------------- | -------------------------- | ---------------------------------- |
| HTTP库        | 原生fetch                  | Node.js 18+ 原生支持，无需额外依赖 |
| HTML→Markdown | turndown                   | OpenCode生产验证，GFM完整支持      |
| HTML→Text     | html-rewriter              | Node.js 18+ 内置，高性能流式处理   |
| 搜索API       | Exa AI MCP                 | OpenCode同款，生产验证             |
| 代理格式      | http://user:pass@host:port | 原生fetch直接支持                  |

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      Tool Layer (工具层)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │  WebFetchTool  │  │  WebSearchTool  │  │   OtherTool   │  │
│  │  • URL验证     │  │  • Exa AI MCP  │  │               │  │
│  │  • UA重试     │  │  • 搜索参数    │  │               │  │
│  │  • 格式转换   │  │  • 结果解析    │  │               │  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬───────┘  │
│           │                      │                     │          │
│           ▼                      ▼                     ▼          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    HTTP Executor                             ││
│  │  • fetch 封装      • 超时控制      • 重试逻辑              ││
│  │  • Cookie管理      • 代理支持      • 重定向处理              ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Network Layer                              ││
│  │  • 原生 fetch      • Agent转发       • 证书处理              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 模块职责

| 模块              | 职责                                 |
| ----------------- | ------------------------------------ |
| WebFetchTool      | 工具定义、参数校验、结果格式化       |
| UARotationManager | UA列表管理、Cloudflare检测、重试逻辑 |
| HTMLConverter     | HTML→Markdown/Text转换、标签过滤     |
| ProxyHandler      | 代理URL解析、认证信息提取            |
| CookieManager     | Cookie存储、同域名自动发送           |
| WebSearchTool     | Exa AI搜索封装、结果解析             |

---

## 3. 核心模块设计

### 3.1 WebFetchTool 定义

```typescript
// src/tools/webfetch/WebFetchTool.ts

import { Tool } from '../base/Tool';
import { UARotationManager } from './UARotationManager';
import { HTMLConverter } from './HTMLConverter';
import { ProxyHandler } from './ProxyHandler';
import { CookieManager } from './CookieManager';

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT = 30 * 1000; // 30秒
const MAX_TIMEOUT = 120 * 1000; // 2分钟

interface WebFetchParams {
  url: string;
  format?: 'text' | 'markdown' | 'html';
  timeout?: number;
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  retryOnUAChange?: boolean;
  redirect?: 'follow' | 'error' | 'manual';
  cookieJar?: boolean;
  proxy?: string;
}

interface WebFetchResult {
  title: string;
  output: string;
  metadata: {
    statusCode: number;
    contentType: string;
    contentLength: number;
    finalUA: string;
    retryAttempted: boolean;
    finalUrl: string;
    headers: Record<string, string>;
  };
  attachments?: {
    type: 'file';
    mime: string;
    url: string;
  }[];
}

export const WebFetchTool = Tool.define('webfetch', {
  name: 'WebFetch',
  description: 'Fetches content from a specified URL with support for multiple formats, UA rotation for anti-blocking, and proxy support.',

  parameters: {
    url: {
      type: 'string',
      required: true,
      description: 'The URL to fetch content from'
    },
    format: {
      type: 'enum',
      default: 'markdown',
      description: 'Return format: text, markdown, or html',
      options: ['text', 'markdown', 'html']
    },
    timeout: {
      type: 'number',
      default: 30,
      description: 'Timeout in seconds (max 120)'
    },
    method: {
      type: 'enum',
      default: 'GET',
      description: 'HTTP method',
      options: ['GET', 'POST', 'HEAD']
    },
    headers: {
      type: 'object',
      default: {},
      description: 'Custom request headers'
    },
    retryOnUAChange: {
      type: 'boolean',
      default: true,
      description: 'Retry with different UA on Cloudflare block'
    },
    redirect: {
      type: 'enum',
      default: 'follow',
      description: 'Redirect handling',
      options: ['follow', 'error', 'manual']
    },
    cookieJar: {
      type: 'boolean',
      default: true,
      description: 'Enable cookie jar for session persistence'
    },
    proxy: {
      type: 'string',
      default: null,
      description: 'Proxy URL with optional auth: http://user:pass@host:port'
    }
  },

  async execute(params: WebFetchParams, context): Promise<WebFetchResult> {
    // 1. 参数校验
    if (!params.url.startsWith('http://') && !params.url.startsWith('https://')) {
      throw new Error('URL must start with http:// or https://');
    }

    const timeout = Math.min((params.timeout ?? 30) * 1000, MAX_TIMEOUT);
    const uaRotation = new UARotationManager(params.retryOnUAChange ?? true);
    const converter = new HTMLConverter();
    const proxyHandler = new ProxyHandler(params.proxy);
    const cookieManager = new CookieManager(params.cookieJar ?? true);

    // 2. 构建请求头
    const baseHeaders: Record<string, string> = {
      'User-Agent': uaRotation.getCurrentUA(),
      'Accept': this.buildAcceptHeader(params.format ?? 'markdown'),
      'Accept-Language': 'en-US,en;q=0.9',
      ...params.headers
    };

    // 3. 添加Cookie
    const cookieHeader = cookieManager.getCookieHeader(params.url);
    if (cookieHeader) {
      baseHeaders['Cookie'] = cookieHeader;
    }

    // 4. 执行请求
    let response: Response;
    let finalUrl = params.url;

    try {
      response = await this.fetchWithRetry(
        params.url,
        {
          method: params.method ?? 'GET',
          headers: baseHeaders,
          redirect: params.redirect ?? 'follow',
          signal: AbortSignal.timeout(timeout)
        },
        uaRotation,
        proxyHandler
      );

      finalUrl = response.url;

      // 5. Cookie保存
      cookieManager.saveFromResponse(finalUrl, response);

    } catch (error) {
      throw new Error(`WebFetch failed: ${error.message}`);
    }

    // 6. 响应校验
    if (!response.ok) {
      throw new Error(`Request failed with status code: ${response.status}`);
    }

    // 7. 大小校验
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      throw new Error('Response too large (exceeds 5MB limit)');
    }

    // 8. 内容处理
    const contentType = response.headers.get('content-type') || '';
    const mime = contentType.split(';')[0]?.trim().toLowerCase() || '';
    const title = `${params.url} (${contentType})`;

    // 9. 图片检测
    if (this.isImage(mime)) {
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
        throw new Error('Response too large (exceeds 5MB limit)');
      }
      const base64Content = Buffer.from(arrayBuffer).toString('base64');
      return {
        title,
        output: 'Image fetched successfully',
        metadata: {
          statusCode: response.status,
          contentType,
          contentLength: arrayBuffer.byteLength,
          finalUA: uaRotation.getCurrentUA(),
          retryAttempted: uaRotation.wasRetryAttempted(),
          finalUrl,
          headers: this.extractResponseHeaders(response)
        },
        attachments: [{
          type: 'file',
          mime,
          url: `data:${mime};base64,${base64Content}`
        }]
      };
    }

    // 10. 文本内容处理
    const content = await response.text();

    let output: string;
    switch (params.format ?? 'markdown') {
      case 'markdown':
        if (contentType.includes('text/html')) {
          output = converter.toMarkdown(content);
        } else {
          output = content;
        }
        break;
      case 'text':
        if (contentType.includes('text/html')) {
          output = converter.toText(content);
        } else {
          output = content;
        }
        break;
      case 'html':
        output = content;
        break;
    }

    return {
      title,
      output,
      metadata: {
        statusCode: response.status,
        contentType,
        contentLength: content.length,
        finalUA: uaRotation.getCurrentUA(),
        retryAttempted: uaRotation.wasRetryAttempted(),
        finalUrl,
        headers: this.extractResponseHeaders(response)
      }
    };
  }

  private buildAcceptHeader(format: string): string {
    switch (format) {
      case 'markdown':
        return 'text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1';
      case 'text':
        return 'text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1';
      case 'html':
        return 'text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1';
      default:
        return '*/*';
    }
  }

  private isImage(mime: string): boolean {
    return mime.startsWith('image/') &&
           mime !== 'image/svg+xml' &&
           mime !== 'image/vnd.fastbidsheet';
  }

  private extractResponseHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    uaRotation: UARotationManager,
    proxyHandler: ProxyHandler
  ): Promise<Response> {
    const maxRetries = uaRotation.getUAList().length;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const ua = uaRotation.getCurrentUA();
      const fetchOptions = {
        ...options,
        headers: { ...options.headers, 'User-Agent': ua }
      };

      const proxyUrl = proxyHandler.getProxyUrl();
      const targetUrl = proxyUrl ? proxyHandler.wrapUrl(url) : url;

      // 添加代理认证头
      const proxyAuthHeaders = proxyHandler.getAuthHeaders();
      if (proxyAuthHeaders) {
        Object.assign(fetchOptions.headers, proxyAuthHeaders);
      }

      const response = await fetch(targetUrl, fetchOptions);

      // 检查Cloudflare拦截
      if (response.status === 403 &&
          response.headers.get('cf-mitigated') === 'challenge') {
        uaRotation.nextUA();
        continue;
      }

      return response;
    }

    throw new Error('All UA attempts failed');
  }
});
```

### 3.2 UARotationManager UA轮换管理

```typescript
// src/tools/webfetch/UARotationManager.ts

const DEFAULT_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
  'opencode/1.0',
];

export class UARotationManager {
  private uaList: string[];
  private currentIndex: number = 0;
  private retryAttempted: boolean = false;
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
    this.uaList = [...DEFAULT_USER_AGENTS];
  }

  getCurrentUA(): string {
    return this.uaList[this.currentIndex];
  }

  getUAList(): string[] {
    return [...this.uaList];
  }

  nextUA(): void {
    this.currentIndex = (this.currentIndex + 1) % this.uaList.length;
    if (this.currentIndex > 0) {
      this.retryAttempted = true;
    }
  }

  wasRetryAttempted(): boolean {
    return this.retryAttempted;
  }

  reset(): void {
    this.currentIndex = 0;
    this.retryAttempted = false;
  }
}
```

### 3.3 HTMLConverter HTML格式转换

```typescript
// src/tools/webfetch/HTMLConverter.ts

import TurndownService from 'turndown';

export class HTMLConverter {
  private turndownService: TurndownService;
  private skipTags = ['script', 'style', 'meta', 'link', 'noscript', 'iframe', 'object', 'embed'];

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
    });

    this.turndownService.remove(this.skipTags);
  }

  toMarkdown(html: string): string {
    return this.turndownService.turndown(html);
  }

  toText(html: string): string {
    let text = '';
    let skipContent = false;
    const SKIP_TAGS = ['script', 'style', 'noscript', 'iframe', 'object', 'embed'];

    const rewriter = new HTMLRewriter()
      .on('script, style, noscript, iframe, object, embed', {
        element() {
          skipContent = true;
        },
      })
      .on('*', {
        element(element) {
          if (!SKIP_TAGS.includes(element.tagName)) {
            skipContent = false;
          }
        },
        text(input) {
          if (!skipContent) {
            text += input.text;
          }
        },
      })
      .transform(new Response(html));

    rewriter.text();
    return text.trim();
  }
}
```

### 3.4 ProxyHandler 代理处理

```typescript
// src/tools/webfetch/ProxyHandler.ts

export class ProxyHandler {
  private proxyUrl: string | null;
  private username: string | null;
  private password: string | null;

  constructor(proxyUrl: string | null) {
    this.proxyUrl = proxyUrl;

    if (proxyUrl) {
      const parsed = this.parseProxyUrl(proxyUrl);
      this.username = parsed.username;
      this.password = parsed.password;
      this.proxyUrl = parsed.proxyUrl;
    }
  }

  private parseProxyUrl(url: string): {
    proxyUrl: string;
    username: string | null;
    password: string | null;
  } {
    try {
      const urlObj = new URL(url);

      if (urlObj.username && urlObj.password) {
        return {
          proxyUrl: `${urlObj.protocol}//${urlObj.host}`,
          username: decodeURIComponent(urlObj.username),
          password: decodeURIComponent(urlObj.password),
        };
      }

      return {
        proxyUrl: url,
        username: null,
        password: null,
      };
    } catch {
      return {
        proxyUrl: url,
        username: null,
        password: null,
      };
    }
  }

  getProxyUrl(): string | null {
    return this.proxyUrl;
  }

  wrapUrl(targetUrl: string): string {
    if (!this.proxyUrl) {
      return targetUrl;
    }

    return `${this.proxyUrl}/${targetUrl}`;
  }

  getAuthHeaders(): Record<string, string> | null {
    if (this.username && this.password) {
      const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      return {
        'Proxy-Authorization': `Basic ${auth}`,
      };
    }
    return null;
  }
}
```

### 3.5 CookieManager Cookie管理

```typescript
// src/tools/webfetch/CookieManager.ts

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
}

export class CookieManager {
  private cookies: Map<string, Cookie> = new Map();
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  private getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  private makeKey(domain: string, name: string): string {
    return `${domain}:${name}`;
  }

  saveFromResponse(url: string, response: Response): void {
    if (!this.enabled) return;

    const domain = this.getDomain(url);

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        this.parseAndSaveCookie(domain, value);
      }
    });
  }

  private parseAndSaveCookie(domain: string, setCookieHeader: string): void {
    const parts = setCookieHeader.split(';');
    const [nameValue, ...attributes] = parts;
    const [name, ...valueParts] = nameValue.split('=');
    const value = valueParts.join('='); // cookie值可能包含=

    if (name && value !== undefined) {
      let expires = Date.now() + 86400000; // 默认1天
      let path = '/';
      let httpOnly = false;
      let secure = false;

      for (const attr of attributes) {
        const attrLower = attr.trim().toLowerCase();
        if (attrLower.startsWith('expires=')) {
          expires = new Date(attrLower.slice(8)).getTime();
        } else if (attrLower.startsWith('path=')) {
          path = attrLower.slice(5);
        } else if (attrLower === 'httponly') {
          httpOnly = true;
        } else if (attrLower === 'secure') {
          secure = true;
        }
      }

      const cookie: Cookie = {
        name: name.trim(),
        value: value.trim(),
        domain,
        path,
        expires,
        httpOnly,
        secure,
      };

      this.cookies.set(this.makeKey(domain, cookie.name), cookie);
    }
  }

  getCookieHeader(url: string): string {
    if (!this.enabled) return '';

    const domain = this.getDomain(url);
    const matchingCookies: string[] = [];

    this.cookies.forEach((cookie, key) => {
      if (this.isDomainMatch(domain, cookie.domain) || key.startsWith(domain + ':')) {
        if (cookie.expires > Date.now()) {
          matchingCookies.push(`${cookie.name}=${cookie.value}`);
        }
      }
    });

    return matchingCookies.join('; ');
  }

  private isDomainMatch(requestDomain: string, cookieDomain: string): boolean {
    return requestDomain === cookieDomain || requestDomain.endsWith('.' + cookieDomain);
  }

  clear(): void {
    this.cookies.clear();
  }
}
```

### 3.6 WebSearchTool 搜索工具

```typescript
// src/tools/websearch/WebSearchTool.ts

import { Tool } from '../base/Tool';
import { abortAfterAny } from '../../util/abort';

const API_CONFIG = {
  BASE_URL: 'https://mcp.exa.ai',
  ENDPOINTS: {
    SEARCH: '/mcp',
  },
  DEFAULT_NUM_RESULTS: 8,
} as const;

interface McpSearchRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: {
    name: string;
    arguments: {
      query: string;
      numResults?: number;
      livecrawl?: 'fallback' | 'preferred';
      type?: 'auto' | 'fast' | 'deep';
      contextMaxCharacters?: number;
    };
  };
}

interface WebSearchParams {
  query: string;
  numResults?: number;
  livecrawl?: 'fallback' | 'preferred';
  type?: 'auto' | 'fast' | 'deep';
  contextMaxCharacters?: number;
}

interface WebSearchResult {
  title: string;
  output: string;
  metadata: Record<string, unknown>;
}

export const WebSearchTool = Tool.define('websearch', async () => {
  return {
    name: 'WebSearch',
    description:
      'Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs',

    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Websearch query',
      },
      numResults: {
        type: 'number',
        required: false,
        default: 8,
        description: 'Number of search results to return',
      },
      livecrawl: {
        type: 'enum',
        required: false,
        default: 'fallback',
        description: "Live crawl mode: 'fallback' or 'preferred'",
        options: ['fallback', 'preferred'],
      },
      type: {
        type: 'enum',
        required: false,
        default: 'auto',
        description: "Search type: 'auto', 'fast', or 'deep'",
        options: ['auto', 'fast', 'deep'],
      },
      contextMaxCharacters: {
        type: 'number',
        required: false,
        default: 10000,
        description: 'Maximum characters for context string',
      },
    },

    async execute(params: WebSearchParams, ctx): Promise<WebSearchResult> {
      await ctx.ask({
        permission: 'websearch',
        patterns: [params.query],
        always: ['*'],
        metadata: {
          query: params.query,
          numResults: params.numResults,
          livecrawl: params.livecrawl,
          type: params.type,
          contextMaxCharacters: params.contextMaxCharacters,
        },
      });

      const searchRequest: McpSearchRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'web_search_exa',
          arguments: {
            query: params.query,
            type: params.type || 'auto',
            numResults: params.numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
            livecrawl: params.livecrawl || 'fallback',
            contextMaxCharacters: params.contextMaxCharacters,
          },
        },
      };

      const { signal, clearTimeout } = abortAfterAny(25000, ctx.abort);

      try {
        const headers: Record<string, string> = {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
        };

        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEARCH}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(searchRequest),
          signal,
        });

        clearTimeout();

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Search error (${response.status}): ${errorText}`);
        }

        const responseText = await response.text();

        // Parse SSE response
        const lines = responseText.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            if (data.result && data.result.content && data.result.content.length > 0) {
              return {
                output: data.result.content[0].text,
                title: `Web search: ${params.query}`,
                metadata: {},
              };
            }
          }
        }

        return {
          output: 'No search results found. Please try a different query.',
          title: `Web search: ${params.query}`,
          metadata: {},
        };
      } catch (error) {
        clearTimeout();
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Search request timed out');
        }
        throw error;
      }
    },
  };
});
```

---

## 4. 文件结构

```
src/tools/
├── webfetch/
│   ├── WebFetchTool.ts       # 工具主类
│   ├── UARotationManager.ts  # UA轮换管理
│   ├── HTMLConverter.ts      # HTML格式转换
│   ├── ProxyHandler.ts       # 代理处理
│   ├── CookieManager.ts      # Cookie管理
│   └── index.ts              # 导出
├── websearch/
│   ├── WebSearchTool.ts      # 搜索工具
│   └── index.ts              # 导出
└── registry.ts               # 工具注册
```

---

## 5. Tool注册与集成

### 5.1 工具注册

```typescript
// src/tools/registry.ts

import { ToolRegistry } from './base/ToolRegistry';
import { WebFetchTool } from './webfetch';
import { WebSearchTool } from './websearch';

export function registerTools(): void {
  ToolRegistry.register('webfetch', WebFetchTool);
  ToolRegistry.register('websearch', WebSearchTool);
}
```

### 5.2 Agent集成

```typescript
// src/agents/mainAgent.ts

import { WebFetchTool } from '../tools/webfetch';
import { WebSearchTool } from '../tools/websearch';

const availableTools = [
  // ... existing tools
  WebFetchTool,
  WebSearchTool,
];
```

---

## 6. 错误处理

### 6.1 错误码定义

| 错误码                     | 说明                         | 可恢复 |
| -------------------------- | ---------------------------- | ------ |
| `FETCH_URL_INVALID`        | URL格式无效（非http/https）  | 否     |
| `FETCH_TIMEOUT`            | 请求超时                     | 是     |
| `FETCH_SIZE_EXCEEDED`      | 响应超过5MB                  | 否     |
| `FETCH_CLOUDFLARE_BLOCKED` | Cloudflare拦截（所有UA失败） | 否     |
| `FETCH_PROXY_ERROR`        | 代理连接失败                 | 是     |
| `FETCH_NETWORK_ERROR`      | 网络错误                     | 是     |
| `FETCH_HTTP_ERROR`         | HTTP错误码（非4xx/5xx）      | 视情况 |
| `FETCH_SSL_ERROR`          | SSL/TLS证书错误              | 是     |

### 6.2 错误返回格式

```typescript
interface WebFetchError {
  code: string;
  message: string;
  recoverable: boolean;
  details?: {
    statusCode?: number;
    attemptedUAs?: string[];
    finalUrl?: string;
    timeoutType?: 'connect' | 'read';
  };
}
```

### 6.3 错误处理策略

| 错误类型       | 处理策略                          |
| -------------- | --------------------------------- |
| 网络超时       | 重试最多3次，间隔1s/2s/4s指数退避 |
| Cloudflare拦截 | 自动切换UA重试                    |
| 代理错误       | 跳过代理尝试直连（如果启用）      |
| SSL错误        | 记录日志，返回错误给用户          |
| 4xx客户端错误  | 不重试，直接返回错误              |
| 5xx服务端错误  | 重试3次，间隔2s/4s/8s             |

---

## 7. 实施计划

| Week    | 任务                         | 交付物                     | 负责人 |
| ------- | ---------------------------- | -------------------------- | ------ |
| Week 39 | WebFetchTool核心实现         | 基础HTTP GET/POST + UA重试 | TBD    |
| Week 40 | HTMLConverter + 格式转换     | Markdown/Text/Html输出     | TBD    |
| Week 41 | ProxyHandler + CookieManager | 代理 + Cookie支持          | TBD    |
| Week 42 | WebSearchTool集成            | Exa AI搜索接入             | TBD    |
| Week 43 | 测试 + 文档                  | 单元测试 + 使用文档        | TBD    |

### 7.1 依赖清单

```json
{
  "dependencies": {
    "turndown": "^7.2.0"
  }
}
```

### 7.2 里程碑

| 里程碑       | 日期        | 交付内容                         |
| ------------ | ----------- | -------------------------------- |
| M1: 基础功能 | Week 40结束 | WebFetch GET + UA重试 + HTML转换 |
| M2: 高级功能 | Week 42结束 | 代理 + Cookie + WebSearch        |
| M3: 发布     | Week 43结束 | 测试通过 + 文档完成              |

---

## 8. 成功指标

| 指标                    | 目标 | 测量方法               |
| ----------------------- | ---- | ---------------------- |
| 基本HTTP请求成功率      | >95% | 单元测试100次请求      |
| Cloudflare绕过率        | >80% | 测试主流Cloudflare站点 |
| 响应时间（无代理）      | <2s  | 测量p95延迟            |
| 响应时间（有代理）      | <5s  | 测量p95延迟            |
| HTML→Markdown转换准确率 | >90% | GFM标准测试集          |
| 代理认证成功率          | 100% | 测试认证代理场景       |
| 单元测试覆盖率          | >80% | Istanbul覆盖率报告     |

---

## 9. 附录

### 9.1 User-Agent列表维护

| UA          | 浏览器   | 版本      | 最后更新 |
| ----------- | -------- | --------- | -------- |
| Chrome 143  | Chrome   | 143.0.0.0 | 2026-04  |
| Firefox 136 | Firefox  | 136.0     | 2026-04  |
| Safari 18.3 | Safari   | 18.3      | 2026-04  |
| Edge 143    | Edge     | 143.0.0.0 | 2026-04  |
| opencode    | opencode | 1.0       | 2026-04  |

### 9.2 参考资料

| 资料                 | 说明                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------- |
| OpenCode WebFetch    | https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/webfetch.ts  |
| OpenCode WebSearch   | https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/websearch.ts |
| turndown             | https://github.com/mixmark-io/turndown                                                 |
| Node.js HTMLRewriter | https://nodejs.org/api/htmlrewriter.html                                               |

---

## 文档历史

| 版本 | 日期       | 修改内容 |
| ---- | ---------- | -------- |
| v0.8 | 2026-04-02 | 初始版本 |
