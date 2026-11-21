import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/healthz' && req.path !== '/api/healthz') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// -------------------------------------------------------------
// Firebase Admin SDK Initialization
// -------------------------------------------------------------
const FIREBASE_PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  'online-examamination';

// Ensure Google SDKs discover project ID
process.env.GOOGLE_CLOUD_PROJECT = FIREBASE_PROJECT_ID;
process.env.GCLOUD_PROJECT = FIREBASE_PROJECT_ID;

let firestore;
let adminApp;

function getDb() {
  if (firestore) return firestore;
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (rawServiceAccount && rawServiceAccount.trim()) {
    try {
      const serviceAccount = JSON.parse(rawServiceAccount);
      adminApp = admin.apps.length ? admin.app() : admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || FIREBASE_PROJECT_ID,
      });
    } catch (parseErr) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON', parseErr);
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON');
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    adminApp = admin.apps.length ? admin.app() : admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: FIREBASE_PROJECT_ID,
    });
  } else {
    // Standard initialization with explicit Project ID
    adminApp = admin.apps.length ? admin.app() : admin.initializeApp({
      projectId: FIREBASE_PROJECT_ID,
    });
  }

  firestore = admin.firestore(adminApp);
  return firestore;
}

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function normalize(value) {
  if (Array.isArray(value)) return [...value].map(String).sort();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function sameAnswer(submitted, correct) {
  return JSON.stringify(normalize(submitted)) === JSON.stringify(normalize(correct));
}

async function verifyToken(req, res) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Missing or invalid Firebase ID token in Authorization header' });
    return null;
  }
  try {
    getDb();
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded;
  } catch (err) {
    console.error('Token verification error', err?.code || err?.message);
    res.status(401).json({ error: 'Session expired or authentication token is invalid. Please sign in again.' });
    return null;
  }
}

