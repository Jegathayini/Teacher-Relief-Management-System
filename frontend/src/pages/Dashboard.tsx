import { useEffect, useState } from "react"

import { fetchTeachers, fetchTimetables, fetchAbsences, fetchReliefAssignments } from "../services/api"
import { exportBackup } from "../utils/backup"

import type {
  Teacher,
  TimetableEntry,
  Absence,
  ReliefAssignment
} from "../types"


// Get today's date in YYYY-MM-DD format
function getToday(): string {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

// Convert a selected date into its weekday name
function getDayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number)

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-US",
    { weekday: "long" }
  )
}

function Dashboard() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [timetables, setTimetables] = useState<TimetableEntry[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [assignments, setAssignments] = useState<ReliefAssignment[]>([])
  const [date, setDate] = useState(getToday)
  const [loadError, setLoadError] = useState("")
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking")

  useEffect(() => {
    let cancelled = false
    async function loadDashboard() {
      try {
        const [loadedTeachers, loadedTimetables, loadedAbsences, loadedAssignments] =
          await Promise.all([
            fetchTeachers(),
            fetchTimetables(),
            fetchAbsences(),
            fetchReliefAssignments()
          ])
        if (cancelled) return
        setTeachers(loadedTeachers)
        setTimetables(loadedTimetables)
        setAbsences(loadedAbsences)
        setAssignments(loadedAssignments)
        setBackendStatus("connected")
        setLoadError("")
      } catch (error) {
        if (cancelled) return
        console.error("Dashboard SQLite load failed:", error)
        setBackendStatus("disconnected")
        setLoadError("Could not load dashboard data from SQLite. Check Flask and refresh.")
      }
    }
    void loadDashboard()
    return () => { cancelled = true }
  }, [])

  // Calculate daily statistics from SQLite
  const dayName = getDayName(date)

  const dailyAbsences = absences.filter(
    (absence) => absence.date === date
  )

  const dailyAssignments = assignments.filter(
    (assignment) => assignment.date === date
  )

  const absentIds = new Set(
    dailyAbsences.map((absence) => absence.teacherId)
  )

  const affectedLessons = timetables.filter(
    (entry) =>
      entry.day === dayName &&
      absentIds.has(entry.teacherId)
  )

  const assignedLessons = affectedLessons.filter(
    (entry) =>
      dailyAssignments.some(
        (assignment) =>
          assignment.period === entry.period &&
          assignment.className === entry.className &&
          assignment.absentTeacherId === entry.teacherId
      )
  )

  const pendingLessons =
    affectedLessons.length - assignedLessons.length

  const activeTeachers = teachers.filter(
    (teacher) => teacher.active
  ).length

  function getTeacherName(id: string): string {
    return (
      teachers.find((teacher) => teacher.id === id)?.name ??
      "Unknown Teacher"
    )
  }

  const summaryCards = [
    {
      title: "Active Teachers",
      value: activeTeachers,
      color: "text-cyan-400"
    },
    {
      title: "Absent Teachers",
      value: dailyAbsences.length,
      color: "text-red-400"
    },
    {
      title: "Relief Assigned",
      value: assignedLessons.length,
      color: "text-green-400"
    },
    {
      title: "Pending Relief",
      value: pendingLessons,
      color: "text-amber-400"
    }
  ]

  return (
    <section className="w-full min-w-0 space-y-6">

      {/* Dashboard Header */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-cyan-400">
            Dashboard Overview
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Monitor daily teacher availability and relief coverage.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">

          {/* Backend Connection Indicator */}
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              backendStatus === "connected"
                ? "border-green-800 bg-green-950/40 text-green-400"
                : backendStatus === "disconnected"
                  ? "border-red-800 bg-red-950/40 text-red-400"
                  : "border-slate-700 bg-slate-800 text-slate-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                backendStatus === "connected"
                  ? "bg-green-400"
                  : backendStatus === "disconnected"
                    ? "bg-red-400"
                    : "bg-amber-400"
              }`}
            />

            <span>
              {backendStatus === "connected"
                ? "Backend Connected"
                : backendStatus === "disconnected"
                  ? "Backend Disconnected"
                  : "Checking Backend..."}
            </span>
          </div>

          {/* Legacy browser backup; does not include SQLite data */}
          <button
            type="button"
            onClick={exportBackup}
            className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            Export Legacy Browser Backup
          </button>

          {/* Date Selection */}
          <div className="ml-auto">
            <label
              htmlFor="dashboard-date"
              className="mb-1 block text-xs text-slate-400"
            >
              Select Date
            </label>

            <input
              id="dashboard-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>

        </div>
      </div>

      {loadError && (
        <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-300">
          {loadError}
        </p>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-slate-700 bg-slate-800 p-5"
          >
            <p className="text-sm text-slate-400">
              {card.title}
            </p>

            <p
              className={`mt-3 text-3xl font-bold ${card.color}`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Daily Absences and Relief Assignments */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Absent Teachers */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Absent Teachers â€” {date}
          </h2>

          {dailyAbsences.length === 0 ? (
            <p className="text-sm text-slate-400">
              No absences recorded for this date.
            </p>
          ) : (
            <div className="space-y-3">
              {dailyAbsences.map((absence) => (
                <div
                  key={absence.id}
                  className="rounded-lg bg-slate-700 p-4"
                >
                  <p className="font-semibold text-white">
                    {getTeacherName(absence.teacherId)}
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    {absence.reason || "No reason specified"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Relief Assignments */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Relief Assignments â€” {date}
          </h2>

          {dailyAssignments.length === 0 ? (
            <p className="text-sm text-slate-400">
              No relief assignments recorded for this date.
            </p>
          ) : (
            <div className="space-y-3">
              {dailyAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg bg-slate-700 p-4"
                >
                  <p className="font-semibold text-white">
                    {assignment.className} â€” Period {assignment.period}
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    {getTeacherName(assignment.reliefTeacherId)}
                    {" "}replaces{" "}
                    {getTeacherName(assignment.absentTeacherId)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Lessons Needing Relief */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Lessons Needing Relief
        </h2>

        {affectedLessons.length === 0 ? (
          <p className="text-sm text-slate-400">
            No lessons require relief for this date.
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
                  <th className="p-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {[...affectedLessons]
                  .sort((a, b) => a.period - b.period)
                  .map((entry) => {
                    const assigned = dailyAssignments.some(
                      (assignment) =>
                        assignment.period === entry.period &&
                        assignment.className === entry.className &&
                        assignment.absentTeacherId === entry.teacherId
                    )

                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-slate-700 text-white"
                      >
                        <td className="p-3">
                          {entry.period}
                        </td>

                        <td className="p-3">
                          {entry.className}
                        </td>

                        <td className="p-3">
                          {entry.subject}
                        </td>

                        <td className="p-3">
                          {getTeacherName(entry.teacherId)}
                        </td>

                        <td className="p-3">
                          <span
                            className={
                              assigned
                                ? "text-green-400"
                                : "text-amber-400"
                            }
                          >
                            {assigned ? "Assigned" : "Pending"}
                          </span>
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

export default Dashboard