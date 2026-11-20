import { useState, useEffect } from 'react';
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  GraduationCap,
  LogOut,
  Plus,
  ShieldCheck,
  Award,
  Sparkles,
  BarChart3,
  Settings,
  UserCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { FacultyManagementView } from '../components/FacultyManagementView';
import { StudentManagementView } from '../components/StudentManagementView';
import { CourseManagementView } from '../components/CourseManagementView';
import { ExamManagementView } from '../components/ExamManagementView';
import { StudentExamsView } from '../components/StudentExamsView';
import { ResultsView } from '../components/ResultsView';
import { ExamEditorModal } from '../components/ExamEditorModal';
import { CourseModal } from '../components/CourseModal';
import { getFacultyUsers, getStudentUsers } from '../services/users';
import { getAllCourses } from '../services/courses';
import { getExams } from '../services/exams';
import { getAllResults, getStudentResults } from '../services/results';
import { isGradingApiConfigured, gradingApiUrl } from '../services/gradingApi';

export function DashboardPage() {
  const { user, profile, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Modals
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);

  // Live Stats
  const [facultyCount, setFacultyCount] = useState<number | string>('—');
  const [studentCount, setStudentCount] = useState<number | string>('—');
  const [courseCount, setCourseCount] = useState<number | string>('—');
  const [examCount, setExamCount] = useState<number | string>('—');
  const [resultCount, setResultCount] = useState<number | string>('—');

  useEffect(() => {
    async function loadStats() {
      if (!profile || !user) return;
      try {
        const [cList, eList, rList] = await Promise.all([
          getAllCourses().catch(() => []),
          getExams(profile.role, profile.uid).catch(() => []),
          profile.role === 'student' ? getStudentResults(user.uid).catch(() => []) : getAllResults().catch(() => []),
        ]);

        setCourseCount(cList.length);
        setExamCount(eList.length);
        setResultCount(rList.length);

        if (profile.role === 'admin') {
          const [fList, sList] = await Promise.all([
            getFacultyUsers().catch(() => []),
            getStudentUsers().catch(() => []),
          ]);
          setFacultyCount(fList.length);
          setStudentCount(sList.length);
        } else if (profile.role === 'faculty') {
          const sList = await getStudentUsers().catch(() => []);
          setStudentCount(sList.length);
        }
      } catch (err) {
        console.error('Failed to load stats', err);
      }
    }
    loadStats();
  }, [profile, user]);

  if (!profile) return null;

  const role = profile.role;
  const isApiReady = isGradingApiConfigured();

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
          <span className="brand-mark"><BookOpen size={21} /></span>
          <span>ExamFlow</span>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        {/* 1. Admin Sidebar Items */}
        {role === 'admin' && (
          <>
            <button
              className={`side-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <ChartNoAxesCombined size={18} /> Dashboard
            </button>
            <button
              className={`side-link ${activeTab === 'faculty' ? 'active' : ''}`}
              onClick={() => setActiveTab('faculty')}
            >
              <UserCheck size={18} /> Faculty Management
            </button>
            <button
              className={`side-link ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              <GraduationCap size={18} /> Student Management
            </button>
            <button
              className={`side-link ${activeTab === 'courses' ? 'active' : ''}`}
              onClick={() => setActiveTab('courses')}
            >
              <BookOpen size={18} /> Courses
            </button>
            <button
              className={`side-link ${activeTab === 'exams' ? 'active' : ''}`}
              onClick={() => setActiveTab('exams')}
            >
              <ClipboardList size={18} /> Examinations
            </button>
            <button
              className={`side-link ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              <Award size={18} /> Results
            </button>
            <button
              className={`side-link ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              <BarChart3 size={18} /> Reports
            </button>
            <button
              className={`side-link ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={18} /> Settings
            </button>
          </>
        )}

        {/* 2. Faculty Sidebar Items */}
        {role === 'faculty' && (
          <>
            <button
              className={`side-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <ChartNoAxesCombined size={18} /> Dashboard
            </button>
            <button
              className={`side-link ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              <GraduationCap size={18} /> Student Management
            </button>
            <button
              className={`side-link ${activeTab === 'courses' ? 'active' : ''}`}
              onClick={() => setActiveTab('courses')}
            >
              <BookOpen size={18} /> My Courses
            </button>
            <button
              className={`side-link ${activeTab === 'exams' ? 'active' : ''}`}
              onClick={() => setActiveTab('exams')}
            >
              <ClipboardList size={18} /> Examinations
            </button>
            <button
              className={`side-link ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              <Award size={18} /> Results
            </button>
            <button
              className={`side-link ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              <BarChart3 size={18} /> Analytics
            </button>
            <button
              className={`side-link ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={18} /> Profile
            </button>
          </>
        )}

        {/* 3. Student Sidebar Items */}
        {role === 'student' && (
          <>
            <button
              className={`side-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <ChartNoAxesCombined size={18} /> Dashboard
            </button>
            <button
              className={`side-link ${activeTab === 'exams' ? 'active' : ''}`}
              onClick={() => setActiveTab('exams')}
            >
              <ClipboardList size={18} /> Available Exams
            </button>
            <button
              className={`side-link ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              <Award size={18} /> Results & History
            </button>
            <button
              className={`side-link ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={18} /> My Profile
            </button>
          </>
        )}

        <div className="sidebar-bottom">
          <div className="cloud-status">
            <span className="status-dot" style={{ background: isApiReady ? '#36c98f' : '#f59e0b' }} />
            {isApiReady ? 'Firebase + AWS Active' : 'Firebase Connected'}
          </div>
          <button className="logout-button" onClick={() => void signOutUser()}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="topbar-caption">ONLINE EXAMINATION MANAGEMENT SYSTEM</span>
            <h1 style={{ textTransform: 'capitalize' }}>
              {activeTab === 'dashboard'
                ? 'Overview'
                : activeTab === 'faculty'
                ? 'Faculty Management'
                : activeTab === 'students'
                ? 'Student Management'
                : activeTab}
            </h1>
          </div>
          <div className="profile-chip">
            <div className="avatar">{profile.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{profile.name}</strong>
              <span className={`badge badge-role-${profile.role}`}>{profile.role}</span>
            </div>
          </div>
        </header>

        {/* Tab: Dashboard Overview */}
        {activeTab === 'dashboard' && (
          <>
            <section className="welcome-row">
              <div>
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h2>
                  {role === 'admin'
                    ? 'Administrator Overview'
                    : role === 'faculty'
                    ? 'Faculty Workspace'
                    : 'Student Assessment Dashboard'}
                </h2>
                <p className="muted">
                  {role === 'admin'
                    ? 'Manage faculty, students, courses and supervise AI-assisted assessments.'
                    : role === 'faculty'
                    ? 'Enroll students, manage assigned courses, and author examinations manually or with AI.'
                    : 'Prepare for scheduled examinations, attempt assessments, and review results.'}
                </p>
              </div>
              <div className="date-chip">
                <CalendarDays size={17} /> Examination Portal
              </div>
            </section>

            {/* Stat Cards */}
            <section className="stats-grid">
              {role === 'admin' && (
                <>
                  <article className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('faculty')}>
                    <div className="stat-top">
                      <span>Faculty Members</span>
                      <UserCheck size={19} color="#7c3aed" />
                    </div>
                    <strong className="stat-value">{facultyCount}</strong>
                    <span className="stat-note">Admin-provisioned instructors</span>
                  </article>
                  <article className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('students')}>
                    <div className="stat-top">
                      <span>Enrolled Students</span>
                      <GraduationCap size={19} color="#2563eb" />
                    </div>
                    <strong className="stat-value">{studentCount}</strong>
                    <span className="stat-note">Across all departments</span>
                  </article>
                  <article className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('exams')}>
                    <div className="stat-top">
                      <span>Examinations</span>
                      <ClipboardList size={19} color="#059669" />
                    </div>
                    <strong className="stat-value">{examCount}</strong>
                    <span className="stat-note">AI & manual assessments</span>
                  </article>
                </>
              )}

              {role === 'faculty' && (
                <>
                  <article className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('students')}>
                    <div className="stat-top">
                      <span>My Students</span>
                      <GraduationCap size={19} color="#2563eb" />
                    </div>
                    <strong className="stat-value">{studentCount}</strong>
                    <span className="stat-note">Enrolled in your department/courses</span>
                  </article>
                  <article className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('courses')}>
                    <div className="stat-top">
                      <span>Assigned Courses</span>
                      <BookOpen size={19} color="#0891b2" />
                    </div>
                    <strong className="stat-value">{courseCount}</strong>
                    <span className="stat-note">Curriculum subjects</span>
                  </article>
                  <article className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setIsExamModalOpen(true)}>
                    <div className="stat-top">
                      <span>Assessment Creator</span>
                      <Sparkles size={19} color="#7c3aed" />
                    </div>
                    <strong className="stat-value" style={{ fontSize: '20px', color: '#7c3aed' }}>
                      + Create Exam
                    </strong>
                    <span className="stat-note">Manual or AI question generator</span>
                  </article>
                </>
              )}

              {role === 'student' && (
                <>
                  <article className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('exams')}>
                    <div className="stat-top">
                      <span>Available Examinations</span>
                      <ClipboardList size={19} color="#059669" />
                    </div>
                    <strong className="stat-value">{examCount}</strong>
                    <span className="stat-note">Ready to attempt</span>
                  </article>
                  <article className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('results')}>
                    <div className="stat-top">
                      <span>Completed Assessments</span>
                      <Award size={19} color="#2563eb" />
                    </div>
                    <strong className="stat-value">{resultCount}</strong>
                    <span className="stat-note">Graded by AWS Lambda</span>
                  </article>
                  <article className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('exams')}>
                    <div className="stat-top">
                      <span>Examination Mode</span>
                      <Clock3 size={19} color="#d97706" />
                    </div>
                    <strong className="stat-value" style={{ fontSize: '20px', color: '#059669' }}>
                      Live Countdown
                    </strong>
                    <span className="stat-note">Automated timer & submission</span>
                  </article>
                </>
              )}
            </section>

            {/* Quick Actions & Architecture Panel */}
            <section className="content-grid">
              <article className="panel quick-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">QUICK ACTIONS</p>
                    <h3>Shortcuts</h3>
                  </div>
                  <span className="panel-icon"><Plus size={18} /></span>
                </div>

                <div className="action-list">
                  {role === 'admin' && (
                    <>
                      <button className="action-row" onClick={() => setActiveTab('faculty')}>
                        <span>+ Provision new Faculty Account</span>
                        <span className="action-arrow">&rarr;</span>
                      </button>
                      <button className="action-row" onClick={() => setActiveTab('students')}>
                        <span>+ Enroll Student Account</span>
                        <span className="action-arrow">&rarr;</span>
                      </button>
                      <button className="action-row" onClick={() => setIsCourseModalOpen(true)}>
                        <span>+ Add Course & Assign Faculty</span>
                        <span className="action-arrow">&rarr;</span>
                      </button>
                      <button className="action-row" onClick={() => setIsExamModalOpen(true)}>
                        <span>✨ Create Examination with AI / Manual</span>
                        <span className="action-arrow">&rarr;</span>
                      </button>
                    </>
                  )}

                  {role === 'faculty' && (
                    <>
                      <button className="action-row" onClick={() => setActiveTab('students')}>
                        <span>+ Enroll Student into your courses</span>
                        <span className="action-arrow">&rarr;</span>
                      </button>
                      <button className="action-row" onClick={() => setIsExamModalOpen(true)}>
                        <span>✨ Create Test Using AI</span>
                        <span className="action-arrow">&rarr;</span>
                      </button>
                      <button className="action-row" onClick={() => setActiveTab('courses')}>
                        <span>View My Assigned Courses</span>
                        <span className="action-arrow">&rarr;</span>
                      </button>
                      <button className="action-row" onClick={() => setActiveTab('results')}>
                        <span>Review Student Submissions</span>
                        <span className="action-arrow">&rarr;</span>
                      </button>
                    </>
                  )}

                  {role === 'student' && (
                    <>
                      <button className="action-row" onClick={() => setActiveTab('exams')}>
                        <span>Browse Available Examinations</span>
                        <span className="action-arrow">&rarr;</span>
                      </button>
                      <button className="action-row" onClick={() => setActiveTab('results')}>
                        <span>View Evaluated Assessment Scores</span>
                        <span className="action-arrow">&rarr;</span>
                      </button>
                      <button className="action-row" onClick={() => setActiveTab('profile')}>
                        <span>View My Enrolled Courses & Profile</span>
                        <span className="action-arrow">&rarr;</span>
                      </button>
                    </>
                  )}
                </div>
              </article>

              <article className="panel status-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">HYBRID CLOUD PLATFORM</p>
                    <h3>System Architecture</h3>
                  </div>
                  <ShieldCheck size={21} className="success-icon" />
                </div>

                <div className="progress-item">
                  <div>
                    <span>Firebase Auth & Firestore</span>
                    <strong>Connected</strong>
                  </div>
                  <div className="progress-track"><span style={{ width: '100%' }} /></div>
                </div>

                <div className="progress-item">
                  <div>
                    <span>Role Hierarchy: Admin &rarr; Faculty &rarr; Student</span>
                    <strong>Enforced</strong>
                  </div>
                  <div className="progress-track"><span style={{ width: '100%' }} /></div>
                </div>

                <div className="progress-item">
                  <div>
                    <span>Gemini AI Engine (AWS Lambda)</span>
                    <strong>{isApiReady ? 'Backend Integrated' : 'Lambda Configured'}</strong>
                  </div>
                  <div className="progress-track"><span style={{ width: isApiReady ? '100%' : '80%' }} /></div>
                </div>

                <div className="notice-box">
                  <strong>Private Server-Side Answer Keys</strong>
                  <p>
                    Student browsers never receive correct answers. AWS Lambda performs server-side grading and transactional scoring using Firebase Admin SDK.
                  </p>
                </div>
              </article>
            </section>
          </>
        )}

        {/* Tab: Faculty Management (Admin only) */}
        {activeTab === 'faculty' && role === 'admin' && <FacultyManagementView />}

        {/* Tab: Student Management (Admin or Faculty) */}
        {activeTab === 'students' && (role === 'admin' || role === 'faculty') && <StudentManagementView />}

        {/* Tab: Courses (Admin or Faculty) */}
        {activeTab === 'courses' && <CourseManagementView />}

        {/* Tab: Examinations */}
        {activeTab === 'exams' && (role === 'student' ? <StudentExamsView /> : <ExamManagementView />)}

        {/* Tab: Results */}
        {activeTab === 'results' && <ResultsView />}

        {/* Tab: Reports / Analytics */}
        {activeTab === 'reports' && (
          <div className="panel" style={{ maxWidth: '800px' }}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">METRICS & ANALYTICS</p>
                <h3>Platform Execution Reports</h3>
              </div>
              <BarChart3 size={20} color="#2558a7" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', margin: '20px 0' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>TOTAL ASSESSMENTS</span>
                <strong style={{ fontSize: '24px', display: 'block', color: '#1e293b', marginTop: '4px' }}>{examCount}</strong>
              </div>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>TOTAL SUBMISSIONS</span>
                <strong style={{ fontSize: '24px', display: 'block', color: '#1e293b', marginTop: '4px' }}>{resultCount}</strong>
              </div>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>ACTIVE COURSES</span>
                <strong style={{ fontSize: '24px', display: 'block', color: '#1e293b', marginTop: '4px' }}>{courseCount}</strong>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#475467', lineHeight: '1.6' }}>
              All examination submissions are recorded in Firestore collection <code>results</code> and evaluated server-side by AWS Lambda. Audit trails for account creation and submissions are stored under <code>auditEvents</code>.
            </p>
          </div>
        )}

        {/* Tab: Settings (Admin) */}
        {activeTab === 'settings' && role === 'admin' && (
          <div className="panel" style={{ maxWidth: '800px' }}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">CONFIGURATION</p>
                <h3>System & Cloud Settings</h3>
              </div>
              <Settings size={20} color="#2558a7" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '14px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <strong>AWS Lambda & API Gateway Endpoint</strong>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 8px' }}>
                  Base URL used for server-side grading, account creation, and Gemini AI exam generation.
                </p>
                <code style={{ fontSize: '12px', color: '#2558a7', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px' }}>
                  {gradingApiUrl || 'VITE_AWS_GRADING_API_URL not set in web/.env'}
                </code>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <strong>Gemini AI Generation Engine</strong>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                  AI questions are generated on AWS Lambda via <code>GEMINI_API_KEY</code> environment variable without exposing secrets in frontend code.
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <strong>Hierarchical Role Provisioning</strong>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                  Admin provisions Faculty &rarr; Faculty enrolls Students. Accounts are created server-side with zero credential sharing.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Profile (Faculty or Student) */}
        {activeTab === 'profile' && (
          <div className="panel" style={{ maxWidth: '720px' }}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">USER PROFILE</p>
                <h3>Account Information</h3>
              </div>
              <User size={20} color="#2558a7" />
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', margin: '20px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
              <div className="avatar" style={{ width: '64px', height: '64px', fontSize: '24px' }}>
                {profile.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'Manrope, sans-serif' }}>{profile.name}</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{profile.email}</span>
                <div style={{ marginTop: '6px' }}>
                  <span className={`badge badge-role-${profile.role}`}>{profile.role}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '12px' }}>
              {role === 'faculty' && (
                <>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Employee ID</span>
                    <strong>{profile.employeeId || 'FAC-001'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Department</span>
                    <strong>{profile.department || 'Computer Science & Engineering'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Assigned Courses</span>
                    <strong>
                      {profile.assignedCourses && profile.assignedCourses.length > 0
                        ? profile.assignedCourses.join(', ')
                        : 'All Department Courses'}
                    </strong>
                  </div>
                </>
              )}

              {role === 'student' && (
                <>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>USN / Roll Number</span>
                    <strong style={{ color: '#1d4ed8' }}>{profile.usn || profile.rollNumber || 'Not assigned'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Department</span>
                    <strong>{profile.department || 'Computer Science & Engineering'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Semester</span>
                    <strong>Semester {profile.semester || '6'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Enrolled Courses</span>
                    <strong>
                      {profile.courseIds && profile.courseIds.length > 0
                        ? profile.courseIds.join(', ')
                        : 'General Curriculum'}
                    </strong>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <footer className="page-footer">
          Group 12 · Bharath Kumar S · Hemanth Gowda · Roshan Gowda
        </footer>
      </main>

      {/* Global Modals */}
      <ExamEditorModal
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
        onSaved={() => {
          setActiveTab('exams');
        }}
      />

      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        onCreated={() => {
          setActiveTab('courses');
        }}
      />
    </div>
  );
}
