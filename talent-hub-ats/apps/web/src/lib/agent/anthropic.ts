import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, StreamParams, ToolDefinition } from "./provider";

const MODEL = "claude-sonnet-4-6";

function toAnthropicTool(t: ToolDefinition): Anthropic.Tool {
  return {
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
  };
}

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async stream({ system, userMessage, tools, onToolCall, onText }: StreamParams): Promise<void> {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    // Agentic loop: keep going until Claude has no more tool calls
    while (true) {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system,
        messages,
        tools: tools?.map(toAnthropicTool),
        stream: false,
      });

      // Stream text blocks to caller
      for (const block of response.content) {
        if (block.type === "text") {
          onText(block.text);
        }
      }

      if (response.stop_reason === "end_turn") {
        break;
      }

      if (response.stop_reason !== "tool_use") {
        break;
      }

      // Execute tool calls and collect results
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await onToolCall(toolUse.name, toolUse.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: "user", content: toolResults });
    }
  }
}
