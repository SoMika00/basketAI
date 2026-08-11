import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLlmService } from './llm.server.js';

vi.mock('./claude.server.js', () => ({
  createClaudeService: vi.fn(() => ({ provider: 'claude' })),
}));

vi.mock('./groq.server.js', () => ({
  createGroqService: vi.fn(() => ({ provider: 'groq' })),
}));

import { createClaudeService } from './claude.server.js';
import { createGroqService } from './groq.server.js';

describe('createLlmService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_PROVIDER;
    delete process.env.GROQ_API_KEY;
  });

  it('defaults to anthropic/Claude when no env vars set', () => {
    const service = createLlmService();
    expect(createClaudeService).toHaveBeenCalled();
    expect(createGroqService).not.toHaveBeenCalled();
    expect(service.provider).toBe('claude');
  });

  it('selects groq when LLM_PROVIDER=groq', () => {
    process.env.LLM_PROVIDER = 'groq';
    const service = createLlmService();
    expect(createGroqService).toHaveBeenCalled();
    expect(createClaudeService).not.toHaveBeenCalled();
    expect(service.provider).toBe('groq');
  });

  it('falls back to groq when only GROQ_API_KEY is present', () => {
    process.env.GROQ_API_KEY = 'test-key';
    const service = createLlmService();
    expect(createGroqService).toHaveBeenCalled();
    expect(createClaudeService).not.toHaveBeenCalled();
    expect(service.provider).toBe('groq');
  });
});
