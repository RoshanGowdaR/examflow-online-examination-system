import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpenCheck,
  ShieldCheck,
  Sparkles,
  Users,
  GraduationCap,
  ArrowRight,
  Lock,
  Timer,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Laptop,
  Server,
  Cloud,
  ChevronRight,
  Database,
  Cpu,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export function LandingPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'admin' | 'faculty' | 'student'>('admin');

  const handleLaunch = () => {
    if (user && profile) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="landing-wrapper">
      {/* ------------------------------------------------------------- */}
      {/* 1. Navigation Bar                                             */}
      {/* ------------------------------------------------------------- */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <span className="brand-mark">
              <BookOpenCheck size={22} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px', color: '#0f172a' }}>
                ExamFlow
              </span>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, letterSpacing: '0.5px' }}>
                GROUP 12 · ONLINE EXAM SYSTEM
              </span>
            </div>
          </div>

          <nav className="nav-links">
            <a href="#features">Features</a>
            <a href="#roles">Role Portals</a>
            <a href="#ai-studio">AI Engine</a>
            <a href="#architecture">Architecture</a>
            <a href="#team">Team</a>
          </nav>

          <div className="nav-actions">
            {user ? (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>
                Go to Dashboard <ArrowRight size={14} />
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
                Sign In to Portal <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. Hero Section                                               */}
      {/* ------------------------------------------------------------- */}
      <section className="hero-section">
        <div className="hero-glow hero-glow-1" />
        <div className="hero-glow hero-glow-2" />

        <div className="landing-container hero-container">
          <div className="hero-badge">
            <span className="hero-badge-tag"><Sparkles size={12} /> AI-POWERED</span>
            <span>Next-Generation Institutional Assessment Platform</span>
          </div>

          <h1 className="hero-title">
            Examinations, Automated. <br />
            <span className="hero-gradient-text">Governed & Intelligent.</span>
          </h1>

          <p className="hero-subtitle">
            ExamFlow is a cloud-native examination management platform engineered for modern universities.
            Featuring complete hierarchical governance (Admin → Faculty → Students), Gemini-powered AI question authoring,
            and tamper-proof server-side evaluation.
          </p>

          <div className="hero-cta-group">
            <button className="btn-hero-primary" onClick={handleLaunch}>
              {user ? 'Enter Your Dashboard' : 'Launch Examination Portal'}
              <ArrowRight size={18} />
            </button>
            <a href="#features" className="btn-hero-secondary">
              Explore Capabilities <ChevronRight size={16} />
            </a>
          </div>

          {/* Tech highlights banner */}
          <div className="tech-badges-banner">
            <div className="tech-badge-item">
              <span className="tech-dot" /> React.js + TypeScript
            </div>
            <div className="tech-badge-item">
              <span className="tech-dot" /> Firebase Auth & Firestore
            </div>
            <div className="tech-badge-item">
              <span className="tech-dot" /> Google Gemini API
            </div>
            <div className="tech-badge-item">
              <span className="tech-dot" /> Docker & Amazon ECR
            </div>
            <div className="tech-badge-item">
              <span className="tech-dot" /> Serverless AWS Ready
            </div>
          </div>

          {/* Visual Platform Showcase Card */}
          <div className="hero-preview-frame">
            <div className="preview-topbar">
              <div className="preview-dots">
                <span style={{ background: '#ef4444' }} />
                <span style={{ background: '#f59e0b' }} />
                <span style={{ background: '#10b981' }} />
              </div>
              <div className="preview-url-bar">
                https://examflow.internal/dashboard · Live Institutional Instance
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="status-dot" style={{ background: '#10b981' }} /> System Operational
              </div>
            </div>

            <div className="preview-body">
              <div className="preview-grid">
                <div className="preview-metric-card">
                  <span className="preview-label">HIERARCHICAL ROLES</span>
                  <div className="preview-value">3 Tiers</div>
                  <span className="preview-desc">Admin · Faculty · Students</span>
                </div>
                <div className="preview-metric-card">
                  <span className="preview-label">AI QUESTION AUTHORING</span>
                  <div className="preview-value">&lt; 3 Sec</div>
                  <span className="preview-desc">Gemini Multi-Topic Engine</span>
                </div>
                <div className="preview-metric-card">
                  <span className="preview-label">ANSWER KEY SECURITY</span>
                  <div className="preview-value">100% Isolated</div>
                  <span className="preview-desc">Zero Client Bundle Leaks</span>
                </div>
                <div className="preview-metric-card">
                  <span className="preview-label">PRODUCTION CONTAINER</span>
                  <div className="preview-value">Node 22 LTS</div>
                  <span className="preview-desc">Alpine Linux + Dockerized</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. Core Feature Pillars (Bento Grid)                         */}
      {/* ------------------------------------------------------------- */}
      <section id="features" className="section-padding section-features">
        <div className="landing-container">
          <div className="section-heading">
            <span className="section-eyebrow">ENTERPRISE CAPABILITIES</span>
            <h2>Built from the ground up for academic rigor</h2>
            <p>Every layer of ExamFlow is architected for role privacy, data integrity, and high-performance delivery.</p>
          </div>

          <div className="bento-feature-grid">
            {/* Bento Card 1: Hierarchical Governance */}
            <div className="bento-box bento-span-8">
              <div className="bento-icon-wrapper" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                <Users size={22} />
              </div>
              <h3>Hierarchical Institutional Governance</h3>
              <p>
                Strict three-tier role-based access control (RBAC). Administrators provision verified faculty accounts
                and institutional curricula. Faculty manage departmental students, author question banks, and oversee submissions.
              </p>
              <div className="bento-pill-row">
                <span className="bento-pill">Admin Control Center</span>
                <span className="bento-pill">Faculty Studio</span>
                <span className="bento-pill">Student Portal</span>
                <span className="bento-pill">Department Scoping</span>
              </div>
            </div>

            {/* Bento Card 2: AI Question Studio */}
            <div className="bento-box bento-span-4 bento-highlight">
              <div className="bento-icon-wrapper" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <Sparkles size={22} />
              </div>
              <h3>Gemini AI Authoring</h3>
              <p>
                Instant exam generation powered by the Google Gemini API. Specify subject, syllabus topics,
                and difficulty to generate calibrated MCQs and True/False assessments.
              </p>
              <div className="bento-pill-row">
                <span className="bento-pill">Bloom's Taxonomy</span>
                <span className="bento-pill">Custom Explanations</span>
              </div>
            </div>

            {/* Bento Card 3: Tamper-Proof Answer Keys */}
            <div className="bento-box bento-span-4">
              <div className="bento-icon-wrapper" style={{ background: '#fef2f2', color: '#dc2626' }}>
                <Lock size={22} />
              </div>
              <h3>Tamper-Proof Answer Protection</h3>
              <p>
                Correct answers are stored in a private, server-only collection. Examination questions sent
                to student clients are strictly sanitized to prevent browser DevTools cheating.
              </p>
            </div>

            {/* Bento Card 4: Proctoring & Time-Bound Exams */}
            <div className="bento-box bento-span-4">
              <div className="bento-icon-wrapper" style={{ background: '#fffbeb', color: '#d97706' }}>
                <Timer size={22} />
              </div>
              <h3>Live Assessment Engine</h3>
              <p>
                Synchronized timer countdowns, hard deadline enforcement, auto-submission on expiry,
                and local progress persistence to guard against network interruptions.
              </p>
            </div>

            {/* Bento Card 5: Real-Time Results & Analytics */}
            <div className="bento-box bento-span-4">
              <div className="bento-icon-wrapper" style={{ background: '#ecfdf5', color: '#059669' }}>
                <BarChart3 size={22} />
              </div>
              <h3>Instant Automated Grading</h3>
              <p>
                Objective questions are graded in milliseconds upon submission. Students receive instant scorecards
                and question-by-question breakdown analytics upon publication.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. Interactive Role Portals                                  */}
      {/* ------------------------------------------------------------- */}
      <section id="roles" className="section-padding section-roles">
        <div className="landing-container">
          <div className="section-heading">
            <span className="section-eyebrow">TAILORED EXPERIENCES</span>
            <h2>Dedicated workspaces for every academic stakeholder</h2>
            <p>Select a role below to explore its specialized capabilities and interface.</p>
          </div>

          <div className="role-tab-selector">
            <button
              className={`role-tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              <ShieldCheck size={16} /> Administrator
            </button>
            <button
              className={`role-tab-btn ${activeTab === 'faculty' ? 'active' : ''}`}
              onClick={() => setActiveTab('faculty')}
            >
              <Users size={16} /> Faculty Member
            </button>
            <button
              className={`role-tab-btn ${activeTab === 'student' ? 'active' : ''}`}
              onClick={() => setActiveTab('student')}
            >
              <GraduationCap size={16} /> Student
            </button>
          </div>

          <div className="role-content-display">
            {activeTab === 'admin' && (
              <div className="role-detail-card">
                <div className="role-detail-header">
                  <div className="role-badge-tag role-tag-admin">SYSTEM ADMINISTRATOR</div>
                  <h3>Total Institutional Governance & Verification</h3>
                  <p>
                    Administrators have overarching authority to maintain institutional data integrity,
                    provision credentialed faculty accounts, and inspect platform metrics.
                  </p>
                </div>
                <div className="role-feature-bullets">
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Faculty Onboarding & Provisioning</strong>
                      <span>Create official faculty profiles with employee IDs, departments, and course allocations.</span>
                    </div>
                  </div>
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Course & Department Catalog</strong>
                      <span>Manage curriculum subject codes, descriptions, and assign authorized teaching staff.</span>
                    </div>
                  </div>
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Student Directory Oversight</strong>
                      <span>View institution-wide enrollments, activate or deactivate accounts, and manage credentials.</span>
                    </div>
                  </div>
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Audit Logging & Performance Monitoring</strong>
                      <span>Real-time visibility into assessment publishes, test submissions, and platform uptime.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'faculty' && (
              <div className="role-detail-card">
                <div className="role-detail-header">
                  <div className="role-badge-tag role-tag-faculty">FACULTY MEMBER</div>
                  <h3>Intelligent Assessment Authoring & Class Studio</h3>
                  <p>
                    Faculty members design examinations, generate high-quality question banks using AI,
                    and track student evaluation metrics for their assigned departments.
                  </p>
                </div>
                <div className="role-feature-bullets">
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Gemini AI Exam Generator</strong>
                      <span>Generate customized assessments in seconds with fine-grained difficulty and question type controls.</span>
                    </div>
                  </div>
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Student Enrollment & Roster Management</strong>
                      <span>Enroll departmental students by USN / Roll number, assign courses, and trigger password setups.</span>
                    </div>
                  </div>
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Draft & Publish Workflow</strong>
                      <span>Iterate privately on assessments with drafts before publishing with strict scheduling dates.</span>
                    </div>
                  </div>
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Submission Analysis & Results</strong>
                      <span>Review student submissions, question difficulty breakdowns, and performance analytics.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'student' && (
              <div className="role-detail-card">
                <div className="role-detail-header">
                  <div className="role-badge-tag role-tag-student">STUDENT APPLICANT</div>
                  <h3>Distraction-Free Live Examination Environment</h3>
                  <p>
                    Students access published assessments for their enrolled courses, complete proctored exams
                    with real-time countdown timers, and review instant performance scorecards.
                  </p>
                </div>
                <div className="role-feature-bullets">
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>One-Click Assessment Access</strong>
                      <span>View live, upcoming, and completed examinations filtered strictly to your enrolled courses.</span>
                    </div>
                  </div>
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Time-Bounded Test Environment</strong>
                      <span>Real-time countdown timer with auto-submit protection when examination time concludes.</span>
                    </div>
                  </div>
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Question Navigation Matrix</strong>
                      <span>Flag questions for review, jump across questions easily, and review answered vs. pending items.</span>
                    </div>
                  </div>
                  <div className="role-bullet">
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Instant Results & Detailed Feedback</strong>
                      <span>Access percentage scores, correct answers, and faculty explanations immediately upon submission.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. AI Engine & Architecture Showcase                          */}
      {/* ------------------------------------------------------------- */}
      <section id="architecture" className="section-padding section-architecture">
        <div className="landing-container">
          <div className="section-heading">
            <span className="section-eyebrow">CLOUD & INFRASTRUCTURE</span>
            <h2>Architected for zero server overhead and maximum security</h2>
            <p>ExamFlow leverages industry-standard serverless and containerized microservice architectures.</p>
          </div>

          <div className="arch-flow-grid">
            <div className="arch-step-card">
              <div className="arch-step-num">01</div>
              <div className="arch-step-icon"><Laptop size={20} /></div>
              <h4>React + TypeScript Frontend</h4>
              <p>Modern Bento Grid UI with real-time Firestore listeners and responsive layout across desktops, tablets, and mobile.</p>
            </div>

            <div className="arch-step-card">
              <div className="arch-step-num">02</div>
              <div className="arch-step-icon"><Cpu size={20} /></div>
              <h4>Google Gemini 2.0 AI Engine</h4>
              <p>Contextual prompt engineering and JSON validation for automated MCQ and True/False examination creation.</p>
            </div>

            <div className="arch-step-card">
              <div className="arch-step-num">03</div>
              <div className="arch-step-icon"><Database size={20} /></div>
              <h4>Firebase Auth & Firestore</h4>
              <p>Rule-enforced granular security permissions with automatic client-side credentials provisioning and password dispatch.</p>
            </div>

            <div className="arch-step-card">
              <div className="arch-step-num">04</div>
              <div className="arch-step-icon"><Server size={20} /></div>
              <h4>Docker Production Container</h4>
              <p>Single full-stack Alpine Linux container with multi-stage builds, Node.js 22 LTS, and native HTTP health probes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. Group 12 Team Credits                                      */}
      {/* ------------------------------------------------------------- */}
      <section id="team" className="section-padding section-team">
        <div className="landing-container">
          <div className="section-heading">
            <span className="section-eyebrow">ACADEMIC PROJECT</span>
            <h2>Group 12 Engineering Team</h2>
            <p>Developed as a comprehensive Online Examination Management System capstone project.</p>
          </div>

          <div className="team-grid">
            <div className="team-card">
              <div className="team-avatar">BK</div>
              <h4>Bharath Kumar S</h4>
              <span className="team-role">Full-Stack & Testing Engineer</span>
              <p className="team-desc">Frontend component design, student assessment delivery, and test workflows.</p>
            </div>

            <div className="team-card">
              <div className="team-avatar">HG</div>
              <h4>Hemanth Gowda</h4>
              <span className="team-role">Cloud & AI Engineer</span>
              <p className="team-desc">Gemini API prompt engineering, evaluation pipeline, and architecture validation.</p>
            </div>

            <div className="team-card team-card-lead">
              <div className="team-avatar team-avatar-lead">RG</div>
              <h4>Roshan Gowda</h4>
              <span className="team-role">Lead DevOps & System Architect</span>
              <p className="team-desc">Docker containerization, Amazon ECR orchestration, Render deployment, and repository lead.</p>
            </div>
          </div>

          <div className="repo-callout">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Cloud size={20} color="#2563eb" />
              <div>
                <strong>Official GitHub Repository</strong>
                <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                  RoshanGowdaR / examflow-online-examination-system
                </span>
              </div>
            </div>
            <a
              href="https://github.com/RoshanGowdaR/examflow-online-examination-system"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
            >
              View on GitHub <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7. Call To Action Banner                                      */}
      {/* ------------------------------------------------------------- */}
      <section className="cta-banner-section">
        <div className="landing-container">
          <div className="cta-card">
            <h2>Ready to experience ExamFlow?</h2>
            <p>Sign in with your institutional credentials to access your portal.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleLaunch} style={{ height: '48px', padding: '0 28px', fontSize: '14px' }}>
                {user ? 'Enter Platform Dashboard' : 'Sign In to Your Account'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 8. Footer                                                     */}
      {/* ------------------------------------------------------------- */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="brand brand-light">
            <span className="brand-mark">
              <BookOpenCheck size={18} />
            </span>
            <span>ExamFlow</span>
          </div>

          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            Group 12 — Bharath Kumar S · Hemanth Gowda · Roshan Gowda
          </div>

          <div style={{ fontSize: '12px', color: '#64748b' }}>
            © {new Date().getFullYear()} ExamFlow Online Examination Management System. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
