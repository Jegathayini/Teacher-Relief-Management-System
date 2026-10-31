
import { useState } from "react"
import type {
  Teacher,
  TimetableEntry,
  Absence,
  ReliefAssignment
} from "../types"

import {
  getTeachers,
  getTimetables,
  getAbsences,
  getReliefAssignments,
  saveReliefAssignments
} from "../utils/storage"

import {
  getReliefSuggestions,
  isReliefConflict
} from "../utils/reliefEngine"

function getToday(): string {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getDayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number)

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-US",
    { weekday: "long" }
  )
}

function ReliefAssignments() {
  const [teachers] = useState<Teacher[]>(getTeachers)
  const [timetables] = useState<TimetableEntry[]>(getTimetables)
  const [absences] = useState<Absence[]>(getAbsences)

  const [assignments, setAssignments] =
    useState<ReliefAssignment[]>(getReliefAssignments)

  const [date, setDate] = useState(getToday)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const dayName = getDayName(date)

  function getTeacherName(id: string): string {
    return teachers.find((teacher) => teacher.id === id)?.name
      ?? "Unknown Teacher"
  }

  const absentTeacherIds = new Set(
    absences
      .filter((absence) => absence.date === date)
      .map((absence) => absence.teacherId)
  )

  const affectedLessons = timetables
    .filter(
      (entry) =>
        entry.day === dayName &&
        absentTeacherIds.has(entry.teacherId)
    )
    .sort((a, b) => {
      if (a.period !== b.period) {
        return a.period - b.period
      }

      return a.className.localeCompare(b.className)
    })

  function findAssignment(entry: TimetableEntry) {
    return assignments.find(
      (assignment) =>
        assignment.date === date &&
        assignment.period === entry.period &&
        assignment.className === entry.className &&
        assignment.absentTeacherId === entry.teacherId
    )
  }

  
function handleAssign(
  entry: TimetableEntry,
  reliefTeacherId: string
) {
  setError("")
  setMessage("")

  if (!reliefTeacherId) {
    setError("Please select a relief teacher.")
    return
  }

  // Read the latest saved data before validation.
  const currentTeachers = getTeachers()
  const currentTimetables = getTimetables()
  const currentAbsences = getAbsences()
  const currentAssignments = getReliefAssignments()

  // 1. Verify the original lesson still exists.
  const lessonExists = currentTimetables.some(
    (item) =>
      item.id === entry.id &&
      item.teacherId === entry.teacherId &&
      item.className === entry.className &&
      item.period === entry.period &&
      item.day === getDayName(date) &&
      item.subject === entry.subject
  )

  if (!lessonExists) {
    setError(
      "This timetable lesson has changed or been deleted. " +
      "Refresh the page and try again."
    )
    return
  }

  // 2. Prevent duplicate assignments for the lesson.
  const alreadyAssigned = currentAssignments.some(
    (assignment) =>
      assignment.date === date &&
      assignment.period === entry.period &&
      assignment.className.toLowerCase() ===
        entry.className.toLowerCase() &&
      assignment.absentTeacherId === entry.teacherId
  )

  if (alreadyAssigned) {
    setError("This lesson already has a relief assignment.")
    return
  }

  // 3. Verify that the original teacher is absent.
  const isStillAbsent = currentAbsences.some(
    (absence) =>
      absence.date === date &&
      absence.teacherId === entry.teacherId
  )

  if (!isStillAbsent) {
    setError(
      "The original teacher is no longer marked absent."
    )
    return
  }

  // 4. Check whether the substitute is still active.
  const reliefTeacher = currentTeachers.find(
    (teacher) => teacher.id === reliefTeacherId
  )

  if (!reliefTeacher || !reliefTeacher.active) {
    setError(
      "The selected relief teacher is no longer active."
    )
    return
  }

  // 5. A teacher cannot replace themselves.
  if (reliefTeacherId === entry.teacherId) {
    setError(
      "A teacher cannot substitute for themselves."
    )
    return
  }

  // 6. Check for scheduling conflicts.
  if (
    isReliefConflict(
      reliefTeacherId,
      date,
      entry.period,
      currentTimetables,
      currentAbsences,
      currentAssignments
    )
  ) {
    setError(
      "This teacher is absent, teaching, or already " +
      "assigned relief during this period."
    )
    return
  }

  // 7. Save the validated assignment.
  const newAssignment: ReliefAssignment = {
    id: crypto.randomUUID(),
    date,
    period: entry.period,
    className: entry.className,
    absentTeacherId: entry.teacherId,
    reliefTeacherId,
    subject: entry.subject
  }

  const updated = [
    ...currentAssignments,
    newAssignment
  ]

  setAssignments(updated)
  saveReliefAssignments(updated)

  setMessage(
    `${reliefTeacher.name} assigned to ` +
    `${entry.className}, Period ${entry.period}.`
  )
}


  function handleRemove(assignmentId: string) {
    const confirmed = window.confirm(
      "Remove this relief assignment?"
    )

    if (!confirmed) return

    const updated = assignments.filter(
      (assignment) => assignment.id !== assignmentId
    )

    setAssignments(updated)
    saveReliefAssignments(updated)

    setMessage("Relief assignment removed.")
    setError("")
  }

  const assignedLessons = affectedLessons.filter(
    (entry) => Boolean(findAssignment(entry))
  )

  const pendingLessons = affectedLessons.filter(
    (entry) => !findAssignment(entry)
  )

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cyan-400">
          Relief Assignment Management
        </h1>
        <p className="mt-1 text-slate-400">
          Find available teachers and assign temporary daily relief.
        </p>
      </div>

      <div className="rounded-xl bg-slate-800 p-5">
        <label
          htmlFor="relief-date"
          className="mb-2 block text-sm text-slate-300"
        >
          Select Date
        </label>

        <input
          id="relief-date"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value)
            setError("")
            setMessage("")
          }}
          className="rounded-lg bg-slate-700 p-3 text-white"
        />

        <p className="mt-2 text-sm text-slate-400">
          {dayName}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-slate-800 p-5">
          <p className="text-sm text-slate-400">
            Affected Lessons
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {affectedLessons.length}
          </p>
        </div>

        <div className="rounded-xl bg-slate-800 p-5">
          <p className="text-sm text-slate-400">
            Relief Assigned
          </p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            {assignedLessons.length}
          </p>
        </div>

        <div className="rounded-xl bg-slate-800 p-5">
          <p className="text-sm text-slate-400">
            Pending Relief
          </p>
          <p className="mt-2 text-3xl font-bold text-amber-400">
            {pendingLessons.length}
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-300"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="rounded-lg border border-green-800 bg-green-950 p-4 text-green-300"
        >
          {message}
        </p>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          Lessons Requiring Relief
        </h2>

        {affectedLessons.length === 0 ? (
          <div className="rounded-xl bg-slate-800 p-6 text-slate-300">
            No affected lessons found for this date.
            Check that absences and weekly timetables have been recorded.
          </div>
        ) : (
          affectedLessons.map((entry) => {
            const existingAssignment = findAssignment(entry)

            const suggestions = existingAssignment
              ? []
              : getReliefSuggestions(
                  {
                    date,
                    period: entry.period,
                    absentTeacherId: entry.teacherId,
                    subject: entry.subject
                  },
                  teachers,
                  timetables,
                  absences,
                  assignments
                )

            return (
              <div
                key={entry.id}
                className="rounded-xl bg-slate-800 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {entry.className} — Period {entry.period}
                    </h3>

                    <p className="mt-1 text-sm text-slate-300">
                      Subject: {entry.subject}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Absent Teacher: {getTeacherName(entry.teacherId)}
                    </p>
                  </div>

                  <span
                    className={
                      existingAssignment
                        ? "rounded-full bg-green-900 px-3 py-1 text-xs text-green-300"
                        : "rounded-full bg-amber-900 px-3 py-1 text-xs text-amber-300"
                    }
                  >
                    {existingAssignment ? "Assigned" : "Pending"}
                  </span>
                </div>

                {existingAssignment ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-700 p-4">
                    <div>
                      <p className="text-xs text-slate-400">
                        Assigned Relief Teacher
                      </p>
                      <p className="font-semibold text-green-300">
                        {getTeacherName(
                          existingAssignment.reliefTeacherId
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleRemove(existingAssignment.id)
                      }
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500"
                    >
                      Remove Assignment
                    </button>
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="mt-4 rounded-lg bg-slate-700 p-4 text-sm text-amber-300">
                    No eligible relief teachers available for this period.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-semibold text-cyan-300">
                      Suggested Relief Teachers
                    </h4>

                    {suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.teacher.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-700 p-4"
                      >
                        <div>
                          <p className="font-semibold text-white">
                            {index + 1}. {suggestion.teacher.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-300">
                            {suggestion.reliefCount} relief assignment(s)
                            on this date
                          </p>

                          {suggestion.subjectMatch && (
                            <span className="mt-1 inline-block text-xs text-green-400">
                              Same Subject
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleAssign(
                              entry,
                              suggestion.teacher.id
                            )
                          }
                          className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                        >
                          Assign Relief
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="rounded-xl bg-slate-800 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Daily Relief Assignment Summary
        </h2>

        {assignments.filter(
          (assignment) => assignment.date === date
        ).length === 0 ? (
          <p className="text-sm text-slate-400">
            No relief assignments recorded for this date.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-600 text-slate-300">
                <tr>
                  <th className="p-3">Period</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Absent Teacher</th>
                  <th className="p-3">Relief Teacher</th>
                </tr>
              </thead>

              <tbody>
                {assignments
                  .filter(
                    (assignment) => assignment.date === date
                  )
                  .sort((a, b) => a.period - b.period)
                  .map((assignment) => (
                    <tr
                      key={assignment.id}
                      className="border-b border-slate-700 text-white"
                    >
                      <td className="p-3">
                        {assignment.period}
                      </td>
                      <td className="p-3">
                        {assignment.className}
                      </td>
                      <td className="p-3">
                        {assignment.subject}
                      </td>
                      <td className="p-3">
                        {getTeacherName(
                          assignment.absentTeacherId
                        )}
                      </td>
                      <td className="p-3 text-green-300">
                        {getTeacherName(
                          assignment.reliefTeacherId
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default ReliefAssignments
