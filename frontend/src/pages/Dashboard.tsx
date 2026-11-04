
import GradeClassManager from "../components/GradeClassManager"
import { useEffect, useState } from "react"
import AcademicYearManager from "../components/AcademicYearManager"
import {
  fetchCloudTeachers,
  fetchCloudDashboardStats,
  fetchAbsences,
  fetchReliefAssignments,
} from "../services/api"
import type { CloudDashboardStats } from "../services/api"
import type { Teacher, Absence, ReliefAssignment } from "../types"

function getToday(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function Dashboard() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [date, setDate] = useState(getToday)
  const [dailyStats, setDailyStats] = useState<CloudDashboardStats | null>(null)
  const [dailyAbsences, setDailyAbsences] = useState<Absence[]>([])
  const [dailyReliefs, setDailyReliefs] = useState<ReliefAssignment[]>([])

  const [loading, setLoading] = useState(true)
  const [dailyLoading, setDailyLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [dailyError, setDailyError] = useState("")

  const [backendStatus, setBackendStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking")

  useEffect(() => {
    let cancelled = false

    async function loadTeachers() {
      try {
        const result = await fetchCloudTeachers()
        if (cancelled) return

        setTeachers(result)
        setBackendStatus("connected")
        setLoadError("")
      } catch (error) {
        if (cancelled) return

        console.error("Dashboard cloud load failed:", error)
        setBackendStatus("disconnected")
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load teachers from Supabase."
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTeachers()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    setDailyLoading(true)
    setDailyStats(null)
    setDailyAbsences([])
    setDailyReliefs([])
    setDailyError("")

    async function loadDailyData() {
      try {
        const [stats, absences, reliefs] = await Promise.all([
          fetchCloudDashboardStats(date),
          fetchAbsences(),
          fetchReliefAssignments(),
        ])

        if (cancelled) return

        setDailyStats(stats)
        setDailyAbsences(absences.filter(a => a.date === date))
        setDailyReliefs(reliefs.filter(r => r.date === date))
      } catch (error) {
        if (cancelled) return

        console.error("Daily dashboard load failed:", error)
        setDailyError(
          error instanceof Error
            ? error.message
            : "Could not load daily records."
        )
      } finally {
        if (!cancelled) setDailyLoading(false)
      }
    }

    void loadDailyData()
    return () => { cancelled = true }
  }, [date])

  const connected = backendStatus === "connected"
  const totalTeachers = teachers.length
  const activeTeachers = teachers.filter(t => t.active).length
  const inactiveTeachers = teachers.filter(t => !t.active).length

  const teacherNames = new Map(
    teachers.map(t => [t.id, t.name])
  )

  function getTeacherName(id: string): string {
    return teacherNames.get(id) ?? "Unknown Teacher"
  }

  const summaryCards = [
    {
      title: "Active Teachers",
      value: connected ? String(activeTeachers) : "—",
      color: "text-cyan-400",
      available: connected,
    },
    {
      title: "Absent Teachers",
      value: dailyStats ? String(dailyStats.absentTeachers) : "—",
      color: "text-red-400",
      available: Boolean(dailyStats),
    },
    {
      title: "Relief Assigned",
      value: dailyStats ? String(dailyStats.reliefAssigned) : "—",
      color: "text-green-400",
      available: Boolean(dailyStats),
    },
    {
      title: "Pending Relief",
      value: dailyStats ? String(dailyStats.pendingRelief) : "—",
      color: "text-amber-400",
      available: Boolean(dailyStats),
    },
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
          <div
            role="status"
            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              connected
                ? "border-green-800 bg-green-950/40 text-green-400"
                : backendStatus === "disconnected"
                  ? "border-red-800 bg-red-950/40 text-red-400"
                  : "border-slate-700 bg-slate-800 text-slate-400"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${
              connected
                ? "bg-green-400"
                : backendStatus === "disconnected"
                  ? "bg-red-400"
                  : "bg-amber-400"
            }`} />

            <span>
              {connected
                ? "Teacher Cloud Connected"
                : backendStatus === "disconnected"
                  ? "Cloud Connection Failed"
                  : "Checking Cloud Connection..."}
            </span>
          </div>

          <div>
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
              onChange={event => setDate(event.target.value)}
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

      {dailyError && (
        <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-300">
          Daily records: {dailyError}
        </p>
      )}

      {/* Dashboard Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(card => (
          <div
            key={card.title}
            className="rounded-xl border border-slate-700 bg-slate-800 p-5"
          >
            <p className="text-sm text-slate-400">{card.title}</p>
            <p className={`mt-3 text-3xl font-bold ${card.color}`}>
              {(card.title === "Active Teachers" ? loading : dailyLoading)
                ? "..."
                : card.value}
            </p>
            {!card.available && !loading && !dailyLoading && (
              <p className="mt-2 text-xs text-amber-400">
                Data unavailable
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Teacher Overview */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h2 className="text-lg font-semibold text-white">
          Teacher Overview
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Teacher records from your school's Supabase database.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { title: "Total Teachers", count: totalTeachers, color: "text-white" },
            { title: "Active Teachers", count: activeTeachers, color: "text-green-400" },
            { title: "Inactive Teachers", count: inactiveTeachers, color: "text-amber-400" },
          ].map(item => (
            <div key={item.title} className="rounded-lg bg-slate-700 p-4">
              <p className="text-sm text-slate-300">{item.title}</p>
              <p className={`mt-2 text-2xl font-bold ${item.color}`}>
                {connected ? item.count : "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <GradeClassManager />
      <AcademicYearManager />

      {/* Daily Absences and Relief Assignments */}
      <div className="grid gap-6 lg:grid-cols-2">

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Absent Teachers — {date}
          </h2>

          {dailyLoading ? (
            <p className="text-sm text-slate-400">Loading absences...</p>
          ) : dailyError ? (
            <p className="text-sm text-red-300">Unable to load absences.</p>
          ) : dailyAbsences.length === 0 ? (
            <p className="text-sm text-slate-400">
              No teacher absences recorded for this date.
            </p>
          ) : (
            <div className="space-y-3">
              {dailyAbsences.map(absence => (
                <div
                  key={absence.id}
                  className="rounded-lg border border-slate-600 bg-slate-700 p-3"
                >
                  <p className="font-semibold text-white">
                    {getTeacherName(absence.teacherId)}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Reason: {absence.reason || "Not specified"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Relief Assignments — {date}
          </h2>

          {dailyLoading ? (
            <p className="text-sm text-slate-400">Loading assignments...</p>
          ) : dailyError ? (
            <p className="text-sm text-red-300">Unable to load assignments.</p>
          ) : dailyReliefs.length === 0 ? (
            <p className="text-sm text-slate-400">
              No relief assignments recorded for this date.
            </p>
          ) : (
            <div className="space-y-3">
              {dailyReliefs.map(relief => (
                <div
                  key={relief.id}
                  className="rounded-lg border border-slate-600 bg-slate-700 p-3"
                >
                  <p className="font-semibold text-white">
                    {relief.className} — Period {relief.period}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Relief Teacher: {getTeacherName(relief.reliefTeacherId)}
                  </p>
                  <p className="text-sm text-slate-400">
                    Absent: {getTeacherName(relief.absentTeacherId)}
                  </p>
                  <p className="text-sm text-slate-400">
                    Subject: {relief.subject}
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
          Lessons Needing Relief — {date}
        </h2>

        {dailyLoading ? (
          <p className="text-sm text-slate-400">
            Calculating daily relief coverage...
          </p>
        ) : dailyError || !dailyStats ? (
          <p className="text-sm text-red-300">
            Relief coverage information is unavailable.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-700 p-4">
              <p className="text-sm text-slate-300">Assigned Lessons</p>
              <p className="mt-2 text-2xl font-bold text-green-400">
                {dailyStats.reliefAssigned}
              </p>
            </div>

            <div className="rounded-lg bg-slate-700 p-4">
              <p className="text-sm text-slate-300">Pending Lessons</p>
              <p className="mt-2 text-2xl font-bold text-amber-400">
                {dailyStats.pendingRelief}
              </p>
            </div>

            <div className="rounded-lg bg-slate-700 p-4">
              <p className="text-sm text-slate-300">Total Lessons Requiring Relief</p>
              <p className="mt-2 text-2xl font-bold text-cyan-400">
                {dailyStats.reliefAssigned + dailyStats.pendingRelief}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default Dashboard
