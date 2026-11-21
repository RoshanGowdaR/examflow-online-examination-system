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

  // Try trusted server route first
  try {
    const res = await fetch(`${base}/ai/generate-exam`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        questions: data.questions as Question[],
        count: data.count || data.questions?.length || 0,
        message: data.message || 'Questions generated successfully.',
      };
    }

    const errData = await res.json().catch(() => ({}));
    console.warn(`[ExamFlow AI] Backend endpoint returned status ${res.status}:`, errData.error || res.statusText);
  } catch (err: any) {
    console.warn('[ExamFlow AI] Backend AI service error, switching to direct client-side Gemini call:', err?.message);
  }

  // Client-side Gemini fallback
  const runtimeConfig = typeof window !== 'undefined' ? (window as any).__EXAMFLOW_CONFIG__ : null;
  const apiKey =
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    runtimeConfig?.geminiApiKey ||
    '';
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Gemini API key is not configured. Please supply VITE_GEMINI_API_KEY.');
  }

  const safeCount = Math.min(Math.max(Number(payload.questionCount) || 5, 1), 30);
  const safeMarks = Number(payload.marksPerQuestion) > 0 ? Number(payload.marksPerQuestion) : 2;

  const systemPrompt = `You are an expert examination creator and university educator.
Generate an academic assessment question paper as a structured JSON object.

RULES:
1. Return ONLY valid, parseable JSON matching the requested schema. No markdown backticks or commentary.
2. Generate exactly ${safeCount} questions.
3. Subject: "${payload.subject}". Topics: "${payload.topics || payload.subject}".
4. Difficulty: ${payload.difficulty}.
5. Allowed types: ${JSON.stringify(payload.questionTypes || ['single'])}.
6. For each question:
   - "type": "single" (4 options A, B, C, D) or "boolean" (True/False)
   - "text": question prompt
   - "options": [{ "id": "A", "text": "..." }, ...]
   - "correctAnswer": exact option ID
   - "marks": ${safeMarks}
   - "difficulty": "${payload.difficulty}"
   - "explanation": concise reason

JSON format:
{
  "questions": [
    {
      "type": "single",
      "text": "...",
      "options": [{ "id": "A", "text": "..." }, { "id": "B", "text": "..." }, { "id": "C", "text": "..." }, { "id": "D", "text": "..." }],
      "correctAnswer": "A",
      "marks": ${safeMarks},
      "difficulty": "${payload.difficulty}",
      "explanation": "..."
    }
  ]
}`;

  const candidateModels = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ];

  let geminiRes: Response | null = null;
  let lastErrText = '';

  for (const model of candidateModels) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
    try {
      const resp = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      });

      if (resp.ok) {
        geminiRes = resp;
        break;
      } else {
        lastErrText = await resp.text();
        console.warn(`[ExamFlow AI] Client model ${model} returned ${resp.status}:`, lastErrText);
      }
    } catch (fErr: any) {
      lastErrText = fErr?.message || String(fErr);
    }
  }

  if (!geminiRes) {
    throw new Error(`Gemini AI service error. Details: ${lastErrText || 'All models failed.'}`);
  }

  const geminiData = await geminiRes.json();
  const rawContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawContent) throw new Error('Empty response from Gemini AI.');

  const cleanJson = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const parsed = JSON.parse(cleanJson);
  const rawList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.questions) ? parsed.questions : []);

  const questions: Question[] = rawList.map((q: any, idx: number) => ({
    id: `ai_${Date.now()}_${idx + 1}`,
    text: q.text || `Question ${idx + 1}`,
    type: q.type === 'boolean' ? 'boolean' : 'single',
    options: Array.isArray(q.options) ? q.options : [],
    correctAnswer: q.correctAnswer || (q.type === 'boolean' ? 'true' : 'A'),
    marks: Number(q.marks) || safeMarks,
    order: idx + 1,
    difficulty: q.difficulty || payload.difficulty,
    explanation: q.explanation || '',
  }));

  return {
    questions,
    count: questions.length,
    message: `Generated ${questions.length} questions successfully with Gemini AI.`,
  };
}
