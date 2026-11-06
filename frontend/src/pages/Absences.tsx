import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import {
  fetchTeachers,
  fetchTimetables,
  fetchAbsences,
  createAbsence,
  fetchReliefAssignments,
  deleteAbsence,
} from "../services/api"
import type { Teacher, TimetableEntry, Absence, ReliefAssignment } from "../types"

const ALL_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]
type AbsenceMode = "full" | "first" | "second" | "single" | "custom"

function getToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function getDayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  if (!year || !month || !day) return ""
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "long" })
}

function Absences() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [timetables, setTimetables] = useState<TimetableEntry[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [assignments, setAssignments] = useState<ReliefAssignment[]>([])
  const [databaseStatus, setDatabaseStatus] = useState("Loading Supabase data...")
  const [date, setDate] = useState(getToday)
  const [teacherId, setTeacherId] = useState("")
  const [reason, setReason] = useState("")
  const [absenceMode, setAbsenceMode] = useState<AbsenceMode>("full")
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([...ALL_PERIODS])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let mounted = true
    async function loadData() {
      try {
        const [loadedTeachers, loadedTimetables, loadedAbsences, loadedAssignments] =
          await Promise.all([
            fetchTeachers(), fetchTimetables(), fetchAbsences(), fetchReliefAssignments(),
          ])
        if (!mounted) return
        setTeachers(loadedTeachers)
        setTimetables(loadedTimetables)
        setAbsences(loadedAbsences)
        setAssignments(loadedAssignments)
        setDatabaseStatus("Connected to Supabase")
      } catch (loadError) {
        console.error("Failed to load absence data:", loadError)
        if (mounted) {
          setDatabaseStatus("Supabase connection failed")
          setError(loadError instanceof Error ? loadError.message : "Failed to load data.")
        }
      }
    }
    void loadData()
    return () => { mounted = false }
  }, [])

  const dayName = getDayName(date)
  const dailyAbsences = absences.filter((absence) => absence.date === date)

  function getTeacherName(id: string): string {
    return teachers.find((teacher) => teacher.id === id)?.name ?? "Unknown Teacher"
  }

  function handleAbsenceModeChange(mode: AbsenceMode) {
    setAbsenceMode(mode)
    if (mode === "full") setSelectedPeriods([...ALL_PERIODS])
    else if (mode === "first") setSelectedPeriods([1, 2, 3, 4])
    else if (mode === "second") setSelectedPeriods([5, 6, 7, 8])
    else if (mode === "single") setSelectedPeriods([1])
    else setSelectedPeriods([])
  }

  function togglePeriod(period: number) {
    setSelectedPeriods((previous) =>
      previous.includes(period)
        ? previous.filter((value) => value !== period)
        : [...previous, period].sort((a, b) => a - b)
    )
  }

  function getAffectedLessons(absence: Absence): TimetableEntry[] {
    return timetables
      .filter((entry) =>
        entry.teacherId === absence.teacherId &&
        entry.day === dayName &&
        absence.absentPeriods.includes(entry.period)
      )
      .sort((a, b) => a.period - b.period)
  }

  function getAssignment(entry: TimetableEntry): ReliefAssignment | undefined {
    return assignments.find((assignment) =>
      assignment.date === date &&
      assignment.absentTeacherId === entry.teacherId &&
      assignment.period === entry.period &&
      assignment.className === entry.className
    )
  }

  function isAssignmentConflicted(assignment: ReliefAssignment): boolean {
    return dailyAbsences.some((absence) =>
      absence.teacherId === assignment.reliefTeacherId &&
      absence.absentPeriods.includes(assignment.period)
    )
  }

  const totalAffectedLessons = dailyAbsences.reduce(
    (total, absence) => total + getAffectedLessons(absence).length, 0
  )
  const pendingLessons = dailyAbsences.reduce(
    (total, absence) => total + getAffectedLessons(absence).filter((entry) => {
      const assignment = getAssignment(entry)
      return !assignment || isAssignmentConflicted(assignment)
    }).length, 0
  )
  const conflictingAssignments = assignments.filter((assignment) =>
    assignment.date === date && isAssignmentConflicted(assignment)
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return
    setError("")
    setMessage("")

    if (databaseStatus !== "Connected to Supabase") {
      setError("Supabase is not connected.")
      return
    }
    if (!date) {
      setError("Please select a date.")
      return
    }
    if (!teacherId || !teachers.some((teacher) => teacher.id === teacherId && teacher.active)) {
      setError("Please select an active teacher.")
      return
    }
    if (selectedPeriods.length === 0) {
      setError("Please select at least one absent period.")
      return
    }

    setIsSaving(true)
    try {
      // Refresh before checking: another administrator may have changed assignments.
      const [currentAbsences, currentAssignments] = await Promise.all([
        fetchAbsences(), fetchReliefAssignments(),
      ])
      setAbsences(currentAbsences)
      setAssignments(currentAssignments)

      const existing = currentAbsences.find((absence) =>
        absence.teacherId === teacherId && absence.date === date
      )
      const additionalPeriods = selectedPeriods.filter(
        (period) => !existing?.absentPeriods.includes(period)
      )
      if (additionalPeriods.length === 0) {
        setError("All selected periods are already recorded for this teacher on this date.")
        return
      }

      const impactedAssignments = currentAssignments.filter((assignment) =>
        assignment.date === date &&
        assignment.reliefTeacherId === teacherId &&
        additionalPeriods.includes(assignment.period)
      )
      if (impactedAssignments.length > 0) {
        const details = impactedAssignments
          .map((assignment) => `P${assignment.period} (${assignment.className})`)
          .join(", ")
        const confirmed = window.confirm(
          `This absence will conflict with ${impactedAssignments.length} existing relief assignment(s): ${details}.\n\n` +
          "You must arrange and confirm replacement teachers afterwards. " +
          "No replacement will happen automatically.\n\nSave the absence and flag these conflicts?"
        )
        if (!confirmed) return
      }

      await createAbsence({
        teacherId,
        date,
        reason: reason.trim(),
        absentPeriods: selectedPeriods,
      })

      // The RPC can merge with an existing row; always reload instead of appending.
      const [updatedAbsences, updatedAssignments] = await Promise.all([
        fetchAbsences(), fetchReliefAssignments(),
      ])
      setAbsences(updatedAbsences)
      setAssignments(updatedAssignments)
      setTeacherId("")
      setReason("")
      handleAbsenceModeChange("full")
      setMessage(
        impactedAssignments.length > 0
          ? `Absence saved. ${impactedAssignments.length} conflicting relief assignment(s) require administrator-confirmed replacement.`
          : existing
            ? "Additional absent periods merged successfully."
            : "Teacher absence saved to Supabase successfully."
      )
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save absence.")
      // If the RPC succeeded but refreshing failed, try to synchronize the page.
      try {
        const [latestAbsences, latestAssignments] = await Promise.all([
          fetchAbsences(), fetchReliefAssignments(),
        ])
        setAbsences(latestAbsences)
        setAssignments(latestAssignments)
      } catch { /* Keep the error visible. */ }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove(absence: Absence) {
    if (isDeleting) return
    setError("")
    setMessage("")
    if (!window.confirm(
      `Remove the entire absence record for ${getTeacherName(absence.teacherId)} on ${absence.date}?`
    )) return

    setIsDeleting(true)
    try {
      // The backend must enforce any restrictions on dependent assignments.
      await deleteAbsence(absence.id)
      const [updatedAbsences, updatedAssignments] = await Promise.all([
        fetchAbsences(), fetchReliefAssignments(),
      ])
      setAbsences(updatedAbsences)
      setAssignments(updatedAssignments)
      setMessage("Absence record removed from Supabase successfully.")
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove absence.")
      try { setAbsences(await fetchAbsences()) } catch { /* Keep current data. */ }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cyan-400">Daily Absence Management</h1>
        <p className="mt-1 text-slate-400">
          Record full-day or period-based absences and identify lessons needing relief.
        </p>
        <p className="mt-2 text-sm text-cyan-400">Database: {databaseStatus}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-slate-800 p-5">
          <p className="text-sm text-slate-400">Absent Teachers</p>
          <p className="mt-2 text-3xl font-bold text-white">{dailyAbsences.length}</p>
        </div>
        <div className="rounded-xl bg-slate-800 p-5">
          <p className="text-sm text-slate-400">Affected Lessons</p>
          <p className="mt-2 text-3xl font-bold text-white">{totalAffectedLessons}</p>
        </div>
        <div className="rounded-xl bg-slate-800 p-5">
          <p className="text-sm text-slate-400">Pending Relief</p>
          <p className="mt-2 text-3xl font-bold text-amber-400">{pendingLessons}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white">Mark Teacher Absent</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="absence-date" className="mb-2 block text-sm text-slate-300">Date</label>
            <input
              id="absence-date" type="date" value={date} required
              onChange={(event) => { setDate(event.target.value); setMessage(""); setError("") }}
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            />
          </div>
          <div>
            <label htmlFor="absent-teacher" className="mb-2 block text-sm text-slate-300">Teacher</label>
            <select
              id="absent-teacher" value={teacherId} required
              onChange={(event) => setTeacherId(event.target.value)}
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            >
              <option value="">Select teacher</option>
              {teachers.filter((teacher) => teacher.active).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <label htmlFor="absence-mode" className="block text-sm font-medium text-slate-300">
            Absence Duration
          </label>
          <select
            id="absence-mode" value={absenceMode}
            onChange={(event) => handleAbsenceModeChange(event.target.value as AbsenceMode)}
            className="w-full rounded-lg bg-slate-700 p-3 text-white"
          >
            <option value="full">Full Day (Periods 1–8)</option>
            <option value="first">First Half (Periods 1–4)</option>
            <option value="second">Second Half (Periods 5–8)</option>
            <option value="single">Single Period</option>
            <option value="custom">Custom Periods</option>
          </select>
          {(absenceMode === "single" || absenceMode === "custom") && (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8" role="group" aria-label="Absent periods">
              {ALL_PERIODS.map((period) => {
                const selected = selectedPeriods.includes(period)
                return (
                  <label
                    key={period}
                    className={`flex cursor-pointer items-center justify-center rounded-lg border p-3 text-sm font-semibold ${
                      selected
                        ? "border-cyan-400 bg-cyan-500 text-slate-950"
                        : "border-slate-600 bg-slate-700 text-white"
                    }`}
                  >
                    <input
                      type={absenceMode === "single" ? "radio" : "checkbox"}
                      name={absenceMode === "single" ? "single-absence-period" : undefined}
                      checked={selected}
                      onChange={() => {
                        if (absenceMode === "single") setSelectedPeriods([period])
                        else togglePeriod(period)
                      }}
                      className="sr-only"
                    />
                    P{period}
                  </label>
                )
              })}
            </div>
          )}
          <p className="text-sm text-cyan-300">
            Selected periods: {selectedPeriods.length ? selectedPeriods.join(", ") : "None selected"}
          </p>
        </div>

        <div>
          <label htmlFor="absence-reason" className="mb-2 block text-sm text-slate-300">
            Reason (Optional)
          </label>
          <input
            id="absence-reason" type="text" value={reason}
            onChange={(event) => setReason(event.target.value)} placeholder="e.g. Leave"
            className="w-full rounded-lg bg-slate-700 p-3 text-white"
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {message && <p role="status" className="text-sm text-green-400">{message}</p>}
        <button
          type="submit"
          disabled={isSaving || isDeleting || databaseStatus !== "Connected to Supabase"}
          className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "Saving..." : "Mark Absent"}
        </button>
      </form>

      {conflictingAssignments.length > 0 && (
        <div className="rounded-xl border border-amber-500/50 bg-slate-800 p-6" role="alert">
          <h2 className="text-lg font-semibold text-amber-300">
            Conflicting Relief Assignments ({conflictingAssignments.length})
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            These assigned substitute teachers are absent during their relief periods.
            An administrator must confirm replacements; no changes are made automatically.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-white">
            {conflictingAssignments.map((assignment) => (
              <li key={assignment.id} className="rounded-lg bg-slate-700 p-3">
                Period {assignment.period} — {assignment.className} — {getTeacherName(assignment.reliefTeacherId)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl bg-slate-800 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Absences for {date}</h2>
          <span className="text-sm text-slate-400">{dayName}</span>
        </div>
        {dailyAbsences.length === 0 ? (
          <p className="rounded-lg bg-slate-700 p-5 text-slate-300">
            No absences recorded for this date.
          </p>
        ) : (
          <div className="space-y-4">
            {dailyAbsences.map((absence) => {
              const lessons = getAffectedLessons(absence)
              return (
                <div key={absence.id} className="rounded-lg bg-slate-700 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">{getTeacherName(absence.teacherId)}</h3>
                      <p className="mt-1 text-sm text-slate-300">
                        {absence.reason || "No reason specified"}
                      </p>
                      <p className="mt-1 text-sm text-cyan-300">
                        Absent periods: {absence.absentPeriods.join(", ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isDeleting || isSaving || databaseStatus !== "Connected to Supabase"}
                      title="Remove the entire Supabase absence record"
                      onClick={() => void handleRemove(absence)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isDeleting ? "Removing..." : "Remove Absence"}
                    </button>
                  </div>
                  <div className="mt-4">
                    <h4 className="mb-2 text-sm font-semibold text-cyan-300">
                      Affected Lessons ({lessons.length})
                    </h4>
                    {lessons.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No scheduled lessons during the selected absent periods.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {lessons.map((entry) => {
                          const assignment = getAssignment(entry)
                          const conflict = assignment ? isAssignmentConflicted(assignment) : false
                          return (
                            <div
                              key={entry.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-800 p-3"
                            >
                              <div>
                                <p className="text-sm text-white">
                                  Period {entry.period} — {entry.className}
                                </p>
                                <p className="text-xs text-slate-400">{entry.subject}</p>
                              </div>
                              <span className={`text-sm ${
                                conflict ? "text-red-400" : assignment ? "text-green-400" : "text-amber-400"
                              }`}>
                                {conflict ? "Replacement Required" : assignment ? "Relief Assigned" : "Pending Relief"}
                              </span>
                            </div>
                          )
                        })}
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
