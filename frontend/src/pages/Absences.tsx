
import { useState, useEffect } from "react"
import { fetchTeachers, fetchTimetables, fetchAbsences, createAbsence, fetchReliefAssignments, deleteAbsence } from "../services/api"
import type { FormEvent } from "react"
import type {
  Teacher,
  TimetableEntry,
  Absence,
  ReliefAssignment
} from "../types"
function getToday(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getDayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number)

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-US",
    { weekday: "long" }
  )
}

function Absences() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [timetables, setTimetables] = useState<TimetableEntry[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [databaseStatus, setDatabaseStatus] = useState("Loading SQLite data...")
  const [assignments, setAssignments] = useState<ReliefAssignment[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  const [date, setDate] = useState(getToday)
  const [teacherId, setTeacherId] = useState("")
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
useEffect(() => {
  async function loadDatabaseData() {
    try {
      const [
        databaseTeachers,
        databaseTimetables,
        databaseAbsences,
        databaseAssignments
      ] = await Promise.all([
        fetchTeachers(),
        fetchTimetables(),
        fetchAbsences(),
        fetchReliefAssignments()
      ])

      setTeachers(databaseTeachers)
      setTimetables(databaseTimetables)
      setAbsences(databaseAbsences)
      setAssignments(databaseAssignments)
      setDatabaseStatus("Connected to SQLite")
    } catch (error) {
      console.error("Failed to load absence data:", error)
      setDatabaseStatus("SQLite connection failed")
    }
  }

  void loadDatabaseData()
}, [])


  const dayName = getDayName(date)

  const dailyAbsences = absences.filter(
    (absence) => absence.date === date
  )

  function getTeacherName(id: string): string {
    return teachers.find((teacher) => teacher.id === id)?.name
      ?? "Unknown Teacher"
  }

  
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()

  if (isSaving) return

  setError("")
  setMessage("")

  if (databaseStatus !== "Connected to SQLite") {
    setError("SQLite is not connected.")
    return
  }

  if (!teacherId) {
    setError("Please select an absent teacher.")
    return
  }

  const selectedTeacher = teachers.find(
    (teacher) => teacher.id === teacherId
  )

  if (!selectedTeacher || !selectedTeacher.active) {
    setError("Please select an active teacher.")
    return
  }

  const alreadyAbsent = absences.some(
    (absence) =>
      absence.teacherId === teacherId &&
      absence.date === date
  )

  if (alreadyAbsent) {
    setError("This teacher is already marked absent on this date.")
    return
  }

  // Check relief assignments currently stored in SQLite.
  let currentAssignments: ReliefAssignment[]
  try {
    currentAssignments = await fetchReliefAssignments()
    setAssignments(currentAssignments)
  } catch {
    setError("Unable to check existing relief assignments. Please try again.")
    return
  }

  const affectedAssignments = currentAssignments.filter(
    (assignment) =>
      assignment.date === date &&
      assignment.reliefTeacherId === teacherId
  )

  // Do not silently invalidate existing relief assignments.
  if (affectedAssignments.length > 0) {
    setError(
      `This teacher has ${affectedAssignments.length} relief assignment(s) ` +
      `on this date. Remove or reassign them in Relief Assignments first.`
    )
    return
  }

  setIsSaving(true)

  try {
    const savedAbsence = await createAbsence({
      teacherId,
      date,
      reason: reason.trim()
    })

    setAbsences((previous) => [...previous, savedAbsence])

    setTeacherId("")
    setReason("")
    setMessage("Teacher absence saved to SQLite successfully.")
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Failed to save teacher absence."
    )
  } finally {
    setIsSaving(false)
  }
}

  
async function handleRemove(absence: Absence) {
  if (isDeleting) return
  setError("")
  setMessage("")

  if (!window.confirm(
    `Remove the absence record for ${getTeacherName(absence.teacherId)} on ${absence.date}?`
  )) return

  setIsDeleting(true)
  try {
    // The backend rejects deletion if a relief assignment depends on it.
    await deleteAbsence(absence.id)
    const [updatedAbsences, updatedAssignments] = await Promise.all([
      fetchAbsences(), fetchReliefAssignments()
    ])
    setAbsences(updatedAbsences)
    setAssignments(updatedAssignments)
    setMessage("Absence record removed from SQLite successfully.")
  } catch (removeError) {
    setError(removeError instanceof Error ? removeError.message : "Failed to remove absence.")
    // Refresh in case deletion succeeded but the subsequent reload failed.
    try { setAbsences(await fetchAbsences()) } catch { /* retain current data */ }
  } finally {
    setIsDeleting(false)
  }
}


  function getAffectedLessons(absentTeacherId: string) {
    return timetables
      .filter(
        (entry) =>
          entry.teacherId === absentTeacherId &&
          entry.day === dayName
      )
      .sort((a, b) => a.period - b.period)
  }

  function isReliefAssigned(entry: TimetableEntry): boolean {
    return assignments.some(
      (assignment) =>
        assignment.date === date &&
        assignment.absentTeacherId === entry.teacherId &&
        assignment.period === entry.period &&
        assignment.className === entry.className
    )
  }

  const totalAffectedLessons = dailyAbsences.reduce(
    (total, absence) =>
      total + getAffectedLessons(absence.teacherId).length,
    0
  )

  const pendingLessons = dailyAbsences.reduce(
    (total, absence) =>
      total +
      getAffectedLessons(absence.teacherId).filter(
        (entry) => !isReliefAssigned(entry)
      ).length,
    0
  )

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cyan-400">
          Daily Absence Management
        </h1>
        <p className="mt-1 text-slate-400">
          Record teacher absences and identify lessons needing relief.
        </p>
        <p className="mt-2 text-sm text-cyan-400">
  Database: {databaseStatus}
