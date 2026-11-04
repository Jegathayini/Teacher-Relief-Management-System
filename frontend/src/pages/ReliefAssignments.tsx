
import { useEffect, useState } from "react"
import { fetchTeachers, fetchTimetables, fetchAbsences, fetchReliefAssignments, createReliefAssignment,deleteReliefAssignment } from "../services/api"
import type {
  Teacher,
  TimetableEntry,
  Absence,
  ReliefAssignment
} from "../types"


import { getReliefSuggestions } from "../utils/reliefEngine"

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
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [timetables, setTimetables] = useState<TimetableEntry[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])

  const [assignments, setAssignments] = useState<ReliefAssignment[]>([])
  const [date, setDate] = useState(getToday)
  const [databaseStatus, setDatabaseStatus] = useState("Loading Supabase data...")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [
  loadedTeachers,
  loadedTimetables,
  loadedAbsences,
  loadedAssignments
] = await Promise.all([
  fetchTeachers(),
  fetchTimetables(),
  fetchAbsences(),
  fetchReliefAssignments()
])

setTeachers(loadedTeachers)
setTimetables(loadedTimetables)
setAbsences(loadedAbsences)
setAssignments(loadedAssignments)
        setDatabaseStatus("Connected to Supabase")
      } catch (cause) {
        console.error("Failed to load relief data:", cause)
        setDatabaseStatus("Supabase connection failed")
        setError("Could not load teachers, timetables and absences from Supabase.")
      }
    }
    void loadData()
  }, [])
  
async function handleRemoveAssignment(assignmentId: string) {
  try {
    setError("")

    await deleteReliefAssignment(assignmentId)

    setAssignments((current) =>
      current.filter((assignment) => assignment.id !== assignmentId)
    )
  } catch (cause) {
    setError(
      cause instanceof Error
        ? cause.message
        : "Failed to remove relief assignment."
    )
  }
}

  async function handleAssign(entry: TimetableEntry, reliefTeacherId: string) {
    if (saving) return
    setSaving(true)
    setError("")
    try {
      await createReliefAssignment({
        date,
        period: entry.period,
        className: entry.className,
        absentTeacherId: entry.teacherId,
        reliefTeacherId,
        subject: entry.subject
      })
      // Reload from the database rather than trusting browser state.
      setAssignments(await fetchReliefAssignments())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save relief assignment.")
      // Refresh in case the server saved the assignment but the response failed.
      try { setAssignments(await fetchReliefAssignments()) } catch { /* keep existing data */ }
    } finally {
      setSaving(false)
    }
  }

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
        <p className="mt-2 text-sm text-cyan-400" role="status">
          Database: {databaseStatus}
        </p>
        <p className="mt-1 text-sm text-amber-300">
          Relief assignments are loaded from Supabase. New assignments are saved to the database.
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

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          Lessons Requiring Relief
        </h2>

        {databaseStatus !== "Connected to Supabase" ? (
          <div className="rounded-xl bg-slate-800 p-6 text-slate-300">
            Waiting for Supabase data. Check that Flask is running if this persists.
          </div>
        ) : affectedLessons.length === 0 ? (
          <div className="rounded-xl bg-slate-800 p-6 text-slate-300">
            No affected lessons found for this date.
            Check that absences and weekly timetables have been recorded in Supabase.
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
  onClick={() => {
    void handleRemoveAssignment(existingAssignment.id)
  }}
  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
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
                            {suggestion.totalReliefCount} total · {suggestion.reliefCount} today relief assignments
                          </p>

                          {suggestion.subjectMatch && (
                            <span className="mt-1 inline-block text-xs text-green-400">
                              Same Subject
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleAssign(entry, suggestion.teacher.id)}
                          className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {saving ? "Saving..." : "Assign Relief"}
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
