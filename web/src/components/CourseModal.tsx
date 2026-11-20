import { useState, useEffect } from 'react';
import { X, BookOpen, Loader2, Check } from 'lucide-react';
import { createCourse } from '../services/courses';
import { getFacultyUsers } from '../services/users';
import { useAuth } from '../auth/AuthContext';
import type { UserProfile } from '../types';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CourseModal({ isOpen, onClose, onCreated }: CourseModalProps) {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [description, setDescription] = useState('');
  const [assignedFacultyIds, setAssignedFacultyIds] = useState<string[]>([]);
  const [facultyList, setFacultyList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    async function load() {
      try {
        if (isAdmin) {
          const list = await getFacultyUsers();
          setFacultyList(list);
        }
      } catch (err) {
        console.error('Failed to load faculty for course assignment', err);
      }
    }
    load();
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  const toggleFaculty = (fUid: string) => {
    if (assignedFacultyIds.includes(fUid)) {
      setAssignedFacultyIds(assignedFacultyIds.filter((id) => id !== fUid));
    } else {
      setAssignedFacultyIds([...assignedFacultyIds, fUid]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError('Course title and course code are required.');
      return;
    }
    if (!user) return;

    try {
      setLoading(true);
      setError('');

      const assignedFacultyNames = facultyList
        .filter((f) => assignedFacultyIds.includes(f.uid))
        .map((f) => f.name);

      await createCourse({
        name,
        code,
        department,
        description,
        assignedFacultyIds,
        assignedFacultyNames,
        createdBy: user.uid,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create course. Please check Firestore permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="panel-icon"><BookOpen size={18} /></span>
            <div>
              <h3 style={{ margin: 0 }}>Add New Course</h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Curriculum subject and faculty assignment</span>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} style={{ background: 'none', border: 0, cursor: 'pointer' }}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="form-row">
              <div className="form-group">
                <label>Course Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Cloud Computing & Distributed Systems"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Course Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CC601"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Academic Department</label>
              <select
                className="form-select"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                <option value="Information Science & Engineering">Information Science & Engineering</option>
                <option value="Electronics & Communication">Electronics & Communication</option>
                <option value="Artificial Intelligence & ML">Artificial Intelligence & ML</option>
                <option value="General Science">General Science</option>
              </select>
            </div>

            <div className="form-group">
              <label>Description & Learning Objectives</label>
              <textarea
                className="form-textarea"
                placeholder="Brief summary of syllabus, modules, or departmental notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {isAdmin && (
              <div className="form-group">
                <label>Assign Faculty Instructors</label>
                {facultyList.length === 0 ? (
                  <span style={{ fontSize: '11px', color: '#64748b' }}>No faculty profiles available yet.</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                    {facultyList.map((f) => {
                      const isAssigned = assignedFacultyIds.includes(f.uid);
                      return (
                        <button
                          key={f.uid}
                          type="button"
                          className={`btn btn-sm ${isAssigned ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => toggleFaculty(f.uid)}
                        >
                          {isAssigned && <Check size={12} />} {f.name} ({f.employeeId || 'Faculty'})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={16} className="spinner" /> Saving...</> : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
