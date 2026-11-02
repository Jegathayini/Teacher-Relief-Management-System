import { useCallback, useEffect, useState } from "react"
import { createGrade, createSchoolClass, deleteGrade, deleteSchoolClass, fetchSchoolConfiguration } from "../services/api"
import type { SchoolConfiguration } from "../services/api"

export default function GradeClassManager() {
  const [config, setConfig] = useState<SchoolConfiguration>({ grades: [], classes: [] })
  const [gradeName, setGradeName] = useState("")
  const [gradeId, setGradeId] = useState("")
  const [section, setSection] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const reload = useCallback(async () => {
    const next = await fetchSchoolConfiguration()
    setConfig(next)
    setGradeId(old => next.grades.some(g => g.id === old) ? old : (next.grades[0]?.id ?? ""))
  }, [])
  useEffect(() => { void reload().catch(e => setError(e instanceof Error ? e.message : "Unable to load classes")) }, [reload])
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("")
    try { await action(); await reload(); setMessage(success) }
    catch (e) { setError(e instanceof Error ? e.message : "Request failed") }
    finally { setBusy(false) }
  }
  return <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-5">
    <div><h2 className="text-lg font-semibold text-cyan-400">School Grades & Classes</h2>
      <p className="text-sm text-slate-400">Configure grade divisions for timetable dropdowns.</p></div>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {message && <p role="status" className="text-green-400">{message}</p>}
    <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); if (!gradeName.trim()) return; void run(() => createGrade(gradeName.trim()), "Grade added.").then(() => setGradeName("")) }}>
      <label className="flex-1 min-w-40 text-sm text-slate-300">New grade name
        <input className="mt-1 w-full rounded-lg bg-slate-700 p-3 text-white" placeholder="Grade 6" value={gradeName} onChange={e => setGradeName(e.target.value)} required maxLength={60}/>
      </label><button disabled={busy} className="self-end rounded-lg bg-cyan-600 px-4 py-3 text-white disabled:opacity-50">Add Grade</button>
    </form>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); if (!gradeId || !section.trim()) return; void run(() => createSchoolClass(gradeId, section), "Class added.").then(() => setSection("")) }}>
      <label className="flex-1 min-w-36 text-sm text-slate-300">Grade
        <select className="mt-1 w-full rounded-lg bg-slate-700 p-3 text-white" value={gradeId} onChange={e => setGradeId(e.target.value)} required>
          <option value="">Select grade</option>{config.grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select></label>
      <label className="flex-1 min-w-32 text-sm text-slate-300">Division
        <input className="mt-1 w-full rounded-lg bg-slate-700 p-3 text-white" placeholder="A" value={section} onChange={e => setSection(e.target.value)} required maxLength={20}/>
      </label><button disabled={busy || !gradeId} className="rounded-lg bg-cyan-600 px-4 py-3 text-white disabled:opacity-50">Add Class</button>
    </form>
    <div className="space-y-3">{config.grades.length === 0 && <p className="text-sm text-slate-400">No grades configured yet.</p>}
      {config.grades.map(g => <div key={g.id} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
        <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-white">{g.name}</h3>
          <button type="button" disabled={busy} className="text-xs text-red-400 disabled:opacity-50" onClick={() => { if (window.confirm(`Delete ${g.name}?`)) void run(() => deleteGrade(g.id), "Grade deleted.") }}>Delete grade</button></div>
        <div className="mt-3 flex flex-wrap gap-2">{config.classes.filter(c => c.gradeId === g.id).map(c => <span key={c.id} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white">{c.name}
          <button type="button" aria-label={`Delete ${c.name}`} disabled={busy} className="text-red-300 disabled:opacity-50" onClick={() => { if (window.confirm(`Delete ${c.name}?`)) void run(() => deleteSchoolClass(c.id), "Class deleted.") }}>×</button></span>)}
          {!config.classes.some(c => c.gradeId === g.id) && <span className="text-sm text-slate-400">No classes yet.</span>}</div>
      </div>)}</div>
  </section>
}