</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-slate-800 p-5">
          <p className="text-sm text-slate-400">Absent Teachers</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {dailyAbsences.length}
          </p>
        </div>

        <div className="rounded-xl bg-slate-800 p-5">
          <p className="text-sm text-slate-400">Affected Lessons</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {totalAffectedLessons}
          </p>
        </div>

        <div className="rounded-xl bg-slate-800 p-5">
          <p className="text-sm text-slate-400">Pending Relief</p>
          <p className="mt-2 text-3xl font-bold text-amber-400">
            {pendingLessons}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl bg-slate-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white">
          Mark Teacher Absent
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="absence-date"
              className="mb-2 block text-sm text-slate-300"
            >
              Date
            </label>
            <input
              id="absence-date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setMessage("")
              }}
              required
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            />
          </div>

          <div>
            <label
              htmlFor="absent-teacher"
              className="mb-2 block text-sm text-slate-300"
            >
              Teacher
            </label>
            <select
              id="absent-teacher"
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
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
        </div>

        <div>
          <label
            htmlFor="absence-reason"
            className="mb-2 block text-sm text-slate-300"
          >
            Reason (Optional)
          </label>
          <input
            id="absence-reason"
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Leave"
            className="w-full rounded-lg bg-slate-700 p-3 text-white"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="text-sm text-green-400">
            {message}
          </p>
        )}

        <button
  type="submit"
  disabled={isSaving || databaseStatus !== "Connected to SQLite"}
  className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
>
  {isSaving ? "Saving..." : "Mark Absent"}
</button>
      </form>

      <div className="rounded-xl bg-slate-800 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            Absences for {date}
          </h2>
          <span className="text-sm text-slate-400">
            {dayName}
          </span>
        </div>

        {dailyAbsences.length === 0 ? (
          <p className="rounded-lg bg-slate-700 p-5 text-slate-300">
            No absences recorded for this date.
          </p>
        ) : (
          <div className="space-y-4">
            {dailyAbsences.map((absence) => {
              const lessons = getAffectedLessons(
                absence.teacherId
              )

              return (
                <div
                  key={absence.id}
                  className="rounded-lg bg-slate-700 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">
                        {getTeacherName(absence.teacherId)}
                      </h3>
                      <p className="mt-1 text-sm text-slate-300">
                        {absence.reason || "No reason specified"}
                      </p>
                    </div>

                    <button
                      type="button" disabled={isDeleting || databaseStatus !== "Connected to SQLite"} title="Remove this SQLite absence record"
                      onClick={() => handleRemove(absence)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove Absence
                    </button>
                  </div>

                  <div className="mt-4">
                    <h4 className="mb-2 text-sm font-semibold text-cyan-300">
                      Affected Lessons ({lessons.length})
                    </h4>

                    {lessons.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No scheduled lessons on this day.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {lessons.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-800 p-3"
                          >
                            <div>
                              <p className="text-sm text-white">
                                Period {entry.period} — {entry.className}
                              </p>
                              <p className="text-xs text-slate-400">
                                {entry.subject}
                              </p>
                            </div>

                            <span
                              className={
                                isReliefAssigned(entry)
                                  ? "text-sm text-green-400"
                                  : "text-sm text-amber-400"
                              }
                            >
                              {isReliefAssigned(entry)
                                ? "Relief Assigned"
                                : "Pending Relief"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
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

export default Absences