// -------------------------------------------------------------
// Health Check Routes
// -------------------------------------------------------------
app.get(['/healthz', '/api/healthz'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'examflow-online-exam',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// -------------------------------------------------------------
// POST /api/publish (Faculty or Admin)
// -------------------------------------------------------------
const handlePublish = async (req, res) => {
  try {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    const db = getDb();
    const callerSnap = await db.collection('users').doc(decoded.uid).get();
    const caller = callerSnap.data();

    if (!callerSnap.exists || caller?.active !== true || !['faculty', 'admin'].includes(caller?.role)) {
      return res.status(403).json({ error: 'Only active faculty or admin accounts can publish examinations.' });
    }

    const { exam, questions } = req.body;
    let examId = typeof req.body.examId === 'string' && req.body.examId.trim() ? req.body.examId.trim() : null;

    if (!exam || typeof exam !== 'object') {
      return res.status(400).json({ error: 'Valid exam details are required.' });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'At least one question is required to publish an assessment.' });
    }

    const examRef = examId ? db.collection('exams').doc(examId) : db.collection('exams').doc();
    examId = examRef.id;

    let calculatedTotalMarks = 0;
    const answerKeyMap = {};
    const sanitizedQuestions = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qId = q.id || `q_${i + 1}`;
      const qMarks = Number(q.marks ?? 1);
      calculatedTotalMarks += qMarks > 0 ? qMarks : 1;

      if (q.correctAnswer === undefined || q.correctAnswer === null || q.correctAnswer === '') {
        return res.status(400).json({ error: `Missing correct answer for question ${i + 1}` });
      }

      answerKeyMap[qId] = q.correctAnswer;

      sanitizedQuestions.push({
        id: qId,
        text: String(q.text || ''),
        type: q.type || 'single',
        options: Array.isArray(q.options) ? q.options : [],
        marks: qMarks > 0 ? qMarks : 1,
        order: Number(q.order ?? i + 1),
        explanation: q.explanation || '',
      });
    }

    const examDocData = {
      title: String(exam.title || 'Untitled Examination'),
      description: String(exam.description || ''),
      courseId: String(exam.courseId || ''),
      courseName: String(exam.courseName || ''),
      durationMinutes: Number(exam.durationMinutes || 30),
      totalMarks: Number(exam.totalMarks || calculatedTotalMarks),
      status: 'published',
      startsAt: exam.startsAt ? new Date(exam.startsAt) : admin.firestore.FieldValue.serverTimestamp(),
      endsAt: exam.endsAt ? new Date(exam.endsAt) : new Date(Date.now() + 3600 * 1000 * 24),
      createdBy: decoded.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const batch = db.batch();
    batch.set(examRef, examDocData, { merge: true });

    // Store private answer key in answerKeys collection (server-only)
    const keyRef = db.collection('answerKeys').doc(examId);
    batch.set(keyRef, {
      examId,
      answers: answerKeyMap,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Write sanitized questions
    for (const q of sanitizedQuestions) {
      const qDocRef = examRef.collection('questions').doc(q.id);
      batch.set(qDocRef, q);
    }

    await batch.commit();

    return res.status(200).json({
      message: 'Examination published successfully',
      examId,
    });
  } catch (error) {
    console.error('Publish API error', error);
    return res.status(500).json({ error: error?.message || 'Unable to publish the examination' });
  }
};
app.post(['/api/publish', '/publish'], handlePublish);

// -------------------------------------------------------------
// POST /api/submit (Student only)
// -------------------------------------------------------------
const handleSubmit = async (req, res) => {
  try {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    const db = getDb();
    const callerSnap = await db.collection('users').doc(decoded.uid).get();

    if (!callerSnap.exists || callerSnap.data()?.active !== true || !['student', 'faculty', 'admin'].includes(callerSnap.data()?.role)) {
      return res.status(403).json({ error: 'Only active authenticated accounts can submit examinations.' });
    }

    const { examId, answers } = req.body;
    if (!examId || typeof examId !== 'string' || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'examId and an answers object are required.' });
    }

    const cleanExamId = examId.trim();
    const examRef = db.collection('exams').doc(cleanExamId);
    const [examSnapshot, keySnapshot, questionsSnapshot] = await Promise.all([
      examRef.get(),
      db.collection('answerKeys').doc(cleanExamId).get(),
      examRef.collection('questions').get(),
    ]);

    if (!examSnapshot.exists) return res.status(404).json({ error: 'Examination not found.' });
    const exam = examSnapshot.data();
    if (exam.status !== 'published') return res.status(409).json({ error: 'This examination is not published.' });

    let keyMap = keySnapshot.exists ? (keySnapshot.data()?.answers || {}) : {};
    const questions = questionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (questions.length === 0) return res.status(409).json({ error: 'This examination has no questions.' });

    // Fallback if answerKeys document is not populated: check questions for correctAnswer
    if (Object.keys(keyMap).length === 0) {
      for (const q of questions) {
        if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
          keyMap[q.id] = q.correctAnswer;
        }
      }
    }

    const now = Date.now();
    const startsAt = exam.startsAt?.toDate ? exam.startsAt.toDate().getTime() : (exam.startsAt ? new Date(exam.startsAt).getTime() : null);
    const endsAt = exam.endsAt?.toDate ? exam.endsAt.toDate().getTime() : (exam.endsAt ? new Date(exam.endsAt).getTime() : null);
    if (startsAt && Number.isFinite(startsAt) && now < startsAt) return res.status(409).json({ error: 'The examination has not started yet.' });
    if (endsAt && Number.isFinite(endsAt) && now > endsAt) return res.status(409).json({ error: 'The examination deadline has passed.' });

    const validQuestionIds = new Set(questions.map((question) => question.id));
    for (const submittedId of Object.keys(answers)) {
      if (!validQuestionIds.has(submittedId)) return res.status(400).json({ error: `Unknown question ID: ${submittedId}` });
    }

    let score = 0;
    let totalMarks = 0;
    let correctCount = 0;
    const breakdown = {};
    const hasKeys = Object.keys(keyMap).length > 0;

    for (const question of questions) {
      const marks = Number(question.marks ?? 1);
      const safeMarks = Number.isFinite(marks) && marks > 0 ? marks : 0;
      totalMarks += safeMarks;

      let isCorrect = false;
      if (hasKeys && Object.prototype.hasOwnProperty.call(keyMap, question.id)) {
        isCorrect = sameAnswer(answers[question.id], keyMap[question.id]);
      } else if (answers[question.id] !== undefined && answers[question.id] !== null && answers[question.id] !== '') {
        // Graceful credit if key was not pre-populated
        isCorrect = true;
      }

      if (isCorrect) {
        score += safeMarks;
        correctCount += 1;
      }
      breakdown[question.id] = { answered: Object.prototype.hasOwnProperty.call(answers, question.id), correct: isCorrect, marksAwarded: isCorrect ? safeMarks : 0 };
    }

    const tabSwitchViolations = Number(req.body.tabSwitchViolations || 0);
    const resultId = `${cleanExamId}_${decoded.uid}`;
    const resultRef = db.collection('results').doc(resultId);
    const resultData = {
      examId: cleanExamId,
      examTitle: String(exam.title || 'Examination'),
      studentUid: decoded.uid,
      studentEmail: decoded.email || callerSnap.data()?.email || '',
      answers,
      score,
      totalMarks,
      correctCount,
      questionCount: questions.length,
      percentage: totalMarks > 0 ? Math.round((score / totalMarks) * 10000) / 100 : 0,
      breakdown,
      tabSwitchViolations,
      isFlagged: tabSwitchViolations >= 3,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'submitted',
    };

    try {
      await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(resultRef);
        if (existing.exists) {
          const error = new Error('ALREADY_SUBMITTED');
          error.code = 'ALREADY_SUBMITTED';
          throw error;
        }
        transaction.create(resultRef, resultData);
      });
    } catch (error) {
      if (error?.code === 'ALREADY_SUBMITTED') {
        return res.status(409).json({ error: 'You have already submitted this examination.' });
      }
      throw error;
    }

    return res.status(200).json({
      message: 'Examination submitted successfully',
      result: {
        examId: cleanExamId,
        score,
        totalMarks,
        correctCount,
        questionCount: questions.length,
        percentage: resultData.percentage,
        tabSwitchViolations,
      },
    });
  } catch (error) {
    console.error('Grading API error', error);
    return res.status(500).json({ error: error?.message || 'Unable to process the examination submission' });
  }
};
app.post(['/api/submit', '/submit'], handleSubmit);

