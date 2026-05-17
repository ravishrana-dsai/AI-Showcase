import { Submission } from './types';

export function generateSubmissionId(existingSubmissions: Submission[]): string {
  const prefix = 'SUB';
  const existingNums = existingSubmissions
    .map(s => s.prompt_id)
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.split('-')[1], 10))
    .filter(n => !isNaN(n));

  const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
  return `${prefix}-${String(nextNum).padStart(3, '0')}`;
}
