import type {
  Teacher,
  TimetableEntry,
  Absence,
  TeacherUnavailability,
  ReliefAssignment,
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

export function isValidIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [year, month, day] = date.split("-").map(Number)
  const parsed = new Date(year, month - 1, day)
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  )
}

export function getDayName(date: string): string {
  if (!isValidIsoDate(date)) return ""
  const [year, month, day] = date.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
  })
}

export function isTeacherAbsentDuringPeriod(
  teacherId: string,
  date: string,
  period: number,
  absences: Absence[]
): boolean {
  return absences.some(
    (absence) =>
      absence.teacherId === teacherId &&
      absence.date === date &&
      absence.absentPeriods.includes(period)
  )
}

export function isTeacherUnavailableDuringPeriod(
  teacherId: string,
  date: string,
  period: number,
  unavailabilities: TeacherUnavailability[]
): boolean {
  const dayName = getDayName(date)
  if (!dayName) return false
  const normalizedDay = dayName.trim().toLowerCase()

  return unavailabilities.some(
    (item) =>
      item.teacherId === teacherId &&
      item.periods.includes(period) &&
      ((item.scope === "date" && item.date === date) ||
        (item.scope === "weekly" &&
          item.day !== null &&
          item.day.trim().toLowerCase() === normalizedDay))
  )
}

export function getReliefSuggestions(
  request: ReliefRequest,
  teachers: Teacher[],
  timetables: TimetableEntry[],
  absences: Absence[],
  assignments: ReliefAssignment[],
  lifetimeCounts: Record<string, number> = {},
  unavailabilities: TeacherUnavailability[] = []
): ReliefSuggestion[] {
  const dayName = getDayName(request.date)
  if (!dayName) return []

  const normalizedDay = dayName.trim().toLowerCase()
  const requestedSubject = request.subject.trim().toLowerCase()

  const busyTeacherIds = new Set(
    timetables
      .filter(
        (entry) =>
          entry.day.trim().toLowerCase() === normalizedDay &&
          entry.period === request.period
      )
      .map((entry) => entry.teacherId)
  )

  const assignedTeacherIds = new Set(
    assignments
      .filter(
        (assignment) =>
          assignment.date === request.date &&
          assignment.period === request.period
      )
      .map((assignment) => assignment.reliefTeacherId)
  )

  const hasLifetimeMap = Object.keys(lifetimeCounts).length > 0

  return teachers
    .filter(
      (teacher) =>
        teacher.active &&
        teacher.id !== request.absentTeacherId &&
        !isTeacherAbsentDuringPeriod(
          teacher.id,
          request.date,
          request.period,
          absences
        ) &&
        !isTeacherUnavailableDuringPeriod(
          teacher.id,
          request.date,
          request.period,
          unavailabilities
        ) &&
        !busyTeacherIds.has(teacher.id) &&
        !assignedTeacherIds.has(teacher.id)
    )
    .map((teacher) => {
      const reliefCount = assignments.filter(
        (assignment) =>
          assignment.date === request.date &&
          assignment.reliefTeacherId === teacher.id
      ).length

      const pendingPreviewCount = assignments.filter(
        (assignment) =>
          assignment.reliefTeacherId === teacher.id &&
          (assignment.id.startsWith("preview:") ||
            assignment.id.startsWith("planned:"))
      ).length

      const totalReliefCount = hasLifetimeMap
        ? (lifetimeCounts[teacher.id] ?? 0) + pendingPreviewCount
        : assignments.filter(
            (assignment) => assignment.reliefTeacherId === teacher.id
          ).length

      const subjectMatch =
        Boolean(requestedSubject) &&
        teacher.subjects.some(
          (subject) => subject.trim().toLowerCase() === requestedSubject
        )

      return {
        teacher,
        reliefCount,
        totalReliefCount,
        subjectMatch,
      }
    })
    .sort((a, b) => {
      if (a.reliefCount !== b.reliefCount) {
        return a.reliefCount - b.reliefCount
      }
      if (a.totalReliefCount !== b.totalReliefCount) {
        return a.totalReliefCount - b.totalReliefCount
      }
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
  assignments: ReliefAssignment[],
  excludeAssignmentId?: string,
  unavailabilities: TeacherUnavailability[] = []
): boolean {
  const dayName = getDayName(date)
  if (!dayName) return true
  const normalizedDay = dayName.trim().toLowerCase()

  const isAbsent = isTeacherAbsentDuringPeriod(
    teacherId,
    date,
    period,
    absences
  )

  const isUnavailable = isTeacherUnavailableDuringPeriod(
    teacherId,
    date,
    period,
    unavailabilities
  )

  const hasRegularClass = timetables.some(
    (entry) =>
      entry.teacherId === teacherId &&
      entry.day.trim().toLowerCase() === normalizedDay &&
      entry.period === period
  )

  const hasReliefAssignment = assignments.some(
    (assignment) =>
      assignment.reliefTeacherId === teacherId &&
      assignment.date === date &&
      assignment.period === period &&
      assignment.id !== excludeAssignmentId
  )

  return isAbsent || isUnavailable || hasRegularClass || hasReliefAssignment
}