import { useState } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Sliders,
} from 'lucide-react';
import type { Question, QuestionType } from '../types';
import { generateExamQuestionsWithAi } from '../services/aiApi';

interface AiExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptQuestions: (questions: Question[]) => void;
  initialSubject?: string;
  initialTitle?: string;
}

export function AiExamModal({
  isOpen,
  onClose,
  onAcceptQuestions,
  initialSubject = '',
  initialTitle = '',
}: AiExamModalProps) {
  // Input form states
  const [subject, setSubject] = useState(initialSubject || '');
  const [title, setTitle] = useState(initialTitle || '');
  const [topics, setTopics] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [includeMcq, setIncludeMcq] = useState(true);
  const [includeTrueFalse, setIncludeTrueFalse] = useState(true);
  const [marksPerQuestion, setMarksPerQuestion] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // Processing & Review states
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [reviewedQuestions, setReviewedQuestions] = useState<Question[] | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError('Please provide a subject or course name.');
      return;
    }
    if (!includeMcq && !includeTrueFalse) {
      setError('Please select at least one question type (MCQ or True/False).');
      return;
    }

    const questionTypes: ('single' | 'boolean')[] = [];
    if (includeMcq) questionTypes.push('single');
    if (includeTrueFalse) questionTypes.push('boolean');

    try {
      setGenerating(true);
      setError('');
      const res = await generateExamQuestionsWithAi({
        subject: subject.trim(),
        title: title.trim(),
        topics: topics.trim(),
        difficulty,
        questionCount: Number(questionCount) || 5,
        questionTypes,
        marksPerQuestion: Number(marksPerQuestion) || 2,
        durationMinutes: Number(durationMinutes) || 30,
        additionalInstructions: additionalInstructions.trim(),
      });

      setReviewedQuestions(res.questions);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate questions with AI.');
    } finally {
      setGenerating(false);
    }
  };

  // Review manipulation
  const updateQuestionText = (index: number, text: string) => {
    if (!reviewedQuestions) return;
    const updated = [...reviewedQuestions];
    updated[index].text = text;
    setReviewedQuestions(updated);
  };

  const updateQuestionMarks = (index: number, marks: number) => {
    if (!reviewedQuestions) return;
    const updated = [...reviewedQuestions];
    updated[index].marks = Number(marks) > 0 ? Number(marks) : 1;
    setReviewedQuestions(updated);
  };

  const updateOptionText = (qIndex: number, optId: string, text: string) => {
    if (!reviewedQuestions) return;
    const updated = [...reviewedQuestions];
    updated[qIndex].options = updated[qIndex].options.map((opt) =>
      opt.id === optId ? { ...opt, text } : opt
    );
    setReviewedQuestions(updated);
  };

  const setCorrectAnswer = (qIndex: number, answerId: string) => {
    if (!reviewedQuestions) return;
    const updated = [...reviewedQuestions];
    updated[qIndex].correctAnswer = answerId;
    setReviewedQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    if (!reviewedQuestions) return;
    const updated = reviewedQuestions.filter((_, i) => i !== index);
    setReviewedQuestions(updated);
  };

  const addManualQuestion = (type: QuestionType) => {
    if (!reviewedQuestions) return;
    const nextOrder = reviewedQuestions.length + 1;
    const newQ: Question = {
      id: `q_manual_${Date.now()}`,
      text: '',
      type,
      options:
        type === 'boolean'
          ? [
              { id: 'true', text: 'True' },
              { id: 'false', text: 'False' },
            ]
          : [
              { id: 'A', text: '' },
              { id: 'B', text: '' },
              { id: 'C', text: '' },
              { id: 'D', text: '' },
            ],
      correctAnswer: type === 'boolean' ? 'true' : 'A',
      marks: Number(marksPerQuestion) || 2,
      order: nextOrder,
    };
    setReviewedQuestions([...reviewedQuestions, newQ]);
  };

  const handleAcceptAll = () => {
    if (!reviewedQuestions || reviewedQuestions.length === 0) return;
    onAcceptQuestions(reviewedQuestions);
    setReviewedQuestions(null);
    onClose();
  };

  const totalReviewedMarks = reviewedQuestions
    ? reviewedQuestions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0)
    : 0;

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container-lg" style={{ maxHeight: '92vh' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="panel-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <Sparkles size={18} />
            </span>
            <div>
              <h3 style={{ margin: 0 }}>AI-Powered Examination Generator</h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Generate objective assessments with Gemini AI and review before drafting
              </span>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} style={{ background: 'none', border: 0, cursor: 'pointer' }}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto' }}>
          {error && (
            <div className="error-message" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Phase 1: Input Form */}
          {!reviewedQuestions ? (
            <form onSubmit={handleGenerate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Subject / Course Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Cloud Computing & Distributed Systems"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Examination Title (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Unit 2 Assessment: AWS Core Services"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Topics or Specific Syllabus Text</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Enter specific modules or topics (e.g. Amazon EC2, S3 storage classes, IAM policies, VPC security groups, Lambda serverless triggers). The AI will focus exclusively on these topics."
                    value={topics}
                    onChange={(e) => setTopics(e.target.value)}
                    style={{ minHeight: '90px' }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Tip: You can paste textbook syllabus lines or course learning outcomes.
                  </span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Difficulty Level</label>
                    <select
                      className="form-select"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as any)}
                    >
                      <option value="easy">Easy (Foundational & Definitions)</option>
                      <option value="medium">Medium (Standard Academic Level)</option>
                      <option value="hard">Hard (Advanced Problem Solving)</option>
                      <option value="mixed">Mixed (Balanced Spread)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Number of Questions (1 – 30)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      className="form-input"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Math.min(30, Math.max(1, Number(e.target.value))))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Marks per Question</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      className="form-input"
                      value={marksPerQuestion}
                      onChange={(e) => setMarksPerQuestion(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Duration (Minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="180"
                      className="form-input"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Question Type Selection */}
                <div className="form-group">
                  <label>Question Formats to Include</label>
                  <div style={{ display: 'flex', gap: '18px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={includeMcq}
                        onChange={(e) => setIncludeMcq(e.target.checked)}
                      />
                      <span>4-Choice Multiple Choice (MCQ)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={includeTrueFalse}
                        onChange={(e) => setIncludeTrueFalse(e.target.checked)}
                      />
                      <span>True / False Questions</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Additional Instructor Instructions (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Focus on practical AWS CLI commands and avoid negative questions."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                  />
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#475467' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                    <Sliders size={15} color="#7c3aed" />
                    <span>Human-in-the-Loop Review Principle</span>
                  </div>
                  Questions generated by Gemini AI are presented in an editable review panel where you can verify, modify choices, change correct answers, and approve questions before adding them to your assessment draft.
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={generating}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={generating} style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                  {generating ? (
                    <>
                      <Loader2 size={16} className="spinner" /> Generating with Gemini AI...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Generate Questions with AI
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Phase 2: Interactive Review Interface */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '14px 18px', borderRadius: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, fontFamily: 'Manrope, sans-serif', fontSize: '16px', color: '#5b21b6' }}>
                    Generated Questions ({reviewedQuestions.length})
                  </h4>
                  <span style={{ fontSize: '12px', color: '#6d28d9' }}>
                    Total Marks: <strong>{totalReviewedMarks}</strong> · Review and edit any question before accepting
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addManualQuestion('single')}>
                    <Plus size={14} /> Add MCQ
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addManualQuestion('boolean')}>
                    <Plus size={14} /> Add T/F
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {reviewedQuestions.map((q, qIndex) => (
                  <div key={q.id} className="question-item-card" style={{ borderLeft: '4px solid #7c3aed' }}>
                    <div className="question-item-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', fontWeight: 700 }}>
                          Q{qIndex + 1}
                        </span>
                        <span className="badge" style={{ textTransform: 'uppercase' }}>
                          {q.type === 'boolean' ? 'True / False' : 'MCQ'}
                        </span>
                        {q.difficulty && (
                          <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                            {q.difficulty}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <label style={{ fontSize: '11px', color: '#64748b' }}>Marks:</label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            style={{ width: '50px', padding: '3px 6px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '5px' }}
                            value={q.marks}
                            onChange={(e) => updateQuestionMarks(qIndex, Number(e.target.value))}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          style={{ border: 0, background: 'none', cursor: 'pointer', padding: '4px' }}
                          onClick={() => removeQuestion(qIndex)}
                          title="Delete question"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Question Prompt</label>
                      <input
                        type="text"
                        className="form-input"
                        value={q.text}
                        onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                      />
                    </div>

                    <div className="options-grid">
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475467' }}>
                        Options & Correct Answer:
                      </label>
                      {q.options.map((opt) => (
                        <div key={opt.id} className="option-input-row">
                          <label
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                            title="Set as correct answer"
                          >
                            <input
                              type="radio"
                              name={`ai_correct_${q.id}`}
                              checked={q.correctAnswer === opt.id}
                              onChange={() => setCorrectAnswer(qIndex, opt.id)}
                            />
                            <span className="option-prefix">{opt.id}</span>
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ flex: 1 }}
                            value={opt.text}
                            onChange={(e) => updateOptionText(qIndex, opt.id, e.target.value)}
                          />
                          {q.correctAnswer === opt.id && (
                            <span className="badge badge-status-published" style={{ fontSize: '10px' }}>
                              Correct Answer
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {q.explanation && (
                      <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', color: '#64748b' }}>
                        <strong>AI Explanation:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReviewedQuestions(null)}
                >
                  &larr; Back to Parameters
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAcceptAll}
                  style={{ background: '#059669', borderColor: '#059669' }}
                >
                  <CheckCircle2 size={16} /> Accept & Add {reviewedQuestions.length} Questions to Exam Draft
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
