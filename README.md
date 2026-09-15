# Build an AI Agent for Your Storefront

A Shopify template app that lets you embed an AI-powered chat widget on your storefront. Shoppers can search for products, ask about policies or shipping, and complete purchases - all without leaving the conversation. Under the hood it speaks the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) to tap into Shopify’s APIs.

## Overview

- **What it is**: ...

## Developer Docs
- Everything from installation to deep dives lives on https://shopify.dev/docs/apps/build/storefront-mcp.
- Clone this repo and follow the instructions on the dev docs.

## Examples
- `hi` > will return a LLM based response. ...

## Architecture

### Components
... (rest of original content unchanged) ...

## MCP Tools Integration
- The backend already initializes all Shopify MCP tools—see [`app/mcp-client.js`](./app/mcp-client.js).
- These tools let your LLM invoke product search, cart actions, order lookups, etc.
- More in our [dev docs](https://shopify.dev/docs/apps/build/storefront-mcp).

## API Endpoints

### GET `/api/tools`

Returns a JSON object containing the list of available MCP tools for the current conversation.

**Query Parameters**
- `type` (optional): `storefront`, `customer`, or `all` (default). Determines which set of tools to return.
- `conversationId` (optional, required for customer tools): Identifier of the conversation to fetch customer tokens.

**Response**
```json
{
  "tools": [
    {
      "name": "search_shop_catalog",
      "description": "Search the shop catalog",
      "parameters": { ... }
    },
    {
      "name": "get_cart",
      "description": "Retrieve the current cart",
      "auth_required": true,
      "parameters": { ... }
    }
  ]
}
```

- If a customer token is missing, the `auth_required` flag will be set on customer‑specific tools.
- Errors return a 500 status with an `error` field.

## Environment Variables
... (rest unchanged) ...

## Customizations
... (rest unchanged) ...

## Deployment
... (rest unchanged) ...

## Contributing
... (rest unchanged)