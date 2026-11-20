import { auth } from '../firebase';
import type { Question, Exam } from '../types';

const rawGradingApiUrl = import.meta.env.VITE_AWS_GRADING_API_URL as string | undefined;
export const gradingApiUrl = rawGradingApiUrl ? rawGradingApiUrl.replace(/\/$/, '') : '';

export function isGradingApiConfigured(): boolean {
  // True if external URL is provided, or in same-origin environment (Render / Docker)
  return true;
}

export function getApiBaseUrl(): string {
  if (gradingApiUrl && gradingApiUrl.trim().length > 0) {
    return gradingApiUrl;
  }
  return '/api';
}

export interface SubmissionResult {
  examId: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  questionCount: number;
  percentage: number;
}

export async function submitExam(examId: string, answers: Record<string, string | string[]>): Promise<SubmissionResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Please sign in before submitting.');

  const base = getApiBaseUrl();
  const idToken = await currentUser.getIdToken();
  const endpoint = base.endsWith('/api') ? `${base}/submit` : `${base}/submit`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ examId, answers }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Submission failed with status code ${response.status}`);
  }
  return payload.result as SubmissionResult;
}

export async function publishExamViaApi(
  exam: Partial<Exam>,
  questions: Question[],
  examId?: string
): Promise<{ examId: string; message: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Please sign in before publishing.');

  const base = getApiBaseUrl();
  const idToken = await currentUser.getIdToken();
  const endpoint = base.endsWith('/api') ? `${base}/publish` : `${base}/publish`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ examId, exam, questions }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Publishing failed with status code ${response.status}`);
  }
  return { examId: payload.examId, message: payload.message };
}
