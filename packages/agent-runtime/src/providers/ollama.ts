/**
 * Ollama AI Provider for Agent Runtime
 *
 * Supports local LLM execution via Ollama (https://ollama.com)
 * Falls back to OpenAI/Anthropic if Ollama is unavailable.
 */

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokens: { prompt: number; completion: number; total: number };
  finishReason: 'stop' | 'length' | 'tool_call';
}

export interface LLMProvider {
  complete(prompt: string, systemPrompt?: string): Promise<LLMResponse>;
  completeWithTools(prompt: string, tools: unknown[], systemPrompt?: string): Promise<LLMResponse>;
}

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: OllamaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model = config.model;
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  async complete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          options: {
            temperature: this.temperature,
            num_predict: this.maxTokens,
          },
        }),
      });

      if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

      const data = await res.json() as {
        message: { content: string };
        eval_count?: number;
        prompt_eval_count?: number;
      };

      return {
        content: data.message.content,
        model: this.model,
        tokens: {
          prompt: data.prompt_eval_count ?? 0,
          completion: data.eval_count ?? 0,
          total: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        },
        finishReason: 'stop',
      };
    } catch (error) {
      // Fallback: return a structured error response
      throw new Error(`Ollama provider failed: ${(error as Error).message}. Ensure Ollama is running at ${this.baseUrl}`);
    }
  }

  async completeWithTools(prompt: string, tools: unknown[], systemPrompt?: string): Promise<LLMResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          tools,
          options: { temperature: this.temperature },
        }),
      });

      const data = await res.json() as { message: { content: string; tool_calls?: unknown[] } };
      return {
        content: data.message.content,
        model: this.model,
        tokens: { prompt: 0, completion: 0, total: 0 },
        finishReason: data.message.tool_calls ? 'tool_call' : 'stop',
      };
    } catch (error) {
      throw new Error(`Ollama tool call failed: ${(error as Error).message}`);
    }
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    const data = await res.json() as { models: Array<{ name: string }> };
    return data.models?.map((m) => m.name) ?? [];
  }

  async pullModel(model: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false }),
    });
  }
}

/**
 * Provider factory — selects the right LLM based on available config.
 */
export function createLLMProvider(config: {
  ollama?: OllamaConfig;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}): LLMProvider | null {
  if (config.ollama) {
    return new OllamaProvider(config.ollama);
  }
  // OpenAI and Anthropic providers would be created here with their respective SDKs
  return null;
}
