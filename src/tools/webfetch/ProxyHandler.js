/**
 * ProxyHandler - 代理处理
 * 支持代理URL解析、认证信息提取
 */
export class ProxyHandler {
    proxyUrl;
    username;
    password;
    constructor(proxyUrl) {
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
    parseProxyUrl(url) {
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
        }
        catch {
            return {
                proxyUrl: url,
                username: null,
                password: null,
            };
        }
    }
    getProxyUrl() {
        return this.proxyUrl;
    }
    wrapUrl(targetUrl) {
        if (!this.proxyUrl) {
            return targetUrl;
        }
        return `${this.proxyUrl}/${targetUrl}`;
    }
    getAuthHeaders() {
        if (this.username && this.password) {
            const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
            return {
                'Proxy-Authorization': `Basic ${auth}`,
            };
        }
        return null;
    }
}
