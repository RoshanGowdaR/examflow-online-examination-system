import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { Course } from '../types';

export async function getAllCourses(): Promise<Course[]> {
  try {
    const coursesRef = collection(db, 'courses');
    const q = query(coursesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || 'Untitled Course',
        code: data.code || '',
        description: data.description || '',
        department: data.department || '',
        assignedFacultyIds: Array.isArray(data.assignedFacultyIds) ? data.assignedFacultyIds : [],
        assignedFacultyNames: Array.isArray(data.assignedFacultyNames) ? data.assignedFacultyNames : [],
        active: data.active ?? true,
        createdBy: data.createdBy || '',
        createdAt: data.createdAt,
      };
    });
  } catch {
    // Fallback if index on createdAt is not built
    const snapshot = await getDocs(collection(db, 'courses'));
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || 'Untitled Course',
        code: data.code || '',
        description: data.description || '',
        department: data.department || '',
        assignedFacultyIds: Array.isArray(data.assignedFacultyIds) ? data.assignedFacultyIds : [],
        assignedFacultyNames: Array.isArray(data.assignedFacultyNames) ? data.assignedFacultyNames : [],
        active: data.active ?? true,
        createdBy: data.createdBy || '',
        createdAt: data.createdAt,
      };
    });
  }
}

export async function getFacultyPermittedCourses(facultyUid: string, assignedCourseCodes: string[] = []): Promise<Course[]> {
  const all = await getAllCourses();
  return all.filter((c) => {
    if (c.active === false) return false;
    // Check if faculty is explicitly assigned by UID
    if (c.assignedFacultyIds && c.assignedFacultyIds.includes(facultyUid)) return true;
    // Check if course code or ID is in faculty's assignedCourses array
    if (assignedCourseCodes.includes(c.id) || assignedCourseCodes.includes(c.code)) return true;
    // Check if course was created by this faculty
    if (c.createdBy === facultyUid) return true;
    return false;
  });
}

export async function createCourse(data: {
  name: string;
  code: string;
  description?: string;
  department?: string;
  assignedFacultyIds?: string[];
  assignedFacultyNames?: string[];
  createdBy: string;
}): Promise<string> {
  const docRef = await addDoc(collection(db, 'courses'), {
    name: data.name.trim(),
    code: data.code.trim().toUpperCase(),
    description: data.description?.trim() || '',
    department: data.department?.trim() || '',
    assignedFacultyIds: data.assignedFacultyIds || [],
    assignedFacultyNames: data.assignedFacultyNames || [],
    active: true,
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCourse(
  courseId: string,
  data: Partial<Omit<Course, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> {
  const courseRef = doc(db, 'courses', courseId);
  await updateDoc(courseRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCourse(courseId: string): Promise<void> {
  await deleteDoc(doc(db, 'courses', courseId));
}
