
import { useState } from "react"
import type { FormEvent } from "react"
import type { Teacher } from "../types"
import { getTeachers, saveTeachers } from "../utils/storage"

function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>(getTeachers)
  const [name, setName] = useState("")
  const [subjects, setSubjects] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState("")

  function updateTeachers(updated: Teacher[]) {
    setTeachers(updated)
    saveTeachers(updated)
  }

  function resetForm() {
    setName("")
    setSubjects("")
    setEditingId(null)
    setError("")
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanName = name.trim()
    const subjectList = subjects
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean)

    if (!cleanName || subjectList.length === 0) {
      setError("Enter a teacher name and at least one subject.")
      return
    }

    if (editingId) {
      const updated = teachers.map((teacher) =>
        teacher.id === editingId
          ? { ...teacher, name: cleanName, subjects: subjectList }
          : teacher
      )
      updateTeachers(updated)
    } else {
      const newTeacher: Teacher = {
        id: crypto.randomUUID(),
        name: cleanName,
        subjects: subjectList,
        active: true
      }

      updateTeachers([...teachers, newTeacher])
    }

    resetForm()
  }

  function handleEdit(teacher: Teacher) {
    setEditingId(teacher.id)
    setName(teacher.name)
    setSubjects(teacher.subjects.join(", "))
    setError("")
  }

  function handleToggleActive(id: string) {
    updateTeachers(
      teachers.map((teacher) =>
        teacher.id === id
          ? { ...teacher, active: !teacher.active }
          : teacher
      )
    )
  }

  function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Delete this teacher? Existing timetable and relief records may still reference them."
    )

    if (!confirmed) return

    updateTeachers(teachers.filter((teacher) => teacher.id !== id))

    if (editingId === id) resetForm()
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cyan-400">
          Teacher Management
        </h1>
        <p className="mt-1 text-slate-400">
          Add, update and manage school teachers.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl bg-slate-800 p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold text-white">
          {editingId ? "Edit Teacher" : "Add New Teacher"}
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
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter teacher name"
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
            onChange={(event) => setSubjects(event.target.value)}
            placeholder="Mathematics, Science"
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

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
          >
            {editingId ? "Save Changes" : "Add Teacher"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-slate-600 px-5 py-3 text-white hover:bg-slate-500"
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
            No teachers added yet. Use the form above to add your first teacher.
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
                    {teacher.active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(teacher)}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(teacher.id)}
                    className="rounded-lg bg-slate-600 px-3 py-2 text-sm text-white hover:bg-slate-500"
                  >
                    {teacher.active ? "Deactivate" : "Activate"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(teacher.id)}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500"
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
