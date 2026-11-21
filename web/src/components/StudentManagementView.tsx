import { useState, useEffect } from 'react';
import { GraduationCap, Plus, Search, RefreshCw, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import type { UserProfile } from '../types';
import { getStudentUsers, getStudentsForFaculty, toggleUserStatus, sendUserPasswordReset } from '../services/users';
import { CreateStudentModal } from './CreateStudentModal';
import { useAuth } from '../auth/AuthContext';

export function StudentManagementView() {
  const { profile } = useAuth();
  const isFaculty = profile?.role === 'faculty';

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError('');
      if (isFaculty && profile) {
        const data = await getStudentsForFaculty(profile.department, profile.assignedCourses || []);
        setStudents(data);
      } else {
        const data = await getStudentUsers();
        setStudents(data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load student directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [profile, isFaculty]);

  const handleToggleStatus = async (user: UserProfile) => {
    try {
      setActionLoading(user.uid);
      const newStatus = await toggleUserStatus(user.uid, user.active);
      setStudents(students.map((s) => (s.uid === user.uid ? { ...s, active: newStatus } : s)));
      setNotice(`Student ${user.name} is now ${newStatus ? 'Active' : 'Inactive'}.`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update student status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendPasswordLink = async (user: UserProfile) => {
    try {
      setActionLoading(`pass_${user.uid}`);
      setError('');
      const res = await sendUserPasswordReset(user.email, user.usn || user.role);
      setNotice(res.message);
      setTimeout(() => setNotice(''), 7000);
    } catch (err: any) {
      setError(err?.message || 'Failed to send password setup email.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.usn && s.usn.toLowerCase().includes(search.toLowerCase())) ||
      (s.registrationNumber && s.registrationNumber.toLowerCase().includes(search.toLowerCase()));
    const matchesSem = semesterFilter === 'all' || s.semester === semesterFilter;
    return matchesSearch && matchesSem;
  });

  return (
    <div>
      <div className="view-header">
        <div>
          <h2>Student Management</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {isFaculty
              ? `Manage students enrolled in ${profile?.department || 'your department'} and assigned courses.`
              : 'Institutional student directory, course enrollment, and assessment access.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadStudents} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
            <Plus size={15} /> Create Student
          </button>
        </div>
      </div>

      {notice && <div className="inline-notice" style={{ marginBottom: '14px' }}>{notice}</div>}
      {error && (
        <div className="error-message" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="filter-row">
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="search-input"
            style={{ paddingLeft: '34px', width: '100%' }}
            placeholder="Search students by name, USN, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-select"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
        >
          <option value="all">All Semesters</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
            <option key={sem} value={String(sem)}>
              Semester {sem}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '200px' }}>
          <div className="spinner" /> Loading student directory...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><GraduationCap size={22} /></div>
          <h4>No students found</h4>
          <p>
            {isFaculty
              ? 'No students are currently enrolled in your courses or department. Click "+ Create Student" to enroll students.'
              : 'No students found matching your criteria.'}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
            <Plus size={14} /> Create Student
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student Details</th>
                <th>USN / Roll Number</th>
                <th>Department</th>
                <th>Semester</th>
                <th>Enrolled Courses</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.uid}>
                  <td>
                    <strong>{s.name}</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{s.email}</div>
                  </td>
                  <td>
                    <code style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '3px 8px', borderRadius: '4px' }}>
                      {s.usn || '—'}
                    </code>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#475569' }}>{s.department || 'General'}</span>
                  </td>
                  <td>
                    <span className="badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                      Sem {s.semester || '—'}
                    </span>
                  </td>
                  <td>
                    {s.courseIds && s.courseIds.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {s.courseIds.map((c) => (
                          <span key={c} className="badge" style={{ background: '#f0fdf4', color: '#15803d', fontSize: '10px' }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>None</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${s.active ? 'badge-status-active' : 'badge-status-inactive'}`}>
                      {s.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSendPasswordLink(s)}
                        disabled={actionLoading === `pass_${s.uid}`}
                        title="Send password setup link or activate Auth credentials"
                        style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {actionLoading === `pass_${s.uid}` ? (
                          <Loader2 size={12} className="spinner" />
                        ) : (
                          <>
                            <KeyRound size={12} /> Password Link
                          </>
                        )}
                      </button>
                      <button
                        className={`btn btn-sm ${s.active ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => handleToggleStatus(s)}
                        disabled={actionLoading === s.uid}
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      >
                        {actionLoading === s.uid ? (
                          <Loader2 size={13} className="spinner" />
                        ) : s.active ? (
                          'Deactivate'
                        ) : (
                          'Activate'
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateStudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={loadStudents}
      />
    </div>
  );
}

