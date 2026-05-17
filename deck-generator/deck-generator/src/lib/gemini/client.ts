import { GoogleGenAI } from '@google/genai';

export const ANALYSIS_MODEL = 'gemini-2.0-flash';
export const CONTENT_MODEL = 'gemini-2.0-flash';

let _genai: GoogleGenAI | null = null;

/**
 * Lazily initializes and returns the GoogleGenAI client.
 * Avoids crashing at module load time when GEMINI_API_KEY is not set (e.g. during build).
 */
export function getGenAI(): GoogleGenAI {
  if (!_genai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is not set. Please add it to .env.local'
      );
    }
    _genai = new GoogleGenAI({ apiKey });
  }
  return _genai;
}

// Keep backward compatibility
export const genai = {
  get models() {
    return getGenAI().models;
  },
};
