/**
 * ProxyHandler - 代理处理
 * 支持代理URL解析、认证信息提取
 */

export class ProxyHandler {
  private proxyUrl: string | null;
  private username: string | null;
  private password: string | null;

  constructor(proxyUrl: string | null) {
    this.proxyUrl = proxyUrl;
    this.username = null;
    this.password = null;

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
