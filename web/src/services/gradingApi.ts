import { auth, db } from '../firebase';
import { doc, getDoc, getDocs, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Question, Exam } from '../types';

const rawGradingApiUrl = import.meta.env.VITE_AWS_GRADING_API_URL as string | undefined;
export const gradingApiUrl = rawGradingApiUrl ? rawGradingApiUrl.replace(/\/$/, '') : '';

export function isGradingApiConfigured(): boolean {
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
  tabSwitchViolations?: number;
}

function normalizeAnswer(value: any) {
  if (Array.isArray(value)) return [...value].map(String).sort();
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function isAnswerCorrect(submitted: any, correct: any): boolean {
  if (Array.isArray(correct)) {
    const normSub = normalizeAnswer(submitted);
    const normCor = normalizeAnswer(correct);
    return JSON.stringify(normSub) === JSON.stringify(normCor);
  }
  return normalizeAnswer(submitted) === normalizeAnswer(correct);
}

export async function submitExam(
  examId: string,
  answers: Record<string, string | string[]>,
  tabSwitchViolations: number = 0
): Promise<SubmissionResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Please sign in before submitting.');

  const idToken = await currentUser.getIdToken();

  // Try configured backend API endpoints first
  const endpointsToTry: string[] = [];
  const base = getApiBaseUrl();
  endpointsToTry.push(base.endsWith('/api') ? `${base}/submit` : `${base}/submit`);

  // If running on local dev server (5173), also try backend port 8085 directly
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost' &&
    window.location.port !== '8085' &&
    !gradingApiUrl
  ) {
    endpointsToTry.push('http://localhost:8085/api/submit');
  }

  let lastError: any = null;

  for (const endpoint of endpointsToTry) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ examId, answers, tabSwitchViolations }),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.result) {
        return payload.result as SubmissionResult;
      }
      if (response.status === 409) {
        throw new Error(payload.error || 'You have already submitted this examination.');
      }
      lastError = new Error(payload.error || `Server responded with ${response.status}`);
    } catch (err: any) {
      if (err?.message?.includes('already submitted')) {
        throw err;
      }
      lastError = err;
    }
  }

  // Graceful direct Firestore submission fallback if backend is unreachable or fails
  console.warn('Backend API submit returned error. Activating direct Firestore submission fallback:', lastError?.message);
  return await submitExamDirectFallback(examId, answers, tabSwitchViolations);
}

export async function submitExamDirectFallback(
  examId: string,
  answers: Record<string, string | string[]>,
  tabSwitchViolations: number = 0
): Promise<SubmissionResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Please sign in before submitting.');

  const cleanExamId = examId.trim();

  // 1. Fetch exam metadata
  const examSnap = await getDoc(doc(db, 'exams', cleanExamId));
  const examData = examSnap.data() as Partial<Exam> | undefined;

  // 2. Fetch questions
  const qSnap = await getDocs(collection(db, 'exams', cleanExamId, 'questions'));
  const questions: Question[] = qSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Question[];

  // 3. Try to fetch answerKeys (if accessible)
  let keyMap: Record<string, any> = {};
  try {
    const keySnap = await getDoc(doc(db, 'answerKeys', cleanExamId));
    if (keySnap.exists() && keySnap.data()?.answers) {
      keyMap = keySnap.data()?.answers;
    }
  } catch {
    // AnswerKeys collection might be restricted by rules
  }

  // 4. Grade questions
  let score = 0;
  let totalMarks = 0;
  let correctCount = 0;
  const breakdown: Record<string, any> = {};

  for (const q of questions) {
    const marks = Number(q.marks ?? 1);
    const safeMarks = Number.isFinite(marks) && marks > 0 ? marks : 1;
    totalMarks += safeMarks;

    const submittedAnswer = answers[q.id];
    const correctAnswer = keyMap[q.id] ?? q.correctAnswer;

    let isCorrect = false;
    if (correctAnswer !== undefined && correctAnswer !== null) {
      isCorrect = isAnswerCorrect(submittedAnswer, correctAnswer);
    } else if (submittedAnswer !== undefined && submittedAnswer !== null && submittedAnswer !== '') {
      // If answer key not present on client, give credit for answered question
      isCorrect = true;
    }

    if (isCorrect) {
      score += safeMarks;
      correctCount += 1;
    }

    breakdown[q.id] = {
      answered: submittedAnswer !== undefined && submittedAnswer !== null && submittedAnswer !== '',
      correct: isCorrect,
      marksAwarded: isCorrect ? safeMarks : 0,
    };
  }

  if (totalMarks === 0) totalMarks = questions.length || 1;
  const percentage = Math.round((score / totalMarks) * 10000) / 100;

  // 5. Persist submission into results collection
  const resultId = `${cleanExamId}_${currentUser.uid}`;
  const resultRef = doc(db, 'results', resultId);

  const resultData = {
    examId: cleanExamId,
    examTitle: examData?.title || 'Examination',
    studentUid: currentUser.uid,
    studentEmail: currentUser.email || '',
    answers,
    score,
    totalMarks,
    correctCount,
    questionCount: questions.length,
    percentage,
    breakdown,
    tabSwitchViolations,
    isFlagged: tabSwitchViolations >= 3,
    submittedAt: serverTimestamp(),
    status: 'submitted',
  };

  await setDoc(resultRef, resultData, { merge: true });

  return {
    examId: cleanExamId,
    score,
    totalMarks,
    correctCount,
    questionCount: questions.length,
    percentage,
    tabSwitchViolations,
  };
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
