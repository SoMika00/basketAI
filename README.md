# Build an AI Agent for Your Storefront

A Shopify template app that lets you embed an AI-powered chat widget on your storefront. Shoppers can search for products, ask about policies or shipping, and complete purchases - all without leaving the conversation. Under the hood it speaks the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) to tap into Shopify’s APIs.

## Overview

- **What**: ...

## Developer Docs
- Everything from installation to deep dives lives on https://shopify.dev/docs/apps/build/storefront-mcp.
- Clone this repo and follow the instructions on the dev docs.

## Examples
- `hi` > will return a LLM based response. ...

## Architecture

### Components
... (rest of original content unchanged)

## MCP Tools Integration
- The backend already initializes all Shopify MCP tools—see [`app/mcp-client.js`](./app/mcp-client.js).
- These tools let your LLM invoke product search, cart actions, order lookups, etc.
- More in our [dev docs](https://shopify.dev/docs/apps/build/storefront-mcp).

## API Endpoints

### GET `/api/rate-limit`

Returns the current chat rate-limit status for a conversation or client IP without consuming a rate-limit slot.

**Query Parameters**
- `conversationId` (optional): Identifier of the conversation. When provided, the key is `conversation:<id>`. When omitted, the key is derived from `X-Forwarded-For` / `X-Real-IP` / `CF-Connecting-IP` headers, falling back to `ip:unknown`.

**Response**
```json
{
  "key": "conversation:123",
  "count": 5,
  "max": 20,
  "window_ms": 60000,
  "remaining": 15,
  "retry_after_seconds": 0
}
```
- `retry_after_seconds` is `0` when `remaining > 0`, otherwise it is the number of seconds until the next slot frees up.
- Errors return a 500 status with an `error` field.
- `OPTIONS` preflight returns `204` with CORS headers allowing `GET`.

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

### GET `/api/conversation/:conversationId`

Returns a summary of the specified conversation.

**Response**
```json
{
  "conversation_id": "123",
  "message_count": 42,
  "last_message_at": "2023-01-01T12:34:56.789Z",
  "token_status": "authorized"
}
```
- `token_status` is either `authorized` (customer token exists) or `unauthorized`.
- Errors return a 400 for missing/invalid `conversationId` or 500 for server errors.

### DELETE `/api/conversation/:conversationId`

Clears a conversation's stored history server-side. Deletes the `Conversation` row (cascading to its `Message` rows) and any associated `CustomerToken` and `CustomerAccountUrls` rows for that conversation.

**Response**
```json
{
  "conversation_id": "123",
  "deleted": true,
  "messages_deleted": 42
}
```
- Deleting a conversation that does not exist returns `200` with `deleted: false` and `messages_deleted: 0` (idempotent).
- Missing `conversationId` returns a `400` with an `error` field.
- Server errors return a `500` with an `error` field.
- `OPTIONS` preflight returns `204` with CORS headers allowing `DELETE`.

### GET `/api/openapi.json`

Provides the OpenAPI 3.0 specification for the API.

[View OpenAPI spec](./api.openapi.json)

## Environment Variables
... (rest unchanged) ...
