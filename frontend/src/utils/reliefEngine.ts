
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

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-US",
    { weekday: "long" }
  )
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

export function getReliefSuggestions(
  request: ReliefRequest,
  teachers: Teacher[],
  timetables: TimetableEntry[],
  absences: Absence[],
  assignments: ReliefAssignment[],
  lifetimeCounts: Record<string, number> = {}
): ReliefSuggestion[] {
  const dayName = getDayName(request.date)

  const busyTeacherIds = new Set(
    timetables
      .filter(
        (entry) =>
          entry.day === dayName &&
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
        !busyTeacherIds.has(teacher.id) &&
        !assignedTeacherIds.has(teacher.id)
    )
    .map((teacher) => {
      const reliefCount = assignments.filter(
        (assignment) =>
          assignment.date === request.date &&
          assignment.reliefTeacherId === teacher.id
      ).length

      const totalReliefCount =
        lifetimeCounts[teacher.id] ??
        assignments.filter(
          (assignment) =>
            assignment.reliefTeacherId === teacher.id
        ).length

      const subjectMatch = teacher.subjects.some(
        (subject) =>
          subject.trim().toLowerCase() ===
          request.subject.trim().toLowerCase()
      )

      return {
        teacher,
        reliefCount,
        totalReliefCount,
        subjectMatch
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
  excludeAssignmentId?: string
): boolean {
  const dayName = getDayName(date)

  const isAbsent = isTeacherAbsentDuringPeriod(
    teacherId,
    date,
    period,
    absences
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
      assignment.period === period &&
      assignment.id !== excludeAssignmentId
  )

  return isAbsent || hasRegularClass || hasReliefAssignment
}
