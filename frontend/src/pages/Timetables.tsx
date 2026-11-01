import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { createTimetable, fetchTimetables, fetchTeachers, deleteTimetable } from "../services/api"
import type { Teacher, TimetableEntry } from "../types"
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

function Timetables() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherId, setTeacherId] = useState("")
  const [className, setClassName] = useState("")
  const [subject, setSubject] = useState("")
  const [day, setDay] = useState("Monday")
  const [period, setPeriod] = useState(1)
  const [filterDay, setFilterDay] = useState("All")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [databaseEntries, setDatabaseEntries] = useState<TimetableEntry[]>([])
  const [databaseStatus, setDatabaseStatus] = useState("Checking SQLite...")
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadDatabaseData() {
      try {
        const [timetables, databaseTeachers] = await Promise.all([
          fetchTimetables(),
          fetchTeachers()
        ])
        setDatabaseEntries(timetables)
        setTeachers(databaseTeachers)
        setDatabaseStatus("Connected to SQLite")
      } catch (loadError) {
        console.error("SQLite API error:", loadError)
        setDatabaseStatus("SQLite connection failed")
      }
    }

    void loadDatabaseData()
  }, [])

  const combinedEntries = databaseEntries

  function handleTeacherChange(id: string) {
    setTeacherId(id)
    const teacher = teachers.find((item) => item.id === id)
    setSubject(teacher?.subjects[0] ?? "")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return
    setError("")
    setSuccess("")

    const cleanClass = className.trim()
    const cleanSubject = subject.trim()

    if (databaseStatus !== "Connected to SQLite") {
      setError("Connect to SQLite before adding a timetable entry.")
      return
    }

    if (!teacherId || !cleanClass || !cleanSubject) {
      setError("Please complete all timetable fields.")
      return
    }

    const selectedTeacher = teachers.find((teacher) => teacher.id === teacherId)
    if (!selectedTeacher || !selectedTeacher.active) {
      setError("Please select an active teacher.")
      return
    }

    if (!selectedTeacher.subjects.includes(cleanSubject)) {
      setError("The selected teacher does not teach this subject.")
      return
    }

    const teacherConflict = combinedEntries.some(
      (entry) =>
        entry.day === day &&
        entry.period === period &&
        entry.teacherId === teacherId
    )

    if (teacherConflict) {
      setError("This teacher already has a class during that period.")
      return
    }

    const classConflict = combinedEntries.some(
      (entry) =>
        entry.day === day &&
        entry.period === period &&
        entry.className.trim().toLowerCase() === cleanClass.toLowerCase()
    )

    if (classConflict) {
      setError("This class already has a lesson during that period.")
      return
    }

    setIsSaving(true)
    try {
      const savedEntry = await createTimetable({
        teacherId,
        className: cleanClass,
        subject: cleanSubject,
        day,
        period
      })
      // Display the saved row even if the follow-up refresh fails.
      setDatabaseEntries((previous) => [...previous, savedEntry])
      try {
        const updatedEntries = await fetchTimetables()
        setDatabaseEntries(updatedEntries)
      } catch (refreshError) {
        console.error("Timetable refresh failed:", refreshError)
      }
      setClassName("")
      setSuccess("Timetable entry saved to SQLite successfully.")
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save timetable entry."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (deletingId !== null) return
    const entry = databaseEntries.find((item) => item.id === id)
    if (!entry) return
    setError("")
    setSuccess("")

    if (!window.confirm(`Delete ${entry.className}, ${entry.day}, Period ${entry.period}?`)) return

    setDeletingId(id)
    try {
      // Backend prevents deleting a timetable linked to relief assignments.
      await deleteTimetable(id)
      setDatabaseEntries((previous) => previous.filter((item) => item.id !== id))
      setSuccess("Timetable entry removed from SQLite successfully.")
      try { setDatabaseEntries(await fetchTimetables()) } catch { /* local state already updated */ }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete timetable entry.")
    } finally {
      setDeletingId(null)
    }
  }

  const visibleEntries = combinedEntries
    .filter((entry) => filterDay === "All" || entry.day === filterDay)
    .sort((a, b) => {
      const dayDifference = DAYS.indexOf(a.day) - DAYS.indexOf(b.day)
      return dayDifference !== 0 ? dayDifference : a.period - b.period
    })

  function getTeacherName(id: string) {
    return teachers.find((teacher) => teacher.id === id)?.name ?? "Unknown Teacher"
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cyan-400">
          Timetable Management
        </h1>
        <p className="mt-1 text-slate-400">
          Manage weekly lessons and prevent scheduling conflicts.
        </p>
        
<div className="mt-4 flex flex-wrap items-center gap-3">
  <span className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-cyan-400">
    {databaseStatus}
  </span>

  {databaseStatus === "Connected to SQLite" && (
    <span className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">
      SQLite Timetable Entries: {databaseEntries.length}
    </span>
  )}
</div>

      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl bg-slate-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white">
          {isSaving ? "Saving..." : "Add Timetable Entry"}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Teacher
            </label>
            <select
              value={teacherId}
              onChange={(event) =>
                handleTeacherChange(event.target.value)
              }
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            >
              <option value="">Select teacher</option>
              {teachers
                .filter((teacher) => teacher.active)
                .map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Class
            </label>
            <input
              type="text"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              placeholder="e.g. Grade 8A"
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Subject
            </label>
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            >
              <option value="">Select subject</option>
              {teachers
                .find((teacher) => teacher.id === teacherId)
                ?.subjects.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Day
            </label>
            <select
              value={day}
              onChange={(event) => setDay(event.target.value)}
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            >
              {DAYS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Period
            </label>
            <select
              value={period}
              onChange={(event) =>
                setPeriod(Number(event.target.value))
              }
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            >
              {PERIODS.map((item) => (
                <option key={item} value={item}>
                  Period {item}
                </option>
              ))}
            </select>
          </div>
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

        <button
          type="submit"
          disabled={isSaving || databaseStatus !== "Connected to SQLite"}
          className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Add Timetable Entry"}
        </button>
      </form>

      <div className="rounded-xl bg-slate-800 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">
            Weekly Timetable
          </h2>

          <select
            value={filterDay}
            onChange={(event) => setFilterDay(event.target.value)}
            className="rounded-lg bg-slate-700 p-2 text-white"
          >
            <option value="All">All Days</option>
            {DAYS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {visibleEntries.length === 0 ? (
          <p className="rounded-lg bg-slate-700 p-5 text-slate-300">
            No timetable entries found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-600 text-slate-300">
                <tr>
                  <th className="p-3">Day</th>
                  <th className="p-3">Period</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Teacher</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {visibleEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-700 text-white"
                  >
                    <td className="p-3">{entry.day}</td>
                    <td className="p-3">{entry.period}</td>
                    <td className="p-3">{entry.className}</td>
                    <td className="p-3">{entry.subject}</td>
                    <td className="p-3">
                      {getTeacherName(entry.teacherId)}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        disabled={deletingId !== null || databaseStatus !== "Connected to SQLite"}
                        title="Delete SQLite timetable entry"
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default Timetables
