
import { useCallback, useEffect, useState } from "react"
import {
  fetchCloudConfiguration,
  createCloudGrade,
  deleteCloudGrade,
  createCloudClass,
  deleteCloudClass,
} from "../services/api"
import type {
  CloudSchoolConfiguration,
} from "../services/api"

export default function GradeClassManager() {
  const [configuration, setConfiguration] =
    useState<CloudSchoolConfiguration>({
      grades: [],
      classes: [],
    })

  const [gradeName, setGradeName] = useState("")
  const [selectedGrade, setSelectedGrade] = useState("")
  const [section, setSection] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadConfiguration = useCallback(async () => {
    try {
      const result = await fetchCloudConfiguration()
      setConfiguration(result)
      setError("")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load school configuration."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfiguration()
  }, [loadConfiguration])

  async function runAction(
    action: () => Promise<unknown>,
    successMessage: string
  ) {
    if (busy) return false

    setBusy(true)
    setError("")
    setMessage("")

    try {
      await action()
      await loadConfiguration()
      setMessage(successMessage)
      return true
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Operation failed."
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleAddGrade() {
    const name = gradeName.trim()
    if (!name) return

    const success = await runAction(
      () => createCloudGrade(name),
      "Grade added successfully."
    )

    if (success) setGradeName("")
  }

  async function handleAddClass() {
    const division = section.trim()
    if (!selectedGrade || !division) return

    const success = await runAction(
      () => createCloudClass(selectedGrade, division),
      "Class added successfully."
    )

    if (success) setSection("")
  }

  async function handleDeleteGrade(
    id: string,
    name: string
  ) {
    if (!window.confirm(`Delete ${name}?`)) return

    await runAction(
      () => deleteCloudGrade(id),
      "Grade deleted successfully."
    )
  }

  async function handleDeleteClass(
    id: string,
    name: string
  ) {
    if (!window.confirm(`Delete class ${name}?`)) return

    await runAction(
      () => deleteCloudClass(id),
      "Class deleted successfully."
    )
  }

  return (
    <section className="space-y-5 rounded-xl border border-slate-700 bg-slate-800 p-5">
      <div>
        <h2 className="text-lg font-semibold text-cyan-400">
          School Grades & Classes
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Manage school grades and class divisions.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-green-950 p-3 text-sm text-green-300">
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">
          Loading grades and classes...
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="new-grade"
                className="mb-2 block text-sm text-slate-300"
              >
                New Grade
              </label>
              <input
                id="new-grade"
                value={gradeName}
                onChange={(e) => setGradeName(e.target.value)}
                placeholder="Grade 6"
                disabled={busy}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                disabled={busy || !gradeName.trim()}
                onClick={() => void handleAddGrade()}
                className="rounded-lg bg-cyan-600 px-4 py-3 font-medium text-white disabled:opacity-40"
              >
                Add Grade
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="class-grade"
                className="mb-2 block text-sm text-slate-300"
              >
                Grade
              </label>
              <select
                id="class-grade"
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white"
              >
                <option value="">Select grade</option>
                {configuration.grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="class-division"
                className="mb-2 block text-sm text-slate-300"
              >
                Division
              </label>
              <input
                id="class-division"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="A"
                disabled={busy}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                disabled={busy || !selectedGrade || !section.trim()}
                onClick={() => void handleAddClass()}
                className="rounded-lg bg-cyan-600 px-4 py-3 font-medium text-white disabled:opacity-40"
              >
                Add Class
              </button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-lg bg-slate-900 p-4">
              <h3 className="mb-3 font-semibold text-white">
                Grades ({configuration.grades.length})
              </h3>
              <div className="space-y-2">
                {configuration.grades.map((grade) => (
                  <div
                    key={grade.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-800 p-3"
                  >
                    <span className="text-sm text-slate-200">
                      {grade.name}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDeleteGrade(grade.id, grade.name)}
                      className="text-sm text-red-400 hover:text-red-300 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {configuration.grades.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No grades added yet.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-slate-900 p-4">
              <h3 className="mb-3 font-semibold text-white">
                Classes ({configuration.classes.length})
              </h3>
              <div className="space-y-2">
                {configuration.classes.map((schoolClass) => {
                  const grade = configuration.grades.find(
                    (item) => item.id === schoolClass.grade_id
                  )
                  const name = `${grade?.name ?? "Unknown grade"} - ${schoolClass.section}`

                  return (
                    <div
                      key={schoolClass.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-slate-800 p-3"
                    >
                      <span className="text-sm text-slate-200">
                        {name}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDeleteClass(schoolClass.id, name)}
                        className="text-sm text-red-400 hover:text-red-300 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  )
                })}
                {configuration.classes.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No classes added yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
