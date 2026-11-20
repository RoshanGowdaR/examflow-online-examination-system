import { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  Trash2,
  Calendar,
  Clock,
  Award,
  Sparkles,
  RefreshCw,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type { Exam } from '../types';
import { getExams, deleteExam, publishExam } from '../services/exams';
import { ExamEditorModal } from './ExamEditorModal';
import { useAuth } from '../auth/AuthContext';
import { isGradingApiConfigured } from '../services/gradingApi';

export function ExamManagementView() {
  const { profile } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadExams = async () => {
    if (!profile) return;
    try {
      setLoading(true);
      setError('');
      const data = await getExams(profile.role, profile.uid);
      setExams(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load examinations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, [profile]);

  const handleDelete = async (examId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete exam "${title}"?`)) return;
    try {
      setActionLoading(examId);
      await deleteExam(examId);
      setExams(exams.filter((e) => e.id !== examId));
      setNotice(`Examination "${title}" deleted.`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete examination.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuickPublish = async (exam: Exam) => {
    try {
      setActionLoading(exam.id);
      setError('');
      // We pass empty questions array to trigger status change if already saved in Firestore
      const res = await publishExam(
        {
          title: exam.title,
          description: exam.description,
          courseId: exam.courseId,
          courseName: exam.courseName,
          durationMinutes: exam.durationMinutes,
          totalMarks: exam.totalMarks,
          startsAt: exam.startsAt,
          endsAt: exam.endsAt,
          createdBy: exam.createdBy,
        },
        [],
        exam.id
      );
      setNotice(res.message);
      await loadExams();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish examination.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredExams = exams.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.courseName && e.courseName.toLowerCase().includes(search.toLowerCase())) ||
      (e.description && e.description.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const apiConfigured = isGradingApiConfigured();

  return (
    <div>
      <div className="view-header">
        <div>
          <h2>Examination Management</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Author, schedule, publish and manage online assessments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadExams} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsEditorOpen(true)}>
            <Plus size={15} /> Create Examination
          </button>
        </div>
      </div>

      {/* Cloud Security Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: apiConfigured ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${apiConfigured ? '#bbf7d0' : '#fde68a'}`,
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {apiConfigured ? (
            <ShieldCheck size={18} color="#16a34a" />
          ) : (
            <AlertTriangle size={18} color="#d97706" />
          )}
          <span>
            <strong>AWS Grading Backend:</strong>{' '}
            {apiConfigured
              ? 'Connected via API Gateway + Lambda for server-side answer key protection and automated grading.'
              : 'VITE_AWS_GRADING_API_URL is pending. (Local Firestore draft mode active; configure Lambda URL for production grading).'}
          </span>
        </div>
      </div>

      {notice && <div className="inline-notice" style={{ marginBottom: '14px' }}>{notice}</div>}
      {error && <div className="error-message" style={{ marginBottom: '14px' }}>{error}</div>}

      <div className="filter-row">
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="search-input"
            style={{ paddingLeft: '34px', width: '100%' }}
            placeholder="Search exams by title or course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'published', 'draft'] as const).map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '200px' }}>
          <div className="spinner" /> Loading examinations...
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ClipboardList size={22} /></div>
          <h4>No examinations found</h4>
          <p>Create your first examination assessment with objective questions.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setIsEditorOpen(true)}>
            <Plus size={14} /> Create Examination
          </button>
        </div>
      ) : (
        <div className="exam-cards-grid">
          {filteredExams.map((exam) => {
            const isPublished = exam.status === 'published';
            const startDate = exam.startsAt ? new Date(exam.startsAt) : null;
            const endDate = exam.endsAt ? new Date(exam.endsAt) : null;

            return (
              <div key={exam.id} className="exam-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span className={`badge ${isPublished ? 'badge-status-published' : 'badge-status-draft'}`}>
                      {exam.status}
                    </span>
                    <button
                      className="btn-danger btn-sm"
                      style={{ background: 'none', border: 0, padding: '4px', cursor: 'pointer' }}
                      onClick={() => handleDelete(exam.id, exam.title)}
                      disabled={actionLoading === exam.id}
                      title="Delete exam"
                    >
                      {actionLoading === exam.id ? <Loader2 size={13} className="spinner" /> : <Trash2 size={15} />}
                    </button>
                  </div>

                  <h3 className="exam-card-title">{exam.title}</h3>
                  <p className="exam-card-desc">{exam.description || 'No description provided.'}</p>
                </div>

                <div>
                  <div className="exam-details-list">
                    <div className="exam-detail-row">
                      <Award size={14} color="#64748b" />
                      <span>Course: <strong>{exam.courseName || 'Unassigned'}</strong></span>
                    </div>
                    <div className="exam-detail-row">
                      <Clock size={14} color="#64748b" />
                      <span>Duration: <strong>{exam.durationMinutes} mins</strong> · Marks: <strong>{exam.totalMarks}</strong></span>
                    </div>
                    {startDate && endDate && (
                      <div className="exam-detail-row">
                        <Calendar size={14} color="#64748b" />
                        <span style={{ fontSize: '11px' }}>
                          Window: {startDate.toLocaleDateString()} {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &rarr; {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    {!isPublished && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => handleQuickPublish(exam)}
                        disabled={actionLoading === exam.id}
                      >
                        <Sparkles size={13} /> Publish Exam
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ExamEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSaved={loadExams}
      />
    </div>
  );
}

