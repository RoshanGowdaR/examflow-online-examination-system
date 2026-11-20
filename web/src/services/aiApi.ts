import { auth } from '../firebase';
import type { Question, AiGenerateExamPayload } from '../types';
import { getApiBaseUrl } from './gradingApi';

export async function generateExamQuestionsWithAi(
  payload: AiGenerateExamPayload
): Promise<{ questions: Question[]; count: number; message: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Please sign in before using AI assessment generation.');

  const base = getApiBaseUrl();
  const idToken = await currentUser.getIdToken();
  const res = await fetch(`${base}/ai/generate-exam`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.code === 'AI_NOT_CONFIGURED') {
      throw new Error(
        'Gemini AI is not configured on the backend. Please add GEMINI_API_KEY to your AWS Lambda environment variables.'
      );
    }
    throw new Error(data.error || `AI generation failed with status code ${res.status}`);
  }

  return {
    questions: data.questions as Question[],
    count: data.count || data.questions?.length || 0,
    message: data.message || 'Questions generated successfully.',
  };
}