// -------------------------------------------------------------
// POST /api/users/create-faculty (Admin only)
// -------------------------------------------------------------
const handleCreateFaculty = async (req, res) => {
  try {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    const db = getDb();
    const callerSnap = await db.collection('users').doc(decoded.uid).get();

    if (!callerSnap.exists || callerSnap.data()?.active !== true || callerSnap.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only administrators can create faculty accounts.' });
    }

    const { name, email, employeeId, department, assignedCourses, contactNumber, active } = req.body;
    if (!name?.trim() || !email?.trim() || !employeeId?.trim() || !department?.trim()) {
      return res.status(400).json({ error: 'Full name, email, employee ID and department are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate email
    const existingSnap = await db.collection('users').where('email', '==', cleanEmail).get();
    if (!existingSnap.empty) {
      return res.status(400).json({ error: `A user profile with email ${cleanEmail} already exists.` });
    }

    // Create Firebase Auth user
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: cleanEmail,
        displayName: name.trim(),
        disabled: active === false,
      });
    } catch (authErr) {
      if (authErr?.code === 'auth/email-already-exists') {
        return res.status(400).json({ error: `An authentication account with email ${cleanEmail} already exists.` });
      }
      throw authErr;
    }

    // Generate password setup link
    let resetLink = '';
    try {
      resetLink = await admin.auth().generatePasswordResetLink(cleanEmail);
    } catch (linkErr) {
      console.warn('Could not generate reset link', linkErr);
    }

    // Create Firestore users/{uid} document
    const facultyData = {
      uid: userRecord.uid,
      name: name.trim(),
      email: cleanEmail,
      role: 'faculty',
      active: active !== false,
      employeeId: employeeId.trim(),
      department: department.trim(),
      assignedCourses: Array.isArray(assignedCourses) ? assignedCourses : [],
      contactNumber: contactNumber ? String(contactNumber).trim() : '',
      createdBy: decoded.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(userRecord.uid).set(facultyData);

    // Audit event
    await db.collection('auditEvents').add({
      type: 'FACULTY_CREATED',
      targetUid: userRecord.uid,
      targetEmail: cleanEmail,
      performedBy: decoded.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      message: 'Faculty account created successfully.',
      uid: userRecord.uid,
      resetLink,
    });
  } catch (error) {
    console.error('Create faculty error', error);
    return res.status(500).json({ error: error?.message || 'Unable to create faculty account.' });
  }
};
app.post(['/api/users/create-faculty', '/users/create-faculty'], handleCreateFaculty);

// -------------------------------------------------------------
// POST /api/users/create-student (Faculty or Admin)
// -------------------------------------------------------------
const handleCreateStudent = async (req, res) => {
  try {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    const db = getDb();
    const callerSnap = await db.collection('users').doc(decoded.uid).get();

    if (!callerSnap.exists || callerSnap.data()?.active !== true) {
      return res.status(403).json({ error: 'Caller account is inactive or not found.' });
    }

    const callerData = callerSnap.data();
    if (callerData.role !== 'admin' && callerData.role !== 'faculty') {
      return res.status(403).json({ error: 'Forbidden: Only faculty or administrators can create student accounts.' });
    }

    const { name, email, usn, registrationNumber, department, semester, courseIds, active } = req.body;
    if (!name?.trim() || !email?.trim() || !usn?.trim() || !department?.trim() || !semester?.trim()) {
      return res.status(400).json({ error: 'Student name, email, USN/Roll Number, department and semester are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsn = usn.trim().toUpperCase();

    // Faculty course boundary check
    if (callerData.role === 'faculty') {
      const facultyDept = callerData.department || '';
      const facultyCourses = Array.isArray(callerData.assignedCourses) ? callerData.assignedCourses : [];

      if (facultyDept && department.trim().toLowerCase() !== facultyDept.toLowerCase()) {
        const hasCourseMatch = Array.isArray(courseIds) && courseIds.some((c) => facultyCourses.includes(c));
        if (!hasCourseMatch) {
          return res.status(403).json({
            error: `Faculty members can only create students in their department (${facultyDept}) or assigned courses.`,
          });
        }
      }
    }

    // Duplicate USN check
    const usnQuery = await db.collection('users').where('usn', '==', cleanUsn).get();
    if (!usnQuery.empty) {
      return res.status(400).json({ error: `A student with USN / Roll Number "${cleanUsn}" already exists.` });
    }

    // Duplicate email check
    const emailQuery = await db.collection('users').where('email', '==', cleanEmail).get();
    if (!emailQuery.empty) {
      return res.status(400).json({ error: `A user profile with email ${cleanEmail} already exists.` });
    }

    // Create Firebase Auth user
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: cleanEmail,
        displayName: name.trim(),
        disabled: active === false,
      });
    } catch (authErr) {
      if (authErr?.code === 'auth/email-already-exists') {
        return res.status(400).json({ error: `An authentication account with email ${cleanEmail} already exists.` });
      }
      throw authErr;
    }

    // Password setup link
    let resetLink = '';
    try {
      resetLink = await admin.auth().generatePasswordResetLink(cleanEmail);
    } catch (linkErr) {
      console.warn('Could not generate reset link', linkErr);
    }

    // Create Firestore profile
    const studentData = {
      uid: userRecord.uid,
      name: name.trim(),
      email: cleanEmail,
      role: 'student',
      active: active !== false,
      usn: cleanUsn,
      registrationNumber: registrationNumber ? String(registrationNumber).trim() : '',
      department: department.trim(),
      semester: String(semester).trim(),
      courseIds: Array.isArray(courseIds) ? courseIds : [],
      createdBy: decoded.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(userRecord.uid).set(studentData);

    // Audit event
    await db.collection('auditEvents').add({
      type: 'STUDENT_CREATED',
      targetUid: userRecord.uid,
      targetUsn: cleanUsn,
      targetEmail: cleanEmail,
      performedBy: decoded.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      message: 'Student account created successfully.',
      uid: userRecord.uid,
      resetLink,
    });
  } catch (error) {
    console.error('Create student error', error);
    return res.status(500).json({ error: error?.message || 'Unable to create student account.' });
  }
};
app.post(['/api/users/create-student', '/users/create-student'], handleCreateStudent);

// -------------------------------------------------------------
// POST /api/ai/generate-exam (Admin and Faculty)
// -------------------------------------------------------------
const handleAiGenerateExam = async (req, res) => {
  try {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    const db = getDb();
    const callerSnap = await db.collection('users').doc(decoded.uid).get();

    if (!callerSnap.exists || callerSnap.data()?.active !== true) {
      return res.status(403).json({ error: 'Caller account is inactive or not found.' });
    }

    const callerRole = callerSnap.data()?.role;
    if (callerRole !== 'admin' && callerRole !== 'faculty') {
      return res.status(403).json({ error: 'Forbidden: Only faculty or administrators can use AI examination creation.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      return res.status(503).json({
        error: 'AI generation service is not configured. GEMINI_API_KEY must be set in backend environment variables.',
        code: 'AI_NOT_CONFIGURED',
      });
    }

    const {
      subject,
      title,
      topics,
      difficulty = 'medium',
      questionCount = 5,
      questionTypes = ['single'],
      marksPerQuestion = 2,
      additionalInstructions = '',
    } = req.body;

    if (!subject?.trim()) {
      return res.status(400).json({ error: 'Subject / Course name is required for AI question generation.' });
    }

    const safeCount = Math.min(Math.max(Number(questionCount) || 5, 1), 30);
    const safeMarks = Number(marksPerQuestion) > 0 ? Number(marksPerQuestion) : 2;

    const systemPrompt = `You are an expert university examination creator and cloud computing educator.
Generate an academic assessment question paper as a structured JSON object.

RULES:
1. Return ONLY valid, parseable JSON matching the requested schema. Do not include markdown code fences, comments, or explanations outside the JSON.
2. Generate exactly ${safeCount} objective questions.
3. Use subject: "${subject.trim()}".
4. Focus strictly on topics/syllabus: "${topics?.trim() || 'Core university syllabus for ' + subject.trim()}".
5. Target difficulty level: ${difficulty}.
6. Allowed question types: ${JSON.stringify(questionTypes)}.
   - If 'single' is allowed: generate 4-choice Multiple Choice Questions with options A, B, C, D.
   - If 'boolean' is allowed: generate True/False questions with options 'True' and 'False'.
7. For every question:
   - Provide a clear, academically sound prompt.
   - For MCQ, provide plausible, high-quality distractor options.
   - Provide accurate "correctAnswer" corresponding to the exact option ID ('A', 'B', 'C', 'D' for MCQ, or 'true'/'false' for True/False).
   - Provide a concise explanation of the answer.
   - Assign ${safeMarks} marks.
${additionalInstructions ? `8. Additional faculty instructions: "${additionalInstructions.trim()}".` : ''}

JSON OUTPUT FORMAT:
{
  "questions": [
    {
      "type": "single",
      "text": "Question text here?",
      "options": [
        { "id": "A", "text": "Choice A" },
        { "id": "B", "text": "Choice B" },
        { "id": "C", "text": "Choice C" },
        { "id": "D", "text": "Choice D" }
      ],
      "correctAnswer": "B",
      "marks": ${safeMarks},
      "difficulty": "${difficulty}",
      "explanation": "Why B is the correct answer."
    },
    {
      "type": "boolean",
      "text": "Statement text here.",
      "options": [
        { "id": "true", "text": "True" },
        { "id": "false", "text": "False" }
      ],
      "correctAnswer": "true",
      "marks": ${safeMarks},
      "difficulty": "${difficulty}",
      "explanation": "Why this statement is true."
    }
  ]
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    };

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error status:', geminiRes.status, errText);
      if (geminiRes.status === 429) {
        return res.status(429).json({ error: 'Gemini AI rate limit reached. Please wait a few moments and try again.' });
      }
      return res.status(502).json({ error: `Gemini AI service error (${geminiRes.status}). Please check API key or quota.` });
    }

    const geminiData = await geminiRes.json();
    const rawContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return res.status(502).json({ error: 'Empty response returned by Gemini AI.' });
    }

    let parsed;
    try {
      const cleanJson = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON', parseErr, rawContent);
      return res.status(502).json({ error: 'AI generated invalid JSON. Please try again with more specific topics.' });
    }

    const rawList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.questions) ? parsed.questions : []);
    if (rawList.length === 0) {
      return res.status(502).json({ error: 'No structured questions found in AI generation output.' });
    }

    const normalized = rawList.map((q, idx) => {
      const isBool = q.type === 'boolean' || q.type === 'true_false' || (Array.isArray(q.options) && q.options.length === 2 && (q.options[0]?.text === 'True' || q.options[0] === 'True'));

      let finalOptions = [];
      let finalCorrect = 'A';

      if (isBool) {
        finalOptions = [
          { id: 'true', text: 'True' },
          { id: 'false', text: 'False' },
        ];
        const rawCorrect = String(q.correctAnswer || '').toLowerCase();
        finalCorrect = rawCorrect === 'false' ? 'false' : 'true';
      } else {
        const optionIds = ['A', 'B', 'C', 'D'];
        finalOptions = optionIds.map((optId, i) => {
          const rawOpt = q.options?.[i];
          const text = typeof rawOpt === 'string' ? rawOpt : (rawOpt?.text || `Option ${optId}`);
          return { id: optId, text };
        });

        const rawAns = String(q.correctAnswer || '').trim();
        const matchedById = finalOptions.find((o) => o.id.toUpperCase() === rawAns.toUpperCase());
        const matchedByText = finalOptions.find((o) => o.text.trim().toLowerCase() === rawAns.toLowerCase());
        finalCorrect = matchedById ? matchedById.id : (matchedByText ? matchedByText.id : 'A');
      }

      return {
        id: `q_ai_${Date.now()}_${idx + 1}`,
        text: String(q.text || q.question || `Question ${idx + 1}`),
        type: isBool ? 'boolean' : 'single',
        options: finalOptions,
        correctAnswer: finalCorrect,
        marks: Number(q.marks) > 0 ? Number(q.marks) : safeMarks,
        difficulty: String(q.difficulty || difficulty),
        explanation: String(q.explanation || ''),
        order: idx + 1,
      };
    });

    return res.status(200).json({
      message: 'Questions generated successfully.',
      count: normalized.length,
      questions: normalized,
      title: title || `${subject} Assessment`,
    });
  } catch (error) {
    console.error('AI generation error', error);
    return res.status(500).json({ error: error?.message || 'Unable to generate questions using AI.' });
  }
};
app.post(['/api/ai/generate-exam', '/ai/generate-exam'], handleAiGenerateExam);

// -------------------------------------------------------------
// Runtime Client Configuration Route
// -------------------------------------------------------------
app.get('/api/config', (req, res) => {
  res.status(200).json({
    apiKey: process.env.VITE_FIREBASE_API_KEY || '',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'online-examamination.firebaseapp.com',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'online-examamination',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'online-examamination.firebasestorage.app',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '219771742130',
    appId: process.env.VITE_FIREBASE_APP_ID || '1:219771742130:web:5744e7caae7db4944026ab',
  });
});

// -------------------------------------------------------------
// Frontend Static File Serving & SPA Route Fallback
// -------------------------------------------------------------
const distPath = process.env.STATIC_DIR || path.join(__dirname, '../web/dist');
if (fs.existsSync(distPath)) {
  console.log(`[ExamFlow Server] Serving static files from: ${distPath}`);
  app.use(express.static(distPath, { index: false }));

  app.get('*', (req, res) => {
    // Return index.html with runtime config injected for client-side React Router navigation
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf8');
      const runtimeConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY || '',
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'online-examamination.firebaseapp.com',
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'online-examamination',
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'online-examamination.firebasestorage.app',
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '219771742130',
        appId: process.env.VITE_FIREBASE_APP_ID || '1:219771742130:web:5744e7caae7db4944026ab',
        geminiApiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '',
      };
      const injected = `<script>window.__EXAMFLOW_CONFIG__ = ${JSON.stringify(runtimeConfig)};</script>`;
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${injected}</head>`);
      } else {
        html = injected + html;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } else {
      res.status(404).send('index.html not found. Please build the frontend first.');
    }
  });
} else {
  console.warn(`[ExamFlow Server] Static directory not found at: ${distPath}`);
  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'examflow-online-exam',
      message: 'Backend server is running. Frontend static build will be served once web/dist is present.',
    });
  });
}

// -------------------------------------------------------------
// Bind & Listen
// -------------------------------------------------------------
const PORT = Number(process.env.PORT) || 10000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`[ExamFlow] Server successfully started!`);
  console.log(`[ExamFlow] Listening on: http://${HOST}:${PORT}`);
  console.log(`[ExamFlow] Health check: http://${HOST}:${PORT}/healthz`);
  console.log(`[ExamFlow] Environment:  ${process.env.NODE_ENV || 'production'}`);
  console.log(`=======================================================`);
});
