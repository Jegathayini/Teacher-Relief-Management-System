export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000"
const CLOUD_V2 = "/api/cloud/v2"


import { supabase } from "../lib/supabase"

export async function getAuthenticatedHeaders(): Promise<HeadersInit> {
  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session) {
    throw new Error("Please sign in to continue.")
  }

  return {
    Authorization: `Bearer ${data.session.access_token}`,
    "Content-Type": "application/json",
  }
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const authHeaders = await getAuthenticatedHeaders()
  const headers = new Headers(init.headers)
  new Headers(authHeaders).forEach((value, key) => headers.set(key, value))
  return fetch(input, { ...init, headers })
}

export interface HealthResponse {
  status: string
  message: string
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`)

  if (!response.ok) {
    throw new Error(
      `Backend request failed: ${response.status}`
    )
  }

  return (await response.json()) as HealthResponse
}


import type { Teacher,TimetableEntry, Absence,ReliefAssignment } from "../types"

export async function fetchTeachers(): Promise<Teacher[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}${CLOUD_V2}/teachers`)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch teachers: ${response.status}`
    )
  }

  return (await response.json()) as Teacher[]
}


export async function fetchTimetables(): Promise<TimetableEntry[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}${CLOUD_V2}/timetables`)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch timetables: ${response.status}`
    )
  }

  return (await response.json()) as TimetableEntry[]
}




export async function createTimetable(
  entry: Omit<TimetableEntry, "id">
): Promise<TimetableEntry> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}${CLOUD_V2}/timetables`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(entry)
    }
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.error ||
      result.message ||
      "Failed to create timetable entry"
    )
  }

  return result as TimetableEntry
}


export async function fetchAbsences(): Promise<Absence[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}${CLOUD_V2}/absences`)

  if (!response.ok) {
    throw new Error("Failed to fetch cloud absences.")
  }

  return (await response.json()) as Absence[]
}

export async function createAbsence(
  absence: Omit<Absence, "id">
): Promise<Absence> {
  const response = await authenticatedFetch(`${API_BASE_URL}${CLOUD_V2}/absences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(absence)
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.error || "Failed to save cloud absence."
    )
  }

  return result as Absence
}


export async function fetchReliefAssignments(): Promise<ReliefAssignment[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}${CLOUD_V2}/relief-assignments`)

  if (!response.ok) {
    throw new Error("Failed to load cloud relief assignments.")
  }

  return response.json()
}

export async function createReliefAssignment(
  assignment: Omit<ReliefAssignment, "id">
): Promise<ReliefAssignment> {
  const response = await authenticatedFetch(`${API_BASE_URL}${CLOUD_V2}/relief-assignments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(assignment)
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)

    throw new Error(
      data?.message ??
      data?.error ??
      "Failed to create relief assignment."
    )
  }

  return response.json()
}



export async function deleteReliefAssignment(
  assignmentId: string
): Promise<void> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}${CLOUD_V2}/relief-assignments/${encodeURIComponent(assignmentId)}`,
    { method: "DELETE" }
  )

  if (!response.ok) {
    const data = await response.json().catch(() => null)

    throw new Error(
      data?.message ?? "Failed to remove relief assignment."
    )
  }
}


export async function deleteAbsence(id: string): Promise<void> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}${CLOUD_V2}/absences/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  )

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message ?? "Failed to remove absence.")
  }
}

export async function deleteTimetable(id: string): Promise<void> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}${CLOUD_V2}/timetables/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  )

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message ?? "Failed to remove timetable.")
  }
}


export async function saveFreePeriod(
  teacherId: string,
  day: string,
  period: number
) {
  const response = await authenticatedFetch(
    `${API_BASE_URL}${CLOUD_V2}/timetable-progress/free`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teacherId,
        day,
        period,
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to save free period"
    )
  }

  return data
}


export type TimetableProgress = {
  day: string
  period: number
  status: "FREE" | "LESSON"
}

export async function fetchTimetableProgress(
  teacherId: string
): Promise<TimetableProgress[]> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}${CLOUD_V2}/timetable-progress/${encodeURIComponent(teacherId)}`
  )

  if (!response.ok) {
    throw new Error("Failed to load timetable progress")
  }

  return response.json()
}

// School grade and class configuration
export type SchoolGrade = { id: string; name: string }
export type SchoolClass = { id: string; gradeId: string; section: string; name: string }
export type SchoolConfiguration = { grades: SchoolGrade[]; classes: SchoolClass[] }

async function schoolRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message ?? `Request failed: ${response.status}`)
  return data as T
}
export const fetchSchoolConfiguration = async (): Promise<SchoolConfiguration> => {
  const data = await fetchCloudConfiguration()
  return { grades: data.grades, classes: data.classes.map(c => ({
    id: c.id, gradeId: c.grade_id, section: c.section,
    name: `${data.grades.find(g => g.id === c.grade_id)?.name ?? "Grade"} ${c.section}`
  })) }
}
export const createGrade = (name: string) => schoolRequest<SchoolGrade>("/api/cloud/grades", { method: "POST", body: JSON.stringify({ name }) })
export const createSchoolClass = (gradeId: string, section: string) => createCloudClass(gradeId, section).then(c => ({ ...c, gradeId: c.grade_id, name: section }))
export const deleteSchoolClass = (id: string) => schoolRequest<{ message: string }>(`/api/cloud/classes/${encodeURIComponent(id)}`, { method: "DELETE" })
export const deleteGrade = (id: string) => schoolRequest<{ message: string }>(`/api/cloud/grades/${encodeURIComponent(id)}`, { method: "DELETE" })

