
import { supabase } from "../lib/supabase";
import type {
  Teacher,
  TimetableEntry,
  Absence,
  ReliefAssignment,
} from "../types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";


// =====================================================
// AUTHENTICATION
// =====================================================

export async function getAuthenticatedHeaders(): Promise<HeadersInit> {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    throw new Error("Please sign in to continue.");
  }

  return {
    Authorization: `Bearer ${data.session.access_token}`,
    "Content-Type": "application/json",
  };
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const authHeaders = await getAuthenticatedHeaders();
  const headers = new Headers(init.headers);

  new Headers(authHeaders).forEach((value, key) =>
    headers.set(key, value)
  );

  return fetch(input, { ...init, headers });
}

async function getAdminSchoolId(): Promise<string> {
  const { data: userData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !userData.user) {
    throw new Error("Please sign in to continue.");
  }

  const { data, error } = await supabase
    .from("school_admins")
    .select("school_id")
    .eq("user_id", userData.user.id);

  if (error) throw new Error(error.message);

  if (!data || data.length !== 1) {
    throw new Error(
      "Your account must be assigned to exactly one school."
    );
  }

  return data[0].school_id;
}

// =====================================================
// HEALTH CHECK - LEGACY FLASK
// =====================================================

export interface HealthResponse {
  status: string;
  message: string;
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in to continue.");
  await getAdminSchoolId();
  return { status: "ok", message: "Supabase connection and school access verified." };
}

// =====================================================
// TEACHER MANAGEMENT - SUPABASE
// =====================================================

function mapCloudTeacher(row: {
  id: string;
  name: string;
  subjects: string;
  active: number;
}): Teacher {
  return {
    id: row.id,
    name: row.name,
    subjects: row.subjects
      ? row.subjects.split(",").map(s => s.trim())
      : [],
    active: row.active === 1,
  };
}

export async function fetchTeachers(): Promise<Teacher[]> {
  return fetchCloudTeachers();
}

export async function fetchCloudTeachers(): Promise<Teacher[]> {
  const schoolId = await getAdminSchoolId();

  const { data, error } = await supabase
    .from("teachers")
    .select("id, name, subjects, active")
    .eq("school_id", schoolId)
    .order("name");

  if (error) {
    throw new Error(`Failed to load teachers: ${error.message}`);
  }

  return (data ?? []).map(mapCloudTeacher);
}

export async function createCloudTeacher(
  name: string,
  subjects: string[]
): Promise<Teacher> {
  const schoolId = await getAdminSchoolId();

  if (!name.trim()) {
    throw new Error("Teacher name is required.");
  }

  const { data, error } = await supabase
    .from("teachers")
    .insert({
      id: crypto.randomUUID(),
      school_id: schoolId,
      name: name.trim(),
      subjects: subjects.join(","),
      active: 1,
    })
    .select("id, name, subjects, active")
    .single();

  if (error) throw new Error(error.message);

  return mapCloudTeacher(data);
}

export async function updateCloudTeacher(
  teacherId: string,
  name: string,
  subjects: string[]
): Promise<Teacher> {
  const schoolId = await getAdminSchoolId();

  if (!name.trim()) {
    throw new Error("Teacher name is required.");
  }

  const { data, error } = await supabase
    .from("teachers")
    .update({
      name: name.trim(),
      subjects: subjects.join(","),
    })
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .select("id, name, subjects, active")
    .single();

  if (error) throw new Error(error.message);

  return mapCloudTeacher(data);
}

export async function updateCloudTeacherStatus(
  teacherId: string,
  active: boolean
): Promise<Teacher> {
  const schoolId = await getAdminSchoolId();

  const { data, error } = await supabase
    .from("teachers")
    .update({ active: active ? 1 : 0 })
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .select("id, name, subjects, active")
    .single();

  if (error) throw new Error(error.message);

  return mapCloudTeacher(data);
}

export async function deleteCloudTeacher(
  teacherId: string
): Promise<void> {
  const schoolId = await getAdminSchoolId();

  const { data, error } = await supabase
    .from("teachers")
    .delete()
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .select("id");

  if (error) throw new Error(error.message);

  if (!data?.length) {
    throw new Error("Teacher not found or access denied.");
  }
}

