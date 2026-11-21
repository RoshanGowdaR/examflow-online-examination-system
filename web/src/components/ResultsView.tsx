import { useState, useEffect } from 'react';
import { Search, RefreshCw, BarChart3 } from 'lucide-react';
import type { ExamResult } from '../types';
import { getStudentResults, getAllResults } from '../services/results';
import { useAuth } from '../auth/AuthContext';

export function ResultsView() {
  const { user, profile } = useAuth();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const isStudent = profile?.role === 'student';

  const loadResults = async () => {
    if (!user || !profile) return;
    try {
      setLoading(true);
      setError('');
      if (isStudent) {
        const data = await getStudentResults(user.uid);
        setResults(data);
      } else {
        const data = await getAllResults();
        setResults(data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load results. Check Firestore permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, [user, profile]);

  const filtered = results.filter((r) => {
    const term = search.toLowerCase();
    return (
      r.examTitle.toLowerCase().includes(term) ||
      r.studentEmail.toLowerCase().includes(term) ||
      r.examId.toLowerCase().includes(term)
    );
  });

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return { bg: '#ecfdf3', text: '#027a48', border: '#a6f4c5' };
    if (pct >= 50) return { bg: '#eff8ff', text: '#175cd3', border: '#b2ddff' };
    return { bg: '#fef3f2', text: '#b42318', border: '#fecdca' };
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h2>{isStudent ? 'My Assessment Results' : 'Student Examination Submissions'}</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {isStudent
              ? 'Review your marks, grades, and automated evaluation summaries.'
              : 'Official server-evaluated results graded via AWS Lambda.'}
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadResults} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '14px' }}>{error}</div>}

      <div className="filter-row">
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="search-input"
            style={{ paddingLeft: '34px', width: '100%' }}
            placeholder="Search by exam title or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '200px' }}>
          <div className="spinner" /> Loading evaluation records...
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><BarChart3 size={22} /></div>
          <h4>No evaluation results recorded</h4>
          <p>
            {isStudent
              ? 'You have not submitted any examinations yet. Complete an active assessment to view your results.'
              : 'No students have submitted examinations yet.'}
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Examination</th>
                {!isStudent && <th>Student Email</th>}
                <th>Score</th>
                <th>Performance</th>
                <th>Correct Questions</th>
                <th>Anti-Cheat Status</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const colors = getScoreColor(r.percentage);
                const submitDate = r.submittedAt?.toDate
                  ? r.submittedAt.toDate().toLocaleString()
                  : r.submittedAt
                  ? new Date(r.submittedAt).toLocaleString()
                  : 'Just now';

                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.examTitle}</strong>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>ID: {r.examId}</div>
                    </td>
                    {!isStudent && (
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{r.studentEmail}</span>
                      </td>
                    )}
                    <td>
                      <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                        {r.score} / {r.totalMarks}
                      </strong>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          fontWeight: 700,
                        }}
                      >
                        {r.percentage}%
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#475467' }}>
                        {r.correctCount} of {r.questionCount}
                      </span>
                    </td>
                    <td>
                      {r.tabSwitchViolations === 0 || !r.tabSwitchViolations ? (
                        <span
                          className="badge"
                          style={{
                            background: '#ecfdf3',
                            color: '#027a48',
                            border: '1px solid #a6f4c5',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          Clean (0 Switches)
                        </span>
                      ) : r.tabSwitchViolations >= 3 ? (
                        <span
                          className="badge"
                          style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #fca5a5',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          ⚠️ 3 Switches (Auto-Submitted)
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            background: '#fef0c7',
                            color: '#b54708',
                            border: '1px solid #fedf89',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          ⚠️ {r.tabSwitchViolations} Switch{r.tabSwitchViolations === 1 ? '' : 'es'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{submitDate}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
