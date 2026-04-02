/**
 * UARotationManager - UA轮换管理
 * 用于Cloudflare反爬虫检测时的UA自动切换
 */
const DEFAULT_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
    'opencode/1.0',
];
export class UARotationManager {
    uaList;
    currentIndex = 0;
    retryAttempted = false;
    constructor(_enabled = true) {
        this.uaList = [...DEFAULT_USER_AGENTS];
    }
    getCurrentUA() {
        return this.uaList[this.currentIndex];
    }
    getUAList() {
        return [...this.uaList];
    }
    nextUA() {
        this.currentIndex = (this.currentIndex + 1) % this.uaList.length;
        if (this.currentIndex > 0) {
            this.retryAttempted = true;
        }
    }
    wasRetryAttempted() {
        return this.retryAttempted;
    }
    reset() {
        this.currentIndex = 0;
        this.retryAttempted = false;
    }
    isCloudflareBlocked(response) {
        return response.status === 403 && response.headers.get('cf-mitigated') === 'challenge';
    }
}