// =====================================================
// GRADES AND CLASSES - SUPABASE
// =====================================================

export interface CloudGrade {
  id: string;
  name: string;
}

export interface CloudSchoolClass {
  id: string;
  grade_id: string;
  section: string;
}

export interface CloudSchoolConfiguration {
  grades: CloudGrade[];
  classes: CloudSchoolClass[];
}

export type SchoolGrade = {
  id: string;
  name: string;
};

export type SchoolClass = {
  id: string;
  gradeId: string;
  section: string;
  name: string;
};

export type SchoolConfiguration = {
  grades: SchoolGrade[];
  classes: SchoolClass[];
};

export async function fetchCloudConfiguration():
  Promise<CloudSchoolConfiguration> {
  const schoolId = await getAdminSchoolId();

  const [gradesResult, classesResult] = await Promise.all([
    supabase
      .from("grades")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("name"),

    supabase
      .from("school_classes")
      .select("id, grade_id, section")
      .eq("school_id", schoolId)
      .order("section"),
  ]);

  if (gradesResult.error) {
    throw new Error(gradesResult.error.message);
  }

  if (classesResult.error) {
    throw new Error(classesResult.error.message);
  }

  return {
    grades: gradesResult.data ?? [],
    classes: classesResult.data ?? [],
  };
}

export async function fetchSchoolConfiguration():
  Promise<SchoolConfiguration> {
  const configuration = await fetchCloudConfiguration();

  return {
    grades: configuration.grades,
    classes: configuration.classes.map(c => ({
      id: c.id,
      gradeId: c.grade_id,
      section: c.section,
      name: `${
        configuration.grades.find(g => g.id === c.grade_id)
          ?.name ?? "Grade"
      } ${c.section}`,
    })),
  };
}

