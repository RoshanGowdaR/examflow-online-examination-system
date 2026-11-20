import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Send,
  Loader2,
  Award,
} from 'lucide-react';
import type { Exam, Question } from '../types';
import { getExamById, getQuestionsForExam } from '../services/exams';
import { submitExam, type SubmissionResult } from '../services/gradingApi';
import { getStudentResults } from '../services/results';
import { useAuth } from '../auth/AuthContext';

export function ExamAttemptPage() {
  const { examId } = useParams<{ examId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // Attempt state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Timer state (seconds remaining)
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Load exam and questions
  useEffect(() => {
    async function load() {
      if (!examId || !user) return;
      try {
        setLoading(true);
        setError('');

        // 1. Check if already submitted
        const studentResults = await getStudentResults(user.uid);
        const existing = studentResults.find((r) => r.examId === examId);
        if (existing) {
          setAlreadySubmitted(true);
          setLoading(false);
          return;
        }

        // 2. Fetch Exam & Questions
        const [examData, qList] = await Promise.all([
          getExamById(examId),
          getQuestionsForExam(examId),
        ]);

        if (!examData) {
          setError('Examination not found.');
          setLoading(false);
          return;
        }

        if (examData.status !== 'published') {
          setError('This examination is currently in draft mode and not open for attempts.');
          setLoading(false);
          return;
        }

        if (qList.length === 0) {
          setError('This examination has no questions.');
          setLoading(false);
          return;
        }

        setExam(examData);
        setQuestions(qList);

        // 3. Initialize timer
        const now = Date.now();
        const hardDeadline = examData.endsAt ? new Date(examData.endsAt).getTime() : now + examData.durationMinutes * 60 * 1000;
        const durationDeadline = now + examData.durationMinutes * 60 * 1000;
        const effectiveDeadline = Math.min(hardDeadline, durationDeadline);
        const diffSeconds = Math.max(0, Math.floor((effectiveDeadline - now) / 1000));
        setSecondsRemaining(diffSeconds);
      } catch (err: any) {
        setError(err?.message || 'Failed to load examination.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [examId, user]);

  // Submit function
  const handleSubmit = useCallback(async () => {
    if (!examId || submitting) return;
    try {
      setSubmitting(true);
      setShowConfirmModal(false);
      setError('');
      const result = await submitExam(examId, answers);
      setSubmissionResult(result);
    } catch (err: any) {
      setError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [examId, answers, submitting]);

  // Countdown timer interval
  useEffect(() => {
    if (secondsRemaining === null || submissionResult !== null || alreadySubmitted) return;

    if (secondsRemaining <= 0) {
      // Auto-submit when time expires
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining, submissionResult, alreadySubmitted, handleSubmit]);

  // Answer handler
  const handleSelectOption = (questionId: string, optionId: string, type: string) => {
    if (type === 'multiple') {
      const current = Array.isArray(answers[questionId]) ? (answers[questionId] as string[]) : [];
      const updated = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      setAnswers({ ...answers, [questionId]: updated });
    } else {
      setAnswers({ ...answers, [questionId]: optionId });
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = useMemo(() => {
    return questions.filter((q) => {
      const a = answers[q.id];
      return a !== undefined && a !== null && (!Array.isArray(a) || a.length > 0);
    }).length;
  }, [questions, answers]);

  if (loading) {
    return (
      <div className="center-page">
        <div className="loading-screen">
          <div className="spinner" /> Loading examination assessment...
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="center-page">
        <div className="status-card" style={{ textAlign: 'center' }}>
          <div className="status-icon" style={{ margin: '0 auto 16px', background: '#ecfdf3', color: '#027a48' }}>
            <CheckCircle2 size={24} />
          </div>
          <h2>Assessment Already Submitted</h2>
          <p>You have already completed and submitted your answers for this examination.</p>
          <button className="btn btn-primary" style={{ margin: '18px auto 0' }} onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className="center-page">
        <div className="status-card" style={{ textAlign: 'center' }}>
          <div className="status-icon" style={{ margin: '0 auto 16px', background: '#fef3f2', color: '#b42318' }}>
            <AlertTriangle size={24} />
          </div>
          <h2>Unable to Open Examination</h2>
          <p>{error}</p>
          <button className="btn btn-secondary" style={{ margin: '18px auto 0' }} onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Success result card after grading
  if (submissionResult) {
    const pct = submissionResult.percentage;
    const isPassing = pct >= 50;

    return (
      <div className="center-page">
        <div className="status-card" style={{ textAlign: 'center', maxWidth: '580px' }}>
          <div
            className="status-icon"
            style={{
              margin: '0 auto 16px',
              background: isPassing ? '#ecfdf3' : '#fef3f2',
              color: isPassing ? '#027a48' : '#b42318',
            }}
          >
            <Award size={26} />
          </div>

          <span className="eyebrow" style={{ color: '#027a48' }}>AUTOMATED GRADING COMPLETE</span>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '26px', margin: '4px 0 10px' }}>
            Assessment Result
          </h2>
          <p className="muted">
            Evaluated by the trusted AWS Lambda backend using private server-side answer keys.
          </p>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              margin: '24px 0',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>SCORE</span>
                <strong style={{ fontSize: '26px', color: '#1e293b', fontFamily: 'Manrope, sans-serif' }}>
                  {submissionResult.score} / {submissionResult.totalMarks}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>PERCENTAGE</span>
                <strong style={{ fontSize: '26px', color: isPassing ? '#059669' : '#dc2626', fontFamily: 'Manrope, sans-serif' }}>
                  {pct}%
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>CORRECT</span>
                <strong style={{ fontSize: '26px', color: '#1e293b', fontFamily: 'Manrope, sans-serif' }}>
                  {submissionResult.correctCount} / {submissionResult.questionCount}
                </strong>
              </div>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isUrgent = secondsRemaining !== null && secondsRemaining <= 300; // < 5 mins

  return (
    <div className="exam-fullscreen">
      {/* Top Navigation Bar with Countdown Timer */}
      <header className="exam-navbar">
        <div className="exam-navbar-title">
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 0, color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Leave examination"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2>{exam?.title}</h2>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {exam?.courseName} · Question {currentIndex + 1} of {questions.length}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {secondsRemaining !== null && (
            <div className={`timer-chip ${isUrgent ? 'timer-urgent' : ''}`}>
              <Clock size={16} />
              <span>{formatTimer(secondsRemaining)}</span>
            </div>
          )}

          <button className="btn btn-primary btn-sm" onClick={() => setShowConfirmModal(true)}>
            <Send size={14} /> Submit
          </button>
        </div>
      </header>

      {/* Main Exam Interface */}
      <main className="exam-layout-grid">
        {/* Left Column: Current Question */}
        <section className="exam-question-card">
          <div>
            <div className="exam-question-top">
              <span className="badge" style={{ background: '#f1f5f9', color: '#334155', fontWeight: 700 }}>
                Question {currentIndex + 1}
              </span>
              <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                {currentQ.marks} {currentQ.marks === 1 ? 'Mark' : 'Marks'}
              </span>
            </div>

            <h3 className="question-prompt">{currentQ.text}</h3>

            <div className="exam-options-stack">
              {currentQ.options.map((opt) => {
                const isSelected =
                  currentQ.type === 'multiple'
                    ? Array.isArray(answers[currentQ.id]) && (answers[currentQ.id] as string[]).includes(opt.id)
                    : answers[currentQ.id] === opt.id;

                return (
                  <button
                    key={opt.id}
                    className={`exam-option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectOption(currentQ.id, opt.id, currentQ.type)}
                  >
                    <div className="option-indicator">{opt.id}</div>
                    <span>{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '18px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              <ArrowLeft size={15} /> Previous
            </button>

            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Answered: <strong>{answeredCount}</strong> of {questions.length}
            </span>

            {currentIndex < questions.length - 1 ? (
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              >
                Next <ArrowRight size={15} />
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setShowConfirmModal(true)}>
                Finish & Submit <Send size={14} />
              </button>
            )}
          </div>
        </section>

        {/* Right Column: Question Navigator */}
        <aside className="exam-nav-sidebar">
          <h4 style={{ margin: '0 0 4px', fontFamily: 'Manrope, sans-serif', fontSize: '14px' }}>
            Assessment Overview
          </h4>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Click any question number to jump directly to it:
          </span>

          <div className="q-grid">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
              const isCurrent = idx === currentIndex;

              let className = 'q-btn';
              if (isAnswered) className += ' answered';
              if (isCurrent) className += ' current';

              return (
                <button
                  key={q.id}
                  className={className}
                  onClick={() => setCurrentIndex(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '14px', fontSize: '11px', color: '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#059669', display: 'inline-block' }} />
              <span>Answered ({answeredCount})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'inline-block' }} />
              <span>Unanswered ({questions.length - answeredCount})</span>
            </div>
          </div>
        </aside>
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px' }}>Submit Examination?</h3>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#475467' }}>
                You have answered <strong>{answeredCount}</strong> out of <strong>{questions.length}</strong> questions.
              </p>
              {questions.length - answeredCount > 0 && (
                <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#b42318' }}>
                  Warning: You have {questions.length - answeredCount} unanswered questions!
                </p>
              )}
              <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#64748b' }}>
                Once submitted, your answers will be finalized and evaluated by AWS Lambda. You cannot change your responses.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
              >
                Continue Exam
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? <><Loader2 size={14} className="spinner" /> Submitting...</> : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
