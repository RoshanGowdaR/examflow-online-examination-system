import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  ShieldAlert,
  ShieldCheck,
  Maximize2,
  Minimize2,
  AlertOctagon,
  RefreshCw,
  Sparkles,
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

  // Anti Tab-Switch System state
  const [tabSwitchViolations, setTabSwitchViolations] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastViolationTimeRef = useRef<number>(0);

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

  // Submit function with anti-cheat violation tracking
  const handleSubmit = useCallback(
    async (forcedViolations?: number) => {
      if (!examId || submitting) return;
      try {
        setSubmitting(true);
        setShowConfirmModal(false);
        setShowViolationModal(false);
        setError('');

        const violationsToSend =
          typeof forcedViolations === 'number' ? forcedViolations : tabSwitchViolations;

        const result = await submitExam(examId, answers, violationsToSend);
        setSubmissionResult(result);
      } catch (err: any) {
        console.error('Submission failed:', err);
        setError(err?.message || 'Submission failed. Please check your network and try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [examId, answers, submitting, tabSwitchViolations]
  );

  // -------------------------------------------------------------
  // Anti Tab-Switch Proctored Monitoring Engine
  // -------------------------------------------------------------
  useEffect(() => {
    if (loading || alreadySubmitted || submissionResult !== null || submitting || isDisqualified) {
      return;
    }

    const triggerViolation = () => {
      const now = Date.now();
      // Debounce consecutive blur/visibility events by 2 seconds
      if (now - lastViolationTimeRef.current < 2000) return;
      lastViolationTimeRef.current = now;

      setTabSwitchViolations((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          setIsDisqualified(true);
          // Automatic submission upon reaching 3 violations
          setTimeout(() => {
            handleSubmit(next);
          }, 800);
        } else {
          setShowViolationModal(true);
        }
        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation();
      }
    };

    const handleWindowBlur = () => {
      triggerViolation();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [loading, alreadySubmitted, submissionResult, submitting, isDisqualified, handleSubmit]);

  // Fullscreen event listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

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
    const violations = submissionResult.tabSwitchViolations ?? tabSwitchViolations;

    return (
      <div className="center-page">
        <div className="status-card" style={{ textAlign: 'center', maxWidth: '600px' }}>
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

          <span className="eyebrow" style={{ color: '#027a48' }}>
            {violations >= 3 ? 'AUTO-SUBMITTED (TAB VIOLATIONS EXCEEDED)' : 'ASSESSMENT EVALUATION COMPLETE'}
          </span>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '26px', margin: '4px 0 10px' }}>
            Assessment Result
          </h2>
          <p className="muted">
            {violations >= 3
              ? 'Your assessment was auto-submitted due to exceeding 3 tab-switch violations. Results have been recorded for faculty review.'
              : 'Evaluated by the trusted backend grading engine with tamper-proof answers.'}
          </p>

          {/* Integrity Pill */}
          <div style={{ margin: '16px auto', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: violations === 0 ? '#ecfdf3' : violations >= 3 ? '#fee2e2' : '#fef0c7', color: violations === 0 ? '#027a48' : violations >= 3 ? '#991b1b' : '#b54708', border: `1px solid ${violations === 0 ? '#a6f4c5' : violations >= 3 ? '#fca5a5' : '#fedf89'}` }}>
            {violations === 0 ? (
              <><ShieldCheck size={15} /> Proctored Session Clean (0 Tab Switches)</>
            ) : violations >= 3 ? (
              <><AlertOctagon size={15} /> Flagged: 3 / 3 Tab Switches (Auto-Submitted)</>
            ) : (
              <><ShieldAlert size={15} /> Flagged: {violations} Tab Switch Warning{violations === 1 ? '' : 's'}</>
            )}
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              margin: '16px 0 24px',
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
      {/* Top Navigation Bar with Anti-Cheat, Timer, Fullscreen, and Submit */}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Anti Tab-Switch Proctored Indicator */}
          <div
            title="Anti Tab-Switch Proctoring Engine Active. Tab switches are strictly monitored."
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 700,
              background:
                tabSwitchViolations === 0
                  ? '#ecfdf3'
                  : tabSwitchViolations === 1
                  ? '#fef0c7'
                  : tabSwitchViolations === 2
                  ? '#ffedd5'
                  : '#fee2e2',
              color:
                tabSwitchViolations === 0
                  ? '#027a48'
                  : tabSwitchViolations === 1
                  ? '#b54708'
                  : tabSwitchViolations === 2
                  ? '#c2410c'
                  : '#b91c1c',
              border: `1px solid ${
                tabSwitchViolations === 0
                  ? '#a6f4c5'
                  : tabSwitchViolations === 1
                  ? '#fedf89'
                  : tabSwitchViolations === 2
                  ? '#fdba74'
                  : '#fca5a5'
              }`,
            }}
          >
            {tabSwitchViolations === 0 ? (
              <ShieldCheck size={14} />
            ) : tabSwitchViolations >= 3 ? (
              <AlertOctagon size={14} />
            ) : (
              <ShieldAlert size={14} />
            )}
            <span>
              {tabSwitchViolations === 0
                ? 'Anti-Cheat: 0 / 3 Switches'
                : tabSwitchViolations === 1
                ? '1 / 3 Switches'
                : tabSwitchViolations === 2
                ? '2 / 3 Switches (Final Warning)'
                : '3 / 3 (Auto-Submitting)'}
            </span>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enable Fullscreen Mode'}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span style={{ fontSize: '11px' }}>{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
          </button>

          {/* Timer Chip */}
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
            {/* Actionable Error Banner if Submission failed */}
            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  marginBottom: '18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: error.includes('rules') || error.includes('permissions') ? '10px' : '0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontSize: '13px', fontWeight: 600 }}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSubmit()}
                    disabled={submitting}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {submitting ? <Loader2 size={13} className="spinner" /> : <RefreshCw size={13} />} Retry Submit
                  </button>
                </div>

                {(error.includes('rules') || error.includes('permissions')) && (
                  <div style={{ background: '#ffffff', border: '1px dashed #f87171', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#7f1d1d' }}>
                    <strong>Action Required in Firebase Console:</strong>
                    <div style={{ margin: '4px 0 6px', color: '#4b5563' }}>
                      In your open Firebase Console tab (<strong>Firestore Database</strong> &rarr; <strong>Rules</strong>), replace the <code>match /results/&#123;resultId&#125;</code> rule with:
                    </div>
                    <pre
                      style={{
                        margin: '6px 0',
                        padding: '10px 12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        userSelect: 'all',
                      }}
                    >
{`match /results/{resultId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
}`}
                    </pre>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>
                      Click <strong>Publish</strong> in Firebase Console, then click <strong>Retry Submit</strong> above!
                    </span>
                  </div>
                )}
              </div>
            )}

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

      {/* ----------------------------------------------------------- */}
      {/* Anti Tab-Switch Warning Modal                              */}
      {/* ----------------------------------------------------------- */}
      {showViolationModal && !isDisqualified && (
        <div className="modal-backdrop" style={{ zIndex: 9999, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)' }}>
          <div className="modal-container" style={{ maxWidth: '480px', border: '2px solid #ef4444', animation: 'scaleIn 0.2s ease-out' }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '28px 24px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <AlertTriangle size={30} />
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#991b1b', margin: '0 0 6px', fontFamily: 'Manrope, sans-serif' }}>
                Tab Switch Detected!
              </h3>

              <div
                style={{
                  display: 'inline-block',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fca5a5',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: 800,
                  marginBottom: '14px',
                }}
              >
                VIOLATION {tabSwitchViolations} OF 3 RECORDED
              </div>

              <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#475467', lineHeight: 1.6 }}>
                You navigated away from the examination window. Switching tabs, opening other applications, or minimizing the browser window is strictly prohibited under institutional examination rules.
              </p>

              <div
                style={{
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px',
                  color: '#9f1239',
                  textAlign: 'left',
                  marginBottom: '20px',
                }}
              >
                <strong>Critical Warning:</strong> If you switch tabs <strong>{3 - tabSwitchViolations} more time{3 - tabSwitchViolations === 1 ? '' : 's'}</strong>, your examination will be <strong>automatically finalized and submitted immediately</strong>, and your session will be flagged for academic dishonesty.
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', height: '42px', fontWeight: 700 }}
                onClick={() => setShowViolationModal(false)}
              >
                I Understand & Resume Examination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* Auto-Submitting Disqualification Overlay                    */}
      {/* ----------------------------------------------------------- */}
      {isDisqualified && (
        <div className="modal-backdrop" style={{ zIndex: 9999, background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)' }}>
          <div className="modal-container" style={{ maxWidth: '480px', border: '2px solid #b91c1c', textAlign: 'center', padding: '32px 24px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#991b1b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <AlertOctagon size={36} />
            </div>

            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#991b1b', margin: '0 0 8px', fontFamily: 'Manrope, sans-serif' }}>
              Maximum Tab Violations Exceeded
            </h3>

            <p style={{ fontSize: '14px', color: '#475467', lineHeight: 1.6, margin: '0 0 18px' }}>
              You switched tabs 3 times during the examination. Under proctoring policy, your assessment is being automatically finalized and submitted now.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#991b1b', fontWeight: 700, fontSize: '13px' }}>
              <Loader2 size={18} className="spinner" />
              <span>Finalizing and submitting examination...</span>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* Active Submission In-Progress Animated Overlay             */}
      {/* ----------------------------------------------------------- */}
      {submitting && (
        <div
          className="modal-backdrop"
          style={{
            zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="modal-container"
            style={{
              maxWidth: '460px',
              padding: '36px 28px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              borderRadius: '16px',
              background: '#ffffff',
              animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Pulsing Animated Orbit Spinner */}
            <div
              style={{
                position: 'relative',
                width: '76px',
                height: '76px',
                margin: '0 auto 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '4px solid #e0e7ff',
                  borderTopColor: '#2563eb',
                  borderRightColor: '#6366f1',
                  animation: 'spin 0.9s linear infinite',
                }}
              />
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                }}
              >
                <Sparkles size={24} />
              </div>
            </div>

            <h3
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: '22px',
                fontWeight: 800,
                color: '#0f172a',
                margin: '0 0 8px',
                letterSpacing: '-0.5px',
              }}
            >
              Submitting Examination...
            </h3>

            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, margin: '0 0 20px' }}>
              Please wait while your responses are securely packaged, validated against answer keys, and recorded to your academic transcript.
            </p>

            {/* Step-by-Step Progress Badges */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                textAlign: 'left',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <span>Responses verified ({answeredCount} of {questions.length} answered)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#2563eb', fontWeight: 600 }}>
                <Loader2 size={16} className="spinner" />
                <span>Evaluating answers & calculating score...</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b' }}>
                <ShieldCheck size={16} color="#94a3b8" />
                <span>Recording proctored anti-cheat audit log</span>
              </div>
            </div>

            <div style={{ marginTop: '18px', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
              Do not close, minimize, or reload this window.
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* Manual Submission Confirmation Modal                        */}
      {/* ----------------------------------------------------------- */}
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
                  Warning: You have {questions.length - answeredCount} unanswered question{questions.length - answeredCount === 1 ? '' : 's'}!
                </p>
              )}
              {tabSwitchViolations > 0 && (
                <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#b54708', fontWeight: 600 }}>
                  Note: {tabSwitchViolations} tab switch warning{tabSwitchViolations === 1 ? '' : 's'} will be recorded with your submission.
                </p>
              )}
              <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#64748b' }}>
                Once submitted, your answers are finalized and evaluated by the grading backend. You cannot change your responses.
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
                onClick={() => handleSubmit()}
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
