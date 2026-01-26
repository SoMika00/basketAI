import AppConfig from "./config.server";
import systemPrompts from "../prompts/prompts.json";

export function createGroqService({
  apiKey = process.env.GROQ_API_KEY,
  model = process.env.LLM_MODEL || "llama-3.3-70b-versatile",
  baseUrl = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
} = {}) {
  if (!apiKey) {
    const error = new Error(AppConfig.errorMessages.apiKeyError);
    error.status = 401;
    throw error;
  }

  const getSystemPrompt = (promptType) => {
    return (
      systemPrompts.systemPrompts[promptType]?.content ||
      systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content
    );
  };

  const toOpenAiTools = (tools) => {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  };

  const normalizeToolResultContent = (content) => {
    if (typeof content === "string") return content;
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  };

  const toOpenAiMessages = (messages) => {
    const out = [];
    for (const msg of messages || []) {
      if (typeof msg.content === "string") {
        out.push({ role: msg.role, content: msg.content });
        continue;
      }

      if (!Array.isArray(msg.content)) {
        out.push({ role: msg.role, content: String(msg.content ?? "") });
        continue;
      }

      let text = "";
      const toolCalls = [];

      for (const block of msg.content) {
        if (!block) continue;
        if (block.type === "text" && typeof block.text === "string") {
          text += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {}),
            },
          });
        } else if (block.type === "tool_result") {
          out.push({
            role: "tool",
            tool_call_id: block.tool_use_id,
            content: normalizeToolResultContent(block.content),
          });
        }
      }

      if (msg.role === "assistant") {
        const assistantMsg = {
          role: "assistant",
          content: text.length > 0 ? text : null,
        };
        if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
        out.push(assistantMsg);
      } else {
        out.push({ role: msg.role, content: text });
      }
    }
    return out;
  };

  const streamConversation = async (
    { messages, promptType = AppConfig.api.defaultPromptType, tools },
    streamHandlers,
  ) => {
    const systemInstruction = getSystemPrompt(promptType);

    const openAiMessages = [
      { role: "system", content: systemInstruction },
      ...toOpenAiMessages(messages),
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: openAiMessages,
        tools: toOpenAiTools(tools),
        stream: true,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      const error = new Error(text || `Groq request failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    if (!response.body) {
      const error = new Error("Groq response has no body");
      error.status = 500;
      throw error;
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();

    let buffer = "";
    let accumulatedText = "";
    const toolCallsByIndex = new Map();
    let finishReason = null;

    const flushEvent = (dataLine) => {
      const payload = dataLine.replace(/^data:\s*/, "").trim();
      if (!payload || payload === "[DONE]") return;

      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }

      const choice = parsed.choices?.[0];
      if (!choice) return;

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }

      const delta = choice.delta || {};

      if (typeof delta.content === "string" && delta.content.length > 0) {
        accumulatedText += delta.content;
        if (streamHandlers?.onText) streamHandlers.onText(delta.content);
      }

      const toolCalls = delta.tool_calls;
      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          const idx = tc.index;
          if (idx === undefined || idx === null) continue;

          const prev = toolCallsByIndex.get(idx) || {
            id: tc.id,
            type: tc.type,
            function: { name: tc.function?.name, arguments: "" },
          };

          if (tc.id) prev.id = tc.id;
          if (tc.type) prev.type = tc.type;
          if (tc.function?.name) prev.function.name = tc.function.name;
          if (typeof tc.function?.arguments === "string") {
            prev.function.arguments += tc.function.arguments;
          }

          toolCallsByIndex.set(idx, prev);
        }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const lines = part.split("\n");
        for (const line of lines) {
          if (line.startsWith("data:")) flushEvent(line);
        }
      }
    }

    const toolCalls = Array.from(toolCallsByIndex.values());

    const contentBlocks = [];
    if (accumulatedText.length > 0) {
      contentBlocks.push({ type: "text", text: accumulatedText });
    }

    for (const tc of toolCalls) {
      let input = {};
      const args = tc.function?.arguments;
      if (typeof args === "string" && args.trim().length > 0) {
        try {
          input = JSON.parse(args);
        } catch {
          input = {};
        }
      }

      contentBlocks.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function?.name,
        input,
      });
    }

    const finalMessage = {
      role: "assistant",
      content: contentBlocks,
      stop_reason: finishReason === "stop" ? "end_turn" : finishReason,
    };

    if (streamHandlers?.onMessage) {
      streamHandlers.onMessage(finalMessage);
    }

    if (streamHandlers?.onToolUse && toolCalls.length > 0) {
      for (const block of contentBlocks) {
        if (block.type === "tool_use") {
          await streamHandlers.onToolUse(block);
        }
      }
    }

    return finalMessage;
  };

  return {
    streamConversation,
    getSystemPrompt,
  };
}

export default {
  createGroqService,
};
