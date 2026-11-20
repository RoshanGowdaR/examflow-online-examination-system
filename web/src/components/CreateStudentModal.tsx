import { useState, useEffect } from 'react';
import { X, GraduationCap, Loader2, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import type { Course } from '../types';
import { getAllCourses, getFacultyPermittedCourses } from '../services/courses';
import { createStudentAccount } from '../services/users';
import { useAuth } from '../auth/AuthContext';

interface CreateStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateStudentModal({ isOpen, onClose, onCreated }: CreateStudentModalProps) {
  const { profile } = useAuth();
  const isFaculty = profile?.role === 'faculty';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [usn, setUsn] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [department, setDepartment] = useState(profile?.department || 'Computer Science & Engineering');
  const [semester, setSemester] = useState('6');
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ message: string; resetLink?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    async function load() {
      try {
        setLoadingCourses(true);
        if (isFaculty && profile) {
          const list = await getFacultyPermittedCourses(profile.uid, profile.assignedCourses || []);
          setCourses(list);
          if (profile.department) setDepartment(profile.department);
        } else {
          const list = await getAllCourses();
          setCourses(list);
        }
      } catch (err) {
        console.error('Failed to load courses', err);
      } finally {
        setLoadingCourses(false);
      }
    }
    load();
  }, [isOpen, isFaculty, profile]);

  if (!isOpen) return null;

  const handleCourseToggle = (code: string) => {
    if (courseIds.includes(code)) {
      setCourseIds(courseIds.filter((c) => c !== code));
    } else {
      setCourseIds([...courseIds, code]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !usn.trim() || !department.trim()) {
      setError('Student name, email, USN, and department are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await createStudentAccount({
        name: name.trim(),
        email: email.trim(),
        usn: usn.trim().toUpperCase(),
        registrationNumber: registrationNumber.trim(),
        department: department.trim(),
        semester: semester.trim(),
        courseIds,
        active,
      });

      setSuccessInfo({
        message: res.message || 'Student account created successfully.',
        resetLink: res.resetLink,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to create student account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (successInfo?.resetLink) {
      navigator.clipboard.writeText(successInfo.resetLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleResetAndClose = () => {
    setName('');
    setEmail('');
    setUsn('');
    setRegistrationNumber('');
    setCourseIds([]);
    setError('');
    setSuccessInfo(null);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="panel-icon"><GraduationCap size={18} /></span>
            <div>
              <h3 style={{ margin: 0 }}>Enroll Student Account</h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Server-side account creation with password setup email
              </span>
            </div>
          </div>
          <button className="icon-button" onClick={handleResetAndClose} style={{ background: 'none', border: 0, cursor: 'pointer' }}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        {successInfo ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div className="status-icon" style={{ margin: '0 auto 16px', background: '#ecfdf3', color: '#027a48' }}>
              <CheckCircle2 size={24} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', margin: '0 0 8px' }}>Student Enrolled Successfully!</h3>
            <p className="muted" style={{ margin: '0 auto 20px', maxWidth: '420px' }}>
              {successInfo.message} The student (<strong>{email}</strong>) can now complete their password setup.
            </p>

            {successInfo.resetLink && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '20px', textAlign: 'left' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#475467', display: 'block', marginBottom: '6px' }}>
                  Student Setup / Reset Link:
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    readOnly
                    className="form-input"
                    value={successInfo.resetLink}
                    style={{ fontSize: '11px', background: '#fff' }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyLink}>
                    {copiedLink ? <Check size={14} color="#059669" /> : <Copy size={14} />} {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <button type="button" className="btn btn-primary" onClick={handleResetAndClose} style={{ width: '100%' }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Student Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Bharath Kumar S"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Student Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="student@college.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>USN / Roll Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 1MS21CS042"
                    value={usn}
                    onChange={(e) => setUsn(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Registration Number (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. REG-2024-889"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Department *</label>
                  {isFaculty ? (
                    <input
                      type="text"
                      className="form-input"
                      value={department}
                      readOnly
                      style={{ background: '#f8fafc', color: '#475569' }}
                    />
                  ) : (
                    <select
                      className="form-select"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    >
                      <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                      <option value="Information Science & Engineering">Information Science & Engineering</option>
                      <option value="Electronics & Communication">Electronics & Communication</option>
                      <option value="Artificial Intelligence & ML">Artificial Intelligence & ML</option>
                    </select>
                  )}
                </div>
                <div className="form-group">
                  <label>Semester *</label>
                  <select
                    className="form-select"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={String(s)}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Account Status</label>
                  <select
                    className="form-select"
                    value={active ? 'active' : 'inactive'}
                    onChange={(e) => setActive(e.target.value === 'active')}
                  >
                    <option value="active">Active (Permitted)</option>
                    <option value="inactive">Inactive (Disabled)</option>
                  </select>
                </div>
              </div>

              {/* Course Assignment */}
              <div className="form-group" style={{ marginTop: '8px' }}>
                <label>Enrolled Courses / Subjects</label>
                {loadingCourses ? (
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Loading courses...</div>
                ) : courses.length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#64748b' }}>No courses available in this department.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    {courses.map((c) => {
                      const isSelected = courseIds.includes(c.code) || courseIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => handleCourseToggle(c.code)}
                        >
                          {isSelected && <Check size={12} />} {c.code} — {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleResetAndClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <><Loader2 size={15} className="spinner" /> Enrolling...</> : 'Enroll Student'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
