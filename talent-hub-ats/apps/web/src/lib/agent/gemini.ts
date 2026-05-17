import {
  GoogleGenerativeAI,
  FunctionDeclaration,
  Part,
  Content,
  FunctionCall,
} from "@google/generative-ai";
import type { LLMProvider, StreamParams, ToolDefinition } from "./provider";

const MODEL = "gemini-2.5-pro";

function toGeminiFn(t: ToolDefinition): FunctionDeclaration {
  return {
    name: t.name,
    description: t.description,
    parameters: t.inputSchema as FunctionDeclaration["parameters"],
  };
}

export class GeminiProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? "");
  }

  async stream({ system, userMessage, tools, onToolCall, onText }: StreamParams): Promise<void> {
    const model = this.genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: system,
      tools: tools
        ? [{ functionDeclarations: tools.map(toGeminiFn) }]
        : undefined,
    });

    const history: Content[] = [];
    let currentMessage = userMessage;

    // Agentic loop
    while (true) {
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(currentMessage);
      const response = result.response;

      const candidate = response.candidates?.[0];
      if (!candidate) break;

      const parts = candidate.content.parts as Part[];

      // Collect text and function calls
      const textParts = parts.filter((p) => "text" in p && p.text);
      const fnCallParts = parts.filter(
        (p): p is Part & { functionCall: FunctionCall } => "functionCall" in p && !!p.functionCall
      );

      for (const p of textParts) {
        if ("text" in p) onText(p.text as string);
      }

      if (fnCallParts.length === 0) break;

      // Update history with model turn
      history.push({ role: "user", parts: [{ text: currentMessage }] });
      history.push({ role: "model", parts });

      // Execute tools and prepare function responses
      const fnResponses: Part[] = [];
      for (const p of fnCallParts) {
        const fc = p.functionCall;
        const result = await onToolCall(fc.name, fc.args);
        fnResponses.push({
          functionResponse: {
            name: fc.name,
            response: { output: JSON.stringify(result) },
          },
        });
      }

      // Next turn: send function responses
      history.push({ role: "user", parts: fnResponses });
      currentMessage = "";
    }
  }
}
