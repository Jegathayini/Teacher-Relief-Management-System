
import { useCallback, useEffect, useState } from "react"
import {
  fetchCloudAcademicYear,
  rolloverAcademicYear,
} from "../services/api"
import type { AcademicYearStatus } from "../services/api"

export default function AcademicYearManager() {
  const [status, setStatus] = useState<AcademicYearStatus | null>(null)
  const [newYear, setNewYear] = useState(2027)
  const [startDate, setStartDate] = useState("2027-01-01")
  const [confirmation, setConfirmation] = useState("")

  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const loadAcademicYear = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const value = await fetchCloudAcademicYear()
      setStatus(value)
      setNewYear(value.year + 1)
      setStartDate(`${value.year + 1}-01-01`)
      setConfirmation("")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load academic year."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAcademicYear()
  }, [loadAcademicYear])

  const expectedConfirmation = `RESET ${newYear}`

  const validYear =
    status !== null &&
    Number.isInteger(newYear) &&
    newYear === status.year + 1

  const validStartDate = startDate === `${newYear}-01-01`

  const canReset =
    !loading &&
    !resetting &&
    validYear &&
    validStartDate &&
    confirmation.trim() === expectedConfirmation

  async function handleReset() {
    if (!canReset || !status) return

    const approved = window.confirm(
      `Archive academic year ${status.year} and start ${newYear}?\n\n` +
      "Current timetable and free-period records will be archived " +
      "and cleared from the active timetable.\n\n" +
      "Only proceed after verifying a database backup and " +
      "testing the rollover on disposable school data."
    )

    if (!approved) return

    setResetting(true)
    setError("")
    setSuccess("")

    try {
      await rolloverAcademicYear(
        newYear,
        startDate,
        confirmation.trim()
      )

      const updated = await fetchCloudAcademicYear()

      setStatus(updated)
      setNewYear(updated.year + 1)
      setStartDate(`${updated.year + 1}-01-01`)
      setConfirmation("")

      setSuccess(
        `Academic year successfully changed to ${updated.year}. ` +
        "Refresh the application to load the new timetable."
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Academic year rollover failed."
      )
    } finally {
      setResetting(false)
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-5">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Academic Year Management
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Archive current timetables and begin a new academic year
          while preserving teachers, grades, absences, and relief history.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          Loading academic year from Supabase...
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="rounded-lg border border-green-800 bg-green-950/30 p-3 text-sm text-green-300"
        >
          {success}
        </p>
      )}

      {status && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h3 className="mb-3 font-semibold text-cyan-400">
            Current Academic Year
          </h3>

          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-slate-400">Academic Year</p>
              <p className="mt-1 text-lg font-bold text-white">
                {status.year}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Start Date</p>
              <p className="mt-1 font-semibold text-white">
                {status.startDate}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Timetable Lessons</p>
              <p className="mt-1 text-lg font-bold text-green-400">
                {status.timetableCount}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Free Period Records</p>
              <p className="mt-1 text-lg font-bold text-amber-400">
                {status.progressCount}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-amber-800 bg-amber-950/20 p-4">
        <h3 className="text-sm font-semibold text-amber-300">
          Academic Year Rollover
        </h3>

        <p className="mt-2 text-sm text-slate-300">
          This operation archives the current timetable and
          free-period records before starting the next year.
          It must be tested and backed up before use on school data.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-slate-300">
          New Year
          <input
            type="number"
            min={2000}
            max={2200}
            value={newYear}
            onChange={event =>
              setNewYear(Number(event.target.value))
            }
            disabled={loading || resetting}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 p-2 text-white disabled:opacity-50"
          />
        </label>

        <label className="text-sm text-slate-300">
          New Year Starts
          <input
            type="date"
            value={startDate}
            onChange={event =>
              setStartDate(event.target.value)
            }
            disabled={loading || resetting}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 p-2 text-white disabled:opacity-50"
          />
        </label>

        <label className="text-sm text-slate-300">
          Type {expectedConfirmation}
          <input
            type="text"
            value={confirmation}
            onChange={event =>
              setConfirmation(event.target.value)
            }
            placeholder={expectedConfirmation}
            disabled={loading || resetting}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 p-2 text-white disabled:opacity-50"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={!canReset}
          className="rounded-lg border border-red-600 px-4 py-2 text-red-300 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {resetting
            ? "Archiving Academic Year..."
            : "Archive & Start New Academic Year"}
        </button>

        <button
          type="button"
          onClick={() => void loadAcademicYear()}
          disabled={loading || resetting}
          className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          Refresh Status
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Confirmation must match exactly. The new academic year
        must be the following year and begin on January 1.
      </p>
    </section>
  )
}
