/**
 * CookieManager - Cookie管理
 * 支持Cookie存储、同域名自动发送
 */

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
    const value = valueParts.join('=');

    if (name && value !== undefined) {
      let expires = Date.now() + 86400000;
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
      if (cookie.expires <= Date.now()) {
        this.cookies.delete(key);
        return;
      }
      if (this.isDomainMatch(domain, cookie.domain) || key.startsWith(domain + ':')) {
        matchingCookies.push(`${cookie.name}=${cookie.value}`);
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
