/**
 * App Configuration
 * Centralized configuration loaded from environment variables with sensible defaults
 */

const AppConfig = {
  api: {
    defaultModel: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    maxTokens: parseInt(process.env.MAX_TOKENS || '1024', 10),
    defaultPromptType: process.env.DEFAULT_PROMPT_TYPE || 'standardAssistant',
  },
  llm: {
    maxLlmTurns: Number(process.env.MAX_LLM_TURNS || 3),
    maxToolCalls: Number(process.env.MAX_TOOL_CALLS || 8),
  },
  tools: {
    productSearchName: 'search_shop_catalog',
    maxProductsToDisplay: parseInt(process.env.MAX_PRODUCTS_TO_DISPLAY || '3', 10),
  },
  errorMessages: {
    missingMessage: 'Message is required',
    apiUnsupported: 'This API endpoint only supports chat requests',
    apiKeyError: 'API key is required',
  },
};

export default AppConfig;
