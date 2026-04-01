import * as fs from 'fs';
import * as path from 'path';

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries?: number;
  temperature?: number;
}

let cachedConfig: LLMConfig | null = null;

export function loadLLMConfig(): LLMConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(process.cwd(), 'config', 'llm.json');

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as LLMConfig;

    if (!config.apiKey) {
      throw new Error('LLM API key is not configured in config/llm.json');
    }

    if (!config.model) {
      throw new Error('LLM model is not configured in config/llm.json');
    }

    cachedConfig = config;
    console.log('[LLM] Config loaded:', {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
    });

    return config;
  } catch (error) {
    console.error('[LLM] Failed to load config:', error);
    throw new Error(
      `LLM config file not found or invalid: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function getLLMConfig(): LLMConfig {
  return loadLLMConfig();
}

export function validateLLMConfig(config: LLMConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.provider) {
    errors.push('Missing provider');
  }

  if (!config.model) {
    errors.push('Missing model');
  }

  if (!config.apiKey) {
    errors.push('Missing apiKey');
  }

  if (!config.baseUrl) {
    errors.push('Missing baseUrl');
  }

  if (config.timeout && config.timeout < 5000) {
    errors.push('Timeout should be at least 5000ms');
  }

  return { valid: errors.length === 0, errors };
}
