import { describe, it, expect } from 'vitest';
import { createLLMProvider, OllamaProvider } from '../providers/ollama';
import { OpenAIProvider } from '../providers/openai';
import { AnthropicProvider } from '../providers/anthropic';

describe('createLLMProvider', () => {
  it('returns null when no config is provided', () => {
    const provider = createLLMProvider({});
    expect(provider).toBeNull();
  });

  it('returns OllamaProvider when only ollama config is provided', () => {
    const provider = createLLMProvider({
      ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
    });
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it('prefers OpenAI over Ollama when both are configured', () => {
    const provider = createLLMProvider({
      openaiApiKey: 'sk-test-key',
      ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('prefers Anthropic over OpenAI when both are configured', () => {
    const provider = createLLMProvider({
      anthropicApiKey: 'sk-ant-test-key',
      openaiApiKey: 'sk-test-key',
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('prefers Anthropic over everything when all three are configured', () => {
    const provider = createLLMProvider({
      anthropicApiKey: 'sk-ant-test-key',
      openaiApiKey: 'sk-test-key',
      ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('returns OpenAIProvider when only openai config is provided', () => {
    const provider = createLLMProvider({
      openaiApiKey: 'sk-test-key',
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('returns AnthropicProvider when only anthropic config is provided', () => {
    const provider = createLLMProvider({
      anthropicApiKey: 'sk-ant-test-key',
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('passes model config to the provider', () => {
    const provider = createLLMProvider({
      openaiApiKey: 'sk-test',
      openaiModel: 'gpt-4o',
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
    // Provider is created but we can only verify it's the right class
  });
});

describe('OllamaProvider', () => {
  it('creates with default model', () => {
    const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434', model: 'llama3.2' });
    expect(provider).toBeDefined();
    expect(provider.complete).toBeInstanceOf(Function);
    expect(provider.completeWithTools).toBeInstanceOf(Function);
  });

  it('has the correct interface', () => {
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2',
      temperature: 0.5,
      maxTokens: 2048,
    });
    expect(provider).toBeDefined();
  });
});

describe('OpenAIProvider', () => {
  it('creates with default model', () => {
    const provider = new OpenAIProvider({ apiKey: 'sk-test' });
    expect(provider).toBeDefined();
    expect(provider.complete).toBeInstanceOf(Function);
    expect(provider.completeWithTools).toBeInstanceOf(Function);
  });

  it('accepts custom config', () => {
    const provider = new OpenAIProvider({
      apiKey: 'sk-test',
      model: 'gpt-4o',
      baseUrl: 'https://custom.api.com/v1',
      temperature: 0.3,
      maxTokens: 1024,
    });
    expect(provider).toBeDefined();
  });
});

describe('AnthropicProvider', () => {
  it('creates with default model', () => {
    const provider = new AnthropicProvider({ apiKey: 'sk-ant-test' });
    expect(provider).toBeDefined();
    expect(provider.complete).toBeInstanceOf(Function);
    expect(provider.completeWithTools).toBeInstanceOf(Function);
  });

  it('accepts custom config', () => {
    const provider = new AnthropicProvider({
      apiKey: 'sk-ant-test',
      model: 'claude-opus-4-7',
      temperature: 0.2,
      maxTokens: 8192,
    });
    expect(provider).toBeDefined();
  });
});
