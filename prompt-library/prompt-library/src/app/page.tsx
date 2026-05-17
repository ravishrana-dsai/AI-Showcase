import { promises as fs } from 'fs';
import path from 'path';
import { Prompt } from '@/lib/types';
import ClientPage from '@/components/ClientPage';

export default async function HomePage() {
  const filePath = path.join(process.cwd(), 'public', 'prompt_library.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const prompts: Prompt[] = JSON.parse(raw);

  return <ClientPage initialPrompts={prompts} />;
}
