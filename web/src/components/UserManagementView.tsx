import { useState, useEffect } from 'react';
import { Users, Search, Info, Loader2, RefreshCw } from 'lucide-react';
import type { UserProfile, UserRole } from '../types';
import { getAllUsers, toggleUserStatus, updateUserRole } from '../services/users';

export function UserManagementView() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAllUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load user directory. Check Firestore permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleStatus = async (user: UserProfile) => {
    try {
      setActionLoading(user.uid);
      const newStatus = await toggleUserStatus(user.uid, user.active);
      setUsers(users.map((u) => (u.uid === user.uid ? { ...u, active: newStatus } : u)));
      setNotice(`User ${user.name} is now ${newStatus ? 'Active' : 'Inactive'}.`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update user status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (user: UserProfile, newRole: UserRole) => {
    try {
      setActionLoading(user.uid);
      await updateUserRole(user.uid, newRole);
      setUsers(users.map((u) => (u.uid === user.uid ? { ...u, role: newRole } : u)));
      setNotice(`Updated ${user.name}'s role to ${newRole}.`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update user role.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.uid.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div>
      <div className="view-header">
        <div>
          <h2>User Directory & Access Control</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Manage user roles, platform access and activation status.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadUsers} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh
        </button>
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
            placeholder="Search by name, email, or UID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'admin', 'faculty', 'student'] as const).map((r) => (
            <button
              key={r}
              className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRoleFilter(r)}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '200px' }}>
          <div className="spinner" /> Loading user directory...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users size={22} /></div>
          <h4>No users found</h4>
          <p>No user accounts matched the filter criteria.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role</th>
                <th>Status</th>
                <th>Firebase UID</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.uid}>
                  <td>
                    <strong>{u.name}</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{u.email}</div>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                      disabled={actionLoading === u.uid}
                    >
                      <option value="admin">Admin</option>
                      <option value="faculty">Faculty</option>
                      <option value="student">Student</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.active ? 'badge-status-active' : 'badge-status-inactive'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontSize: '11px', color: '#475569' }}>
                      {u.uid.slice(0, 10)}...{u.uid.slice(-4)}
                    </code>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => handleToggleStatus(u)}
                      disabled={actionLoading === u.uid}
                    >
                      {actionLoading === u.uid ? (
                        <Loader2 size={13} className="spinner" />
                      ) : u.active ? (
                        'Deactivate'
                      ) : (
                        'Activate'
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Account Provisioning Help Note */}
      <div className="notice-box" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={16} color="#345e9a" />
          <strong>Account Provisioning Guide</strong>
        </div>
        <p>
          To add a new user to the platform:
          1. Create the user in <strong>Firebase Console &rarr; Authentication &rarr; Users &rarr; Add User</strong>.
          2. Copy their unique Firebase Auth UID.
          3. In Firestore, create a document under <code>users/{'{UID}'}</code> with fields <code>name</code>, <code>email</code>, <code>role</code>, and <code>active: true</code>.
        </p>
      </div>
    </div>
  );
}
