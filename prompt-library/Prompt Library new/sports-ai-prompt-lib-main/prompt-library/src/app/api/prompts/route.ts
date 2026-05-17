import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Prompt } from '@/lib/types';

let promptsCache: Prompt[] | null = null;

export async function GET() {
  if (!promptsCache) {
    const filePath = path.join(process.cwd(), 'public', 'prompt_library.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    promptsCache = JSON.parse(raw);
  }
  return NextResponse.json(promptsCache);
}
