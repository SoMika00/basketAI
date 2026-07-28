import { describe, it, expect, beforeEach, vi } from 'vitest';
import MCPClient from './mcp-client.js';

global.fetch = vi.fn();

function createMockResponse(result, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => 'error',
    json: async () => ({ jsonrpc: '2.0', id: 1, result }),
  };
}

describe('MCPClient', () => {
  let client;
  const hostUrl = 'https://test.myshopify.com';
  const conversationId = 'conv1';
  const shopId = 'shop1';

  beforeEach(() => {
    fetch.mockReset();
    client = new MCPClient(hostUrl, conversationId, shopId);
  });

  it('connectToStorefrontServer fetches tools/list and formats tools', async () => {
    const mockTools = [{ name: 'search', description: 'Search', inputSchema: {} }];
    fetch.mockResolvedValueOnce(createMockResponse({ tools: mockTools }));

    const tools = await client.connectToStorefrontServer();
    expect(fetch).toHaveBeenCalledWith(`${hostUrl}/api/mcp`, expect.objectContaining({ method: 'POST' }));
    expect(tools).toHaveLength(1);
    expect(client.storefrontTools).toHaveLength(1);
  });

  it('connectToCustomerServer fetches tools/list and formats tools', async () => {
    const mockTools = [{ name: 'customer_tool', description: 'Cust', inputSchema: {} }];
    fetch.mockResolvedValueOnce(createMockResponse({ tools: mockTools }));

    const tools = await client.connectToCustomerServer();
    expect(tools).toHaveLength(1);
    expect(client.customerTools).toHaveLength(1);
  });

  it('callTool dispatches to storefront', async () => {
    const mockTools = [{ name: 'sf_tool', description: '', inputSchema: {} }];
    fetch.mockResolvedValueOnce(createMockResponse({ tools: mockTools }));
    await client.connectToStorefrontServer();

    fetch.mockResolvedValueOnce(createMockResponse({ content: 'ok' }));
    const res = await client.callTool('sf_tool', {});
    expect(res).toEqual({ content: 'ok' });
  });

  it('callTool dispatches to customer', async () => {
    const mockTools = [{ name: 'cust_tool', description: '', inputSchema: {} }];
    fetch.mockResolvedValueOnce(createMockResponse({ tools: mockTools }));
    await client.connectToCustomerServer();

    fetch.mockResolvedValueOnce(createMockResponse({ content: 'cust' }));
    const res = await client.callTool('cust_tool', {});
    expect(res).toEqual({ content: 'cust' });
  });

  it('callCustomerTool returns auth_required on 401', async () => {
    const mockTools = [{ name: 'auth_tool', description: '', inputSchema: {} }];
    fetch.mockResolvedValueOnce(createMockResponse({ tools: mockTools }));
    await client.connectToCustomerServer();

    const err = new Error('Unauthorized');
    err.status = 401;
    fetch.mockRejectedValueOnce(err);

    // mock generateAuthUrl indirectly by expecting shape (it will fail but we catch 401 path)
    const res = await client.callTool('auth_tool', {});
    expect(res).toEqual({
      error: { type: 'auth_required', data: expect.stringContaining('authorize') }
    });
  });

  it('throws on unknown tool', async () => {
    await expect(client.callTool('unknown', {})).rejects.toThrow('Tool unknown not found');
  });
});
