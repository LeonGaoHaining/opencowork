/**
 * WebFetchTool - 网页获取工具
 * 支持多种格式、UA轮换、代理、Cookie
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { UARotationManager } from './UARotationManager';
import { HTMLConverter } from './HTMLConverter';
import { ProxyHandler } from './ProxyHandler';
import { CookieManager } from './CookieManager';

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT = 30 * 1000;
const MAX_TIMEOUT = 120 * 1000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>
): void {
  const prefix = '[WebFetch]';
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} ${prefix} ${message}`;
  if (level === 'error') {
    console.error(logMessage, meta || '');
  } else if (level === 'warn') {
    console.warn(logMessage, meta || '');
  } else {
    console.log(logMessage, meta || '');
  }
}

export interface WebFetchParams {
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

export interface WebFetchResult {
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

function buildAcceptHeader(format: string): string {
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

function isImage(mime: string): boolean {
  return mime.startsWith('image/') && mime !== 'image/svg+xml' && mime !== 'image/vnd.fastbidsheet';
}

function extractResponseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  uaRotation: UARotationManager,
  proxyHandler: ProxyHandler
): Promise<Response> {
  const maxRetries = uaRotation.getUAList().length;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const ua = uaRotation.getCurrentUA();
    const existingHeaders: Record<string, string> =
      (options.headers as Record<string, string>) || {};
    const fetchOptions: RequestInit = {
      ...options,
      headers: { ...existingHeaders, 'User-Agent': ua },
    };

    const proxyUrl = proxyHandler.getProxyUrl();
    const targetUrl = proxyUrl ? proxyHandler.wrapUrl(url) : url;

    const proxyAuthHeaders = proxyHandler.getAuthHeaders();
    if (proxyAuthHeaders && fetchOptions.headers) {
      const headers = fetchOptions.headers as Record<string, string>;
      for (const key of Object.keys(proxyAuthHeaders)) {
        headers[key] = proxyAuthHeaders[key];
      }
    }

    log('info', `Attempt ${attempt + 1}/${maxRetries}`, { url: targetUrl, ua });

    try {
      const response = await fetch(targetUrl, fetchOptions);

      if (response.status === 403 && response.headers.get('cf-mitigated') === 'challenge') {
        log('warn', 'Cloudflare challenge detected, rotating UA', { attempt });
        uaRotation.nextUA();
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log('warn', `Fetch failed, attempt ${attempt + 1}`, { error: lastError.message });

      if (attempt < maxRetries - 1) {
        const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
        log('info', `Retrying after ${delay}ms`, { delay });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  log('error', 'All fetch attempts failed', { error: lastError?.message });
  throw lastError || new Error('All UA attempts failed');
}

export const webfetchTool = tool(
  async (params: WebFetchParams) => {
    const startTime = Date.now();
    log('info', 'Starting webfetch', { url: params.url, format: params.format });

    if (!params.url.startsWith('http://') && !params.url.startsWith('https://')) {
      log('error', 'Invalid URL', { url: params.url });
      return {
        success: false,
        error: { code: 'FETCH_URL_INVALID', message: 'URL must start with http:// or https://' },
      };
    }

    const timeout = Math.min((params.timeout ?? 30) * 1000, MAX_TIMEOUT);
    const uaRotation = new UARotationManager(params.retryOnUAChange ?? true);
    const converter = new HTMLConverter();
    const proxyHandler = new ProxyHandler(params.proxy ?? null);
    const cookieManager = new CookieManager(params.cookieJar ?? true);

    const baseHeaders: Record<string, string> = {
      'User-Agent': uaRotation.getCurrentUA(),
      Accept: buildAcceptHeader(params.format ?? 'markdown'),
      'Accept-Language': 'en-US,en;q=0.9',
      ...params.headers,
    };

    const cookieHeader = cookieManager.getCookieHeader(params.url);
    if (cookieHeader) {
      baseHeaders['Cookie'] = cookieHeader;
    }

    let response: Response;
    let finalUrl = params.url;

    try {
      response = await fetchWithRetry(
        params.url,
        {
          method: params.method ?? 'GET',
          headers: baseHeaders,
          redirect: params.redirect ?? 'follow',
          signal: AbortSignal.timeout(timeout),
        },
        uaRotation,
        proxyHandler
      );

      finalUrl = response.url;
      cookieManager.saveFromResponse(finalUrl, response);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', 'Webfetch failed', { url: params.url, error: errorMessage });
      return { success: false, error: { code: 'FETCH_ERROR', message: errorMessage } };
    }

    if (!response.ok) {
      log('error', 'HTTP error', { url: params.url, statusCode: response.status });
      return {
        success: false,
        error: {
          code: 'FETCH_HTTP_ERROR',
          message: `Request failed with status code: ${response.status}`,
        },
      };
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      return {
        success: false,
        error: { code: 'FETCH_SIZE_EXCEEDED', message: 'Response too large (exceeds 5MB limit)' },
      };
    }

    const contentType = response.headers.get('content-type') || '';
    const mime = contentType.split(';')[0]?.trim().toLowerCase() || '';
    const title = `${params.url} (${contentType})`;

    if (isImage(mime)) {
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
        log('error', 'Response too large (image)', { size: arrayBuffer.byteLength });
        return {
          success: false,
          error: { code: 'FETCH_SIZE_EXCEEDED', message: 'Response too large (exceeds 5MB limit)' },
        };
      }
      const base64Content = Buffer.from(arrayBuffer).toString('base64');
      log('info', 'Image fetched', { url: params.url, size: arrayBuffer.byteLength });
      return {
        success: true,
        title,
        output: 'Image fetched successfully',
        metadata: {
          statusCode: response.status,
          contentType,
          contentLength: arrayBuffer.byteLength,
          finalUA: uaRotation.getCurrentUA(),
          retryAttempted: uaRotation.wasRetryAttempted(),
          finalUrl,
          headers: extractResponseHeaders(response),
        },
        attachments: [
          {
            type: 'file',
            mime,
            url: `data:${mime};base64,${base64Content}`,
          },
        ],
      };
    }

    const content = await response.text();

    let output: string;
    switch (params.format ?? 'markdown') {
      case 'markdown':
        output = contentType.includes('text/html') ? converter.toMarkdown(content) : content;
        break;
      case 'text':
        output = contentType.includes('text/html') ? converter.toText(content) : content;
        break;
      case 'html':
        output = content;
        break;
      default:
        output = content;
    }

    const duration = Date.now() - startTime;
    log('info', 'Webfetch completed', {
      url: params.url,
      statusCode: response.status,
      contentLength: content.length,
      duration,
    });

    return {
      success: true,
      title,
      output,
      metadata: {
        statusCode: response.status,
        contentType,
        contentLength: content.length,
        finalUA: uaRotation.getCurrentUA(),
        retryAttempted: uaRotation.wasRetryAttempted(),
        finalUrl,
        headers: extractResponseHeaders(response),
      },
    };
  },
  {
    name: 'webfetch',
    description:
      'Fetches content from a specified URL with support for multiple formats (text/markdown/html), UA rotation for anti-blocking, and proxy support.',
    schema: z.object({
      url: z.string().describe('The URL to fetch content from'),
      format: z.enum(['text', 'markdown', 'html']).default('markdown').describe('Return format'),
      timeout: z.number().default(30).describe('Timeout in seconds (max 120)'),
      method: z.enum(['GET', 'POST', 'HEAD']).default('GET').describe('HTTP method'),
      headers: z.record(z.string(), z.string()).default({}).describe('Custom request headers'),
      retryOnUAChange: z
        .boolean()
        .default(true)
        .describe('Retry with different UA on Cloudflare block'),
      redirect: z
        .enum(['follow', 'error', 'manual'])
        .default('follow')
        .describe('Redirect handling'),
      cookieJar: z.boolean().default(true).describe('Enable cookie jar'),
      proxy: z.string().nullable().default(null).describe('Proxy URL with optional auth'),
    }),
  }
);
