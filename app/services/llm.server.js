import { createClaudeService } from "./claude.server";
import { createGroqService } from "./groq.server";

export function createLlmService() {
  const provider =
    process.env.LLM_PROVIDER || (process.env.GROQ_API_KEY ? "groq" : "anthropic");

  if (provider === "groq") {
    return createGroqService();
  }

  return createClaudeService();
}

export default {
  createLlmService,
};
