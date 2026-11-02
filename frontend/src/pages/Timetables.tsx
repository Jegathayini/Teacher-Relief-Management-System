
import { useEffect, useState, useRef } from "react"
import type { FormEvent } from "react"
import type { TimetableProgress } from "../services/api"
import {
  createTimetable,
  fetchTimetables,
  fetchTeachers,
  deleteTimetable,
  saveFreePeriod,
  fetchTimetableProgress,
} from "../services/api"

import type { Teacher, TimetableEntry } from "../types"
import { updateTimetablePeriod } from "../services/timetableEditing"

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
]

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

function Timetables() {
  // Database state
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [databaseEntries, setDatabaseEntries] = useState<TimetableEntry[]>([])
  const [databaseStatus, setDatabaseStatus] = useState("Checking SQLite...")

  // Selected teacher
  const [teacherId, setTeacherId] = useState("")

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0)
  const [savedProgress, setSavedProgress] = useState<TimetableProgress[]>([])
const [isLoadingProgress, setIsLoadingProgress] = useState(false)
const progressRequestId = useRef(0)
  const [showLessonForm, setShowLessonForm] = useState(false)
  const [isEditingLesson, setIsEditingLesson] = useState(false)
  const [wizardClass, setWizardClass] = useState("")
  const [wizardSubject, setWizardSubject] = useState("")

  // Manual entry form
  const [className, setClassName] = useState("")
  const [subject, setSubject] = useState("")
  const [day, setDay] = useState("Monday")
  const [period, setPeriod] = useState(1)

  // Interface state
  const [filterDay, setFilterDay] = useState("All")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Load SQLite data
  useEffect(() => {
    async function loadDatabaseData() {
      try {
        const [timetables, databaseTeachers] = await Promise.all([
          fetchTimetables(),
          fetchTeachers(),
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

  // Derived values
  const currentDay = DAYS[Math.floor(currentStep / 8)]
  const currentPeriod = PERIODS[currentStep % 8]
  const currentSavedPeriod = savedProgress.find(
  (item) =>
    item.day === currentDay &&
    item.period === currentPeriod
)
const currentLesson = databaseEntries.find(
  (entry) =>
    entry.teacherId === teacherId &&
    entry.day === currentDay &&
    entry.period === currentPeriod
)
  const activeTeachers = teachers.filter((teacher) => teacher.active)

  const selectedTeacher = teachers.find(
    (teacher) => teacher.id === teacherId
  )

  const visibleEntries = [...databaseEntries]
    .filter((entry) => filterDay === "All" || entry.day === filterDay)
    .sort((a, b) => {
      const dayDifference =
        DAYS.indexOf(a.day) - DAYS.indexOf(b.day)

      return dayDifference !== 0
        ? dayDifference
        : a.period - b.period
    })

  function getTeacherName(id: string) {
    return (
      teachers.find((teacher) => teacher.id === id)?.name ??
      "Unknown Teacher"
    )
  }

  // Teacher selection
  
  // Teacher selection and resume saved progress
  async function handleTeacherChange(id: string) {
    const requestId = ++progressRequestId.current
    const teacher = teachers.find((item) => item.id === id)

    setTeacherId(id)
    setCurrentStep(0)
    setShowLessonForm(false)
    setIsEditingLesson(false)
    setWizardClass("")
    setWizardSubject(teacher?.subjects[0] ?? "")
    setSubject(teacher?.subjects[0] ?? "")
    setSavedProgress([])
    setError("")
    setSuccess("")

    if (!id) {
  setIsLoadingProgress(false)
  return
}

    setIsLoadingProgress(true)

    try {
      const progress = await fetchTimetableProgress(id)
      if (requestId !== progressRequestId.current) return
      setSavedProgress(progress)

      // Find the first incomplete period among 40 periods.
      const firstIncomplete = Array.from(
        { length: 40 },
        (_, index) => {
          const day = DAYS[Math.floor(index / 8)]
          const period = PERIODS[index % 8]

          return progress.some(
            (item) =>
              item.day === day &&
              item.period === period
          )
        }
      ).findIndex((completed) => !completed)

      // Resume at the first incomplete period.
      setCurrentStep(
        firstIncomplete === -1 ? 39 : firstIncomplete
      )
    
} catch (loadError) {
  // Ignore errors from an outdated teacher request.
  if (requestId !== progressRequestId.current) return

  setError(
    loadError instanceof Error
      ? loadError.message
      : "Failed to load teacher progress."
  )
} finally {
  // Only the latest request can stop the loading state.
  if (requestId === progressRequestId.current) {
    setIsLoadingProgress(false)
  }
}

  }


  // Wizard navigation
  function handleNext() {
    setCurrentStep((previous) => Math.min(previous + 1, 39))
    setShowLessonForm(false)
    setIsEditingLesson(false)
    setWizardClass("")
    setError("")
    setSuccess("")
  }

  function handlePrevious() {
    setCurrentStep((previous) => Math.max(previous - 1, 0))
    setShowLessonForm(false)
    setIsEditingLesson(false)
    setWizardClass("")
    setError("")
    setSuccess("")
  }

  function handleEditLesson() {
  if (!currentLesson) return

  setWizardSubject(currentLesson.subject)
  setWizardClass(currentLesson.className)

  setIsEditingLesson(true)
  setShowLessonForm(true)

  setError("")
  setSuccess("")
}

  // Save Free Period
  async function handleFreePeriod() {
    if (!teacherId || isSaving) return

    if (databaseStatus !== "Connected to SQLite") {
      setError("Connect to SQLite before saving.")
      return
    }

    setError("")
    setSuccess("")
    setIsSaving(true)

    try {
      if (currentLesson) {
        await updateTimetablePeriod({
          teacherId, day: currentDay, period: currentPeriod, status: "FREE",
        })
        setDatabaseEntries((previous) => previous.filter((item) => item.id !== currentLesson.id))
      } else {
        await saveFreePeriod(teacherId, currentDay, currentPeriod)
      }
      setSavedProgress((previous) => [
  ...previous.filter(
    (item) =>
      !(item.day === currentDay && item.period === currentPeriod)
  ),
  {
    day: currentDay,
    period: currentPeriod,
    status: "FREE",
  },
])

      setShowLessonForm(false)
      setIsEditingLesson(false)
      setWizardClass("")

      setSuccess(
        `${currentDay} Period ${currentPeriod} saved as Free.`
      )

      setCurrentStep((previous) =>
        Math.min(previous + 1, 39)
      )
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save free period."
      )
    } finally {
      setIsSaving(false)
    }
  }

  // Save Wizard Lesson
  async function handleSaveLesson() {
    if (!teacherId || isSaving) return

    if (databaseStatus !== "Connected to SQLite") {
      setError("Connect to SQLite before saving.")
      return
    }

    if (!wizardSubject.trim() || !wizardClass.trim()) {
      setError("Please select a subject and enter a class.")
      return
    }

    if (
      !selectedTeacher ||
      !selectedTeacher.active ||
      !selectedTeacher.subjects.includes(wizardSubject)
    ) {
      setError("Please select a valid subject for this teacher.")
      return
    }

    setError("")
    setSuccess("")
    setIsSaving(true)

    try {
      const savedEntry = isEditingLesson || currentLesson
        ? (await updateTimetablePeriod({
            teacherId,
            className: wizardClass.trim(),
            subject: wizardSubject.trim(),
            day: currentDay,
            period: currentPeriod,
            status: "LESSON",
          })).entry!
        : await createTimetable({
            teacherId,
            className: wizardClass.trim(),
            subject: wizardSubject.trim(),
            day: currentDay,
            period: currentPeriod,
          })
      setSavedProgress((previous) => [
  ...previous.filter(
    (item) =>
      !(item.day === currentDay && item.period === currentPeriod)
  ),
  {
    day: currentDay,
    period: currentPeriod,
    status: "LESSON",
  },
])

      // Update the table immediately.
      setDatabaseEntries((previous) => [
        ...previous.filter((item) => item.id !== savedEntry.id), savedEntry,
      ])

      // Refresh from SQLite.
      try {
        setDatabaseEntries(await fetchTimetables())
      } catch (refreshError) {
        console.error("Timetable refresh failed:", refreshError)
      }

      setShowLessonForm(false)
      setIsEditingLesson(false)
      setWizardClass("")

      setSuccess(
        `${currentDay} Period ${currentPeriod} saved successfully.`
      )

      setCurrentStep((previous) =>
        Math.min(previous + 1, 39)
      )
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save lesson."
      )
    } finally {
      setIsSaving(false)
    }
  }

  // Manual timetable entry
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

    if (!selectedTeacher || !selectedTeacher.active) {
      setError("Please select an active teacher.")
      return
    }

    if (!selectedTeacher.subjects.includes(cleanSubject)) {
      setError("The selected teacher does not teach this subject.")
      return
    }

    const teacherConflict = databaseEntries.some(
      (entry) =>
        entry.day === day &&
        entry.period === period &&
        entry.teacherId === teacherId
    )

    if (teacherConflict) {
      setError("This teacher already has a class during that period.")
      return
    }

    const classConflict = databaseEntries.some(
      (entry) =>
        entry.day === day &&
        entry.period === period &&
        entry.className.trim().toLowerCase() ===
          cleanClass.toLowerCase()
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
        period,
      })

      setDatabaseEntries((previous) => [...previous, savedEntry])

      try {
        setDatabaseEntries(await fetchTimetables())
      } catch (refreshError) {
        console.error("Timetable refresh failed:", refreshError)
      }

      setClassName("")
      if (savedEntry.teacherId === teacherId) {
        setSavedProgress((previous) => [
          ...previous.filter((item) => !(item.day === day && item.period === period)),
          { day, period, status: "LESSON" },
        ])
      }
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

  // Delete timetable entry
  async function handleDelete(id: string) {
    if (deletingId !== null) return

    const entry = databaseEntries.find((item) => item.id === id)
    if (!entry) return

    if (
      !window.confirm(
        `Delete ${entry.className}, ${entry.day}, Period ${entry.period}?`
      )
    ) {
      return
    }

    setError("")
    setSuccess("")
    setDeletingId(id)

    try {
      await deleteTimetable(id)

      setDatabaseEntries((previous) =>
        previous.filter((item) => item.id !== id)
      )
      if (entry.teacherId === teacherId) {
        setSavedProgress((previous) => previous.filter(
          (item) => !(item.day === entry.day && item.period === entry.period)
        ))
      }

      setSuccess("Timetable entry removed from SQLite successfully.")

      try {
        setDatabaseEntries(await fetchTimetables())
      } catch (refreshError) {
        console.error("Timetable refresh failed:", refreshError)
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete timetable entry."
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="space-y-6">
      {/* Page Heading */}
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

      {/* Teacher Selection */}
      <div className="rounded-xl bg-slate-800 p-6">
        <h2 className="mb-2 text-lg font-semibold text-white">
          Select a Teacher
        </h2>

        <p className="mb-5 text-sm text-slate-400">
          Choose a teacher to manage their weekly timetable.
        </p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {activeTeachers.map((teacher) => (
            <button
              key={teacher.id}
              type="button"
              onClick={() => handleTeacherChange(teacher.id)}
              disabled={isSaving}
              className={`rounded-xl border p-4 text-left transition disabled:opacity-50 ${
                teacherId === teacher.id
                  ? "border-cyan-400 bg-cyan-950 text-cyan-300"
                  : "border-slate-700 bg-slate-900 text-white hover:border-cyan-500"
              }`}
            >
              <p className="font-semibold">{teacher.name}</p>

              <p className="mt-2 text-xs text-slate-400">
                {teacher.subjects.join(", ")}
              </p>
            </button>
          ))}
        </div>

        {selectedTeacher && (
          <div className="mt-5 rounded-lg border border-cyan-700 bg-slate-900 p-4">
            <p className="text-sm text-slate-400">
              Selected Teacher
            </p>

            <p className="mt-1 font-semibold text-cyan-400">
              {selectedTeacher.name}
            </p>

            <p className="mt-1 text-sm text-slate-300">
              Subjects: {selectedTeacher.subjects.join(", ")}
            </p>
          </div>
        )}
      </div>

      {/* Teacher Timetable Wizard */}
      {selectedTeacher && (
        <div className="rounded-xl bg-slate-800 p-6">
          <h2 className="text-xl font-bold text-cyan-400">
            {selectedTeacher.name}'s Timetable
          </h2>

          <p className="mt-3 text-lg text-white">
            {currentDay} — Period {currentPeriod}
          </p>
          {currentSavedPeriod && (
  <p className="mt-2 text-sm font-medium text-green-400">
    Already saved:{" "}
    {currentSavedPeriod.status === "FREE"
      ? "Free Period"
      : "Lesson"}
  </p>
)}
{currentLesson && (
  <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900 p-4">
    <p className="font-semibold text-cyan-400">
      Saved Lesson Details
    </p>
    {currentLesson && (
  <button
    type="button"
    onClick={handleEditLesson}
    disabled={isSaving || isLoadingProgress}
    className="mt-3 rounded-lg bg-amber-500 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
  >
    Edit Lesson
  </button>
)}

    <p className="mt-2 text-sm text-white">
      Subject: {currentLesson.subject}
    </p>

    <p className="mt-1 text-sm text-white">
      Class: {currentLesson.className}
    </p>
  </div>
)}

          <p className="mt-1 text-sm text-slate-400">
            Step {currentStep + 1} of 40
          </p>
          <p className="mt-2 text-sm text-green-400">
  Completed: {savedProgress.length} / 40 periods
</p>

          {/* Navigation Progress Bar */}
          
{/* Actual Timetable Completion Progress */}
<div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-700">
  <div
    className="h-full bg-green-400 transition-all duration-300"
    style={{
      width: `${(savedProgress.length / 40) * 100}%`,
    }}
  />
</div>

<p className="mt-2 text-right text-sm text-slate-400">
  {Math.round((savedProgress.length / 40) * 100)}% completed
</p>


          {/* Period Action Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleFreePeriod}
              disabled={
                isSaving || isLoadingProgress ||
                databaseStatus !== "Connected to SQLite"
              }
              className="rounded-lg border border-slate-600 bg-slate-700 p-4 font-semibold text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Free Period"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowLessonForm(true)
                setIsEditingLesson(false)
                setWizardClass("")
                setError("")
                setSuccess("")

                setWizardSubject(
                  selectedTeacher.subjects.length === 1
                    ? selectedTeacher.subjects[0]
                    : ""
                )
              }}
              disabled={isSaving || isLoadingProgress}
              className="rounded-lg bg-cyan-500 p-4 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              Add Subject
            </button>
          </div>

          {/* Wizard Lesson Form */}
{showLessonForm && (
  <div className="mt-5 space-y-4 rounded-lg bg-slate-900 p-4">

    <h3 className="font-semibold text-white">
      {isEditingLesson ? "Edit Existing Lesson" : "Add New Lesson"}
    </h3>

    {selectedTeacher.subjects.length > 1 ? (
                <div>
                  <label
                    htmlFor="wizard-subject"
                    className="mb-2 block text-sm text-slate-300"
                  >
                    Select Subject
                  </label>

                  <select
                    id="wizard-subject"
                    value={wizardSubject}
                    onChange={(event) =>
                      setWizardSubject(event.target.value)
                    }
                    className="w-full rounded-lg bg-slate-700 p-3 text-white"
                  >
                    <option value="">Choose a subject</option>

                    {selectedTeacher.subjects.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-sm text-cyan-400">
                  Subject: {selectedTeacher.subjects[0]}
                </p>
              )}

              <div>
                <label
                  htmlFor="wizard-class"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Class
                </label>

                <input
                  id="wizard-class"
                  type="text"
                  value={wizardClass}
                  onChange={(event) =>
                    setWizardClass(event.target.value)
                  }
                  placeholder="e.g. Grade 8A"
                  className="w-full rounded-lg bg-slate-700 p-3 text-white"
                />
              </div>

              {/* Save Lesson Button */}
              <button
                type="button"
                onClick={handleSaveLesson}
                disabled={
                  isSaving || isLoadingProgress ||
                  databaseStatus !== "Connected to SQLite"
                }
                className="rounded-lg bg-cyan-600 px-5 py-3 font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving..." : isEditingLesson ? "Save Changes" : "Save Lesson"}
              </button>
            </div>
          )}

          {/* Messages */}
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-400">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="mt-4 text-sm text-green-400">
              {success}
            </p>
          )}

          {/* Wizard Navigation */}
          <div className="mt-6 flex justify-between gap-3">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentStep === 0 || isSaving}
              className="rounded-lg bg-slate-700 px-5 py-3 text-white disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={currentStep === 39 || isSaving}
              className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Manual Timetable Entry */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl bg-slate-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white">
          Add Timetable Entry
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="manual-teacher"
              className="mb-2 block text-sm text-slate-300"
            >
              Teacher
            </label>

            <select
              id="manual-teacher"
              value={teacherId}
              onChange={(event) =>
                handleTeacherChange(event.target.value)
              }
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            >
              <option value="">Select teacher</option>

              {activeTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="manual-class"
              className="mb-2 block text-sm text-slate-300"
            >
              Class
            </label>

            <input
              id="manual-class"
              type="text"
              value={className}
              onChange={(event) =>
                setClassName(event.target.value)
              }
              placeholder="e.g. Grade 8A"
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            />
          </div>

          <div>
            <label
              htmlFor="manual-subject"
              className="mb-2 block text-sm text-slate-300"
            >
              Subject
            </label>

            <select
              id="manual-subject"
              value={subject}
              onChange={(event) =>
                setSubject(event.target.value)
              }
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            >
              <option value="">Select subject</option>

              {selectedTeacher?.subjects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="manual-day"
              className="mb-2 block text-sm text-slate-300"
            >
              Day
            </label>

            <select
              id="manual-day"
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
            <label
              htmlFor="manual-period"
              className="mb-2 block text-sm text-slate-300"
            >
              Period
            </label>

            <select
              id="manual-period"
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

        <button
          type="submit"
          disabled={
            isSaving ||
            databaseStatus !== "Connected to SQLite"
          }
          className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Add Timetable Entry"}
        </button>
      </form>

      {/* Weekly Timetable Table */}
      <div className="rounded-xl bg-slate-800 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">
            Weekly Timetable
          </h2>

          <select
            aria-label="Filter timetable by day"
            value={filterDay}
            onChange={(event) =>
              setFilterDay(event.target.value)
            }
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
                        disabled={
                          deletingId !== null ||
                          isSaving ||
                          databaseStatus !== "Connected to SQLite"
                        }
                        title="Delete SQLite timetable entry"
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {deletingId === entry.id
                          ? "Deleting..."
                          : "Delete"}
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
