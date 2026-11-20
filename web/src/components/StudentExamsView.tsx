import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  Award,
  Calendar,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type { Exam } from '../types';
import { getExams } from '../services/exams';
import { getStudentResults } from '../services/results';
import { useAuth } from '../auth/AuthContext';

export function StudentExamsView() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [submittedExamIds, setSubmittedExamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!user || !profile) return;
    try {
      setLoading(true);
      setError('');

      // Fetch published exams
      const publishedExams = await getExams('student');
      setExams(publishedExams);

      // Fetch existing submissions for this student
      const results = await getStudentResults(user.uid);
      const submittedIds = new Set(results.map((r) => r.examId));
      setSubmittedExamIds(submittedIds);
    } catch (err: any) {
      setError(err?.message || 'Failed to load examinations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, profile]);

  const now = Date.now();

  return (
    <div>
      <div className="view-header">
        <div>
          <h2>Available Examinations</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Browse and attempt scheduled assessments for your enrolled courses.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '14px' }}>{error}</div>}

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '200px' }}>
          <div className="spinner" /> Loading examinations...
        </div>
      ) : exams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ClipboardList size={22} /></div>
          <h4>No examinations currently published</h4>
          <p>Your faculty has not published any active assessments yet. Check back soon!</p>
        </div>
      ) : (
        <div className="exam-cards-grid">
          {exams.map((exam) => {
            const startDate = exam.startsAt ? new Date(exam.startsAt).getTime() : null;
            const endDate = exam.endsAt ? new Date(exam.endsAt).getTime() : null;

            const isUpcoming = startDate !== null && now < startDate;
            const isEnded = endDate !== null && now > endDate;
            const hasSubmitted = submittedExamIds.has(exam.id);

            return (
              <div key={exam.id} className="exam-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}>
                      {exam.courseName || 'Course'}
                    </span>

                    {hasSubmitted ? (
                      <span className="badge badge-status-published" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> Attempted
                      </span>
                    ) : isUpcoming ? (
                      <span className="badge badge-status-upcoming">Upcoming</span>
                    ) : isEnded ? (
                      <span className="badge badge-status-ended">Expired</span>
                    ) : (
                      <span className="badge badge-status-published" style={{ background: '#dcfce7', color: '#15803d' }}>
                        Active Now
                      </span>
                    )}
                  </div>

                  <h3 className="exam-card-title">{exam.title}</h3>
                  <p className="exam-card-desc">{exam.description || 'Attempt all questions before the allocated deadline.'}</p>
                </div>

                <div>
                  <div className="exam-details-list">
                    <div className="exam-detail-row">
                      <Clock size={14} color="#64748b" />
                      <span>Duration: <strong>{exam.durationMinutes} mins</strong></span>
                    </div>
                    <div className="exam-detail-row">
                      <Award size={14} color="#64748b" />
                      <span>Total Marks: <strong>{exam.totalMarks}</strong></span>
                    </div>
                    {exam.endsAt && (
                      <div className="exam-detail-row">
                        <Calendar size={14} color="#64748b" />
                        <span style={{ fontSize: '11px' }}>
                          Deadline: {new Date(exam.endsAt).toLocaleDateString()} {new Date(exam.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '14px' }}>
                    {hasSubmitted ? (
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', cursor: 'default' }}
                        disabled
                      >
                        <CheckCircle2 size={15} color="#059669" /> Already Submitted
                      </button>
                    ) : isUpcoming ? (
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%' }}
                        disabled
                      >
                        Starts at {new Date(exam.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </button>
                    ) : isEnded ? (
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%' }}
                        disabled
                      >
                        Deadline Passed
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        onClick={() => navigate(`/exam/${exam.id}/attempt`)}
                      >
                        Start Assessment <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
