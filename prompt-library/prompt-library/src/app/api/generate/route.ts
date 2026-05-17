import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `You are a world-class prompt engineer with deep expertise in LLM behavior, instruction design, and output optimization. The user will describe a task they want to accomplish using an AI/LLM. Your job is to generate the single best, most comprehensive prompt they can use to get outstanding results.

You will also receive context about the top matching prompts from our library. Use them as inspiration and incorporate their best techniques, but create something uniquely tailored to the user's specific task.

IMPORTANT: The generated prompt is plain text that a human will copy-paste into an AI chat. It must NOT contain any JSON, code syntax, curly braces, or data format references. Write it as natural, well-formatted plain text using line breaks, dashes, and numbered lists for structure.

The generated prompt MUST follow this structure and quality bar:

1. Role & Context: Start by assigning the AI a specific expert role/persona relevant to the task (e.g. "You are a senior marketing strategist with 15 years of experience...").

2. Task Definition: Clearly state the objective in 1-2 sentences. Be precise about what the output should achieve.

3. Detailed Instructions: Break the task into numbered steps or bullet points. Each step should be specific and actionable. Include:
   - What to cover and in what order
   - Specific angles, perspectives, or frameworks to use
   - Any research or reasoning the AI should do before responding

4. Constraints & Guidelines: Add clear boundaries:
   - Tone and style (e.g. professional, conversational, technical)
   - Length or depth expectations
   - What to avoid (common pitfalls, generic content, etc.)
   - Target audience

5. Output Format: Specify exactly how the response should be structured:
   - Use formatting directives (headers, bullet points, numbered lists, tables, etc.)
   - Define sections if applicable

6. Quality Enhancers: Add at least 2-3 of these techniques:
   - Chain-of-thought: "Think step by step before writing"
   - Self-review: "Review your output for accuracy and completeness before finalizing"
   - Specificity anchors: Include concrete examples, numbers, or scenarios
   - Iterative refinement: "First create an outline, then expand each section"

The prompt should be:
- 150-400 words (substantial but focused)
- Immediately copy-paste usable with no placeholders the user needs to fill (infer specifics from their task description)
- Written in second person addressing the AI ("You are...", "Your task is...")
- Professional and precise in language
- Plain text only — NO JSON, NO code blocks, NO curly braces, NO markup syntax`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'PASTE_YOUR_KEY_HERE') {
      return NextResponse.json(
        { error: 'Gemini API key not configured. Add your key to .env.local' },
        { status: 500 }
      );
    }

    const { task, libraryContext } = await request.json();

    if (!task || typeof task !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "task" field' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const librarySection = libraryContext?.length
      ? `\n\nHere are the top matching prompts from our library for reference:\n${libraryContext.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}`
      : '';

    const userMessage = `Task the user wants to accomplish:\n"${task}"${librarySection}\n\nGenerate a comprehensive, well-structured, expert-level prompt for this task. Follow all the structural requirements from your instructions — include role, context, detailed steps, constraints, output format, and quality enhancers. Remember: the prompt itself must be plain text, not JSON or code.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object' as const,
          properties: {
            generatedPrompt: {
              type: 'string' as const,
              description: 'The full prompt text as plain readable text with line breaks for structure. No JSON, no code syntax, no curly braces.',
            },
            explanation: {
              type: 'string' as const,
              description: 'A brief 2-3 sentence explanation of why this prompt is effective.',
            },
          },
          required: ['generatedPrompt', 'explanation'],
        },
        temperature: 0.6,
      },
    });

    const text = response.text ?? '';

    // Parse the JSON response from Gemini
    let parsed: { generatedPrompt: string; explanation: string };
    try {
      // Strip markdown code fences if Gemini wraps them despite instructions
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parsing fails, treat the whole response as the prompt
      parsed = {
        generatedPrompt: text.trim(),
        explanation: 'AI-generated prompt tailored to your task.',
      };
    }

    return NextResponse.json({
      generatedPrompt: parsed.generatedPrompt,
      explanation: parsed.explanation,
    });
  } catch (error: unknown) {
    console.error('Gemini API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate prompt: ${message}` },
      { status: 500 }
    );
  }
}
