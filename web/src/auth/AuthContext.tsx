import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setLoading(true);
      setUser(nextUser);
      setProfile(null);
      setProfileError(null);

      if (!nextUser) {
        setLoading(false);
        return;
      }

      try {
        const profileSnapshot = await getDoc(doc(db, 'users', nextUser.uid));
        if (!profileSnapshot.exists()) {
          setProfileError('Your sign-in is valid, but your role profile has not been created. Ask the project administrator to add your UID to the users collection.');
        } else {
          const data = profileSnapshot.data();
          const validRoles = ['admin', 'faculty', 'student'];
          if (!validRoles.includes(data.role) || data.active !== true) {
            setProfileError('Your account is inactive or has an invalid role. Please contact the administrator.');
          } else {
            setProfile({
              uid: nextUser.uid,
              name: String(data.name ?? nextUser.displayName ?? 'User'),
              email: String(data.email ?? nextUser.email ?? ''),
              role: data.role,
              active: data.active,
              department: data.department || '',
              employeeId: data.employeeId || '',
              assignedCourses: Array.isArray(data.assignedCourses) ? data.assignedCourses : [],
              usn: data.usn || '',
              semester: data.semester || '',
              courseIds: Array.isArray(data.courseIds) ? data.courseIds : [],
            });
          }
        }
      } catch (error) {
        console.error('Failed to load user profile', error);
        setProfileError('Could not load your profile. Check your internet connection and Firestore rules.');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    loading,
    profileError,
    signIn: async (email, password) => {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    signOutUser: async () => {
      await signOut(auth);
      setProfile(null);
    },
  }), [user, profile, loading, profileError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
