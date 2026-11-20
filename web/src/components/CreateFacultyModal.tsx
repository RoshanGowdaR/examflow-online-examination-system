import { useState, useEffect } from 'react';
import { X, UserPlus, Loader2, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import type { Course } from '../types';
import { getAllCourses } from '../services/courses';
import { createFacultyAccount } from '../services/users';

interface CreateFacultyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateFacultyModal({ isOpen, onClose, onCreated }: CreateFacultyModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [contactNumber, setContactNumber] = useState('');
  const [assignedCourses, setAssignedCourses] = useState<string[]>([]);
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
        const data = await getAllCourses();
        setCourses(data);
      } catch (err) {
        console.error('Failed to load courses', err);
      } finally {
        setLoadingCourses(false);
      }
    }
    load();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCourseToggle = (code: string) => {
    if (assignedCourses.includes(code)) {
      setAssignedCourses(assignedCourses.filter((c) => c !== code));
    } else {
      setAssignedCourses([...assignedCourses, code]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !employeeId.trim() || !department.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await createFacultyAccount({
        name: name.trim(),
        email: email.trim(),
        employeeId: employeeId.trim(),
        department: department.trim(),
        contactNumber: contactNumber.trim(),
        assignedCourses,
        active,
      });

      setSuccessInfo({
        message: res.message || 'Faculty account created successfully.',
        resetLink: res.resetLink,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to create faculty account.');
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
    setEmployeeId('');
    setContactNumber('');
    setAssignedCourses([]);
    setError('');
    setSuccessInfo(null);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="panel-icon"><UserPlus size={18} /></span>
            <div>
              <h3 style={{ margin: 0 }}>Create Faculty Account</h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Secure server-side provisioning with password setup link
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
            <h3 style={{ fontFamily: 'Manrope, sans-serif', margin: '0 0 8px' }}>Faculty Account Created!</h3>
            <p className="muted" style={{ margin: '0 auto 20px', maxWidth: '420px' }}>
              {successInfo.message} A password setup link was generated for <strong>{email}</strong>.
            </p>

            {successInfo.resetLink && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '20px', textAlign: 'left' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#475467', display: 'block', marginBottom: '6px' }}>
                  Faculty Setup / Reset Link:
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
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginTop: '6px' }}>
                  The faculty member can use this link to establish their initial password securely.
                </span>
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
                  <label>Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Dr. Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="faculty@college.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Employee ID *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. FAC-CSE-042"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Department *</label>
                  <select
                    className="form-select"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                    <option value="Information Science & Engineering">Information Science & Engineering</option>
                    <option value="Electronics & Communication">Electronics & Communication</option>
                    <option value="Artificial Intelligence & ML">Artificial Intelligence & ML</option>
                    <option value="Basic Sciences">Basic Sciences</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Contact Number (Optional)</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+91 9876543210"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Account Status</label>
                  <select
                    className="form-select"
                    value={active ? 'active' : 'inactive'}
                    onChange={(e) => setActive(e.target.value === 'active')}
                  >
                    <option value="active">Active (Permitted to sign in)</option>
                    <option value="inactive">Inactive (Disabled)</option>
                  </select>
                </div>
              </div>

              {/* Course Assignment */}
              <div className="form-group" style={{ marginTop: '8px' }}>
                <label>Assign Subjects / Courses</label>
                {loadingCourses ? (
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Loading courses...</div>
                ) : courses.length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#64748b' }}>No courses exist yet. You can assign courses later.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    {courses.map((c) => {
                      const isSelected = assignedCourses.includes(c.code) || assignedCourses.includes(c.id);
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
                {submitting ? <><Loader2 size={15} className="spinner" /> Creating Faculty...</> : 'Create Faculty'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