export type AcademicYearStatus = {
  year: number
  startDate: string
  timetableCount: number
  progressCount: number
  archivedYears: number
}

export async function fetchAcademicYear(): Promise<AcademicYearStatus> {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/cloud/academic-year`)
  if (!response.ok) throw new Error("Could not load academic year settings.")
  return response.json() as Promise<AcademicYearStatus>
}

export async function rolloverAcademicYear(newYear: number, startDate: string, confirmation: string): Promise<void> {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/cloud/academic-year/rollover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newYear, startDate, confirmation })
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || "Academic year rollover failed.")
}



export async function fetchCloudTeachers(): Promise<Teacher[]> {
  const headers = await getAuthenticatedHeaders()

  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/cloud/teachers`,
    { headers }
  )

  if (!response.ok) {
    throw new Error(
      `Cloud teacher request failed: ${response.status}`
    )
  }

  const data: unknown = await response.json()

  if (!Array.isArray(data)) {
    throw new Error("Unexpected cloud teacher response")
  }

  return data as Teacher[]
}

export async function createCloudTeacher(
  name: string,
  subjects: string[]
): Promise<Teacher> {
  const headers = await getAuthenticatedHeaders()

  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/cloud/teachers`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ name, subjects }),
    }
  )

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.message ??
      data?.error ??
      `Failed to add teacher (${response.status})`
    )
  }

  return data as Teacher
}

export async function updateCloudTeacher(
  teacherId: string,
  name: string,
  subjects: string[]
): Promise<Teacher> {
  const headers = await getAuthenticatedHeaders()

  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/cloud/teachers/${encodeURIComponent(teacherId)}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ name, subjects }),
    }
  )

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.message ??
      data?.error ??
      `Failed to update teacher (${response.status})`
    )
  }

  return data as Teacher
}

export async function updateCloudTeacherStatus(
  teacherId: string,
  active: boolean
): Promise<Teacher> {
  const headers = await getAuthenticatedHeaders()

  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/cloud/teachers/${encodeURIComponent(teacherId)}/status`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ active }),
    }
  )

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.message ??
      data?.error ??
      `Failed to update teacher status (${response.status})`
    )
  }

  return data as Teacher
}

export async function deleteCloudTeacher(
  teacherId: string
): Promise<void> {
  const headers = await getAuthenticatedHeaders()

  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/cloud/teachers/${encodeURIComponent(teacherId)}`,
    {
      method: "DELETE",
      headers,
    }
  )

  if (!response.ok) {
    const data = await response.json().catch(() => null)

    throw new Error(
      data?.message ??
      data?.error ??
      `Failed to delete teacher (${response.status})`
    )
  }
}


export async function fetchCloudAcademicYear(): Promise<AcademicYearStatus> {
  const headers = await getAuthenticatedHeaders()

  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/cloud/academic-year`,
    {
      method: "GET",
      headers,
    }
  )

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.message ??
      `Failed to load academic year (${response.status})`
    )
  }

  return data as AcademicYearStatus
}


export interface CloudGrade {
  id: string
  name: string
}

export interface CloudSchoolClass {
  id: string
  grade_id: string
  section: string
}

export interface CloudSchoolConfiguration {
  grades: CloudGrade[]
  classes: CloudSchoolClass[]
}

async function cloudConfigurationRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthenticatedHeaders()

  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.message ?? `Request failed (${response.status})`
    )
  }

  return data as T
}

export function fetchCloudConfiguration() {
  return cloudConfigurationRequest<CloudSchoolConfiguration>(
    "/api/cloud/configuration"
  )
}

export function createCloudGrade(name: string) {
  return cloudConfigurationRequest<CloudGrade>(
    "/api/cloud/grades",
    {
      method: "POST",
      body: JSON.stringify({ name }),
    }
  )
}

export function deleteCloudGrade(gradeId: string) {
  return cloudConfigurationRequest<{ message: string }>(
    `/api/cloud/grades/${encodeURIComponent(gradeId)}`,
    { method: "DELETE" }
  )
}

export function createCloudClass(
  gradeId: string,
  section: string
) {
  return cloudConfigurationRequest<CloudSchoolClass>(
    "/api/cloud/classes",
    {
      method: "POST",
      body: JSON.stringify({ gradeId, section }),
    }
  )
}

export function deleteCloudClass(classId: string) {
  return cloudConfigurationRequest<{ message: string }>(
    `/api/cloud/classes/${encodeURIComponent(classId)}`,
    { method: "DELETE" }
  )
}

export type CloudDashboardStats = {
  absentTeachers: number
  reliefAssigned: number
  pendingRelief: number
}

export async function fetchCloudDashboardStats(date: string): Promise<CloudDashboardStats> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}${CLOUD_V2}/dashboard?date=${encodeURIComponent(date)}`
  )
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.message ?? "Could not load daily statistics")
  return data as CloudDashboardStats
}
