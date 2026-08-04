import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGroqService } from './groq.server.js';

vi.mock('./config.server.js', () => ({
  default: {
    api: { defaultPromptType: 'standardAssistant' },
    errorMessages: { apiKeyError: 'API key required' },
  },
}));

vi.mock('../prompts/prompts.json', () => ({
  default: {
    systemPrompts: {
      standardAssistant: { content: 'You are a helpful assistant.' },
    },
  },
}));

global.fetch = vi.fn();

function createMockStream(chunks) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    text: async () => '',
    body: stream,
  };
}

describe('createGroqService', () => {
  let groqService;

  beforeEach(() => {
    vi.clearAllMocks();
    groqService = createGroqService({ apiKey: 'test-key' });
  });

  it('throws when no apiKey provided', () => {
    expect(() => createGroqService({ apiKey: '' })).toThrow();
  });

  it('getSystemPrompt returns configured prompt', () => {
    const prompt = groqService.getSystemPrompt('standardAssistant');
    expect(prompt).toBe('You are a helpful assistant.');
  });

  describe('toOpenAiTools (via stream)', () => {
    it('converts tools to OpenAI format', async () => {
      const tools = [
        { name: 'search', description: 'Search', input_schema: { type: 'object' } },
      ];
      fetch.mockResolvedValueOnce(createMockStream(['data: {"choices":[{"delta":{}}]}

', 'data: [DONE]

']));
      await groqService.streamConversation({ messages: [], tools }, {});
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.tools).toEqual([
        { type: 'function', function: { name: 'search', description: 'Search', parameters: { type: 'object' } } },
      ]);
    });
  });

  describe('toOpenAiMessages', () => {
    it('handles text messages', async () => {
      fetch.mockResolvedValueOnce(createMockStream(['data: {"choices":[{"delta":{}}]}

', 'data: [DONE]

']));
      await groqService.streamConversation({ messages: [{ role: 'user', content: 'hi' }] }, {});
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.messages[1]).toEqual({ role: 'user', content: 'hi' });
    });

    it('handles tool_use blocks', async () => {
      const messages = [
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'call1', name: 'search', input: { q: 'test' } }],
        },
      ];
      fetch.mockResolvedValueOnce(createMockStream(['data: {"choices":[{"delta":{}}]}

', 'data: [DONE]

']));
      await groqService.streamConversation({ messages }, {});
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.messages[1].tool_calls[0]).toMatchObject({ id: 'call1', function: { name: 'search' } });
    });

    it('handles tool_result blocks', async () => {
      const messages = [
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call1', content: 'result' }] },
      ];
      fetch.mockResolvedValueOnce(createMockStream(['data: {"choices":[{"delta":{}}]}

', 'data: [DONE]

']));
      await groqService.streamConversation({ messages }, {});
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.messages[1]).toEqual({ role: 'tool', tool_call_id: 'call1', content: 'result' });
    });
  });

  describe('streamConversation', () => {
    it('happy path streams text and returns final message', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}

',
        'data: [DONE]

',
      ];
      fetch.mockResolvedValueOnce(createMockStream(chunks));

      const onText = vi.fn();
      const onMessage = vi.fn();
      const result = await groqService.streamConversation({ messages: [] }, { onText, onMessage });

      expect(onText).toHaveBeenCalledWith('Hello');
      expect(result.content[0].text).toBe('Hello');
    });

    it('handles tool calls in stream', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call1","function":{"name":"search","arguments":"{\"q\":\"snow\"}"}}]},"finish_reason":"tool_calls"}]}

',
        'data: [DONE]

',
      ];
      fetch.mockResolvedValueOnce(createMockStream(chunks));

      const onToolUse = vi.fn();
      await groqService.streamConversation({ messages: [] }, { onToolUse });
      expect(onToolUse).toHaveBeenCalled();
    });

    it('throws on non-ok response', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'unauthorized' });
      await expect(groqService.streamConversation({ messages: [] }, {})).rejects.toThrow();
    });

    it('throws when no response body', async () => {
      fetch.mockResolvedValueOnce({ ok: true, status: 200, body: null, text: async () => '' });
      await expect(groqService.streamConversation({ messages: [] }, {})).rejects.toThrow();
    });
  });
});