export async function createCloudGrade(
  name: string
): Promise<CloudGrade> {
  const schoolId = await getAdminSchoolId();

  if (!name.trim()) {
    throw new Error("Grade name is required.");
  }

  const { data, error } = await supabase
    .from("grades")
    .insert({
      id: crypto.randomUUID(),
      school_id: schoolId,
      name: name.trim(),
    })
    .select("id, name")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export const createGrade = createCloudGrade;

export async function createCloudClass(
  gradeId: string,
  section: string
): Promise<CloudSchoolClass> {
  const schoolId = await getAdminSchoolId();

  if (!section.trim()) {
    throw new Error("Class section is required.");
  }

  // Verify that the selected grade belongs to this school.
  const { data: grade, error: gradeError } = await supabase
    .from("grades")
    .select("id")
    .eq("id", gradeId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (gradeError) throw new Error(gradeError.message);

  if (!grade) {
    throw new Error("Grade not found in your school.");
  }

  const { data, error } = await supabase
    .from("school_classes")
    .insert({
      id: crypto.randomUUID(),
      school_id: schoolId,
      grade_id: gradeId,
      section: section.trim(),
    })
    .select("id, grade_id, section")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function createSchoolClass(
  gradeId: string,
  section: string
): Promise<SchoolClass> {
  const result = await createCloudClass(gradeId, section);

  const configuration = await fetchCloudConfiguration();

  const gradeName =
    configuration.grades.find(g => g.id === gradeId)?.name ??
    "Grade";

  return {
    id: result.id,
    gradeId: result.grade_id,
    section: result.section,
    name: `${gradeName} ${result.section}`,
  };
}

export async function deleteCloudClass(
  classId: string
): Promise<{ message: string }> {
  const schoolId = await getAdminSchoolId();

  const { data, error } = await supabase
    .from("school_classes")
    .delete()
    .eq("id", classId)
    .eq("school_id", schoolId)
    .select("id");

  if (error) throw new Error(error.message);

  if (!data?.length) {
    throw new Error("Class not found or access denied.");
  }

  return { message: "Class deleted successfully." };
}

export const deleteSchoolClass = deleteCloudClass;

export async function deleteCloudGrade(
  gradeId: string
): Promise<{ message: string }> {
  const schoolId = await getAdminSchoolId();

  // Do not delete a grade while it contains classes.
  const { count, error: countError } = await supabase
    .from("school_classes")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("grade_id", gradeId);

  if (countError) throw new Error(countError.message);

  if ((count ?? 0) > 0) {
    throw new Error(
      "Cannot delete this grade while it contains classes."
    );
  }

  const { data, error } = await supabase
    .from("grades")
    .delete()
    .eq("id", gradeId)
    .eq("school_id", schoolId)
    .select("id");

  if (error) throw new Error(error.message);

  if (!data?.length) {
    throw new Error("Grade not found or access denied.");
  }

  return { message: "Grade deleted successfully." };
}

export const deleteGrade = deleteCloudGrade;

// =====================================================
// TIMETABLES - SUPABASE
// =====================================================

function requireResult<T>(data: T | null, error: { message: string } | null, label: string): T {
  if (error) throw new Error(`${label}: ${error.message}`);
  if (data === null) throw new Error(`${label}: no data returned.`);
  return data;
}

export async function fetchTimetables(): Promise<TimetableEntry[]> {
  const schoolId = await getAdminSchoolId();
  const { data, error } = await supabase.from("timetables")
    .select("id, teacher_id, class_name, subject, day, period")
    .eq("school_id", schoolId).order("day").order("period");
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({ id: r.id, teacherId: r.teacher_id,
    className: r.class_name, subject: r.subject, day: r.day, period: r.period }));
}

export async function createTimetable(entry: Omit<TimetableEntry, "id">): Promise<TimetableEntry> {
  const { data, error } = await supabase.rpc("create_school_timetable", {
    p_teacher_id: entry.teacherId, p_class_name: entry.className,
    p_subject: entry.subject, p_day: entry.day, p_period: entry.period,
  });
  return requireResult(data as TimetableEntry | null, error, "Failed to create timetable");
}

export async function deleteTimetable(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_school_timetable", { p_timetable_id: id });
  if (error) throw new Error(error.message);
}

// =====================================================
// TIMETABLE PROGRESS - SUPABASE
// =====================================================

export type TimetableProgress = {
  day: string;
  period: number;
  status: "FREE" | "LESSON";
};

export async function saveFreePeriod(teacherId: string, day: string, period: number) {
  const { data, error } = await supabase.rpc("save_school_free_period", {
    p_teacher_id: teacherId, p_day: day, p_period: period,
  });
  return requireResult(data, error, "Failed to save free period");
}

export async function fetchTimetableProgress(teacherId: string): Promise<TimetableProgress[]> {
  const schoolId = await getAdminSchoolId();
  const { data, error } = await supabase.from("timetable_progress")
    .select("day, period, status").eq("school_id", schoolId)
    .eq("teacher_id", teacherId).order("day").order("period");
  if (error) throw new Error(error.message);
  return (data ?? []) as TimetableProgress[];
}

export async function fetchAbsences(): Promise<Absence[]> {
  const schoolId = await getAdminSchoolId()

  const { data, error } = await supabase
    .from("absences")
    .select("id, teacher_id, date, reason, absent_periods")
    .eq("school_id", schoolId)
    .order("date", { ascending: false })

  if (error) {
    throw new Error(`Failed to load absences: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    teacherId: row.teacher_id,
    date: row.date,
    reason: row.reason ?? "",
    absentPeriods: row.absent_periods ?? [1, 2, 3, 4, 5, 6, 7, 8],
  }))
}

export async function createAbsence(
  absence: Omit<Absence, "id">
): Promise<Absence> {
  const { data, error } = await supabase.rpc(
    "create_school_absence",
    {
      p_teacher_id: absence.teacherId,
      p_date: absence.date,
      p_reason: absence.reason ?? "",
      p_absent_periods: absence.absentPeriods,
    }
  )

  if (error) {
    throw new Error(`Failed to create absence: ${error.message}`)
  }

  if (!data) {
    throw new Error("No absence record returned from Supabase.")
  }

  // The RPC returns camelCase fields.
  return {
    id: data.id,
    teacherId: data.teacherId,
    date: data.date,
    reason: data.reason ?? "",
    absentPeriods: data.absentPeriods,
  }
}

export async function deleteAbsence(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_school_absence", { p_absence_id: id });
  if (error) throw new Error(error.message);
}

// =====================================================
// RELIEF ASSIGNMENTS - SUPABASE
// =====================================================

export async function fetchReliefAssignments(): Promise<ReliefAssignment[]> {
  const schoolId = await getAdminSchoolId();
  const { data, error } = await supabase.from("relief_assignments")
    .select("id, date, period, class_name, absent_teacher_id, relief_teacher_id, subject")
    .eq("school_id", schoolId).order("date", { ascending: false })
    .order("period").order("class_name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({ id: r.id, date: r.date, period: r.period,
    className: r.class_name, absentTeacherId: r.absent_teacher_id,
    reliefTeacherId: r.relief_teacher_id, subject: r.subject }));
}

export async function createReliefAssignment(
  assignment: Omit<ReliefAssignment, "id">
): Promise<ReliefAssignment> {
  const { data, error } = await supabase.rpc("create_relief_assignment", {
    p_date: assignment.date, p_period: assignment.period,
    p_class_name: assignment.className,
    p_absent_teacher_id: assignment.absentTeacherId,
    p_relief_teacher_id: assignment.reliefTeacherId,
    p_subject: assignment.subject,
  });
  return requireResult(data as ReliefAssignment | null, error, "Failed to create relief assignment");
}

export async function deleteReliefAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_relief_assignment", {
    p_assignment_id: assignmentId,
  });
  if (error) throw new Error(error.message);
}

// =====================================================
// ACADEMIC YEAR - SUPABASE
// =====================================================

export type AcademicYearStatus = {
  year: number;
  startDate: string;
  timetableCount: number;
  progressCount: number;
  archivedYears: number;
};

export async function fetchAcademicYear(): Promise<AcademicYearStatus> {
  return fetchCloudAcademicYear();
}

export async function fetchCloudAcademicYear(): Promise<AcademicYearStatus> {
  const schoolId = await getAdminSchoolId();
  const { data, error } = await supabase.rpc("get_school_academic_year");
  const status = requireResult(data as Omit<AcademicYearStatus, "archivedYears"> | null,
    error, "Failed to load academic year");
  // Count distinct archived years across all pages (Supabase commonly caps row responses).
  const archivedYears = new Set<number>();
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data: archives, error: archiveError } = await supabase
      .from("timetable_archives").select("academic_year")
      .eq("school_id", schoolId).order("academic_year")
      .range(from, from + pageSize - 1);
    if (archiveError) throw new Error(archiveError.message);
    for (const item of archives ?? []) archivedYears.add(item.academic_year);
    if ((archives?.length ?? 0) < pageSize) break;
  }
  return { ...status, archivedYears: archivedYears.size };
}

export async function rolloverAcademicYear(
  newYear: number, startDate: string, confirmation: string
): Promise<void> {
  const { error } = await supabase.rpc("rollover_school_academic_year", {
    p_new_year: newYear, p_start_date: startDate, p_confirmation: confirmation,
  });
  if (error) throw new Error(error.message);
}

// =====================================================
// DASHBOARD - SUPABASE
// =====================================================

export type CloudDashboardStats = {
  absentTeachers: number;
  reliefAssigned: number;
  pendingRelief: number;
};

export async function fetchCloudDashboardStats(date: string): Promise<CloudDashboardStats> {
  const { data, error } = await supabase.rpc("get_school_dashboard", { p_date: date });
  return requireResult(data as CloudDashboardStats | null, error, "Could not load daily statistics");
}

// Lifetime relief totals (do not reset when the academic year changes).
export async function fetchSchoolReliefCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("get_school_relief_counts");
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ teacherId: string; totalReliefs: number }>) {
    counts[row.teacherId] = Number(row.totalReliefs);
  }
  return counts;
}


export async function replaceReliefAssignment(
  assignmentId: string,
  newReliefTeacherId: string
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "replace_relief_assignment",
    {
      p_assignment_id: assignmentId,
      p_new_relief_teacher_id: newReliefTeacherId,
    }
  )

  if (error) {
    throw new Error(
      `Failed to replace relief teacher: ${error.message}`
    )
  }

  if (data === null || data === undefined) {
    throw new Error(
      "Supabase did not confirm the relief replacement."
    )
  }
}
