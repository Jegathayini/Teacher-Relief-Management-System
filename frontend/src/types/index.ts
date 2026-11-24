export type Teacher = {
  id: string
  name: string
  subjects: string[]
  active: boolean
}

export type TimetableEntry = {
  id: string
  teacherId: string
  className: string
  subject: string
  day: string
  period: number
}

export type Absence = {
  id: string
  teacherId: string
  date: string
  reason: string
  absentPeriods: number[]
}

export type UnavailabilityScope = "date" | "weekly"

export type TeacherUnavailability = {
  id: string
  teacherId: string
  scope: UnavailabilityScope
  date: string | null
  day: string | null
  periods: number[]
  reason: string
}

export type ReliefAssignment = {
  id: string
  date: string
  period: number
  className: string
  absentTeacherId: string
  reliefTeacherId: string
  subject: string
}

export type Period = {
  number: number
  startTime: string
  endTime: string
}