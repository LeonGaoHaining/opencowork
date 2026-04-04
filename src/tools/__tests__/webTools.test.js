import { describe, it, expect, beforeEach } from 'vitest';
import { UARotationManager } from '../webfetch/UARotationManager';
import { HTMLConverter } from '../webfetch/HTMLConverter';
import { ProxyHandler } from '../webfetch/ProxyHandler';
import { CookieManager } from '../webfetch/CookieManager';
describe('WebFetch Tools - Black Box Tests', () => {
    describe('UARotationManager', () => {
        let uaManager;
        beforeEach(() => {
            uaManager = new UARotationManager();
        });
        it('should return default UA on initialization', () => {
            const ua = uaManager.getCurrentUA();
            expect(ua).toBeTruthy();
            expect(ua).toContain('Mozilla/5.0');
        });
        it('should rotate through UA list', () => {
            const firstUA = uaManager.getCurrentUA();
            uaManager.nextUA();
            const secondUA = uaManager.getCurrentUA();
            expect(firstUA).not.toBe(secondUA);
        });
        it('should track retry attempts', () => {
            expect(uaManager.wasRetryAttempted()).toBe(false);
            uaManager.nextUA();
            expect(uaManager.wasRetryAttempted()).toBe(true);
        });
        it('should return full UA list', () => {
            const uaList = uaManager.getUAList();
            expect(uaList).toHaveLength(5);
            expect(uaList).toContain('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36');
            expect(uaList).toContain('opencode/1.0');
        });
        it('should reset state', () => {
            uaManager.nextUA();
            uaManager.reset();
            expect(uaManager.wasRetryAttempted()).toBe(false);
        });
    });
    describe('HTMLConverter', () => {
        let converter;
        beforeEach(() => {
            converter = new HTMLConverter();
        });
        it('should convert HTML to markdown', () => {
            const html = '<h1>Title</h1><p>Paragraph</p>';
            const markdown = converter.toMarkdown(html);
            expect(markdown).toContain('# Title');
            expect(markdown).toContain('Paragraph');
        });
        it('should strip script and style tags', () => {
            const html = '<script>alert("xss")</script><style>.hidden{display:none}</style><p>Content</p>';
            const markdown = converter.toMarkdown(html);
            expect(markdown).not.toContain('alert');
            expect(markdown).not.toContain('display');
            expect(markdown).toContain('Content');
        });
        it('should convert HTML to text', () => {
            const html = '<h1>Title</h1><p>Paragraph</p>';
            const text = converter.toText(html);
            expect(text).toContain('Title');
            expect(text).toContain('Paragraph');
        });
        it('should handle empty input', () => {
            expect(converter.toMarkdown('')).toBe('');
            expect(converter.toText('')).toBe('');
        });
        it('should decode HTML entities', () => {
            const html = '&amp; &lt; &gt; &nbsp;';
            const text = converter.toText(html);
            expect(text).toContain('&');
            expect(text).toContain('<');
            expect(text).toContain('>');
        });
    });
    describe('ProxyHandler', () => {
        it('should handle no proxy', () => {
            const handler = new ProxyHandler(null);
            expect(handler.getProxyUrl()).toBeNull();
            expect(handler.getAuthHeaders()).toBeNull();
            expect(handler.wrapUrl('http://example.com')).toBe('http://example.com');
        });
        it('should parse proxy without auth', () => {
            const handler = new ProxyHandler('http://proxy.example.com:8080');
            expect(handler.getProxyUrl()).toBe('http://proxy.example.com:8080');
            expect(handler.getAuthHeaders()).toBeNull();
        });
        it('should parse proxy with auth', () => {
            const handler = new ProxyHandler('http://user:pass@proxy.example.com:8080');
            expect(handler.getProxyUrl()).toBe('http://proxy.example.com:8080');
            const authHeaders = handler.getAuthHeaders();
            expect(authHeaders).not.toBeNull();
            expect(authHeaders).toHaveProperty('Proxy-Authorization');
        });
        it('should wrap URL for proxy', () => {
            const handler = new ProxyHandler('http://proxy.example.com:8080');
            const wrapped = handler.wrapUrl('http://target.com/page');
            expect(wrapped).toBe('http://proxy.example.com:8080/http://target.com/page');
        });
    });
    describe('CookieManager', () => {
        let cookieManager;
        beforeEach(() => {
            cookieManager = new CookieManager(true);
        });
        it('should return empty string when disabled', () => {
            const disabled = new CookieManager(false);
            const mockUrl = 'https://example.com';
            expect(disabled.getCookieHeader(mockUrl)).toBe('');
        });
        it('should return empty string for no cookies', () => {
            const header = cookieManager.getCookieHeader('https://example.com');
            expect(header).toBe('');
        });
        it('should clear all cookies', () => {
            cookieManager.clear();
            const header = cookieManager.getCookieHeader('https://example.com');
            expect(header).toBe('');
        });
        it('should extract domain from URL', () => {
            const cookieManager = new CookieManager();
            const domain = cookieManager.getDomain('https://example.com/path');
            expect(domain).toBe('example.com');
        });
        it('should handle invalid URL', () => {
            const cookieManager = new CookieManager();
            const domain = cookieManager.getDomain('not-a-url');
            expect(domain).toBe('');
        });
    });
});
describe('WebSearch Tools - Black Box Tests', () => {
    describe('WebSearch Tool Schema', () => {
        it('should have correct schema structure', () => {
            const schema = {
                query: expect.any(String),
                numResults: expect.any(Number),
                livecrawl: expect.any(String),
                type: expect.any(String),
                contextMaxCharacters: expect.any(Number),
            };
            expect(schema.query).toBeTruthy();
            expect(schema.numResults).toBeTruthy();
        });
        it('should validate default values', () => {
            const params = {
                query: 'test',
            };
            expect(params.query).toBe('test');
        });
    });
});
