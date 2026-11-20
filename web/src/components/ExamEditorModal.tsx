import { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Sparkles, FileText } from 'lucide-react';
import type { Course, Question, QuestionOption, QuestionType } from '../types';
import { getAllCourses, getFacultyPermittedCourses } from '../services/courses';
import { saveDraftExam, publishExam } from '../services/exams';
import { useAuth } from '../auth/AuthContext';
import { AiExamModal } from './AiExamModal';
import { CourseModal } from './CourseModal';

interface ExamEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialCourseId?: string;
}

export function ExamEditorModal({ isOpen, onClose, onSaved, initialCourseId }: ExamEditorModalProps) {
  const { user, profile } = useAuth();
  const isFaculty = profile?.role === 'faculty';

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState(initialCourseId || '');
  const [durationMinutes, setDurationMinutes] = useState(30);

  // Default time window: Starts now, Ends in 24 hours
  const now = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const toLocalIso = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [startsAt, setStartsAt] = useState(toLocalIso(now));
  const [endsAt, setEndsAt] = useState(toLocalIso(tomorrow));

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: 'q_1',
      text: 'Which cloud service model provides virtual machines and raw storage?',
      type: 'single',
      options: [
        { id: 'A', text: 'Software as a Service (SaaS)' },
        { id: 'B', text: 'Infrastructure as a Service (IaaS)' },
        { id: 'C', text: 'Platform as a Service (PaaS)' },
        { id: 'D', text: 'Function as a Service (FaaS)' },
      ],
      marks: 2,
      order: 1,
      correctAnswer: 'B',
    },
    {
      id: 'q_2',
      text: 'AWS Lambda requires managing and provisioning virtual machine instances.',
      type: 'boolean',
      options: [
        { id: 'true', text: 'True' },
        { id: 'false', text: 'False' },
      ],
      marks: 1,
      order: 2,
      correctAnswer: 'false',
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  const loadCourses = async () => {
    if (!profile || !user) return;
    try {
      setLoadingCourses(true);
      let data: Course[] = [];
      if (isFaculty) {
        data = await getFacultyPermittedCourses(user.uid, profile.assignedCourses || []);
      } else {
        data = await getAllCourses();
      }
      setCourses(data);
      if (data.length > 0 && !courseId) {
        setCourseId(data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load courses', err);
    } finally {
      setLoadingCourses(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadCourses();
  }, [isOpen, isFaculty, profile, user]);

  if (!isOpen) return null;

  const totalCalculatedMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);

  // Question manipulation helpers
  const addQuestion = (type: QuestionType) => {
    const nextOrder = questions.length + 1;
    const newQId = `q_${Date.now()}`;
    let options: QuestionOption[] = [];
    let defaultAnswer: string | string[] = 'A';

    if (type === 'single') {
      options = [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
      ];
      defaultAnswer = 'A';
    } else if (type === 'boolean') {
      options = [
        { id: 'true', text: 'True' },
        { id: 'false', text: 'False' },
      ];
      defaultAnswer = 'true';
    }

    setQuestions([
      ...questions,
      {
        id: newQId,
        text: '',
        type,
        options,
        marks: 2,
        order: nextOrder,
        correctAnswer: defaultAnswer,
      },
    ]);
  };

  const handleAiQuestionsAccepted = (aiQuestions: Question[]) => {
    const startOrder = questions.length;
    const reordered = aiQuestions.map((q, i) => ({
      ...q,
      order: startOrder + i + 1,
    }));
    setQuestions([...questions, ...reordered]);
    setSuccessNotice(`Appended ${aiQuestions.length} AI-generated questions to the examination draft.`);
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) {
      setError('An examination must have at least one question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i + 1 }));
    setQuestions(updated);
  };

  const updateQuestionText = (index: number, text: string) => {
    const updated = [...questions];
    updated[index].text = text;
    setQuestions(updated);
  };

  const updateQuestionMarks = (index: number, marks: number) => {
    const updated = [...questions];
    updated[index].marks = marks;
    setQuestions(updated);
  };

  const updateOptionText = (qIndex: number, optId: string, text: string) => {
    const updated = [...questions];
    updated[qIndex].options = updated[qIndex].options.map((opt) =>
      opt.id === optId ? { ...opt, text } : opt
    );
    setQuestions(updated);
  };

  const setCorrectAnswer = (qIndex: number, answer: string) => {
    const updated = [...questions];
    updated[qIndex].correctAnswer = answer;
    setQuestions(updated);
  };

  // Validation
  const validateForm = () => {
    if (!title.trim()) {
      setError('Exam title is required.');
      return false;
    }
    if (!courseId) {
      setError('Please select or create a course for this examination.');
      return false;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('The scheduled deadline (endsAt) must be strictly after the start time.');
      return false;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Question ${i + 1} text cannot be empty.`);
        return false;
      }
      for (const opt of q.options) {
        if (!opt.text.trim()) {
          setError(`Please provide text for option ${opt.id} in Question ${i + 1}.`);
          return false;
        }
      }
      if (!q.correctAnswer) {
        setError(`Please mark the correct answer for Question ${i + 1}.`);
        return false;
      }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateForm() || !user) return;
    try {
      setSaving(true);
      setError('');
      const selectedCourse = courses.find((c) => c.id === courseId);
      await saveDraftExam(
        {
          title,
          description,
          courseId,
          courseName: selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : '',
          durationMinutes: Number(durationMinutes),
          totalMarks: totalCalculatedMarks,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          createdBy: user.uid,
        },
        questions
      );
      setSuccessNotice('Draft saved successfully!');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || 'Failed to save draft exam.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateForm() || !user) return;
    try {
      setSaving(true);
      setError('');
      const selectedCourse = courses.find((c) => c.id === courseId);
      const res = await publishExam(
        {
          title,
          description,
          courseId,
          courseName: selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : '',
          durationMinutes: Number(durationMinutes),
          totalMarks: totalCalculatedMarks,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          createdBy: user.uid,
        },
        questions
      );
      setSuccessNotice(res.message || 'Examination published successfully!');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to publish examination.');
    } finally {
      setSaving(false);
    }
  };

  const currentSelectedCourse = courses.find((c) => c.id === courseId);

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container-lg">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="panel-icon"><FileText size={18} /></span>
            <div>
              <h3 style={{ margin: 0 }}>Examination & Assessment Creator</h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Objective questions with server-side answer key protection and AI authoring
              </span>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} style={{ background: 'none', border: 0, cursor: 'pointer' }}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={16} /> {error}</div>}
          {successNotice && <div className="inline-notice" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ecfdf3', color: '#027a48', border: '1px solid #a6f4c5' }}><CheckCircle2 size={16} /> {successNotice}</div>}

          {/* Section 1: Basic Information */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span className="eyebrow" style={{ display: 'block', marginBottom: '8px' }}>STEP 1: GENERAL METADATA</span>
            <div className="form-row">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Examination Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Mid-Term Assessment: Cloud Architecture"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Course / Subject *</label>
                {loadingCourses ? (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Loading courses...</div>
                ) : courses.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#b54708' }}>
                      {isFaculty ? 'No courses assigned to your faculty profile.' : 'No courses found in the database.'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsCourseModalOpen(true)}
                    >
                      <Plus size={13} /> Create Course Now
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                    {!isFaculty && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsCourseModalOpen(true)}
                        title="Add another course"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label>Instructions / Description</label>
              <textarea
                className="form-textarea"
                placeholder="Guidelines for students: e.g. Attempt all questions within the allocated time. No tab switching allowed."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ minHeight: '60px' }}
              />
            </div>

            <div className="form-row" style={{ marginTop: '12px' }}>
              <div className="form-group">
                <label>Duration (Minutes) *</label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  className="form-input"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Starts At (Scheduled Start) *</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Ends At (Hard Deadline) *</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Questions Editor */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span className="eyebrow" style={{ display: 'block' }}>STEP 2: QUESTION BANK</span>
                <h4 style={{ margin: '4px 0 0', fontFamily: 'Manrope, sans-serif' }}>
                  Questions ({questions.length}) · Total Marks: <strong style={{ color: '#2558a7' }}>{totalCalculatedMarks}</strong>
                </h4>
              </div>

              {/* Action Buttons: AI Creation + Manual MCQ / TF */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: '#7c3aed',
                    color: '#fff',
                    borderColor: '#7c3aed',
                    boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                    fontWeight: 700,
                  }}
                  onClick={() => setIsAiModalOpen(true)}
                >
                  <Sparkles size={14} /> Create Test Using AI
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addQuestion('single')}>
                  <Plus size={14} /> Add 4-Choice MCQ
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addQuestion('boolean')}>
                  <Plus size={14} /> Add True/False
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {questions.map((q, qIndex) => (
                <div key={q.id} className="question-item-card">
                  <div className="question-item-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge" style={{ background: '#e2e8f0', color: '#1e293b' }}>
                        Q{qIndex + 1}
                      </span>
                      <span className="badge" style={{ textTransform: 'uppercase' }}>
                        {q.type === 'boolean' ? 'True / False' : 'Multiple Choice'}
                      </span>
                      {q.difficulty && (
                        <span className="badge" style={{ background: '#f8fafc', color: '#64748b' }}>
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
                        title="Remove question"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Question Prompt *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Which AWS service is best suited for serverless event-driven execution?"
                      value={q.text}
                      onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                    />
                  </div>

                  <div className="options-grid">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475467' }}>
                      Options & Select Correct Answer (Protected server-side):
                    </label>
                    {q.options.map((opt) => (
                      <div key={opt.id} className="option-input-row">
                        <label
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                          title="Select as correct answer"
                        >
                          <input
                            type="radio"
                            name={`correct_${q.id}`}
                            checked={q.correctAnswer === opt.id}
                            onChange={() => setCorrectAnswer(qIndex, opt.id)}
                          />
                          <span className="option-prefix">{opt.id}</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ flex: 1 }}
                          placeholder={`Option ${opt.id} text`}
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
                    <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', color: '#64748b' }}>
                      <strong>Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleSaveDraft} disabled={saving}>
            {saving ? <Loader2 size={15} className="spinner" /> : 'Save as Draft'}
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePublish} disabled={saving}>
            {saving ? (
              <><Loader2 size={15} className="spinner" /> Publishing...</>
            ) : (
              <><Sparkles size={15} /> Publish Assessment</>
            )}
          </button>
        </div>
      </div>

      {/* AI Examination Modal */}
      <AiExamModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onAcceptQuestions={handleAiQuestionsAccepted}
        initialSubject={currentSelectedCourse ? currentSelectedCourse.name : ''}
        initialTitle={title}
      />

      {/* Inline Course Creator Modal if needed */}
      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        onCreated={loadCourses}
      />
    </div>
  );
}
