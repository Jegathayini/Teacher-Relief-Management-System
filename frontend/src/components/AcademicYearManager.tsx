import { useEffect, useState } from "react"
import { fetchAcademicYear, rolloverAcademicYear } from "../services/api"
import type { AcademicYearStatus } from "../services/api"

export default function AcademicYearManager({ onReset }: { onReset: () => Promise<void> }) {
  const [status, setStatus] = useState<AcademicYearStatus | null>(null)
  const [newYear, setNewYear] = useState(2027)
  const [startDate, setStartDate] = useState("2027-01-01")
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  useEffect(() => {
    void fetchAcademicYear().then((value) => {
      setStatus(value)
      setNewYear(value.year + 1)
      setStartDate(`${value.year + 1}-01-01`)
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load settings"))
  }, [])
  async function reset() {
    if (!status || busy) return
    setError(""); setMessage("")
    if (!window.confirm(`Archive the ${status.year} timetable and clear ALL current lessons and FREE periods? Relief records remain saved. This cannot be undone without restoring a backup.`)) return
    setBusy(true)
    try {
      await rolloverAcademicYear(newYear, startDate, confirmation)
      await onReset()
      const value = await fetchAcademicYear()
      setStatus(value)
      setNewYear(value.year + 1)
      setStartDate(`${value.year + 1}-01-01`)
      setConfirmation("")
      setMessage("Academic year started. Timetables reset; relief records preserved.")
    } catch (e) { setError(e instanceof Error ? e.message : "Reset failed.") }
    finally { setBusy(false) }
  }
  return <section className="rounded-xl border border-amber-800/60 bg-slate-800 p-5 space-y-4">
    <div><h2 className="text-lg font-semibold text-white">Academic Year Management</h2>
      <p className="text-sm text-slate-400">Archive the current timetable and begin a fresh year. Teachers, grades, absences, and relief history stay saved.</p></div>
    {status && <p className="text-sm text-slate-300">Current year: <strong>{status.year}</strong> · Lessons: {status.timetableCount} · Wizard records: {status.progressCount}</p>}
    <p className="text-sm text-amber-300">Before resetting, download a SQLite backup using the backup endpoint. This operation is restricted to local development until admin authentication is added.</p>
    <div className="flex flex-wrap gap-3">
      <label className="text-sm text-slate-300">New year<input className="mt-1 block rounded bg-slate-900 border border-slate-600 p-2 text-white" type="number" min={2000} max={2200} value={newYear} onChange={e=>setNewYear(Number(e.target.value))}/></label>
      <label className="text-sm text-slate-300">New year starts<input className="mt-1 block rounded bg-slate-900 border border-slate-600 p-2 text-white" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
      <label className="text-sm text-slate-300">Type RESET {newYear}<input className="mt-1 block rounded bg-slate-900 border border-slate-600 p-2 text-white" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
    </div>
    <button type="button" disabled={!status || busy || confirmation !== `RESET ${newYear}`} onClick={()=>void reset()} className="rounded-lg border border-red-600 px-4 py-2 text-red-300 hover:bg-red-950 disabled:opacity-40">{busy ? "Archiving..." : "Archive & Clear Teacher Timetables"}</button>
    {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
    {message && <p role="status" className="text-green-400 text-sm">{message}</p>}
  </section>
}
