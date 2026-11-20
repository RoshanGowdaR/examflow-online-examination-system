import admin from 'firebase-admin';

let firestore;
let app;

function getDb() {
  if (firestore) return firestore;
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  const serviceAccount = JSON.parse(rawServiceAccount);
  app = admin.apps.length ? admin.app() : admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  firestore = admin.firestore(app);
  return firestore;
}

function response(statusCode, body, origin = '*') {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'content-type,authorization',
      'access-control-allow-methods': 'POST,OPTIONS',
      'vary': 'origin',
    },
    body: JSON.stringify(body),
  };
}

function normalize(value) {
  if (Array.isArray(value)) return [...value].map(String).sort();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function sameAnswer(submitted, correct) {
  return JSON.stringify(normalize(submitted)) === JSON.stringify(normalize(correct));
}

export const handler = async (event) => {
  const configuredOrigin = process.env.ALLOWED_ORIGIN || '*';
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
  const allowOrigin = configuredOrigin === '*' || configuredOrigin === requestOrigin
    ? (configuredOrigin === '*' ? '*' : configuredOrigin)
    : 'null';

  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const rawPath = event.rawPath || event.path || '';
  const path = rawPath.replace(/\/$/, '');

  if (method === 'OPTIONS') return response(204, {}, allowOrigin);

  if (method !== 'POST') {
    return response(405, { error: 'Method not allowed' }, allowOrigin);
  }

  // -------------------------------------------------------------
  // Route Dispatcher
  // -------------------------------------------------------------
  if (path.endsWith('/publish')) {
    return handlePublish(event, allowOrigin);
  } else if (path.endsWith('/submit')) {
    return handleSubmit(event, allowOrigin);
  } else if (path.endsWith('/users/create-faculty')) {
    return handleCreateFaculty(event, allowOrigin);
  } else if (path.endsWith('/users/create-student')) {
    return handleCreateStudent(event, allowOrigin);
  } else if (path.endsWith('/ai/generate-exam')) {
    return handleAiGenerateExam(event, allowOrigin);
  } else {
    return response(404, { error: `Route not found: ${path}` }, allowOrigin);
  }
};

// -------------------------------------------------------------
// POST /users/create-faculty (Admin only)
// -------------------------------------------------------------
async function handleCreateFaculty(event, allowOrigin) {
  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return response(401, { error: 'Missing Firebase ID token' }, allowOrigin);

    const db = getDb();
    const decoded = await admin.auth().verifyIdToken(match[1]);
    const callerSnap = await db.collection('users').doc(decoded.uid).get();

    if (!callerSnap.exists || callerSnap.data()?.active !== true || callerSnap.data()?.role !== 'admin') {
      return response(403, { error: 'Forbidden: Only administrators can create faculty accounts' }, allowOrigin);
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const { name, email, employeeId, department, assignedCourses, contactNumber, active } = body;

    if (!name?.trim() || !email?.trim() || !employeeId?.trim() || !department?.trim()) {
      return response(400, { error: 'Full name, email, employee ID and department are required.' }, allowOrigin);
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check duplicate email in Firestore
    const existingSnap = await db.collection('users').where('email', '==', cleanEmail).get();
    if (!existingSnap.empty) {
      return response(400, { error: `A user profile with email ${cleanEmail} already exists.` }, allowOrigin);
    }

    // 2. Create user in Firebase Authentication
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: cleanEmail,
        displayName: name.trim(),
        disabled: active === false,
      });
    } catch (authErr) {
      if (authErr?.code === 'auth/email-already-exists') {
        return response(400, { error: `An authentication account with email ${cleanEmail} already exists.` }, allowOrigin);
      }
      throw authErr;
    }

    // 3. Generate password setup/reset link
    let resetLink = '';
    try {
      resetLink = await admin.auth().generatePasswordResetLink(cleanEmail);
    } catch (linkErr) {
      console.warn('Could not generate reset link', linkErr);
    }

    // 4. Create Firestore users/{uid} document
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

    // 5. Audit event
    await db.collection('auditEvents').add({
      type: 'FACULTY_CREATED',
      targetUid: userRecord.uid,
      targetEmail: cleanEmail,
      performedBy: decoded.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return response(201, {
      message: 'Faculty account created successfully.',
      uid: userRecord.uid,
      resetLink,
    }, allowOrigin);
  } catch (error) {
    console.error('Create faculty error', error);
    if (error?.code?.startsWith('auth/')) {
      return response(401, { error: 'Authentication session expired or invalid.' }, allowOrigin);
    }
    return response(500, { error: error?.message || 'Unable to create faculty account.' }, allowOrigin);
  }
}

// -------------------------------------------------------------
// POST /users/create-student (Faculty or Admin)
// -------------------------------------------------------------
async function handleCreateStudent(event, allowOrigin) {
  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return response(401, { error: 'Missing Firebase ID token' }, allowOrigin);

    const db = getDb();
    const decoded = await admin.auth().verifyIdToken(match[1]);
    const callerSnap = await db.collection('users').doc(decoded.uid).get();

    if (!callerSnap.exists || callerSnap.data()?.active !== true) {
      return response(403, { error: 'Caller account is inactive or not found.' }, allowOrigin);
    }

    const callerData = callerSnap.data();
    if (callerData.role !== 'admin' && callerData.role !== 'faculty') {
      return response(403, { error: 'Forbidden: Only faculty or administrators can create student accounts.' }, allowOrigin);
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const { name, email, usn, registrationNumber, department, semester, courseIds, active } = body;

    if (!name?.trim() || !email?.trim() || !usn?.trim() || !department?.trim() || !semester?.trim()) {
      return response(400, { error: 'Student name, email, USN/Roll Number, department and semester are required.' }, allowOrigin);
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsn = usn.trim().toUpperCase();

    // Faculty course boundary check: Faculty can only register students for their assigned department or courses
    if (callerData.role === 'faculty') {
      const facultyDept = callerData.department || '';
      const facultyCourses = Array.isArray(callerData.assignedCourses) ? callerData.assignedCourses : [];

      if (facultyDept && department.trim().toLowerCase() !== facultyDept.toLowerCase()) {
        const hasCourseMatch = Array.isArray(courseIds) && courseIds.some((c) => facultyCourses.includes(c));
        if (!hasCourseMatch) {
          return response(403, {
            error: `Faculty members can only create students in their department (${facultyDept}) or assigned courses.`,
          }, allowOrigin);
        }
      }
    }

    // Duplicate USN check
    const usnQuery = await db.collection('users').where('usn', '==', cleanUsn).get();
    if (!usnQuery.empty) {
      return response(400, { error: `A student with USN / Roll Number "${cleanUsn}" already exists.` }, allowOrigin);
    }

    // Duplicate email check
    const emailQuery = await db.collection('users').where('email', '==', cleanEmail).get();
    if (!emailQuery.empty) {
      return response(400, { error: `A user profile with email ${cleanEmail} already exists.` }, allowOrigin);
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
        return response(400, { error: `An authentication account with email ${cleanEmail} already exists.` }, allowOrigin);
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

    return response(201, {
      message: 'Student account created successfully.',
      uid: userRecord.uid,
      resetLink,
    }, allowOrigin);
  } catch (error) {
    console.error('Create student error', error);
    if (error?.code?.startsWith('auth/')) {
      return response(401, { error: 'Authentication session expired or invalid.' }, allowOrigin);
    }
    return response(500, { error: error?.message || 'Unable to create student account.' }, allowOrigin);
  }
}

// -------------------------------------------------------------
// POST /ai/generate-exam (Admin and Faculty only)
// -------------------------------------------------------------
async function handleAiGenerateExam(event, allowOrigin) {
  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return response(401, { error: 'Missing Firebase ID token' }, allowOrigin);

    const db = getDb();
    const decoded = await admin.auth().verifyIdToken(match[1]);
    const callerSnap = await db.collection('users').doc(decoded.uid).get();

    if (!callerSnap.exists || callerSnap.data()?.active !== true) {
      return response(403, { error: 'Caller account is inactive or not found.' }, allowOrigin);
    }

    const callerRole = callerSnap.data()?.role;
    if (callerRole !== 'admin' && callerRole !== 'faculty') {
      return response(403, { error: 'Forbidden: Only faculty or administrators can use AI examination creation.' }, allowOrigin);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      return response(503, {
        error: 'AI generation service is not configured. GEMINI_API_KEY must be set in backend environment variables.',
        code: 'AI_NOT_CONFIGURED',
      }, allowOrigin);
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const {
      subject,
      title,
      topics,
      difficulty = 'medium',
      questionCount = 5,
      questionTypes = ['single'],
      marksPerQuestion = 2,
      additionalInstructions = '',
    } = body;

    if (!subject?.trim()) {
      return response(400, { error: 'Subject / Course name is required for AI question generation.' }, allowOrigin);
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
        return response(429, { error: 'Gemini AI rate limit reached. Please wait a few moments and try again.' }, allowOrigin);
      }
      return response(502, { error: `Gemini AI service error (${geminiRes.status}). Please check API key or quota.` }, allowOrigin);
    }

    const geminiData = await geminiRes.json();
    const rawContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return response(502, { error: 'Empty response returned by Gemini AI.' }, allowOrigin);
    }

    let parsed;
    try {
      const cleanJson = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON', parseErr, rawContent);
      return response(502, { error: 'AI generated invalid JSON. Please try again with more specific topics.' }, allowOrigin);
    }

    const rawList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.questions) ? parsed.questions : []);
    if (rawList.length === 0) {
      return response(502, { error: 'No structured questions found in AI generation output.' }, allowOrigin);
    }

    // Normalize questions to match our ExamEditor format
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

        // Determine if correctAnswer was an option ID or the full text
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

    return response(200, {
      message: 'Questions generated successfully.',
      count: normalized.length,
      questions: normalized,
      title: title || `${subject} Assessment`,
    }, allowOrigin);
  } catch (error) {
    console.error('AI generation error', error);
    return response(500, { error: error?.message || 'Unable to generate questions using AI.' }, allowOrigin);
  }
}

