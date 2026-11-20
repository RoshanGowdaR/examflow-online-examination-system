import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth/AuthContext';

export function AccountPendingPage() {
  const { user, profileError } = useAuth();
  return (
    <main className="center-page">
      <div className="status-card">
        <div className="status-icon">!</div>
        <p className="eyebrow">ACCOUNT SETUP REQUIRED</p>
        <h1>Your account is not ready yet</h1>
        <p className="muted">Signed in as <strong>{user?.email}</strong></p>
        <p>{profileError ?? 'Your user profile is not configured.'}</p>
        <div className="uid-box"><span>Firebase UID</span><code>{user?.uid}</code></div>
        <p className="muted small">Share this UID with the project administrator. They must create a matching document in Firestore → users.</p>
        <button className="secondary-button" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    </main>
  );
}
