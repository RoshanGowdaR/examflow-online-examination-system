import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { ExamResult } from '../types';

export async function getStudentResults(studentUid: string): Promise<ExamResult[]> {
  const resultsRef = collection(db, 'results');
  const q = query(resultsRef, where('studentUid', '==', studentUid));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      examId: data.examId || '',
      examTitle: data.examTitle || 'Examination',
      studentUid: data.studentUid || '',
      studentEmail: data.studentEmail || '',
      score: Number(data.score ?? 0),
      totalMarks: Number(data.totalMarks ?? 0),
      correctCount: Number(data.correctCount ?? 0),
      questionCount: Number(data.questionCount ?? 0),
      percentage: Number(data.percentage ?? 0),
      submittedAt: data.submittedAt,
      status: 'submitted',
      breakdown: data.breakdown,
    };
  });
}

export async function getAllResults(): Promise<ExamResult[]> {
  const resultsRef = collection(db, 'results');
  const snapshot = await getDocs(resultsRef);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      examId: data.examId || '',
      examTitle: data.examTitle || 'Examination',
      studentUid: data.studentUid || '',
      studentEmail: data.studentEmail || '',
      score: Number(data.score ?? 0),
      totalMarks: Number(data.totalMarks ?? 0),
      correctCount: Number(data.correctCount ?? 0),
      questionCount: Number(data.questionCount ?? 0),
      percentage: Number(data.percentage ?? 0),
      submittedAt: data.submittedAt,
      status: 'submitted',
      breakdown: data.breakdown,
    };
  });
}

export async function getResultsForExam(examId: string): Promise<ExamResult[]> {
  const resultsRef = collection(db, 'results');
  const q = query(resultsRef, where('examId', '==', examId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      examId: data.examId || '',
      examTitle: data.examTitle || 'Examination',
      studentUid: data.studentUid || '',
      studentEmail: data.studentEmail || '',
      score: Number(data.score ?? 0),
      totalMarks: Number(data.totalMarks ?? 0),
      correctCount: Number(data.correctCount ?? 0),
      questionCount: Number(data.questionCount ?? 0),
      percentage: Number(data.percentage ?? 0),
      submittedAt: data.submittedAt,
      status: 'submitted',
      breakdown: data.breakdown,
    };
  });
}

