import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Submission } from '@/lib/types';
import { validateSubmission } from '@/lib/validation';
import { generateSubmissionId } from '@/lib/idGenerator';

const SUBMISSIONS_PATH = path.join(process.cwd(), 'data', 'submissions.json');

async function readSubmissions(): Promise<Submission[]> {
  try {
    const raw = await fs.readFile(SUBMISSIONS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeSubmissions(submissions: Submission[]): Promise<void> {
  await fs.mkdir(path.dirname(SUBMISSIONS_PATH), { recursive: true });
  await fs.writeFile(SUBMISSIONS_PATH, JSON.stringify(submissions, null, 2), 'utf-8');
}

export async function GET() {
  const submissions = await readSubmissions();
  return NextResponse.json(submissions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const errors = validateSubmission(body);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const submissions = await readSubmissions();

  const newSubmission: Submission = {
    prompt_id: generateSubmissionId(submissions),
    title: body.title,
    primary_use_case: body.primary_use_case,
    secondary_use_cases: body.secondary_use_cases || [],
    user_role: body.user_role,
    industry: body.industry,
    category: body.category,
    complexity: body.complexity,
    supported_llms: body.supported_llms,
    output_type: body.output_type,
    prompt_text: body.prompt_text,
    variations: body.variations,
    tips: body.tips,
    submitted_at: new Date().toISOString(),
    status: 'pending',
  };

  submissions.push(newSubmission);
  await writeSubmissions(submissions);

  return NextResponse.json(newSubmission, { status: 201 });
}
