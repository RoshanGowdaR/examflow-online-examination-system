import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Exam, Question, UserRole } from '../types';
import { isGradingApiConfigured, publishExamViaApi } from './gradingApi';

export async function getExams(role: UserRole, _currentUid?: string): Promise<Exam[]> {
  const examsRef = collection(db, 'exams');
  let snapshot;

  if (role === 'student') {
    // Students can ONLY read published exams per firestore.rules
    const q = query(examsRef, where('status', '==', 'published'));
    snapshot = await getDocs(q);
  } else {
    // Faculty / Admin can read all exams
    snapshot = await getDocs(examsRef);
  }

  const exams: Exam[] = [];
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    
    // Format timestamps safely
    let startsAtIso = '';
    let endsAtIso = '';
    if (data.startsAt?.toDate) {
      startsAtIso = data.startsAt.toDate().toISOString();
    } else if (data.startsAt) {
      startsAtIso = new Date(data.startsAt).toISOString();
    }
    if (data.endsAt?.toDate) {
      endsAtIso = data.endsAt.toDate().toISOString();
    } else if (data.endsAt) {
      endsAtIso = new Date(data.endsAt).toISOString();
    }

    exams.push({
      id: docSnap.id,
      title: data.title || 'Untitled Exam',
      description: data.description || '',
      courseId: data.courseId || '',
      courseName: data.courseName || '',
      durationMinutes: Number(data.durationMinutes || 30),
      totalMarks: Number(data.totalMarks || 0),
      status: data.status || 'draft',
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      createdBy: data.createdBy || '',
      createdAt: data.createdAt,
    });
  }

  // Sort exams by startsAt descending
  return exams.sort((a, b) => new Date(b.startsAt || 0).getTime() - new Date(a.startsAt || 0).getTime());
}

export async function getExamById(examId: string): Promise<Exam | null> {
  const examRef = doc(db, 'exams', examId);
  const snap = await getDoc(examRef);
  if (!snap.exists()) return null;
  const data = snap.data();

  return {
    id: snap.id,
    title: data.title || 'Untitled Exam',
    description: data.description || '',
    courseId: data.courseId || '',
    courseName: data.courseName || '',
    durationMinutes: Number(data.durationMinutes || 30),
    totalMarks: Number(data.totalMarks || 0),
    status: data.status || 'draft',
    startsAt: data.startsAt?.toDate ? data.startsAt.toDate().toISOString() : new Date(data.startsAt).toISOString(),
    endsAt: data.endsAt?.toDate ? data.endsAt.toDate().toISOString() : new Date(data.endsAt).toISOString(),
    createdBy: data.createdBy || '',
    createdAt: data.createdAt,
  };
}

export async function getQuestionsForExam(examId: string): Promise<Question[]> {
  const qCol = collection(db, 'exams', examId, 'questions');
  const snap = await getDocs(qCol);
  const questions: Question[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      text: data.text || '',
      type: data.type || 'single',
      options: Array.isArray(data.options) ? data.options : [],
      marks: Number(data.marks ?? 1),
      order: Number(data.order ?? 1),
    };
  });
  return questions.sort((a, b) => a.order - b.order);
}

export async function saveDraftExam(
  examData: Omit<Exam, 'id' | 'status'>,
  questions: Question[],
  existingExamId?: string
): Promise<string> {
  let examRef;
  if (existingExamId) {
    examRef = doc(db, 'exams', existingExamId);
  } else {
    examRef = doc(collection(db, 'exams'));
  }

  const calculatedTotalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);

  const payload = {
    title: examData.title.trim(),
    description: examData.description.trim(),
    courseId: examData.courseId,
    courseName: examData.courseName || '',
    durationMinutes: Number(examData.durationMinutes) || 30,
    totalMarks: calculatedTotalMarks,
    status: 'draft',
    startsAt: examData.startsAt ? new Date(examData.startsAt) : serverTimestamp(),
    endsAt: examData.endsAt ? new Date(examData.endsAt) : serverTimestamp(),
    createdBy: examData.createdBy,
    updatedAt: serverTimestamp(),
  };

  await setDoc(examRef, payload, { merge: true });
  const examId = examRef.id;

  // Save questions into subcollection
  const batch = writeBatch(db);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qId = q.id && !q.id.startsWith('temp_') ? q.id : `q_${i + 1}`;
    const qRef = doc(db, 'exams', examId, 'questions', qId);
    batch.set(qRef, {
      id: qId,
      text: q.text,
      type: q.type,
      options: q.options,
      marks: Number(q.marks) || 1,
      order: i + 1,
    });
  }
  await batch.commit();

  return examId;
}

export async function publishExam(
  examData: Omit<Exam, 'id' | 'status'>,
  questions: Question[],
  existingExamId?: string
): Promise<{ examId: string; message: string }> {
  // If AWS Lambda grading API is available, publish through the trusted backend
  if (isGradingApiConfigured()) {
    return await publishExamViaApi(examData, questions, existingExamId);
  }

  // Fallback for development if AWS API is not yet live:
  // Save exam and questions directly to Firestore. Note that answerKeys
  // collection is blocked by Firestore rules for client writes, so a warning is logged.
  const examId = await saveDraftExam(examData, questions, existingExamId);
  const examRef = doc(db, 'exams', examId);
  await setDoc(examRef, { status: 'published', updatedAt: serverTimestamp() }, { merge: true });

  return {
    examId,
    message: 'Exam published in Firestore directly. (Note: Deploy AWS Lambda with POST /publish to secure the server-only answer key).',
  };
}

export async function deleteExam(examId: string): Promise<void> {
  // Delete subcollection questions
  const qCol = collection(db, 'exams', examId, 'questions');
  const snap = await getDocs(qCol);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  // Delete exam doc
  await deleteDoc(doc(db, 'exams', examId));
}
