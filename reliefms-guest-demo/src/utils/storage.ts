
import type {
  Teacher,
  TimetableEntry,
  Absence,
  ReliefAssignment
} from "../types"

const STORAGE_KEYS = {
  teachers: "relief_teachers",
  timetables: "relief_timetables",
  absences: "relief_absences",
  assignments: "relief_assignments"
}

function loadData<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)

    if (!saved) {
      return fallback
    }

    return JSON.parse(saved) as T
  } catch (error) {
    console.error("Error loading data:", error)
    return fallback
  }
}

function saveData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error("Error saving data:", error)
  }
}

// Teacher storage
export function getTeachers(): Teacher[] {
  return loadData<Teacher[]>(STORAGE_KEYS.teachers, [])
}

export function saveTeachers(teachers: Teacher[]): void {
  saveData(STORAGE_KEYS.teachers, teachers)
}

// Timetable storage
export function getTimetables(): TimetableEntry[] {
  return loadData<TimetableEntry[]>(STORAGE_KEYS.timetables, [])
}

export function saveTimetables(
  timetables: TimetableEntry[]
): void {
  saveData(STORAGE_KEYS.timetables, timetables)
}

// Absence storage
export function getAbsences(): Absence[] {
  return loadData<Absence[]>(STORAGE_KEYS.absences, [])
}

export function saveAbsences(absences: Absence[]): void {
  saveData(STORAGE_KEYS.absences, absences)
}

// Relief assignment storage
export function getReliefAssignments(): ReliefAssignment[] {
  return loadData<ReliefAssignment[]>(
    STORAGE_KEYS.assignments,
    []
  )
}

export function saveReliefAssignments(
  assignments: ReliefAssignment[]
): void {
  saveData(STORAGE_KEYS.assignments, assignments)
}
