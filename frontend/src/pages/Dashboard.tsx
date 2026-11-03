import GradeClassManager from "../components/GradeClassManager"
import { useEffect, useState } from "react"
import AcademicYearManager from "../components/AcademicYearManager"
import { fetchCloudTeachers } from "../services/api"
import type { Teacher } from "../types"

// Get today's date in local YYYY-MM-DD format
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

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [backendStatus, setBackendStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking")

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      try {
        const loadedTeachers = await fetchCloudTeachers()

        if (cancelled) return

        setTeachers(loadedTeachers)
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
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [])

  const connected = backendStatus === "connected"

  const totalTeachers = teachers.length

  const activeTeachers = teachers.filter(
    (teacher) => teacher.active
  ).length

  const inactiveTeachers = teachers.filter(
    (teacher) => !teacher.active
  ).length

  const summaryCards = [
    {
      title: "Active Teachers",
      value: connected ? String(activeTeachers) : "—",
      color: "text-cyan-400",
      available: true,
    },
    {
      title: "Absent Teachers",
      value: "—",
      color: "text-red-400",
      available: false,
    },
    {
      title: "Relief Assigned",
      value: "—",
      color: "text-green-400",
      available: false,
    },
    {
      title: "Pending Relief",
      value: "—",
      color: "text-amber-400",
      available: false,
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

          {/* Cloud Connection */}
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
            <span
              className={`h-2 w-2 rounded-full ${
                connected
                  ? "bg-green-400"
                  : backendStatus === "disconnected"
                    ? "bg-red-400"
                    : "bg-amber-400"
              }`}
            />

            <span>
              {connected
                ? "Teacher Cloud Connected"
                : backendStatus === "disconnected"
                  ? "Cloud Connection Failed"
                  : "Checking Cloud Connection..."}
            </span>
          </div>

          {/* Date Selection */}
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
              onChange={(event) => setDate(event.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {loadError && (
        <p
          role="alert"
          className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-300"
        >
          {loadError}
        </p>
      )}

      {/* Dashboard Summary Cards */}
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
              {loading && card.available ? "..." : card.value}
            </p>

            {!card.available && (
              <p className="mt-2 text-xs text-amber-400">
                Awaiting cloud migration
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

          {/* Total Teachers */}
          <div className="rounded-lg bg-slate-700 p-4">
            <p className="text-sm text-slate-300">
              Total Teachers
            </p>

            <p className="mt-2 text-2xl font-bold text-white">
              {connected ? totalTeachers : "—"}
            </p>
          </div>

          {/* Active Teachers */}
          <div className="rounded-lg bg-slate-700 p-4">
            <p className="text-sm text-slate-300">
              Active Teachers
            </p>

            <p className="mt-2 text-2xl font-bold text-green-400">
              {connected ? activeTeachers : "—"}
            </p>
          </div>

          {/* Inactive Teachers */}
          <div className="rounded-lg bg-slate-700 p-4">
            <p className="text-sm text-slate-300">
              Inactive Teachers
            </p>

            <p className="mt-2 text-2xl font-bold text-amber-400">
              {connected ? inactiveTeachers : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* School Grades and Classes */}
      <GradeClassManager />

      {/* Supabase Academic Year Management */}
      <AcademicYearManager />

      {/* Daily Absences and Relief Assignments */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Absent Teachers */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Absent Teachers — {date}
          </h2>

          <p className="text-sm text-slate-400">
            Daily absence records will appear here after
            the Supabase absence API is connected.
          </p>
        </div>

        {/* Relief Assignments */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Relief Assignments — {date}
          </h2>

          <p className="text-sm text-slate-400">
            Daily relief assignments will appear here after
            the Supabase relief management API is connected.
          </p>
        </div>
      </div>

      {/* Lessons Needing Relief */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Lessons Needing Relief
        </h2>

        <p className="text-sm text-slate-400">
          Pending and assigned lessons will be calculated using
          your school's cloud timetable, absence records,
          and relief assignments.
        </p>
      </div>
    </section>
  )
}

export default Dashboard
