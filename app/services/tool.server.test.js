import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createToolService } from './tool.server.js';

vi.mock('../db.server.js', () => ({
  saveMessage: vi.fn().mockResolvedValue({ id: 'msg1' }),
}));

vi.mock('./config.server.js', () => ({
  default: {
    tools: {
      productSearchName: 'search_shop_catalog',
      maxProductsToDisplay: 3,
    },
    errorMessages: {},
  },
}));

import { saveMessage } from '../db.server.js';

 describe('createToolService', () => {
  let toolService;
  let conversationHistory;
  let productsToDisplay;
  const conversationId = 'conv1';

  beforeEach(() => {
    vi.clearAllMocks();
    toolService = createToolService();
    conversationHistory = [];
    productsToDisplay = [];
  });

  describe('handleToolError', () => {
    it('handles auth_required error and sends auth message', async () => {
      const toolUseResponse = { error: { type: 'auth_required', data: 'auth url' } };
      const sendMessage = vi.fn();

      await toolService.handleToolError(
        toolUseResponse,
        'some_tool',
        'tool1',
        conversationHistory,
        sendMessage,
        conversationId
      );

      expect(sendMessage).toHaveBeenCalledWith({ type: 'auth_required' });
      expect(saveMessage).toHaveBeenCalled();
      expect(conversationHistory).toHaveLength(1);
    });

    it('handles other errors and saves to history', async () => {
      const toolUseResponse = { error: { type: 'internal_error', data: 'err' } };
      const sendMessage = vi.fn();

      await toolService.handleToolError(
        toolUseResponse,
        'some_tool',
        'tool1',
        conversationHistory,
        sendMessage,
        conversationId
      );

      expect(saveMessage).toHaveBeenCalled();
      expect(conversationHistory).toHaveLength(1);
    });
  });

  describe('handleToolSuccess', () => {
    it('processes product search and updates productsToDisplay', async () => {
      const toolUseResponse = {
        content: [{ text: JSON.stringify({ products: [{ product_id: 'p1', title: 'Test', price_range: { currency: 'USD', min: 10 } }] }) }],
      };

      await toolService.handleToolSuccess(
        toolUseResponse,
        'search_shop_catalog',
        'tool1',
        conversationHistory,
        productsToDisplay,
        conversationId
      );

      expect(productsToDisplay).toHaveLength(1);
      expect(productsToDisplay[0]).toMatchObject({ id: 'p1', title: 'Test' });
      expect(saveMessage).toHaveBeenCalled();
      expect(conversationHistory).toHaveLength(1);
    });

    it('handles non-product tool success', async () => {
      const toolUseResponse = { content: 'ok' };

      await toolService.handleToolSuccess(
        toolUseResponse,
        'other_tool',
        'tool1',
        conversationHistory,
        productsToDisplay,
        conversationId
      );

      expect(productsToDisplay).toHaveLength(0);
      expect(saveMessage).toHaveBeenCalled();
    });
  });

  describe('processProductSearchResult', () => {
    it('parses and formats products correctly', () => {
      const toolUseResponse = {
        content: [{ text: JSON.stringify({ products: Array.from({ length: 5 }, (_, i) => ({ product_id: `p${i}`, title: `Prod${i}` })) }) }],
      };

      const products = toolService.processProductSearchResult(toolUseResponse);
      expect(products).toHaveLength(3); // max 3
      expect(products[0]).toHaveProperty('price');
    });

    it('returns empty on parse error', () => {
      const toolUseResponse = { content: [{ text: 'invalid' }] };
      const products = toolService.processProductSearchResult(toolUseResponse);
      expect(products).toEqual([]);
    });
  });

  describe('addToolResultToHistory', () => {
    it('adds tool result to history and saves to DB', async () => {
      await toolService.addToolResultToHistory(conversationHistory, 'tool1', 'result', conversationId);

      expect(conversationHistory).toHaveLength(1);
      expect(conversationHistory[0].content[0].type).toBe('tool_result');
      expect(saveMessage).toHaveBeenCalledWith(conversationId, 'user', expect.any(String));
    });
  });
});
