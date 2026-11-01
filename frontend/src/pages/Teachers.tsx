import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import type { Teacher } from "../types"
import { fetchTeachers } from "../services/api"

const API_BASE_URL = "http://127.0.0.1:5000"

async function readApiError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  if (body && typeof body === "object") {
    const data = body as Record<string, unknown>
    if (typeof data.error === "string") return data.error
    if (typeof data.message === "string") return data.message
  }
  return `Request failed (${response.status})`
}

function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [name, setName] = useState("")
  const [subjects, setSubjects] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [databaseStatus, setDatabaseStatus] = useState("Checking database...")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    async function loadTeachers() {
      try {
        const data = await fetchTeachers()
        if (!mounted) return
        setTeachers(data)
        setDatabaseStatus("Connected to SQLite")
      } catch (err) {
        console.error("Failed to load teachers:", err)
        if (mounted) setDatabaseStatus("Database connection failed")
      }
    }
    void loadTeachers()
    return () => { mounted = false }
  }, [])

  async function refreshTeachers() {
    const data = await fetchTeachers()
    setTeachers(data)
    setDatabaseStatus("Connected to SQLite")
  }

  function resetForm() {
    setName("")
    setSubjects("")
    setEditingId(null)
    setError("")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setError("")
    setSuccess("")

    const cleanName = name.trim()
    const subjectList = [...new Set(subjects.split(",").map((s) => s.trim()).filter(Boolean))]
    if (!cleanName || subjectList.length === 0) {
      setError("Enter a teacher name and at least one subject.")
      return
    }
    if (databaseStatus !== "Connected to SQLite") {
      setError("Database is unavailable. Please start Flask and reload.")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(
        editingId
          ? `${API_BASE_URL}/api/teachers/${encodeURIComponent(editingId)}`
          : `${API_BASE_URL}/api/teachers`,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cleanName, subjects: subjectList })
        }
      )
      if (!response.ok) throw new Error(await readApiError(response))
      await refreshTeachers()
      resetForm()
      setSuccess(editingId ? "Teacher updated in SQLite." : "Teacher added to SQLite.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save teacher.")
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(teacher: Teacher) {
    setEditingId(teacher.id)
    setName(teacher.name)
    setSubjects(teacher.subjects.join(", "))
    setError("")
    setSuccess("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleActivate(teacher: Teacher) {
    if (teacher.active || saving) return
    setError("")
    setSuccess("")
    setSaving(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/teachers/${encodeURIComponent(teacher.id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true })
        }
      )
      if (!response.ok) throw new Error(await readApiError(response))
      await refreshTeachers()
      setSuccess(`${teacher.name} activated in SQLite.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to activate teacher.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cyan-400">Teacher Management</h1>
        <p className="mt-1 text-slate-400">Add, update and manage school teachers.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-cyan-400">
            {databaseStatus}
          </span>
          {databaseStatus === "Connected to SQLite" && (
            <span className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300">
              Teachers in SQLite: {teachers.length}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={(event) => { void handleSubmit(event) }} className="space-y-4 rounded-xl bg-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white">{editingId ? "Edit Teacher" : "Add New Teacher"}</h2>
        <div>
          <label htmlFor="teacher-name" className="mb-2 block text-sm text-slate-300">Teacher Name</label>
          <input id="teacher-name" type="text" value={name} onChange={(event) => setName(event.target.value)}
            placeholder="Enter teacher name" className="w-full rounded-lg bg-slate-700 p-3 text-white outline-none focus:ring-2 focus:ring-cyan-500" />
        </div>
        <div>
          <label htmlFor="teacher-subjects" className="mb-2 block text-sm text-slate-300">Subjects</label>
          <input id="teacher-subjects" type="text" value={subjects} onChange={(event) => setSubjects(event.target.value)}
            placeholder="Mathematics, Science" className="w-full rounded-lg bg-slate-700 p-3 text-white outline-none focus:ring-2 focus:ring-cyan-500" />
          <p className="mt-1 text-xs text-slate-400">Separate multiple subjects using commas.</p>
        </div>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {success && <p role="status" className="text-sm text-green-400">{success}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving || databaseStatus !== "Connected to SQLite"}
            className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Saving..." : editingId ? "Save Changes" : "Add Teacher"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg bg-slate-600 px-5 py-3 text-white hover:bg-slate-500">Cancel</button>
          )}
        </div>
      </form>

      <div className="rounded-xl bg-slate-800 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Teacher List</h2>
          <span className="rounded-full bg-slate-700 px-3 py-1 text-sm text-cyan-300">{teachers.length} Teachers</span>
        </div>
        {teachers.length === 0 ? (
          <p className="rounded-lg bg-slate-700 p-5 text-slate-300">
            {databaseStatus === "Connected to SQLite" ? "No teachers added yet. Use the form above to add your first teacher." : "Unable to display teachers until SQLite is connected."}
          </p>
        ) : (
          <div className="space-y-3">
            {teachers.map((teacher) => (
              <div key={teacher.id} className="flex flex-col gap-4 rounded-lg bg-slate-700 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold text-white">{teacher.name}</h3>
                  <p className="mt-1 text-sm text-slate-300">{teacher.subjects.join(", ")}</p>
                  <span className={teacher.active ? "mt-2 inline-block text-xs text-green-400" : "mt-2 inline-block text-xs text-amber-400"}>
                    {teacher.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={saving} onClick={() => handleEdit(teacher)}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">Edit</button>
                  {teacher.active ? (
                    <button type="button" disabled title="Deactivation is disabled until related relief records are migrated"
                      className="cursor-not-allowed rounded-lg bg-slate-600 px-3 py-2 text-sm text-white opacity-50">Deactivate (unavailable)</button>
                  ) : (
                    <button type="button" disabled={saving} onClick={() => { void handleActivate(teacher) }}
                      className="rounded-lg bg-slate-600 px-3 py-2 text-sm text-white hover:bg-slate-500 disabled:opacity-50">Activate</button>
                  )}
                  <button type="button" disabled title="Database deletion is not yet implemented; linked records must be protected"
                    className="cursor-not-allowed rounded-lg bg-red-600 px-3 py-2 text-sm text-white opacity-50">Delete (unavailable)</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default Teachers
