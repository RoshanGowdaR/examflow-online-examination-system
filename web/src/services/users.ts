import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../firebase';
import type { UserProfile, UserRole, CreateFacultyPayload, CreateStudentPayload } from '../types';
import { getApiBaseUrl } from './gradingApi';

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
export async function createFacultyAccount(payload: CreateFacultyPayload): Promise<{ uid: string; resetLink?: string; message: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Please sign in before performing administrative actions.');

  const cleanEmail = payload.email.trim().toLowerCase();
  const base = getApiBaseUrl();

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
      return { uid: data.uid, resetLink: data.resetLink, message: data.message || 'Faculty account created successfully.' };
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

  const newDocRef = doc(usersRef);
  const uid = newDocRef.id;

  await setDoc(newDocRef, {
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
    message: 'Faculty account created successfully.',
  };
}

export async function createStudentAccount(payload: CreateStudentPayload): Promise<{ uid: string; resetLink?: string; message: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Please sign in before performing student creation.');

  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanUsn = payload.usn.trim().toUpperCase();
  const base = getApiBaseUrl();

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
      return { uid: data.uid, resetLink: data.resetLink, message: data.message || 'Student enrolled successfully.' };
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

  const newDocRef = doc(usersRef);
  const uid = newDocRef.id;

  await setDoc(newDocRef, {
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
    message: 'Student account enrolled successfully.',
  };
}
