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
