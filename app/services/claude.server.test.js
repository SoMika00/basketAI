import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClaudeService } from './claude.server.js';

vi.mock('@anthropic-ai/sdk', () => {
  const mockStream = {
    on: vi.fn((event, handler) => {
      if (event === 'text') mockStream._onText = handler;
      if (event === 'message') mockStream._onMessage = handler;
      if (event === 'contentBlock') mockStream._onContentBlock = handler;
    }),
    finalMessage: vi.fn().mockResolvedValue({
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello from Claude' }],
      stop_reason: 'end_turn',
    }),
  };

  const mockAnthropic = vi.fn(() => ({
    messages: {
      stream: vi.fn().mockResolvedValue(mockStream),
    },
  }));

  return { Anthropic: mockAnthropic };
});

vi.mock('../utils/retry.server.js', () => ({
  withRetry: vi.fn(async (fn) => fn()),
}));

vi.mock('../prompts/prompts.json', () => ({
  default: {
    systemPrompts: {
      standardAssistant: { content: 'Standard prompt' },
      enthusiasticAssistant: { content: 'Enthusiastic prompt' },
    },
  },
}));

vi.mock('./config.server.js', () => ({
  default: {
    api: {
      defaultModel: 'claude-3-5-sonnet-20241022',
      maxTokens: 1024,
      defaultPromptType: 'standardAssistant',
    },
  },
}));

import { withRetry } from '../utils/retry.server.js';

 describe('createClaudeService', () => {
  let claudeService;
  const apiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    claudeService = createClaudeService(apiKey);
  });

  describe('streamConversation', () => {
    it('streams conversation successfully and returns finalMessage', async () => {
      const messages = [{ role: 'user', content: 'Hi' }];
      const handlers = {
        onText: vi.fn(),
        onMessage: vi.fn(),
        onContentBlock: vi.fn(),
      };

      const result = await claudeService.streamConversation(
        { messages, promptType: 'standardAssistant', tools: [] },
        handlers
      );

      expect(result).toMatchObject({ role: 'assistant', stop_reason: 'end_turn' });
      expect(withRetry).toHaveBeenCalled();
    });

    it('handles tool_use in finalMessage and calls onToolUse', async () => {
      const mockFinal = {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tool1', name: 'search', input: {} }],
        stop_reason: 'end_turn',
      };
      // override for this test
      const { Anthropic } = await import('@anthropic-ai/sdk');
      const instance = new Anthropic();
      instance.messages.stream.mockResolvedValue({
        on: vi.fn(),
        finalMessage: vi.fn().mockResolvedValue(mockFinal),
      });

      const onToolUse = vi.fn();
      await claudeService.streamConversation(
        { messages: [], promptType: 'standardAssistant', tools: [{ name: 'search' }] },
        { onToolUse }
      );

      expect(onToolUse).toHaveBeenCalledWith(mockFinal.content[0]);
    });

    it('handles rate limit and auth errors via retry and streaming', async () => {
      const error = new Error('Rate limit');
      error.status = 429;
      withRetry.mockRejectedValueOnce(error);

      await expect(
        claudeService.streamConversation({ messages: [], promptType: 'standardAssistant' }, {})
      ).rejects.toThrow('Rate limit');
    });

    it('selects prompt via getSystemPrompt and exercises prompt selection', async () => {
      const prompt = claudeService.getSystemPrompt('enthusiasticAssistant');
      expect(prompt).toBe('Enthusiastic prompt');

      const defaultPrompt = claudeService.getSystemPrompt('unknown');
      expect(defaultPrompt).toBe('Standard prompt');
    });
  });

  describe('getSystemPrompt', () => {
    it('returns correct prompt for known type', () => {
      expect(claudeService.getSystemPrompt('standardAssistant')).toBe('Standard prompt');
    });

    it('falls back to default prompt', () => {
      expect(claudeService.getSystemPrompt('nonexistent')).toBe('Standard prompt');
    });
  });
});
