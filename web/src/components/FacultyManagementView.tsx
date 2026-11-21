import { useState, useEffect } from 'react';
import { Users, Plus, Search, RefreshCw, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import type { UserProfile } from '../types';
import { getFacultyUsers, toggleUserStatus, sendUserPasswordReset } from '../services/users';
import { CreateFacultyModal } from './CreateFacultyModal';

export function FacultyManagementView() {
  const [facultyList, setFacultyList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadFaculty = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getFacultyUsers();
      setFacultyList(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load faculty directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaculty();
  }, []);

  const handleToggleStatus = async (user: UserProfile) => {
    try {
      setActionLoading(user.uid);
      const newStatus = await toggleUserStatus(user.uid, user.active);
      setFacultyList(facultyList.map((f) => (f.uid === user.uid ? { ...f, active: newStatus } : f)));
      setNotice(`Faculty ${user.name} is now ${newStatus ? 'Active' : 'Inactive'}.`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update faculty status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendPasswordLink = async (user: UserProfile) => {
    try {
      setActionLoading(`pass_${user.uid}`);
      setError('');
      const res = await sendUserPasswordReset(user.email, user.role);
      setNotice(res.message);
      setTimeout(() => setNotice(''), 7000);
    } catch (err: any) {
      setError(err?.message || 'Failed to send password setup email.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredFaculty = facultyList.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.email.toLowerCase().includes(search.toLowerCase()) ||
      (f.employeeId && f.employeeId.toLowerCase().includes(search.toLowerCase())) ||
      (f.department && f.department.toLowerCase().includes(search.toLowerCase()));
    const matchesDept = deptFilter === 'all' || (f.department && f.department.toLowerCase() === deptFilter.toLowerCase());
    return matchesSearch && matchesDept;
  });

  return (
    <div>
      <div className="view-header">
        <div>
          <h2>Faculty Management</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Provision, manage, and assign courses to academic faculty instructors.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadFaculty} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
            <Plus size={15} /> Create Faculty
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
            placeholder="Search faculty by name, ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-select"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        >
          <option value="all">All Departments</option>
          <option value="Computer Science & Engineering">Computer Science & Engineering</option>
          <option value="Information Science & Engineering">Information Science & Engineering</option>
          <option value="Electronics & Communication">Electronics & Communication</option>
          <option value="Artificial Intelligence & ML">Artificial Intelligence & ML</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '200px' }}>
          <div className="spinner" /> Loading faculty directory...
        </div>
      ) : filteredFaculty.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users size={22} /></div>
          <h4>No faculty accounts found</h4>
          <p>Get started by creating your institution's first faculty account.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
            <Plus size={14} /> Create Faculty
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Faculty Details</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Assigned Courses</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFaculty.map((f) => (
                <tr key={f.uid}>
                  <td>
                    <strong>{f.name}</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{f.email}</div>
                  </td>
                  <td>
                    <code style={{ fontSize: '11px', color: '#1e293b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                      {f.employeeId || '—'}
                    </code>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#475569' }}>{f.department || 'General'}</span>
                  </td>
                  <td>
                    {f.assignedCourses && f.assignedCourses.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {f.assignedCourses.map((c) => (
                          <span key={c} className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '10px' }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>None assigned</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${f.active ? 'badge-status-active' : 'badge-status-inactive'}`}>
                      {f.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSendPasswordLink(f)}
                        disabled={actionLoading === `pass_${f.uid}`}
                        title="Send password setup link or activate Auth credentials"
                        style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {actionLoading === `pass_${f.uid}` ? (
                          <Loader2 size={12} className="spinner" />
                        ) : (
                          <>
                            <KeyRound size={12} /> Password Link
                          </>
                        )}
                      </button>
                      <button
                        className={`btn btn-sm ${f.active ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => handleToggleStatus(f)}
                        disabled={actionLoading === f.uid}
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      >
                        {actionLoading === f.uid ? (
                          <Loader2 size={13} className="spinner" />
                        ) : f.active ? (
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

      <CreateFacultyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={loadFaculty}
      />
    </div>
  );
}
