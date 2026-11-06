import { downloadDailyReliefPdf } from "../utils/dailyReliefPdf"
import { useEffect, useState } from "react"
import {
  fetchTeachers,
  fetchTimetables,
  fetchAbsences,
  fetchReliefAssignments,
  fetchSchoolReliefCounts,
  createReliefAssignment,
  deleteReliefAssignment,
  replaceReliefAssignment
} from "../services/api"
import type { Teacher, TimetableEntry, Absence, ReliefAssignment } from "../types"
import { getReliefSuggestions, isTeacherAbsentDuringPeriod } from "../utils/reliefEngine"

function getToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function getDayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "long" })
}

export default function ReliefAssignments() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [timetables, setTimetables] = useState<TimetableEntry[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [assignments, setAssignments] = useState<ReliefAssignment[]>([])
  const [lifetimeCounts, setLifetimeCounts] = useState<Record<string, number>>({})
  const [date, setDate] = useState(getToday)
  const [databaseStatus, setDatabaseStatus] = useState("Loading Supabase data...")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  async function refreshData() {
    const [loadedTeachers, loadedTimetables, loadedAbsences, loadedAssignments, loadedCounts] =
      await Promise.all([
        fetchTeachers(),
        fetchTimetables(),
        fetchAbsences(),
        fetchReliefAssignments(),
        fetchSchoolReliefCounts()
      ])
    setTeachers(loadedTeachers)
    setTimetables(loadedTimetables)
    setAbsences(loadedAbsences)
    setAssignments(loadedAssignments)
    setLifetimeCounts(loadedCounts)
    setDatabaseStatus("Connected to Supabase")
  }

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      try {
        const [loadedTeachers, loadedTimetables, loadedAbsences, loadedAssignments, loadedCounts] =
          await Promise.all([
            fetchTeachers(), fetchTimetables(), fetchAbsences(),
            fetchReliefAssignments(), fetchSchoolReliefCounts()
          ])
        if (cancelled) return
        setTeachers(loadedTeachers)
        setTimetables(loadedTimetables)
        setAbsences(loadedAbsences)
        setAssignments(loadedAssignments)
        setLifetimeCounts(loadedCounts)
        setDatabaseStatus("Connected to Supabase")
      } catch (cause) {
        if (cancelled) return
        console.error("Failed to load relief data:", cause)
        setDatabaseStatus("Supabase connection failed")
        setError(cause instanceof Error ? cause.message : "Could not load Supabase data.")
      }
    }
    void loadData()
    return () => { cancelled = true }
  }, [])

  const dayName = getDayName(date)
  const dailyAssignments = assignments.filter((assignment) => assignment.date === date)
  const conflictingAssignments = dailyAssignments.filter((assignment) =>
    isTeacherAbsentDuringPeriod(assignment.reliefTeacherId, date, assignment.period, absences)
  )

  function getTeacherName(id: string): string {
    return teachers.find((teacher) => teacher.id === id)?.name ?? "Unknown Teacher"
  }

  function findAssignment(entry: TimetableEntry): ReliefAssignment | undefined {
    return dailyAssignments.find((assignment) =>
      assignment.period === entry.period &&
      assignment.className === entry.className &&
      assignment.absentTeacherId === entry.teacherId
    )
  }

  const affectedLessons = timetables
    .filter((entry) => entry.day === dayName &&
      isTeacherAbsentDuringPeriod(entry.teacherId, date, entry.period, absences))
    .sort((a, b) => a.period - b.period || a.className.localeCompare(b.className))

  const assignedLessons = affectedLessons.filter((entry) => Boolean(findAssignment(entry)))
  const pendingLessons = affectedLessons.filter((entry) => !findAssignment(entry))

  async function handleAssign(entry: TimetableEntry, reliefTeacherId: string) {
    if (busyId || databaseStatus !== "Connected to Supabase") return
    setBusyId(entry.id)
    setError("")
    setSuccess("")
    try {
      await createReliefAssignment({
        date,
        period: entry.period,
        className: entry.className,
        absentTeacherId: entry.teacherId,
        reliefTeacherId,
        subject: entry.subject
      })
      await refreshData()
      setSuccess("Relief assignment saved to Supabase.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save relief assignment.")
      try { await refreshData() } catch { /* Retain last loaded data. */ }
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemoveAssignment(assignment: ReliefAssignment) {
    if (busyId || databaseStatus !== "Connected to Supabase") return
    if (!window.confirm(
      `Remove the relief assignment for ${assignment.className}, Period ${assignment.period}?`
    )) return
    setBusyId(assignment.id)
    setError("")
    setSuccess("")
    try {
      await deleteReliefAssignment(assignment.id)
      await refreshData()
      setSuccess("Relief assignment removed.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to remove relief assignment.")
      try { await refreshData() } catch { /* Retain last loaded data. */ }
    } finally {
      setBusyId(null)
    }
  }

  async function handleReplaceAssignment(assignment: ReliefAssignment, newTeacherId: string) {
    if (busyId || databaseStatus !== "Connected to Supabase") return
    const newTeacher = teachers.find((teacher) => teacher.id === newTeacherId)
    if (!newTeacher?.active || newTeacherId === assignment.reliefTeacherId) {
      setError("Select a different active replacement teacher.")
      return
    }
    if (!window.confirm(
      `Replace ${getTeacherName(assignment.reliefTeacherId)} with ${newTeacher.name}\n` +
      `for ${assignment.className}, Period ${assignment.period} on ${assignment.date}?\n\n` +
      "This will update the assignment and record replacement history."
    )) return

    setBusyId(assignment.id)
    setError("")
    setSuccess("")
    try {
      await replaceReliefAssignment(assignment.id, newTeacherId)
      await refreshData()
      setSuccess(`Relief teacher replaced with ${newTeacher.name}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to replace relief teacher.")
      try { await refreshData() } catch { /* Retain last loaded data. */ }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cyan-400">Relief Assignment Management</h1>
        <p className="mt-1 text-slate-400">Find available teachers, assign relief, and resolve substitute conflicts.</p>
        <p className="mt-2 text-sm text-cyan-400" role="status">Database: {databaseStatus}</p>
        <p className="mt-1 text-sm text-amber-300">Assignments are saved directly to Supabase. Replacements require administrator confirmation.</p>
      </div>

      <div className="rounded-xl bg-slate-800 p-5">
        <label htmlFor="relief-date" className="mb-2 block text-sm text-slate-300">Select Date</label>
        <div className="flex flex-wrap items-center gap-4">
          <input id="relief-date" type="date" value={date} onChange={(event) => {
            setDate(event.target.value)
            setError("")
            setSuccess("")
          }} className="rounded-lg bg-slate-700 p-3 text-white" />
          <span className="text-sm text-slate-400">{dayName}</span>
          <button type="button"
            disabled={busyId !== null || databaseStatus !== "Connected to Supabase" || !date}
            onClick={() => {
              try {
                setError("")
                downloadDailyReliefPdf(date, dailyAssignments, teachers)
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Could not generate the PDF.")
              }
            }}
            className="rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
            Download Daily PDF
          </button>
          <button type="button" disabled={busyId !== null} onClick={() => {
            setError("")
            setSuccess("")
            void refreshData().catch((cause: unknown) => {
              setError(cause instanceof Error ? cause.message : "Could not refresh data.")
            })
          }} className="rounded-lg bg-slate-700 px-4 py-3 text-sm text-white hover:bg-slate-600 disabled:opacity-40">
            Refresh Data
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Affected Lessons", count: affectedLessons.length, color: "text-white" },
          { label: "Relief Assigned", count: assignedLessons.length, color: "text-green-400" },
          { label: "Pending Relief", count: pendingLessons.length, color: "text-amber-400" },
          { label: "Replacement Conflicts", count: conflictingAssignments.length, color: "text-red-400" }
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-800 p-5">
            <p className="text-sm text-slate-400">{item.label}</p>
            <p className={`mt-2 text-3xl font-bold ${item.color}`}>{item.count}</p>
          </div>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-300">{error}</p>}
      {success && <p role="status" className="rounded-lg border border-green-800 bg-green-950 p-4 text-green-300">{success}</p>}

      {conflictingAssignments.length > 0 && (
        <div className="space-y-4 rounded-xl border border-red-700 bg-slate-800 p-6">
          <div>
            <h2 className="text-xl font-semibold text-red-400">Relief Assignment Conflicts</h2>
            <p className="mt-1 text-sm text-slate-300">
              {conflictingAssignments.length} assignment(s) have a relief teacher absent during the assigned period. Confirm a replacement below.
            </p>
          </div>
          {conflictingAssignments.map((assignment) => {
            const suggestions = getReliefSuggestions(
              { date: assignment.date, period: assignment.period, absentTeacherId: assignment.absentTeacherId, subject: assignment.subject },
              teachers, timetables, absences,
              assignments.filter((existing) => existing.id !== assignment.id),
              lifetimeCounts
            ).filter((suggestion) => suggestion.teacher.id !== assignment.reliefTeacherId)
            return (
              <div key={assignment.id} className="space-y-3 rounded-lg bg-slate-700 p-4">
                <div>
                  <h3 className="font-semibold text-white">{assignment.className} — Period {assignment.period}</h3>
                  <p className="text-sm text-slate-300">Subject: {assignment.subject}</p>
                  <p className="text-sm text-slate-300">Absent Teacher: {getTeacherName(assignment.absentTeacherId)}</p>
                  <p className="mt-1 text-sm text-red-300">Unavailable Relief Teacher: {getTeacherName(assignment.reliefTeacherId)}</p>
                </div>
                <h4 className="text-sm font-semibold text-cyan-300">Suggested Replacement Teachers</h4>
                {suggestions.length === 0 ? (
                  <p className="text-sm text-amber-300">No eligible replacements found for this period.</p>
                ) : suggestions.map((suggestion) => (
                  <div key={suggestion.teacher.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-800 p-3">
                    <div>
                      <p className="font-semibold text-white">{suggestion.teacher.name}</p>
                      <p className="text-xs text-slate-400">{suggestion.totalReliefCount} total · {suggestion.reliefCount} today</p>
                      {suggestion.subjectMatch && <span className="text-xs text-green-400">Same Subject</span>}
                    </div>
                    <button type="button" disabled={busyId !== null} onClick={() => void handleReplaceAssignment(assignment, suggestion.teacher.id)}
                      className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
                      {busyId === assignment.id ? "Replacing..." : "Confirm Replacement"}
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Lessons Requiring Relief</h2>
        {databaseStatus !== "Connected to Supabase" ? (
          <div className="rounded-xl bg-slate-800 p-6 text-slate-300">Waiting for Supabase data. Try refreshing the page.</div>
        ) : affectedLessons.length === 0 ? (
          <div className="rounded-xl bg-slate-800 p-6 text-slate-300">No affected lessons found for this date. Check the absences and weekly timetable.</div>
        ) : affectedLessons.map((entry) => {
          const existingAssignment = findAssignment(entry)
          const hasConflict = existingAssignment ? conflictingAssignments.some((item) => item.id === existingAssignment.id) : false
          const suggestions = existingAssignment ? [] : getReliefSuggestions(
            { date, period: entry.period, absentTeacherId: entry.teacherId, subject: entry.subject },
            teachers, timetables, absences, assignments, lifetimeCounts
          )
          return (
            <div key={entry.id} className="rounded-xl bg-slate-800 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{entry.className} — Period {entry.period}</h3>
                  <p className="mt-1 text-sm text-slate-300">Subject: {entry.subject}</p>
                  <p className="mt-1 text-sm text-slate-400">Absent Teacher: {getTeacherName(entry.teacherId)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${hasConflict ? "bg-red-900 text-red-300" : existingAssignment ? "bg-green-900 text-green-300" : "bg-amber-900 text-amber-300"}`}>
                  {hasConflict ? "Conflict" : existingAssignment ? "Assigned" : "Pending"}
                </span>
              </div>
              {existingAssignment ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-700 p-4">
                  <div>
                    <p className="text-xs text-slate-400">Assigned Relief Teacher</p>
                    <p className={`font-semibold ${hasConflict ? "text-red-300" : "text-green-300"}`}>{getTeacherName(existingAssignment.reliefTeacherId)}</p>
                    {hasConflict && <p className="mt-1 text-xs text-red-300">Replacement required — use the conflict section above.</p>}
                  </div>
                  <button type="button" disabled={busyId !== null || hasConflict} onClick={() => void handleRemoveAssignment(existingAssignment)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    title={hasConflict ? "Resolve the conflict by confirming a replacement" : "Remove this assignment"}>
                    {busyId === existingAssignment.id ? "Removing..." : "Remove Assignment"}
                  </button>
                </div>
              ) : suggestions.length === 0 ? (
                <p className="mt-4 rounded-lg bg-slate-700 p-4 text-sm text-amber-300">No eligible relief teachers available for this period.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-cyan-300">Suggested Relief Teachers</h4>
                  {suggestions.map((suggestion, index) => (
                    <div key={suggestion.teacher.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-700 p-4">
                      <div>
                        <p className="font-semibold text-white">{index + 1}. {suggestion.teacher.name}</p>
                        <p className="mt-1 text-xs text-slate-300">{suggestion.totalReliefCount} total · {suggestion.reliefCount} today relief assignments</p>
                        {suggestion.subjectMatch && <span className="mt-1 inline-block text-xs text-green-400">Same Subject</span>}
                      </div>
                      <button type="button" disabled={busyId !== null} onClick={() => void handleAssign(entry, suggestion.teacher.id)}
                        className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
                        {busyId === entry.id ? "Saving..." : "Assign Relief"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-xl bg-slate-800 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Daily Relief Assignment Summary</h2>
        {dailyAssignments.length === 0 ? (
          <p className="text-sm text-slate-400">No relief assignments recorded for this date.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-600 text-slate-300">
                <tr><th className="p-3">Period</th><th className="p-3">Class</th><th className="p-3">Subject</th><th className="p-3">Absent Teacher</th><th className="p-3">Relief Teacher</th></tr>
              </thead>
              <tbody>
                {[...dailyAssignments].sort((a, b) => a.period - b.period || a.className.localeCompare(b.className)).map((assignment) => {
                  const hasConflict = conflictingAssignments.some((item) => item.id === assignment.id)
                  return (
                    <tr key={assignment.id} className="border-b border-slate-700 text-white">
                      <td className="p-3">{assignment.period}</td>
                      <td className="p-3">{assignment.className}</td>
                      <td className="p-3">{assignment.subject}</td>
                      <td className="p-3">{getTeacherName(assignment.absentTeacherId)}</td>
                      <td className="p-3">
                        <span className={hasConflict ? "text-red-400" : "text-green-300"}>{getTeacherName(assignment.reliefTeacherId)}</span>
                        {hasConflict && <p className="text-xs text-red-400">Conflict — Replacement Required</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
