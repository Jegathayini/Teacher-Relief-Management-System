import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import type { Teacher } from "../types"
import {
  fetchCloudTeachers,
  createCloudTeacher,
  updateCloudTeacher,
  updateCloudTeacherStatus,
  deleteCloudTeacher,
} from "../services/api"

function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [name, setName] = useState("")
  const [subjects, setSubjects] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [databaseStatus, setDatabaseStatus] = useState(
    "Checking Supabase connection..."
  )

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadTeachers() {
      try {
        const data = await fetchCloudTeachers()

        if (!mounted) return

        setTeachers(data)
        setDatabaseStatus("Connected to Supabase")
        setError("")
      } catch (err) {
        console.error("Failed to load cloud teachers:", err)

        if (!mounted) return

        setDatabaseStatus("Supabase connection failed")
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load teachers."
        )
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadTeachers()

    return () => {
      mounted = false
    }
  }, [])

  function resetForm() {
    setName("")
    setSubjects("")
    setEditingId(null)
  }

  function handleEdit(teacher: Teacher) {
    setEditingId(teacher.id)
    setName(teacher.name)
    setSubjects(teacher.subjects.join(", "))
    setError("")
    setSuccess("")

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving || loading) return

    setError("")
    setSuccess("")

    const cleanName = name.trim()

    const subjectList = [
      ...new Set(
        subjects
          .split(",")
          .map((subject) => subject.trim())
          .filter(Boolean)
      ),
    ]

    if (!cleanName || subjectList.length === 0) {
      setError(
        "Enter a teacher name and at least one subject."
      )
      return
    }

    if (databaseStatus !== "Connected to Supabase") {
      setError(
        "Supabase is unavailable. Please check Flask and reload."
      )
      return
    }

    setSaving(true)

    try {
      const wasEditing = editingId !== null

      if (editingId) {
        await updateCloudTeacher(
          editingId,
          cleanName,
          subjectList
        )
      } else {
        await createCloudTeacher(
          cleanName,
          subjectList
        )
      }

      resetForm()

      setSuccess(
        wasEditing
          ? "Teacher updated successfully in Supabase!"
          : "Teacher added successfully to Supabase!"
      )

      try {
        const updatedTeachers = await fetchCloudTeachers()

        setTeachers(updatedTeachers)
        setDatabaseStatus("Connected to Supabase")
      } catch (refreshError) {
        console.error(
          "Teacher saved, but list refresh failed:",
          refreshError
        )

        setDatabaseStatus("Supabase connection failed")

        setError(
          "Teacher was saved, but the list could not refresh. Reload the page before trying again."
        )
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save teacher."
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(teacher: Teacher) {
    if (saving || loading || databaseStatus !== "Connected to Supabase") return

    const newStatus = !teacher.active
    if (!newStatus && !window.confirm(`Deactivate ${teacher.name}?`)) return

    setSaving(true)
    setError("")
    setSuccess("")

    try {
      const updatedTeacher = await updateCloudTeacherStatus(teacher.id, newStatus)
      setTeachers((previous) =>
        previous.map((item) =>
          item.id === updatedTeacher.id ? updatedTeacher : item
        )
      )
      setSuccess(`${teacher.name} ${newStatus ? "activated" : "deactivated"} successfully in Supabase!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change teacher status.")
    } finally {
      setSaving(false)
    }
  }
  
async function handleDelete(teacher: Teacher) {
  if (saving) return

  if (!window.confirm(
    `Permanently delete ${teacher.name}? This cannot be undone.`
  )) {
    return
  }

  setSaving(true)
  setError("")
  setSuccess("")

  try {
    await deleteCloudTeacher(teacher.id)

    setTeachers((previous) =>
      previous.filter((item) => item.id !== teacher.id)
    )

    if (editingId === teacher.id) {
      resetForm()
    }

    setSuccess(`${teacher.name} deleted successfully!`)
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to delete teacher."
    )
  } finally {
    setSaving(false)
  }
}

  const connected =
    databaseStatus === "Connected to Supabase"

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cyan-400">
          Teacher Management
        </h1>

        <p className="mt-1 text-slate-400">
          Add and update teachers in your school's
          cloud database.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            role="status"
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-cyan-400"
          >
            {databaseStatus}
          </span>

          {connected && (
            <span className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300">
              Teachers in Supabase: {teachers.length}
            </span>
          )}
        </div>
      </div>

      <form
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
        className="space-y-4 rounded-xl bg-slate-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white">
          {editingId
            ? "Edit Teacher"
            : "Add New Teacher"}
        </h2>

        <div>
          <label
            htmlFor="teacher-name"
            className="mb-2 block text-sm text-slate-300"
          >
            Teacher Name
          </label>

          <input
            id="teacher-name"
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="Enter teacher name"
            required
            className="w-full rounded-lg bg-slate-700 p-3 text-white outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label
            htmlFor="teacher-subjects"
            className="mb-2 block text-sm text-slate-300"
          >
            Subjects
          </label>

          <input
            id="teacher-subjects"
            type="text"
            value={subjects}
            onChange={(event) =>
              setSubjects(event.target.value)
            }
            placeholder="Mathematics, Science"
            required
            className="w-full rounded-lg bg-slate-700 p-3 text-white outline-none focus:ring-2 focus:ring-cyan-500"
          />

          <p className="mt-1 text-xs text-slate-400">
            Separate multiple subjects using commas.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="text-sm text-green-400">
            {success}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving || !connected || loading}
            className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Save Changes"
                : "Add Teacher"}
          </button>

          {editingId && (
            <button
              type="button"
              disabled={saving}
              onClick={resetForm}
              className="rounded-lg bg-slate-600 px-5 py-3 text-white hover:bg-slate-500 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-xl bg-slate-800 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            Teacher List
          </h2>

          <span className="rounded-full bg-slate-700 px-3 py-1 text-sm text-cyan-300">
            {teachers.length} Teachers
          </span>
        </div>

        {teachers.length === 0 ? (
          <p className="rounded-lg bg-slate-700 p-5 text-slate-300">
            {loading
              ? "Loading teachers..."
              : connected
                ? "No teachers added yet. Use the form above to add your first teacher."
                : "Unable to display teachers until Supabase is connected."}
          </p>
        ) : (
          <div className="space-y-3">
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                className="flex flex-col gap-4 rounded-lg bg-slate-700 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h3 className="font-semibold text-white">
                    {teacher.name}
                  </h3>

                  <p className="mt-1 text-sm text-slate-300">
                    {teacher.subjects.join(", ")}
                  </p>

                  <span
                    className={
                      teacher.active
                        ? "mt-2 inline-block text-xs text-green-400"
                        : "mt-2 inline-block text-xs text-amber-400"
                    }
                  >
                    {teacher.active
                      ? "Active"
                      : "Inactive"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving || !connected}
                    onClick={() => handleEdit(teacher)}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    disabled={saving || !connected || loading}
                    onClick={() => { void handleStatusChange(teacher) }}
                    className="rounded-lg bg-slate-600 px-3 py-2 text-sm text-white hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {teacher.active
                      ? "Deactivate"
                      : "Activate"}
                  </button>

                  <button
  type="button"
  disabled={saving || !connected}
  onClick={() => {
    void handleDelete(teacher)
  }}
  className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
>
                    Delete
                  </button>
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
