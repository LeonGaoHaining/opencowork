/**
 * CookieManager - Cookie管理
 * 支持Cookie存储、同域名自动发送
 */
export class CookieManager {
    cookies = new Map();
    enabled;
    constructor(enabled = true) {
        this.enabled = enabled;
    }
    getDomain(url) {
        try {
            return new URL(url).hostname;
        }
        catch {
            return '';
        }
    }
    makeKey(domain, name) {
        return `${domain}:${name}`;
    }
    saveFromResponse(url, response) {
        if (!this.enabled)
            return;
        const domain = this.getDomain(url);
        response.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'set-cookie') {
                this.parseAndSaveCookie(domain, value);
            }
        });
    }
    parseAndSaveCookie(domain, setCookieHeader) {
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
                }
                else if (attrLower.startsWith('path=')) {
                    path = attrLower.slice(5);
                }
                else if (attrLower === 'httponly') {
                    httpOnly = true;
                }
                else if (attrLower === 'secure') {
                    secure = true;
                }
            }
            const cookie = {
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
    getCookieHeader(url) {
        if (!this.enabled)
            return '';
        const domain = this.getDomain(url);
        const matchingCookies = [];
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
    isDomainMatch(requestDomain, cookieDomain) {
        return requestDomain === cookieDomain || requestDomain.endsWith('.' + cookieDomain);
    }
    clear() {
        this.cookies.clear();
    }
}
