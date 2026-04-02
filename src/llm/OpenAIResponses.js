import { getLLMConfig } from './config';
export class OpenAIResponsesClient {
    config = getLLMConfig();
    baseUrl;
    apiKey;
    model;
    timeout;
    constructor() {
        this.baseUrl = this.config.baseUrl.replace(/\/$/, '');
        this.apiKey = this.config.apiKey;
        this.model = this.config.model;
        this.timeout = this.config.timeout || 60000;
    }
    async chat(messages) {
        const url = `${this.baseUrl}/chat/completions`;
        const body = {
            model: this.model,
            messages: messages,
            reasoning_effort: 'medium',
        };
        const response = await this.makeRequest(url, body);
        const content = response.choices?.[0]?.message?.content || '';
        return {
            content,
            model: this.model,
            usage: response.usage,
        };
    }
    async complete(prompt) {
        return this.chat([{ role: 'user', content: prompt }]);
    }
    async makeRequest(url, body) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                    'api-key': this.apiKey,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
            }
            return await response.json();
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw error;
        }
    }
}
let clientInstance = null;
export function getLLMClient() {
    if (!clientInstance) {
        clientInstance = new OpenAIResponsesClient();
    }
    return clientInstance;
}
export function resetLLMClient() {
    clientInstance = null;
    console.log('[OpenAIResponses] Client reset');
}
