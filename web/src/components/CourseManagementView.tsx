import { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Trash2, Loader2, RefreshCw } from 'lucide-react';
import type { Course } from '../types';
import { getAllCourses, getFacultyPermittedCourses, deleteCourse } from '../services/courses';
import { CourseModal } from './CourseModal';
import { useAuth } from '../auth/AuthContext';

export function CourseManagementView() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isFaculty = profile?.role === 'faculty';

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCourses = async () => {
    if (!profile || !user) return;
    try {
      setLoading(true);
      setError('');
      if (isFaculty) {
        const data = await getFacultyPermittedCourses(user.uid, profile.assignedCourses || []);
        setCourses(data);
      } else {
        const data = await getAllCourses();
        setCourses(data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, [profile, user, isFaculty]);

  const handleDelete = async (courseId: string, courseCode: string) => {
    if (!window.confirm(`Are you sure you want to delete course ${courseCode}?`)) return;
    try {
      setDeletingId(courseId);
      await deleteCourse(courseId);
      setCourses(courses.filter((c) => c.id !== courseId));
      setNotice(`Course ${courseCode} deleted successfully.`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete course.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredCourses = courses.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      (c.department && c.department.toLowerCase().includes(search.toLowerCase())) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="view-header">
        <div>
          <h2>{isFaculty ? 'My Assigned Courses' : 'Courses & Curriculum'}</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {isFaculty
              ? 'Academic courses and subjects assigned to your faculty profile.'
              : 'Institutional subjects, department mapping, and faculty assignment.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadCourses} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh
          </button>
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
              <Plus size={15} /> Add Course
            </button>
          )}
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
            placeholder="Search courses by name, code, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '200px' }}>
          <div className="spinner" /> Loading courses...
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><BookOpen size={22} /></div>
          <h4>No courses found</h4>
          <p>
            {isFaculty
              ? 'No courses have been assigned to your profile yet. Contact your administrator.'
              : 'Get started by creating the first course syllabus for examinations.'}
          </p>
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
              <Plus size={14} /> Create First Course
            </button>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course Title</th>
                <th>Department</th>
                <th>Assigned Faculty</th>
                <th>Description</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}>
                      {c.code}
                    </span>
                  </td>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#475569' }}>{c.department || 'General'}</span>
                  </td>
                  <td>
                    {c.assignedFacultyNames && c.assignedFacultyNames.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {c.assignedFacultyNames.map((name) => (
                          <span key={name} className="badge" style={{ background: '#f5f3ff', color: '#6d28d9', fontSize: '10px' }}>
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ color: '#64748b', maxWidth: '320px', fontSize: '11px' }}>
                    {c.description || '—'}
                  </td>
                  {isAdmin && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(c.id, c.code)}
                        disabled={deletingId === c.id}
                      >
                        {deletingId === c.id ? <Loader2 size={13} className="spinner" /> : <Trash2 size={13} />}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CourseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={loadCourses}
      />
    </div>
  );
}
