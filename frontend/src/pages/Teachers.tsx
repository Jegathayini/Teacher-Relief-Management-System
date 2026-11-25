import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import type {
  Teacher,
  TeacherUnavailability,
  UnavailabilityScope,
} from "../types"
import {
  fetchCloudTeachers,
  createCloudTeacher,
  updateCloudTeacher,
  updateCloudTeacherStatus,
  deleteCloudTeacher,
  fetchTeacherUnavailabilities,
  createTeacherUnavailability,
  deleteTeacherUnavailability,
} from "../services/api"
import { isValidIsoDate } from "../utils/reliefEngine"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
const ALL_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

function getToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`
}

function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [unavailabilities, setUnavailabilities] = useState<
    TeacherUnavailability[]
  >([])

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

  // Period-level unavailability state
  const [unavailTeacherId, setUnavailTeacherId] = useState("")
  const [unavailScope, setUnavailScope] =
    useState<UnavailabilityScope>("date")
  const [unavailDate, setUnavailDate] = useState(getToday)
  const [unavailDay, setUnavailDay] = useState("Monday")
  const [unavailPeriods, setUnavailPeriods] = useState<number[]>([])
  const [unavailReason, setUnavailReason] = useState("")
  const [unavailError, setUnavailError] = useState("")
  const [unavailSuccess, setUnavailSuccess] = useState("")
  const [savingUnavail, setSavingUnavail] = useState(false)
  const [deletingUnavailId, setDeletingUnavailId] = useState<string | null>(
    null
  )

  useEffect(() => {
    let mounted = true

    async function loadTeachers() {
      try {
        const [teacherData, unavailabilityData] = await Promise.all([
          fetchCloudTeachers(),
          fetchTeacherUnavailabilities(),
        ])

        if (!mounted) return

        setTeachers(teacherData)
        setUnavailabilities(unavailabilityData)
        setDatabaseStatus("Connected to Supabase")
        setError("")
      } catch (err) {
        console.error("Failed to load cloud teachers:", err)

        if (!mounted) return

        setDatabaseStatus("Supabase connection failed")
        setError(
          err instanceof Error ? err.message : "Unable to load teachers."
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

  function getTeacherName(id: string): string {
    return (
      teachers.find((teacher) => teacher.id === id)?.name ?? "Unknown Teacher"
    )
  }

  function toggleUnavailPeriod(period: number) {
    setUnavailPeriods((previous) =>
      previous.includes(period)
        ? previous.filter((value) => value !== period)
        : [...previous, period].sort((a, b) => a - b)
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      setError("Enter a teacher name and at least one subject.")
      return
    }

    if (databaseStatus !== "Connected to Supabase") {
      setError("Supabase is unavailable. Check your connection and reload.")
      return
    }

    setSaving(true)

    try {
      const wasEditing = editingId !== null

      if (editingId) {
        await updateCloudTeacher(editingId, cleanName, subjectList)
      } else {
        await createCloudTeacher(cleanName, subjectList)
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
      setError(err instanceof Error ? err.message : "Unable to save teacher.")
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
      const updatedTeacher = await updateCloudTeacherStatus(
        teacher.id,
        newStatus
      )
      setTeachers((previous) =>
        previous.map((item) =>
          item.id === updatedTeacher.id ? updatedTeacher : item
        )
      )
      setSuccess(
        `${teacher.name} ${newStatus ? "activated" : "deactivated"} successfully in Supabase!`
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to change teacher status."
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(teacher: Teacher) {
    if (saving || loading || databaseStatus !== "Connected to Supabase") return

    if (
      !window.confirm(
        `Permanently delete ${teacher.name}? This cannot be undone.`
      )
    ) {
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
      setUnavailabilities((previous) =>
        previous.filter((item) => item.teacherId !== teacher.id)
      )

      if (editingId === teacher.id) {
        resetForm()
      }
      if (unavailTeacherId === teacher.id) {
        setUnavailTeacherId("")
      }

      setSuccess(`${teacher.name} deleted successfully!`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete teacher."
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateUnavailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (savingUnavail || loading) return

    setUnavailError("")
    setUnavailSuccess("")

    if (databaseStatus !== "Connected to Supabase") {
      setUnavailError("Supabase is unavailable. Check your connection and reload.")
      return
    }

    if (!unavailTeacherId) {
      setUnavailError("Please select a teacher.")
      return
    }

    if (unavailScope === "date" && !isValidIsoDate(unavailDate)) {
      setUnavailError("Please enter a valid date.")
      return
    }

    if (unavailScope === "weekly" && !DAYS.includes(unavailDay)) {
      setUnavailError("Please select a valid weekday.")
      return
    }

    if (unavailPeriods.length === 0) {
      setUnavailError("Select at least one unavailable period.")
      return
    }

    setSavingUnavail(true)

    try {
      const created = await createTeacherUnavailability({
        teacherId: unavailTeacherId,
        scope: unavailScope,
        date: unavailScope === "date" ? unavailDate : null,
        day: unavailScope === "weekly" ? unavailDay : null,
        periods: unavailPeriods,
        reason: unavailReason.trim(),
      })

      setUnavailabilities((previous) => [created, ...previous])
      setUnavailPeriods([])
      setUnavailReason("")
      setUnavailSuccess(
        `Period-level unavailability saved for ${getTeacherName(created.teacherId)}.`
      )
    } catch (err) {
      setUnavailError(
        err instanceof Error
          ? err.message
          : "Unable to save period-level unavailability."
      )
    } finally {
      setSavingUnavail(false)
    }
  }

  async function handleDeleteUnavailability(record: TeacherUnavailability) {
    if (deletingUnavailId || savingUnavail) return

    if (
      !window.confirm(
        `Remove unavailable periods (${record.periods.join(", ")}) for ${getTeacherName(record.teacherId)}?`
      )
    ) {
      return
    }

    setDeletingUnavailId(record.id)
    setUnavailError("")
    setUnavailSuccess("")

    try {
      await deleteTeacherUnavailability(record.id)
      setUnavailabilities((previous) =>
        previous.filter((item) => item.id !== record.id)
      )
      setUnavailSuccess("Unavailability record removed.")
    } catch (err) {
      setUnavailError(
        err instanceof Error
          ? err.message
          : "Unable to remove unavailability record."
      )
    } finally {
      setDeletingUnavailId(null)
    }
  }

  const connected = databaseStatus === "Connected to Supabase"
  const activeTeachers = teachers.filter((teacher) => teacher.active)

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cyan-400">
          Teacher Management
        </h1>

        <p className="mt-1 text-slate-400">
          Add and update teachers, and configure period-level unavailability in
          your school's cloud database.
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
            onChange={(event) => setSubjects(event.target.value)}
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

      {/* Period-Level Teacher Unavailability */}
      <div className="space-y-4 rounded-xl bg-slate-800 p-6">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Period-Level Unavailability (Inactive Periods)
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Mark specific periods where a teacher is unavailable (e.g., medical
            rest or paper marking) without recording a full-day absence.
            Relief suggestions will exclude the teacher during these periods.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            void handleCreateUnavailability(event)
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="unavail-teacher"
                className="mb-2 block text-sm text-slate-300"
              >
                Teacher
              </label>
              <select
                id="unavail-teacher"
                value={unavailTeacherId}
                onChange={(event) => setUnavailTeacherId(event.target.value)}
                className="w-full rounded-lg bg-slate-700 p-3 text-white outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Select active teacher</option>
                {activeTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="unavail-scope"
                className="mb-2 block text-sm text-slate-300"
              >
                Schedule Type
              </label>
              <select
                id="unavail-scope"
                value={unavailScope}
                onChange={(event) =>
                  setUnavailScope(event.target.value as UnavailabilityScope)
                }
                className="w-full rounded-lg bg-slate-700 p-3 text-white outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="date">Specific Date</option>
                <option value="weekly">Weekly Recurring Day</option>
              </select>
            </div>

            {unavailScope === "date" ? (
              <div>
                <label
                  htmlFor="unavail-date"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Date
                </label>
                <input
                  id="unavail-date"
                  type="date"
                  value={unavailDate}
                  onChange={(event) => setUnavailDate(event.target.value)}
                  className="w-full rounded-lg bg-slate-700 p-3 text-white outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            ) : (
              <div>
                <label
                  htmlFor="unavail-day"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Weekday
                </label>
                <select
                  id="unavail-day"
                  value={unavailDay}
                  onChange={(event) => setUnavailDay(event.target.value)}
                  className="w-full rounded-lg bg-slate-700 p-3 text-white outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {DAYS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-300">
                Unavailable Periods
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setUnavailPeriods([1, 2, 3, 4])}
                  className="rounded border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-700"
                >
                  First Half (1–4)
                </button>
                <button
                  type="button"
                  onClick={() => setUnavailPeriods([5, 6, 7, 8])}
                  className="rounded border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-700"
                >
                  Second Half (5–8)
                </button>
                <button
                  type="button"
                  onClick={() => setUnavailPeriods([...ALL_PERIODS])}
                  className="rounded border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-700"
                >
                  All (1–8)
                </button>
                <button
                  type="button"
                  onClick={() => setUnavailPeriods([])}
                  className="rounded border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-700"
                >
                  Clear
                </button>
              </div>
            </div>

            <div
              className="grid grid-cols-4 gap-2 sm:grid-cols-8"
              role="group"
              aria-label="Unavailable periods"
            >
              {ALL_PERIODS.map((period) => {
                const selected = unavailPeriods.includes(period)
                return (
                  <button
                    key={period}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleUnavailPeriod(period)}
                    className={`rounded-lg border p-2.5 text-sm font-semibold transition-colors ${
                      selected
                        ? "border-amber-400 bg-amber-500 text-slate-950"
                        : "border-slate-600 bg-slate-700 text-white hover:border-amber-500"
                    }`}
                  >
                    P{period}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="unavail-reason"
              className="mb-2 block text-sm text-slate-300"
            >
              Reason (Optional)
            </label>
            <input
              id="unavail-reason"
              type="text"
              value={unavailReason}
              onChange={(event) => setUnavailReason(event.target.value)}
              placeholder="e.g. Medical rest, Paper marking time"
              className="w-full rounded-lg bg-slate-700 p-3 text-white outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {unavailError && (
            <p role="alert" className="text-sm text-red-400">
              {unavailError}
            </p>
          )}

          {unavailSuccess && (
            <p role="status" className="text-sm text-green-400">
              {unavailSuccess}
            </p>
          )}

          <button
            type="submit"
            disabled={savingUnavail || !connected || loading}
            className="rounded-lg bg-amber-500 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingUnavail ? "Saving..." : "Mark Periods Unavailable"}
          </button>
        </form>

        <div className="border-t border-slate-700 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-300">
            Recorded Period-Level Unavailability ({unavailabilities.length})
          </h3>

          {unavailabilities.length === 0 ? (
            <p className="rounded-lg bg-slate-700/60 p-4 text-sm text-slate-400">
              No period-level unavailability rules recorded.
            </p>
          ) : (
            <div className="space-y-2">
              {unavailabilities.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col gap-3 rounded-lg bg-slate-700 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {getTeacherName(record.teacherId)}{" "}
                      <span className="ml-2 rounded bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-300">
                        {record.scope === "date"
                          ? `Date: ${record.date ?? "—"}`
                          : `Every ${record.day ?? "—"}`}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-cyan-300">
                      Periods: {record.periods.map((p) => `P${p}`).join(", ")}
                      {record.reason ? ` — ${record.reason}` : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      deletingUnavailId !== null ||
                      savingUnavail ||
                      !connected
                    }
                    onClick={() => {
                      void handleDeleteUnavailability(record)
                    }}
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingUnavailId === record.id
                      ? "Removing..."
                      : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-slate-800 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Teacher List</h2>

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
            {teachers.map((teacher) => {
              const teacherUnavailCount = unavailabilities.filter(
                (item) => item.teacherId === teacher.id
              ).length
              return (
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

                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <span
                        className={
                          teacher.active
                            ? "text-xs text-green-400"
                            : "text-xs text-amber-400"
                        }
                      >
                        {teacher.active ? "Active" : "Inactive"}
                      </span>

                      {teacherUnavailCount > 0 && (
                        <span className="text-xs text-amber-300">
                          • {teacherUnavailCount} period unavailability rule(s)
                        </span>
                      )}
                    </div>
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
                      onClick={() => {
                        void handleStatusChange(teacher)
                      }}
                      className="rounded-lg bg-slate-600 px-3 py-2 text-sm text-white hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {teacher.active ? "Deactivate" : "Activate"}
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
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default Teachers