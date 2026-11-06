
import { useEffect, useState } from "react"

import {
  fetchTeachers,
  fetchTimetables,
  fetchAbsences,
  fetchReliefAssignments,
  fetchSchoolReliefCounts,
  createAbsence,
  createReliefAssignment,
  replaceReliefAssignment
} from "../services/api"

import { getReliefSuggestions } from "../utils/reliefEngine"

import type {
  Teacher,
  TimetableEntry,
  Absence,
  ReliefAssignment
} from "../types"

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

type PeriodPreset = "full" | "first" | "second"

function getLocalDate(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getWeekday(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number)

  const date = new Date(year, month - 1, day)

  return date.toLocaleDateString("en-US", {
    weekday: "long"
  })
}

export default function UnplannedReliefs() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [timetables, setTimetables] = useState<TimetableEntry[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [assignments, setAssignments] = useState<ReliefAssignment[]>([])
  const [lifetimeCounts, setLifetimeCounts] = useState<Record<string, number>>({})
  const [chosenTeachers, setChosenTeachers] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")

  const [selectedTeacherId, setSelectedTeacherId] = useState("")
  const [selectedDate, setSelectedDate] = useState(getLocalDate)

  const [selectedPeriods, setSelectedPeriods] =
    useState<number[]>([...PERIODS])

  const [reason, setReason] = useState("")

  useEffect(() => {
    let active = true

    async function loadData() {
      try {
        setLoading(true)
        setError("")

        const [
          teacherData,
          timetableData,
          absenceData,
          assignmentData,
          countsData
        ] = await Promise.all([
          fetchTeachers(),
          fetchTimetables(),
          fetchAbsences(),
          fetchReliefAssignments(),
          fetchSchoolReliefCounts()
        ])

        if (!active) return

        setTeachers(teacherData)
        setTimetables(timetableData)
        setAbsences(absenceData)
        setAssignments(assignmentData)
        setLifetimeCounts(countsData)
      } catch (err) {
        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load school data."
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [])

  function clearSelectionFeedback() {
    setChosenTeachers({})
    setSaveMessage("")
  }

  function togglePeriod(period: number) {
    clearSelectionFeedback()
    setSelectedPeriods((current) =>
      current.includes(period)
        ? current.filter((value) => value !== period)
        : [...current, period].sort((a, b) => a - b)
    )
  }

  function selectPeriodPreset(preset: PeriodPreset) {
    clearSelectionFeedback()
    switch (preset) {
      case "full":
        setSelectedPeriods([...PERIODS])
        break

      case "first":
        setSelectedPeriods([1, 2, 3, 4])
        break

      case "second":
        setSelectedPeriods([5, 6, 7, 8])
        break
    }
  }

  const selectedTeacher = teachers.find(
    (teacher) => teacher.id === selectedTeacherId
  )
  const selectedDay = selectedDate
  ? getWeekday(selectedDate)
  : ""

const affectedLessons = timetables.filter((entry) => {
  return (
    entry.teacherId === selectedTeacherId &&
    entry.day.toLowerCase() === selectedDay.toLowerCase() &&
    selectedPeriods.includes(entry.period)
  )
})

const affectedReliefDuties = assignments.filter((assignment) => {
  return (
    assignment.reliefTeacherId === selectedTeacherId &&
    assignment.date === selectedDate &&
    selectedPeriods.includes(assignment.period)
  )
})

const existingAssignments = assignments.filter((assignment) => {
  return (
    assignment.absentTeacherId === selectedTeacherId &&
    assignment.date === selectedDate &&
    selectedPeriods.includes(assignment.period)
  )
})

const lessonsNeedingRelief = affectedLessons.filter((lesson) => {
  return !existingAssignments.some((assignment) => {
    return (
      assignment.period === lesson.period &&
      assignment.className === lesson.className &&
      assignment.absentTeacherId === selectedTeacherId
    )
  })
})

  // Preview the selected teacher as absent before the record is saved.
  const previewAbsences: Absence[] = selectedTeacherId && selectedDate
    ? [...absences, {
        id: "preview-unplanned-absence",
        teacherId: selectedTeacherId,
        date: selectedDate,
        reason,
        absentPeriods: selectedPeriods
      }]
    : absences

  function suggestionOptions(
    key: string,
    period: number,
    subject: string,
    absentTeacherId: string,
    excludeAssignmentId?: string
  ) {
    // Exclude the assignment being replaced, so candidates are not
    // incorrectly considered busy because of the old relief teacher.
    const otherAssignments = excludeAssignmentId
      ? assignments.filter((assignment) => assignment.id !== excludeAssignmentId)
      : assignments

    // Other selections on this screen also reserve their chosen periods.
    const plannedAssignments: ReliefAssignment[] = Object.entries(chosenTeachers)
      .filter(([selectionKey, teacherId]) => selectionKey !== key && Boolean(teacherId))
      .flatMap(([selectionKey, teacherId]) => {
        const lesson = lessonsNeedingRelief.find((item) => `lesson:${item.id}` === selectionKey)
        const duty = affectedReliefDuties.find((item) => `replacement:${item.id}` === selectionKey)
        if (!lesson && !duty) return []
        return [{
          id: `preview:${selectionKey}`,
          date: selectedDate,
          period: lesson?.period ?? duty!.period,
          className: lesson?.className ?? duty!.className,
          subject: lesson?.subject ?? duty!.subject,
          absentTeacherId: lesson?.teacherId ?? duty!.absentTeacherId,
          reliefTeacherId: teacherId
        }]
      })

    return getReliefSuggestions(
      { date: selectedDate, period, subject, absentTeacherId },
      teachers,
      timetables,
      previewAbsences,
      [...otherAssignments, ...plannedAssignments],
      lifetimeCounts
    ).filter((option) => option.teacher.id !== selectedTeacherId)
  }

  async function refreshSchoolData() {
    const [teacherData, timetableData, absenceData, assignmentData, countsData] =
      await Promise.all([
        fetchTeachers(),
        fetchTimetables(),
        fetchAbsences(),
        fetchReliefAssignments(),
        fetchSchoolReliefCounts()
      ])
    setTeachers(teacherData)
    setTimetables(timetableData)
    setAbsences(absenceData)
    setAssignments(assignmentData)
    setLifetimeCounts(countsData)
    return { teacherData, timetableData, absenceData, assignmentData, countsData }
  }

  async function confirmAndSave() {
    if (saving) return
    setSaveMessage("")
    setError("")

    if (!selectedTeacherId || !selectedDate || selectedPeriods.length === 0) {
      setSaveMessage("Select a teacher, date, and at least one absent period.")
      return
    }

    const plannedLessons = lessonsNeedingRelief
      .filter((lesson) => Boolean(chosenTeachers[`lesson:${lesson.id}`]))
      .map((lesson) => ({
        key: `lesson:${lesson.id}`,
        date: selectedDate,
        period: lesson.period,
        className: lesson.className,
        subject: lesson.subject,
        absentTeacherId: lesson.teacherId,
        reliefTeacherId: chosenTeachers[`lesson:${lesson.id}`]
      }))

    const plannedReplacements = affectedReliefDuties
      .filter((assignment) => Boolean(chosenTeachers[`replacement:${assignment.id}`]))
      .map((assignment) => ({
        key: `replacement:${assignment.id}`,
        assignment,
        newTeacherId: chosenTeachers[`replacement:${assignment.id}`]
      }))

    const unassignedCount = lessonsNeedingRelief.length +
      affectedReliefDuties.length - plannedLessons.length - plannedReplacements.length

    const message = `Record the absence for ${selectedTeacher?.name ?? "this teacher"} on ${selectedDate} ` +
      `(periods ${selectedPeriods.join(", ")})?\n\n` +
      `New relief assignments: ${plannedLessons.length}\n` +
      `Relief replacements: ${plannedReplacements.length}\n` +
      `Duties still without a selected substitute: ${unassignedCount}\n\n` +
      `Only selected substitutes will be assigned. Continue?`
    if (!window.confirm(message)) return

    setSaving(true)
    let absenceSaved = false
    let successfulAssignments = 0
    let successfulReplacements = 0

    try {
      // Refresh first so stale dropdown selections cannot silently overwrite changes.
      const fresh = await refreshSchoolData()
      const currentTeacher = fresh.teacherData.find((t) => t.id === selectedTeacherId)
      if (!currentTeacher?.active) throw new Error("The absent teacher is no longer active.")

      const day = getWeekday(selectedDate)
      const liveLessons = fresh.timetableData.filter((entry) =>
        entry.teacherId === selectedTeacherId &&
        entry.day.toLowerCase() === day.toLowerCase() &&
        selectedPeriods.includes(entry.period)
      )
      const liveDuties = fresh.assignmentData.filter((assignment) =>
        assignment.reliefTeacherId === selectedTeacherId &&
        assignment.date === selectedDate &&
        selectedPeriods.includes(assignment.period)
      )
      const preview: Absence[] = [...fresh.absenceData, {
        id: "preview-current-absence", teacherId: selectedTeacherId,
        date: selectedDate, reason, absentPeriods: selectedPeriods
      }]
      const reserved: ReliefAssignment[] = []

      for (const item of plannedLessons) {
        const stillScheduled = liveLessons.some((lesson) =>
          lesson.period === item.period && lesson.className === item.className &&
          lesson.subject === item.subject
        )
        const alreadyAssigned = fresh.assignmentData.some((a) =>
          a.date === selectedDate && a.period === item.period &&
          a.className === item.className
        )
        if (!stillScheduled || alreadyAssigned) {
          throw new Error(`The timetable or assignment for ${item.className}, period ${item.period} changed. Review selections.`)
        }
      }
      for (const item of plannedReplacements) {
        const current = liveDuties.find((a) => a.id === item.assignment.id)
        if (!current || current.reliefTeacherId !== selectedTeacherId) {
          throw new Error(`Relief duty for ${item.assignment.className}, period ${item.assignment.period} changed. Review selections.`)
        }
      }

      // Validate all choices together, including choices for the same period.
      for (const item of plannedLessons) {
        const eligible = getReliefSuggestions(
          { date: selectedDate, period: item.period, subject: item.subject,
            absentTeacherId: item.absentTeacherId },
          fresh.teacherData, fresh.timetableData, preview,
          [...fresh.assignmentData, ...reserved], fresh.countsData
        ).some((candidate) => candidate.teacher.id === item.reliefTeacherId)
        if (!eligible) throw new Error(`Selected substitute is unavailable for ${item.className}, period ${item.period}.`)
        reserved.push({ id: `planned:${item.key}`, ...item })
      }
      for (const item of plannedReplacements) {
        const a = item.assignment
        const eligible = getReliefSuggestions(
          { date: selectedDate, period: a.period, subject: a.subject,
            absentTeacherId: a.absentTeacherId },
          fresh.teacherData, fresh.timetableData, preview,
          [...fresh.assignmentData.filter((other) => other.id !== a.id), ...reserved],
          fresh.countsData
        ).some((candidate) => candidate.teacher.id === item.newTeacherId)
        if (!eligible) throw new Error(`Selected replacement is unavailable for ${a.className}, period ${a.period}.`)
        reserved.push({ ...a, id: `planned:${item.key}`, reliefTeacherId: item.newTeacherId })
      }

      // The existing RPC merges periods when the teacher already has an absence.
      await createAbsence({
        teacherId: selectedTeacherId,
        date: selectedDate,
        reason: reason.trim(),
        absentPeriods: [...selectedPeriods].sort((a, b) => a - b)
      })
      absenceSaved = true

      // Each write is independently checked by its Supabase RPC.
      for (const item of plannedLessons) {
        await createReliefAssignment({
          date: item.date, period: item.period, className: item.className,
          subject: item.subject, absentTeacherId: item.absentTeacherId,
          reliefTeacherId: item.reliefTeacherId
        })
        successfulAssignments += 1
      }
      for (const item of plannedReplacements) {
        await replaceReliefAssignment(item.assignment.id, item.newTeacherId)
        successfulReplacements += 1
      }

      setChosenTeachers({})
      setSaveMessage(`Saved absence successfully. Created ${successfulAssignments} relief assignment(s) ` +
        `and confirmed ${successfulReplacements} replacement(s). ` +
        (unassignedCount > 0 ? `${unassignedCount} duty/duties still need substitutes.` : "All identified duties have been addressed."))
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error"
      setSaveMessage(
        `${absenceSaved ? "PARTIAL SAVE: The absence was saved." : "Nothing was saved by this attempt."} ` +
        `Created ${successfulAssignments} assignment(s) and completed ${successfulReplacements} replacement(s). ` +
        `${detail} Review the refreshed records before trying again.`
      )
    } finally {
      try {
        await refreshSchoolData()
      } catch (refreshError) {
        setError(`Could not refresh school data: ${refreshError instanceof Error ? refreshError.message : "Unknown error"}. Reload the page before making further changes.`)
      }
      setSaving(false)
    }
  }

  function teacherSelector(
    key: string,
    period: number,
    subject: string,
    absentTeacherId: string,
    excludeAssignmentId?: string
  ) {
    const options = suggestionOptions(key, period, subject, absentTeacherId, excludeAssignmentId)
    const selected = chosenTeachers[key] ?? ""
    return (
      <div className="mt-3">
        <label className="block text-sm text-slate-300" htmlFor={key}>
          Suggested available teacher ({options.length})
        </label>
        <select
          id={key}
          disabled={saving}
          value={options.some((option) => option.teacher.id === selected) ? selected : ""}
          onChange={(event) => {
            setChosenTeachers((current) => ({ ...current, [key]: event.target.value }))
            setSaveMessage("")
          }}
          className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white"
        >
          <option value="">Select a substitute</option>
          {options.map((option) => (
            <option key={option.teacher.id} value={option.teacher.id}>
              {option.teacher.name} — {option.subjectMatch ? "Subject match" : "Other subject"}
              {` · Today: ${option.reliefCount} · Total: ${option.totalReliefCount}`}
            </option>
          ))}
        </select>
        {options.length === 0 && (
          <p className="mt-2 text-xs text-amber-300">No eligible substitute found for this period.</p>
        )}
      </div>
    )
  }

  return (
    <section className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-cyan-400">
          Unplanned Absences & Relief
        </h1>

        <p className="mt-2 text-slate-400">
          Record unexpected teacher absences and arrange
          suitable relief assignments from one place.
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <p className="text-slate-400">
            Loading school data...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-800 bg-red-950/40 p-5"
        >
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          
          {/* Unplanned absence form */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Record an Unplanned Absence
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Select the unavailable teacher, date, and
                affected periods.
              </p>
            </div>

            {/* Teacher and date */}
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Teacher
                <select
                  disabled={saving}
                  value={selectedTeacherId}
                  onChange={(event) => {
                    setSelectedTeacherId(event.target.value)
                    clearSelectionFeedback()
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white"
                >
                  <option value="">
                    Select a teacher
                  </option>

                  {teachers
                    .filter((teacher) => teacher.active)
                    .sort((a, b) =>
                      a.name.localeCompare(b.name)
                    )
                    .map((teacher) => (
                      <option
                        key={teacher.id}
                        value={teacher.id}
                      >
                        {teacher.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                Date
                <input
                  type="date"
                  disabled={saving}
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value)
                    clearSelectionFeedback()
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white"
                />
              </label>
            </div>

            {/* Absence duration */}
            <div className="mt-6">
              <p className="mb-3 text-sm font-medium text-slate-300">
                Absence Duration
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    selectPeriodPreset("full")
                  }
                  className="rounded-lg border border-cyan-700 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-900/40"
                >
                  Full Day
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    selectPeriodPreset("first")
                  }
                  className="rounded-lg border border-cyan-700 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-900/40"
                >
                  First Half
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    selectPeriodPreset("second")
                  }
                  className="rounded-lg border border-cyan-700 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-900/40"
                >
                  Second Half
                </button>
              </div>

              <p className="mt-4 text-sm text-slate-400">
                Select or deselect individual periods:
              </p>

              <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
                {PERIODS.map((period) => (
                  <button
                    key={period}
                    type="button"
                    disabled={saving}
                    onClick={() => togglePeriod(period)}
                    aria-pressed={selectedPeriods.includes(period)}
                    className={`rounded-lg border p-3 text-sm font-semibold transition-colors ${
                      selectedPeriods.includes(period)
                        ? "border-cyan-400 bg-cyan-500 text-slate-950"
                        : "border-slate-600 bg-slate-900 text-slate-300 hover:border-cyan-700"
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <label className="mt-6 block text-sm text-slate-300">
              Reason (Optional)
              <textarea
                disabled={saving}
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                rows={3}
                placeholder="e.g. Unexpected leave"
                className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white"
              />
            </label>

            {/* Selection preview */}
            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-5">
              <h3 className="font-semibold text-white">
                Absence Preview
              </h3>

              <div className="mt-3 space-y-2 text-sm">
                <p className="text-slate-400">
                  Teacher:{" "}
                  <span className="font-medium text-white">
                    {selectedTeacher?.name ?? "Not selected"}
                  </span>
                </p>

                <p className="text-slate-400">
                  Date:{" "}
                  <span className="font-medium text-white">
                    {selectedDate || "Not selected"}
                  </span>
                </p>

                <p className="text-slate-400">
                  Selected Periods:{" "}
                  <span className="font-medium text-cyan-300">
                    {selectedPeriods.length > 0
                      ? selectedPeriods.join(", ")
                      : "None"}
                  </span>
                </p>

                <p className="text-slate-400">
                  Reason:{" "}
                  <span className="font-medium text-white">
                    {reason.trim() || "Not specified"}
                  </span>
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Review affected lessons and select suitable substitutes below.
              Saving requires administrator confirmation.
            </p>
          </div>

          {/* Affected-work preview */}
          {selectedTeacherId && selectedDate && selectedPeriods.length > 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Affected Lessons & Relief Duties
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Preview for {selectedTeacher?.name} on {selectedDate} ({selectedDay}).
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Lessons Needing Relief", count: lessonsNeedingRelief.length, color: "text-amber-400" },
                  { label: "Existing Relief Duties Affected", count: affectedReliefDuties.length, color: "text-red-400" },
                  { label: "Already Assigned Lessons", count: existingAssignments.length, color: "text-cyan-400" }
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-700 bg-slate-800 p-5">
                    <p className="text-sm text-slate-400">{item.label}</p>
                    <p className={`mt-2 text-3xl font-bold ${item.color}`}>{item.count}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
                <h3 className="text-lg font-semibold text-white">Scheduled Lessons Needing Relief</h3>
                {lessonsNeedingRelief.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">No unassigned scheduled lessons found for the selected periods.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {lessonsNeedingRelief.map((lesson) => (
                      <div key={lesson.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                        <p className="font-medium text-white">{lesson.className}</p>
                        <p className="mt-1 text-sm text-slate-400">Period {lesson.period} • {lesson.subject}</p>
                        <p className="mt-2 text-xs text-amber-300">Relief teacher required</p>
                        {teacherSelector(`lesson:${lesson.id}`, lesson.period, lesson.subject, lesson.teacherId)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
                <h3 className="text-lg font-semibold text-white">Existing Relief Duties Requiring Replacement</h3>
                {affectedReliefDuties.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">This teacher has no existing relief duties during the selected periods.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {affectedReliefDuties.map((assignment) => (
                      <div key={assignment.id} className="rounded-lg border border-red-900 bg-slate-900 p-4">
                        <p className="font-medium text-white">{assignment.className}</p>
                        <p className="mt-1 text-sm text-slate-400">Period {assignment.period} • {assignment.subject}</p>
                        <p className="mt-2 text-xs text-red-300">Replacement teacher required</p>
                        {teacherSelector(`replacement:${assignment.id}`, assignment.period, assignment.subject, assignment.absentTeacherId, assignment.id)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
                <h3 className="text-lg font-semibold text-white">Lessons With Existing Relief Assignments</h3>
                {existingAssignments.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">No existing assignments found.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {existingAssignments.map((assignment) => {
                      const reliefTeacher = teachers.find((teacher) => teacher.id === assignment.reliefTeacherId)
                      return (
                        <div key={assignment.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                          <p className="font-medium text-white">{assignment.className}</p>
                          <p className="mt-1 text-sm text-slate-400">Period {assignment.period} • {assignment.subject}</p>
                          <p className="mt-2 text-sm text-cyan-300">Assigned to: {reliefTeacher?.name ?? "Unknown teacher"}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-cyan-900 bg-slate-800 p-6">
            <h2 className="text-lg font-semibold text-white">Confirm Unplanned Absence & Relief</h2>
            <p className="mt-2 text-sm text-slate-400">
              The absence will be recorded even when some lessons have no selected substitute.
              Only selected substitutes will receive assignments. Other duties remain pending.
            </p>
            <button
              type="button"
              disabled={saving || !selectedTeacherId || !selectedDate || selectedPeriods.length === 0}
              onClick={() => { void confirmAndSave() }}
              className="mt-4 rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving and verifying..." : "Confirm & Save"}
            </button>
            {saveMessage && (
              <p role="status" className="mt-4 whitespace-pre-line text-sm text-amber-200">{saveMessage}</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
