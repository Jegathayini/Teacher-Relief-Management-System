const API_BASE_URL = "http://127.0.0.1:5000"

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
  const response = await fetch(`${API_BASE_URL}/api/teachers`)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch teachers: ${response.status}`
    )
  }

  return (await response.json()) as Teacher[]
}


export async function fetchTimetables(): Promise<TimetableEntry[]> {
  const response = await fetch(`${API_BASE_URL}/api/timetables`)

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
  const response = await fetch(
    `${API_BASE_URL}/api/timetables`,
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
  const response = await fetch(`${API_BASE_URL}/api/absences`)

  if (!response.ok) {
    throw new Error("Failed to fetch absences from SQLite.")
  }

  return (await response.json()) as Absence[]
}

export async function createAbsence(
  absence: Omit<Absence, "id">
): Promise<Absence> {
  const response = await fetch(`${API_BASE_URL}/api/absences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(absence)
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.error || "Failed to save absence to SQLite."
    )
  }

  return result as Absence
}


export async function fetchReliefAssignments(): Promise<ReliefAssignment[]> {
  const response = await fetch(`${API_BASE_URL}/api/relief-assignments`)

  if (!response.ok) {
    throw new Error("Failed to load relief assignments from SQLite.")
  }

  return response.json()
}

export async function createReliefAssignment(
  assignment: Omit<ReliefAssignment, "id">
): Promise<ReliefAssignment> {
  const response = await fetch(`${API_BASE_URL}/api/relief-assignments`, {
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
  const response = await fetch(
    `${API_BASE_URL}/api/relief-assignments/${encodeURIComponent(assignmentId)}`,
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
  const response = await fetch(
    `${API_BASE_URL}/api/absences/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  )

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message ?? "Failed to remove absence.")
  }
}

export async function deleteTimetable(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/timetables/${encodeURIComponent(id)}`,
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
  const response = await fetch(
    "http://127.0.0.1:5000/api/timetable-progress/free",
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
  const response = await fetch(
    `http://127.0.0.1:5000/api/timetable-progress/${encodeURIComponent(teacherId)}`
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message ?? `Request failed: ${response.status}`)
  return data as T
}
export const fetchSchoolConfiguration = () => schoolRequest<SchoolConfiguration>("/api/grades")
export const createGrade = (name: string) => schoolRequest<SchoolGrade>("/api/grades", { method: "POST", body: JSON.stringify({ name }) })
export const createSchoolClass = (gradeId: string, section: string) => schoolRequest<SchoolClass>("/api/school-classes", { method: "POST", body: JSON.stringify({ gradeId, section }) })
export const deleteSchoolClass = (id: string) => schoolRequest<{ message: string }>(`/api/school-classes/${encodeURIComponent(id)}`, { method: "DELETE" })
export const deleteGrade = (id: string) => schoolRequest<{ message: string }>(`/api/grades/${encodeURIComponent(id)}`, { method: "DELETE" })

export type AcademicYearStatus = {
  year: number
  startDate: string
  timetableCount: number
  progressCount: number
  archivedYears: number
}

export async function fetchAcademicYear(): Promise<AcademicYearStatus> {
  const response = await fetch(`${API_BASE_URL}/api/academic-year`)
  if (!response.ok) throw new Error("Could not load academic year settings.")
  return response.json() as Promise<AcademicYearStatus>
}

export async function rolloverAcademicYear(newYear: number, startDate: string, confirmation: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/academic-year/rollover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newYear, startDate, confirmation })
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || "Academic year rollover failed.")
}
