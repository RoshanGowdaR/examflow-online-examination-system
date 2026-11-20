import { useState, type FormEvent } from 'react';
import { ArrowRight, BookOpenCheck, Cloud, ShieldCheck, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { user, profile, profileError, signIn, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (user && profile) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResetMessage('');
    setBusy(true);

    try {
      await signIn(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Firebase Auth sign-in error:', err);
      const code = err?.code as string | undefined;
      const message = err?.message as string | undefined;

      if (code === 'auth/too-many-requests') {
        setError(
          'Access to this account has been temporarily disabled due to multiple failed login attempts. Please wait 5 minutes, or use the "Forgot Password" link below to unlock it.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError(
          'Incorrect email or password. If you recently reset your password, please make sure you opened the email link and clicked "Save" on the reset page.'
        );
      } else if (code === 'auth/user-not-found') {
        setError('No account was found for this email address in Firebase Authentication.');
      } else if (code === 'auth/user-disabled') {
        setError('This account has been disabled in the Firebase Console.');
      } else if (code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled in Firebase Console (Authentication → Sign-in method).');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Check your internet connection.');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else {
        setError(message ? `Sign-in failed (${code || 'error'}): ${message}` : 'Unable to sign in. Check your details and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Please enter your email address first to receive a password reset link.');
      return;
    }

    try {
      setResetting(true);
      setError('');
      setResetMessage('');
      await sendPasswordResetEmail(auth, email.trim());
      setResetMessage(`A password reset link has been sent to ${email.trim()}. Open that email to set a new password.`);
    } catch (err: any) {
      console.error('Forgot password error:', err);
      const code = err?.code;
      if (code === 'auth/user-not-found') {
        setError('No account exists with this email.');
      } else {
        setError(err?.message || 'Could not send reset email. Please try again.');
      }
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-aside">
        <div className="brand brand-light"><span className="brand-mark"><BookOpenCheck size={22} /></span><span>ExamFlow</span></div>
        <div className="aside-copy">
          <p className="eyebrow">GROUP 12 PROJECT</p>
          <h1>Examinations, made simpler.</h1>
          <p className="aside-description">A secure online examination platform for administrators, faculty and students.</p>
          <div className="feature-line"><ShieldCheck size={18} /><span>Role-based access and secure submissions</span></div>
          <div className="feature-line"><Cloud size={18} /><span>Powered by Firebase and AWS serverless services</span></div>
        </div>
        <div className="aside-footer">Bharath Kumar S · Hemanth Gowda · Roshan Gowda</div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to your account</h2>
          <p className="muted">Use the account provided by your examination administrator.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="label-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label htmlFor="password" style={{ margin: 0 }}>Password</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetting}
                style={{ background: 'none', border: 0, padding: 0, color: '#2558a7', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                {resetting ? 'Sending link...' : 'Forgot password?'}
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: '21px' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', marginBottom: 0, paddingRight: '40px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 0,
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
                tabIndex={-1}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div className="error-message" role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            {profileError && (
              <div className="error-message" role="alert" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '2px' }}>Role Profile Missing or Inactive</strong>
                    <span>{profileError}</span>
                    {user && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#475569' }}>
                        Firebase UID: <code style={{ userSelect: 'all', background: '#f1f5f9', padding: '2px 4px', borderRadius: '3px' }}>{user.uid}</code>
                      </div>
                    )}
                  </div>
                </div>
                {user && (
                  <button
                    type="button"
                    onClick={() => signOutUser()}
                    style={{
                      alignSelf: 'flex-start',
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      marginTop: '4px',
                    }}
                  >
                    Sign out to try another account
                  </button>
                )}
              </div>
            )}

            {resetMessage && (
              <div className="inline-notice" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#ecfdf3', color: '#027a48', border: '1px solid #a6f4c5', marginBottom: '14px' }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{resetMessage}</span>
              </div>
            )}

            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} />
            </button>
          </form>

          <p className="login-note">New users are created by the administrator. Public registration is disabled.</p>
        </div>
      </section>
    </main>
  );
}
