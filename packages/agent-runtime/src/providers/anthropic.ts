import type { LLMProvider, LLMResponse } from './ollama';

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private apiVersion: string;

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.anthropic.com';
    this.model = config.model ?? 'claude-sonnet-4-6';
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this.apiVersion = '2023-06-01';
  }

  async complete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: prompt },
    ];

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages,
      temperature: this.temperature,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic error ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
      stop_reason?: string;
    };

    const textContent = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n');

    return {
      content: textContent,
      model: this.model,
      tokens: {
        prompt: data.usage?.input_tokens ?? 0,
        completion: data.usage?.output_tokens ?? 0,
        total: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length',
    };
  }

  async completeWithTools(
    prompt: string,
    tools: unknown[],
    systemPrompt?: string,
  ): Promise<LLMResponse> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: prompt },
    ];

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages,
      tools,
      temperature: this.temperature,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Anthropic tool call error: ${res.status}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      stop_reason?: string;
    };

    const textContent = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n');

    const hasToolUse = data.content.some((c) => c.type === 'tool_use');

    return {
      content: textContent,
      model: this.model,
      tokens: { prompt: 0, completion: 0, total: 0 },
      finishReason: hasToolUse ? 'tool_call' : 'stop',
    };
  }
}
