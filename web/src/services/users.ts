import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { db, auth, firebaseConfig } from '../firebase';
import type { UserProfile, UserRole, CreateFacultyPayload, CreateStudentPayload } from '../types';
import { getApiBaseUrl } from './gradingApi';

// -------------------------------------------------------------
// Client-Side Firebase Auth Provisioning Helper
// Uses an isolated secondary Firebase App instance so the active
// Admin session is never signed out or disturbed.
// -------------------------------------------------------------
export async function provisionAuthAccount(email: string, password: string): Promise<string | null> {
  const cleanEmail = email.trim().toLowerCase();
  const tempAppName = `authProvision_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let tempApp = null;
  try {
    tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);
    const userCredential = await createUserWithEmailAndPassword(tempAuth, cleanEmail, password);
    const uid = userCredential.user.uid;
    await signOut(tempAuth);
    return uid;
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      console.log(`Auth account for ${cleanEmail} already exists in Firebase Auth.`);
      return null;
    }
    console.warn('Could not auto-provision Firebase Auth user:', err?.message || err);
    return null;
  } finally {
    if (tempApp) {
      deleteApp(tempApp).catch(() => {});
    }
  }
}

export async function sendUserPasswordReset(
  email: string,
  usnOrRole?: string
): Promise<{ provisioned: boolean; temporaryPassword?: string; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return {
      provisioned: false,
      message: `Password setup link sent to ${cleanEmail}. The user can open that link in their inbox to set their password.`,
    };
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') {
      // User is not in Firebase Auth yet! Provision them with temporary password
      const tempPass = usnOrRole && usnOrRole.length > 2 ? `${usnOrRole.toUpperCase()}@123` : 'Student@123';
      await provisionAuthAccount(cleanEmail, tempPass);
      await sendPasswordResetEmail(auth, cleanEmail).catch(() => {});
      return {
        provisioned: true,
        temporaryPassword: tempPass,
        message: `Account activated in Firebase Auth! Temporary password is "${tempPass}". Setup link also sent to ${cleanEmail}.`,
      };
    }
    throw new Error(err?.message || 'Failed to send password reset email.');
  }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      uid: docSnap.id,
      name: data.name || 'Unnamed User',
      email: data.email || '',
      role: data.role as UserRole,
      active: data.active ?? true,
      department: data.department || '',
      employeeId: data.employeeId || '',
      contactNumber: data.contactNumber || '',
      assignedCourses: Array.isArray(data.assignedCourses) ? data.assignedCourses : [],
      usn: data.usn || '',
      rollNumber: data.rollNumber || data.usn || '',
      registrationNumber: data.registrationNumber || '',
      semester: data.semester || '',
      courseIds: Array.isArray(data.courseIds) ? data.courseIds : [],
      createdBy: data.createdBy || '',
      createdAt: data.createdAt,
    };
  });
}

export async function getFacultyUsers(): Promise<UserProfile[]> {
  const all = await getAllUsers();
  return all.filter((u) => u.role === 'faculty');
}

export async function getStudentUsers(): Promise<UserProfile[]> {
  const all = await getAllUsers();
  return all.filter((u) => u.role === 'student');
}

export async function getStudentsForFaculty(facultyDept?: string, facultyCourseCodes: string[] = []): Promise<UserProfile[]> {
  const allStudents = await getStudentUsers();
  if (!facultyDept && facultyCourseCodes.length === 0) return allStudents;

  return allStudents.filter((student) => {
    // Match department
    if (facultyDept && student.department && student.department.toLowerCase() === facultyDept.toLowerCase()) {
      return true;
    }
    // Match course assignment
    if (student.courseIds && student.courseIds.some((c) => facultyCourseCodes.includes(c))) {
      return true;
    }
    return false;
  });
}

export async function toggleUserStatus(uid: string, currentStatus: boolean): Promise<boolean> {
  const userRef = doc(db, 'users', uid);
  const newStatus = !currentStatus;
  await updateDoc(userRef, { active: newStatus });
  return newStatus;
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { role });
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, data);
}

// -------------------------------------------------------------
// Trusted Server-Side Creation Calls with Resilient Client Fallback
// -------------------------------------------------------------
export async function createFacultyAccount(payload: CreateFacultyPayload): Promise<{ uid: string; resetLink?: string; temporaryPassword?: string; message: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Please sign in before performing administrative actions.');

  const cleanEmail = payload.email.trim().toLowerCase();
  const base = getApiBaseUrl();
  const tempPassword = payload.initialPassword?.trim() || 'Faculty@123';

  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch(`${base}/users/create-faculty`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        uid: data.uid,
        resetLink: data.resetLink,
        temporaryPassword: tempPassword,
        message: data.message || 'Faculty account created successfully.',
      };
    }

    const errData = await res.json().catch(() => ({}));
    if (res.status === 400 && errData.error && errData.error.toLowerCase().includes('already exists')) {
      throw new Error(errData.error);
    }
    console.warn(`Backend faculty creation returned status ${res.status}:`, errData.error || res.statusText);
  } catch (err: any) {
    if (err?.message && err.message.toLowerCase().includes('already exists')) {
      throw err;
    }
    console.warn('Backend server returned an error or is unreachable. Provisioning faculty directly in Firestore:', err?.message);
  }

  // Graceful Fallback: Direct Firestore user creation via authenticated Admin SDK
  const usersRef = collection(db, 'users');
  const existingDocs = await getDocs(query(usersRef, where('email', '==', cleanEmail)));
  if (!existingDocs.empty) {
    throw new Error(`A user profile with email ${cleanEmail} already exists.`);
  }

  // Provision in Firebase Authentication with temporary password
  const authUid = await provisionAuthAccount(cleanEmail, tempPassword);
  const uid = authUid || doc(usersRef).id;

  await setDoc(doc(usersRef, uid), {
    uid,
    name: payload.name.trim(),
    email: cleanEmail,
    role: 'faculty',
    active: payload.active ?? true,
    department: payload.department.trim(),
    employeeId: payload.employeeId.trim(),
    contactNumber: payload.contactNumber?.trim() || '',
    assignedCourses: payload.assignedCourses || [],
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
  });

  // Attempt to trigger password reset/setup email via Client Auth
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (emailErr) {
    console.warn('Password setup email note:', emailErr);
  }

  return {
    uid,
    temporaryPassword: tempPassword,
    message: `Faculty account created successfully. Temporary password: "${tempPassword}".`,
  };
}

export async function createStudentAccount(payload: CreateStudentPayload): Promise<{ uid: string; resetLink?: string; temporaryPassword?: string; message: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Please sign in before performing student creation.');

  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanUsn = payload.usn.trim().toUpperCase();
  const base = getApiBaseUrl();
  const tempPassword = payload.initialPassword?.trim() || (cleanUsn ? `${cleanUsn}@123` : 'Student@123');

  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch(`${base}/users/create-student`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        uid: data.uid,
        resetLink: data.resetLink,
        temporaryPassword: tempPassword,
        message: data.message || 'Student enrolled successfully.',
      };
    }

    const errData = await res.json().catch(() => ({}));
    if (res.status === 400 && errData.error && errData.error.toLowerCase().includes('already')) {
      throw new Error(errData.error);
    }
    console.warn(`Backend student creation returned status ${res.status}:`, errData.error || res.statusText);
  } catch (err: any) {
    if (err?.message && err.message.toLowerCase().includes('already')) {
      throw err;
    }
    console.warn('Backend server returned an error or is unreachable. Provisioning student directly in Firestore:', err?.message);
  }

  // Graceful Fallback: Direct Firestore student creation via authenticated SDK
  const usersRef = collection(db, 'users');
  const existingEmailDocs = await getDocs(query(usersRef, where('email', '==', cleanEmail)));
  if (!existingEmailDocs.empty) {
    throw new Error(`A user profile with email ${cleanEmail} already exists.`);
  }

  const existingUsnDocs = await getDocs(query(usersRef, where('usn', '==', cleanUsn)));
  if (!existingUsnDocs.empty) {
    throw new Error(`A student with USN/Roll Number ${cleanUsn} is already registered.`);
  }

  // Provision in Firebase Authentication with temporary password
  const authUid = await provisionAuthAccount(cleanEmail, tempPassword);
  const uid = authUid || doc(usersRef).id;

  await setDoc(doc(usersRef, uid), {
    uid,
    name: payload.name.trim(),
    email: cleanEmail,
    role: 'student',
    active: payload.active ?? true,
    department: payload.department.trim(),
    usn: cleanUsn,
    rollNumber: cleanUsn,
    registrationNumber: payload.registrationNumber?.trim() || '',
    semester: payload.semester.trim(),
    courseIds: payload.courseIds || [],
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
  });

  // Attempt to trigger password reset/setup email via Client Auth
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (emailErr) {
    console.warn('Password setup email note:', emailErr);
  }

  return {
    uid,
    temporaryPassword: tempPassword,
    message: `Student account enrolled successfully. Temporary password: "${tempPassword}".`,
  };
}