// -------------------------------------------------------------
// POST /publish: Faculty/Admin publishes exam + stores private key
// -------------------------------------------------------------
async function handlePublish(event, allowOrigin) {
  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return response(401, { error: 'Missing Firebase ID token' }, allowOrigin);

    const db = getDb();
    const decoded = await admin.auth().verifyIdToken(match[1]);
    const userSnapshot = await db.collection('users').doc(decoded.uid).get();
    const userData = userSnapshot.data();

    if (!userSnapshot.exists || userData?.active !== true || !['faculty', 'admin'].includes(userData?.role)) {
      return response(403, { error: 'Only active faculty or admin accounts can publish examinations' }, allowOrigin);
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const { exam, questions } = body;
    let examId = typeof body.examId === 'string' && body.examId.trim() ? body.examId.trim() : null;

    if (!exam || typeof exam !== 'object') {
      return response(400, { error: 'Invalid exam details provided' }, allowOrigin);
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return response(400, { error: 'At least one question is required to publish an examination' }, allowOrigin);
    }

    const examRef = examId ? db.collection('exams').doc(examId) : db.collection('exams').doc();
    examId = examRef.id;

    // Calculate total marks from questions
    let calculatedTotalMarks = 0;
    const answerKeyMap = {};
    const sanitizedQuestions = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qId = q.id || `q_${i + 1}`;
      const qMarks = Number(q.marks ?? 1);
      calculatedTotalMarks += qMarks > 0 ? qMarks : 1;

      if (q.correctAnswer === undefined || q.correctAnswer === null || q.correctAnswer === '') {
        return response(400, { error: `Missing correct answer for question ${i + 1}` }, allowOrigin);
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

    // Prepare exam document
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

    // Write sanitized questions into exams/{examId}/questions subcollection
    for (const q of sanitizedQuestions) {
      const qDocRef = examRef.collection('questions').doc(q.id);
      batch.set(qDocRef, q);
    }

    await batch.commit();

    return response(200, {
      message: 'Examination published successfully',
      examId,
    }, allowOrigin);
  } catch (error) {
    console.error('Publish API error', error);
    if (error?.code?.startsWith('auth/')) {
      return response(401, { error: 'Your session has expired. Sign in again.' }, allowOrigin);
    }
    if (error instanceof SyntaxError) return response(400, { error: 'Invalid JSON request body' }, allowOrigin);
    return response(500, { error: 'Unable to publish the examination' }, allowOrigin);
  }
}

// -------------------------------------------------------------
// POST /submit: Student submits answers for automated grading
// -------------------------------------------------------------
async function handleSubmit(event, allowOrigin) {
  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return response(401, { error: 'Missing Firebase ID token' }, allowOrigin);

    const db = getDb();
    const decoded = await admin.auth().verifyIdToken(match[1]);
    const userSnapshot = await db.collection('users').doc(decoded.uid).get();
    if (!userSnapshot.exists || userSnapshot.data()?.active !== true || userSnapshot.data()?.role !== 'student') {
      return response(403, { error: 'Only active student accounts can submit examinations' }, allowOrigin);
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const examId = typeof body.examId === 'string' ? body.examId.trim() : '';
    const answers = body.answers;
    if (!examId || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return response(400, { error: 'examId and an answers object are required' }, allowOrigin);
    }

    const examRef = db.collection('exams').doc(examId);
    const [examSnapshot, keySnapshot, questionsSnapshot] = await Promise.all([
      examRef.get(),
      db.collection('answerKeys').doc(examId).get(),
      examRef.collection('questions').get(),
    ]);

    if (!examSnapshot.exists) return response(404, { error: 'Examination not found' }, allowOrigin);
    const exam = examSnapshot.data();
    if (exam.status !== 'published') return response(409, { error: 'This examination is not published' }, allowOrigin);
    if (!keySnapshot.exists || !keySnapshot.data()?.answers) {
      return response(500, { error: 'The answer key is not configured for this examination' }, allowOrigin);
    }

    const now = Date.now();
    const startsAt = exam.startsAt?.toDate ? exam.startsAt.toDate().getTime() : (exam.startsAt ? new Date(exam.startsAt).getTime() : null);
    const endsAt = exam.endsAt?.toDate ? exam.endsAt.toDate().getTime() : (exam.endsAt ? new Date(exam.endsAt).getTime() : null);
    if (startsAt && Number.isFinite(startsAt) && now < startsAt) return response(409, { error: 'The examination has not started yet' }, allowOrigin);
    if (endsAt && Number.isFinite(endsAt) && now > endsAt) return response(409, { error: 'The examination deadline has passed' }, allowOrigin);

    const keyMap = keySnapshot.data().answers;
    const questions = questionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (questions.length === 0) return response(409, { error: 'This examination has no questions' }, allowOrigin);

    const validQuestionIds = new Set(questions.map((question) => question.id));
    for (const submittedId of Object.keys(answers)) {
      if (!validQuestionIds.has(submittedId)) return response(400, { error: `Unknown question ID: ${submittedId}` }, allowOrigin);
    }

    let score = 0;
    let totalMarks = 0;
    let correctCount = 0;
    const breakdown = {};
    for (const question of questions) {
      const marks = Number(question.marks ?? 1);
      const safeMarks = Number.isFinite(marks) && marks > 0 ? marks : 0;
      totalMarks += safeMarks;
      const isCorrect = Object.prototype.hasOwnProperty.call(keyMap, question.id)
        && sameAnswer(answers[question.id], keyMap[question.id]);
      if (isCorrect) {
        score += safeMarks;
        correctCount += 1;
      }
      breakdown[question.id] = { answered: Object.prototype.hasOwnProperty.call(answers, question.id), correct: isCorrect, marksAwarded: isCorrect ? safeMarks : 0 };
    }

    const resultId = `${examId}_${decoded.uid}`;
    const resultRef = db.collection('results').doc(resultId);
    const resultData = {
      examId,
      examTitle: String(exam.title || 'Examination'),
      studentUid: decoded.uid,
      studentEmail: decoded.email || userSnapshot.data()?.email || '',
      answers,
      score,
      totalMarks,
      correctCount,
      questionCount: questions.length,
      percentage: totalMarks > 0 ? Math.round((score / totalMarks) * 10000) / 100 : 0,
      breakdown,
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
      if (error?.code === 'ALREADY_SUBMITTED') return response(409, { error: 'You have already submitted this examination' }, allowOrigin);
      throw error;
    }

    return response(200, {
      message: 'Examination submitted successfully',
      result: { examId, score, totalMarks, correctCount, questionCount: questions.length, percentage: resultData.percentage },
    }, allowOrigin);
  } catch (error) {
    console.error('Grading API error', error);
    if (error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error' || error?.code === 'auth/invalid-id-token') {
      return response(401, { error: 'Your session has expired. Sign in again.' }, allowOrigin);
    }
    if (error instanceof SyntaxError) return response(400, { error: 'Invalid JSON request body' }, allowOrigin);
    return response(500, { error: 'Unable to process the examination submission' }, allowOrigin);
  }
}
