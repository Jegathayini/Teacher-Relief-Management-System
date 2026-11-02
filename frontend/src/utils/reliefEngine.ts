
import type {
  Teacher,
  TimetableEntry,
  Absence,
  ReliefAssignment
} from "../types"

export type ReliefSuggestion = {
  teacher: Teacher
  reliefCount: number
  totalReliefCount: number
  subjectMatch: boolean
}

type ReliefRequest = {
  date: string
  period: number
  absentTeacherId: string
  subject: string
}

function getDayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  const dateObject = new Date(year, month - 1, day)

  return dateObject.toLocaleDateString("en-US", {
    weekday: "long"
  })
}

export function getReliefSuggestions(
  request: ReliefRequest,
  teachers: Teacher[],
  timetables: TimetableEntry[],
  absences: Absence[],
  assignments: ReliefAssignment[]
): ReliefSuggestion[] {
  const dayName = getDayName(request.date)

  // Teachers absent on the selected date
  const absentTeacherIds = new Set(
    absences
      .filter((absence) => absence.date === request.date)
      .map((absence) => absence.teacherId)
  )

  // Teachers who have a regular class during this period
  const busyTeacherIds = new Set(
    timetables
      .filter(
        (entry) =>
          entry.day === dayName &&
          entry.period === request.period
      )
      .map((entry) => entry.teacherId)
  )

  // Teachers already assigned relief during this period
  const assignedTeacherIds = new Set(
    assignments
      .filter(
        (assignment) =>
          assignment.date === request.date &&
          assignment.period === request.period
      )
      .map((assignment) => assignment.reliefTeacherId)
  )

  return teachers
    .filter((teacher) => {
      return (
        teacher.active &&
        teacher.id !== request.absentTeacherId &&
        !absentTeacherIds.has(teacher.id) &&
        !busyTeacherIds.has(teacher.id) &&
        !assignedTeacherIds.has(teacher.id)
      )
    })
    .map((teacher) => {
      const reliefCount = assignments.filter(
        (assignment) =>
          assignment.date === request.date &&
          assignment.reliefTeacherId === teacher.id
      ).length

      // Lifetime total is calculated across ALL dates, including previous years.
      // The academic-year rollover preserves these assignment records in SQLite.
      const totalReliefCount = assignments.filter(
        (assignment) => assignment.reliefTeacherId === teacher.id
      ).length

      const subjectMatch = teacher.subjects.some(
        (subject) =>
          subject.toLowerCase() ===
          request.subject.toLowerCase()
      )

      return {
        teacher,
        reliefCount,
        totalReliefCount,
        subjectMatch
      }
    })
    .sort((a, b) => {
      // Prefer teachers with fewer relief assignments
      if (a.reliefCount !== b.reliefCount) {
        return a.reliefCount - b.reliefCount
      }

      // On equal daily workload, favor the teacher with fewer lifetime assignments.
      if (a.totalReliefCount !== b.totalReliefCount) {
        return a.totalReliefCount - b.totalReliefCount
      }

      // Then prefer teachers who teach the same subject
      if (a.subjectMatch !== b.subjectMatch) {
        return a.subjectMatch ? -1 : 1
      }

      return a.teacher.name.localeCompare(b.teacher.name)
    })
}

export function isReliefConflict(
  teacherId: string,
  date: string,
  period: number,
  timetables: TimetableEntry[],
  absences: Absence[],
  assignments: ReliefAssignment[]
): boolean {
  const dayName = getDayName(date)

  const isAbsent = absences.some(
    (absence) =>
      absence.teacherId === teacherId &&
      absence.date === date
  )

  const hasRegularClass = timetables.some(
    (entry) =>
      entry.teacherId === teacherId &&
      entry.day === dayName &&
      entry.period === period
  )

  const hasReliefAssignment = assignments.some(
    (assignment) =>
      assignment.reliefTeacherId === teacherId &&
      assignment.date === date &&
      assignment.period === period
  )

  return isAbsent || hasRegularClass || hasReliefAssignment
}
