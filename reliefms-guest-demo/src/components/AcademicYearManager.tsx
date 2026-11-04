
import { useEffect, useState } from "react"
import { fetchCloudAcademicYear } from "../services/api"
import type { AcademicYearStatus } from "../services/api"

export default function AcademicYearManager() {
  const [status, setStatus] =
    useState<AcademicYearStatus | null>(null)

  const [newYear, setNewYear] = useState(2027)
  const [startDate, setStartDate] = useState("2027-01-01")
  const [confirmation, setConfirmation] = useState("")

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadAcademicYear() {
      try {
        const value = await fetchCloudAcademicYear()

        if (cancelled) return

        setStatus(value)
        setNewYear(value.year + 1)
        setStartDate(`${value.year + 1}-01-01`)
        setError("")
      } catch (err) {
        if (cancelled) return

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load academic year settings."
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAcademicYear()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="space-y-4 rounded-xl border border-amber-800/60 bg-slate-800 p-5">

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">
          Academic Year Management
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Archive the current timetable and begin a fresh
          academic year while preserving teachers, grades,
          absences, and historical relief assignments.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-sm text-slate-400">
          Loading academic year from Supabase...
        </p>
      )}

      {/* Error */}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-400"
        >
          {error}
        </p>
      )}

      {/* Current Academic Year */}
      {status && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h3 className="mb-3 font-semibold text-cyan-400">
            Current Academic Year
          </h3>

          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-slate-400">
                Academic Year
              </p>
              <p className="mt-1 text-lg font-bold text-white">
                {status.year}
              </p>
            </div>

            <div>
              <p className="text-slate-400">
                Start Date
              </p>
              <p className="mt-1 font-semibold text-white">
                {status.startDate}
              </p>
            </div>

            <div>
              <p className="text-slate-400">
                Timetable Lessons
              </p>
              <p className="mt-1 text-lg font-bold text-green-400">
                {status.timetableCount}
              </p>
            </div>

            <div>
              <p className="text-slate-400">
                Free Period Records
              </p>
              <p className="mt-1 text-lg font-bold text-amber-400">
                {status.progressCount}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Reset Information */}
      <div className="rounded-lg border border-amber-800 bg-amber-950/20 p-4">
        <p className="text-sm font-semibold text-amber-300">
          Cloud Academic Year Reset
        </p>

        <p className="mt-2 text-sm text-slate-300">
          The reset operation is temporarily locked while
          the PostgreSQL archive and rollover transaction
          is being verified.
        </p>

        <p className="mt-2 text-sm text-slate-400">
          Once enabled, the system will archive the previous
          year's timetables and start the next year without
          deleting teacher records or historical relief
          assignments.
        </p>
      </div>

      {/* Reset Settings */}
      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-slate-300">
          New Year

          <input
            type="number"
            min={2000}
            max={2200}
            value={newYear}
            onChange={(event) =>
              setNewYear(Number(event.target.value))
            }
            disabled
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 p-2 text-white opacity-50"
          />
        </label>

        <label className="text-sm text-slate-300">
          New Year Starts

          <input
            type="date"
            value={startDate}
            onChange={(event) =>
              setStartDate(event.target.value)
            }
            disabled
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 p-2 text-white opacity-50"
          />
        </label>

        <label className="text-sm text-slate-300">
          Type RESET {newYear}

          <input
            type="text"
            value={confirmation}
            onChange={(event) =>
              setConfirmation(event.target.value)
            }
            placeholder={`RESET ${newYear}`}
            disabled
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 p-2 text-white opacity-50 opacity-50"
          />
        </label>
      </div>

      {/* Reset Button */}
      <button
        type="button"
        disabled
        title="Cloud reset will be enabled after archive verification"
        className="cursor-not-allowed rounded-lg border border-red-600 px-4 py-2 text-red-300 opacity-40"
      >
        Archive & Clear Teacher Timetables
      </button>

      <p className="text-xs text-slate-500">
        Reset is disabled until the cloud migration
        safety checks are completed.
      </p>
    </section>
  )
}
