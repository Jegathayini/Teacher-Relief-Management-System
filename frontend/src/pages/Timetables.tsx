import { useEffect, useState, useRef } from "react"
import type { FormEvent } from "react"
import {
  fetchSchoolConfiguration,
  createTimetable,
  fetchTimetables,
  fetchTeachers,
  deleteTimetable,
  saveFreePeriod,
  fetchTimetableProgress,
  fetchTeacherUnavailabilities,
} from "../services/api"
import type { SchoolClass, TimetableProgress } from "../services/api"
import type {
  Teacher,
  TimetableEntry,
  TeacherUnavailability,
} from "../types"
import { updateTimetablePeriod } from "../services/timetableEditing"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

function Timetables() {
  // Database state
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [databaseEntries, setDatabaseEntries] = useState<TimetableEntry[]>([])
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([])
  const [unavailabilities, setUnavailabilities] = useState<
    TeacherUnavailability[]
  >([])
  const [databaseStatus, setDatabaseStatus] = useState(
    "Checking cloud database..."
  )

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

  // Load school-scoped cloud data
  useEffect(() => {
    let mounted = true

    async function loadDatabaseData() {
      try {
        const [
          timetables,
          databaseTeachers,
          configuration,
          loadedUnavailabilities,
        ] = await Promise.all([
          fetchTimetables(),
          fetchTeachers(),
          fetchSchoolConfiguration(),
          fetchTeacherUnavailabilities(),
        ])

        if (!mounted) return

        setDatabaseEntries(timetables)
        setTeachers(databaseTeachers)
        setSchoolClasses(configuration.classes)
        setUnavailabilities(loadedUnavailabilities)
        setDatabaseStatus("Connected to Supabase")
      } catch (loadError) {
        console.error("Cloud API error:", loadError)
        if (!mounted) return
        setDatabaseStatus("Cloud connection failed")
      }
    }

    void loadDatabaseData()

    return () => {
      mounted = false
    }
  }, [])

  // Derived values
  const currentDay = DAYS[Math.floor(currentStep / 8)]
  const currentPeriod = PERIODS[currentStep % 8]
  const currentLesson = databaseEntries.find(
    (entry) =>
      entry.teacherId === teacherId &&
      entry.day === currentDay &&
      entry.period === currentPeriod
  )

  // A slot is complete if it has a saved lesson OR a saved free-period status.
  // Using a Set prevents the same slot from being counted twice.
  const completedSlots = new Set<string>()
  for (const entry of databaseEntries) {
    if (
      entry.teacherId === teacherId &&
      DAYS.includes(entry.day) &&
      PERIODS.includes(entry.period)
    ) {
      completedSlots.add(`${entry.day}:${entry.period}`)
    }
  }
  for (const item of savedProgress) {
    if (DAYS.includes(item.day) && PERIODS.includes(item.period)) {
      completedSlots.add(`${item.day}:${item.period}`)
    }
  }
  const completedCount = teacherId ? completedSlots.size : 0

  const currentSavedPeriod = currentLesson
    ? { day: currentDay, period: currentPeriod, status: "LESSON" as const }
    : savedProgress.find(
        (item) => item.day === currentDay && item.period === currentPeriod
      )

  const availableClassNames = Array.from(
    new Set([
      ...schoolClasses.map((item) => item.name),
      ...databaseEntries.map((item) => item.className),
    ])
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const activeTeachers = teachers.filter((teacher) => teacher.active)

  const selectedTeacher = teachers.find((teacher) => teacher.id === teacherId)

  const visibleEntries = [...databaseEntries]
    .filter((entry) => filterDay === "All" || entry.day === filterDay)
    .sort((a, b) => {
      const dayDifference = DAYS.indexOf(a.day) - DAYS.indexOf(b.day)
      if (dayDifference !== 0) return dayDifference
      if (a.period !== b.period) return a.period - b.period
      return a.className.localeCompare(b.className, undefined, { numeric: true })
    })

  function getTeacherName(id: string) {
    return (
      teachers.find((teacher) => teacher.id === id)?.name ?? "Unknown Teacher"
    )
  }

  function findClassPeers(
    targetClassName: string,
    targetDay: string,
    targetPeriod: number,
    excludeTeacherId?: string
  ): TimetableEntry[] {
    const normalizedClass = targetClassName.trim().toLowerCase()
    if (!normalizedClass) return []
    return databaseEntries.filter(
      (entry) =>
        entry.day === targetDay &&
        entry.period === targetPeriod &&
        entry.className.trim().toLowerCase() === normalizedClass &&
        entry.teacherId !== excludeTeacherId
    )
  }

  function findWeeklyUnavailability(
    targetTeacherId: string,
    targetDay: string,
    targetPeriod: number
  ): TeacherUnavailability | undefined {
    if (!targetTeacherId) return undefined
    return unavailabilities.find(
      (item) =>
        item.teacherId === targetTeacherId &&
        item.scope === "weekly" &&
        item.day === targetDay &&
        item.periods.includes(targetPeriod)
    )
  }

  function isSplitPeriodEntry(entry: TimetableEntry): boolean {
    return (
      findClassPeers(entry.className, entry.day, entry.period, entry.teacherId)
        .length > 0
    )
  }

  const wizardClassPeers = findClassPeers(
    wizardClass,
    currentDay,
    currentPeriod,
    teacherId
  )
  const manualClassPeers = findClassPeers(className, day, period, teacherId)
  const wizardWeeklyUnavail = findWeeklyUnavailability(
    teacherId,
    currentDay,
    currentPeriod
  )
  const manualWeeklyUnavail = findWeeklyUnavailability(teacherId, day, period)

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
      // Refresh both sources: existing lessons and explicit free periods.
      const [progress, latestEntries] = await Promise.all([
        fetchTimetableProgress(id),
        fetchTimetables(),
      ])
      if (requestId !== progressRequestId.current) return
      setSavedProgress(progress)
      setDatabaseEntries(latestEntries)

      const occupiedSlots = new Set<string>()
      for (const entry of latestEntries) {
        if (entry.teacherId === id) {
          occupiedSlots.add(`${entry.day}:${entry.period}`)
        }
      }
      for (const item of progress) {
        occupiedSlots.add(`${item.day}:${item.period}`)
      }
      const firstIncomplete = Array.from({ length: 40 }, (_, index) => {
        const slotDay = DAYS[Math.floor(index / 8)]
        const slotPeriod = PERIODS[index % 8]
        return occupiedSlots.has(`${slotDay}:${slotPeriod}`)
      }).findIndex((completed) => !completed)

      // Resume at the first incomplete period.
      setCurrentStep(firstIncomplete === -1 ? 39 : firstIncomplete)
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

    if (databaseStatus !== "Connected to Supabase") {
      setError("Connect to Supabase before saving.")
      return
    }

    setError("")
    setSuccess("")
    setIsSaving(true)

    try {
      if (currentLesson) {
        await updateTimetablePeriod({
          teacherId,
          day: currentDay,
          period: currentPeriod,
          status: "FREE",
        })
        setDatabaseEntries((previous) =>
          previous.filter((item) => item.id !== currentLesson.id)
        )
      } else {
        await saveFreePeriod(teacherId, currentDay, currentPeriod)
      }
      setSavedProgress((previous) => [
        ...previous.filter(
          (item) => !(item.day === currentDay && item.period === currentPeriod)
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

      setSuccess(`${currentDay} Period ${currentPeriod} saved as Free.`)

      setCurrentStep((previous) => Math.min(previous + 1, 39))
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

    if (databaseStatus !== "Connected to Supabase") {
      setError("Connect to Supabase before saving.")
      return
    }

    const cleanWizardClass = wizardClass.trim()
    const cleanWizardSubject = wizardSubject.trim()

    if (!cleanWizardSubject || !cleanWizardClass) {
      setError("Please select a subject and enter a class.")
      return
    }

    if (
      !selectedTeacher ||
      !selectedTeacher.active ||
      !selectedTeacher.subjects.includes(cleanWizardSubject)
    ) {
      setError("Please select a valid subject for this teacher.")
      return
    }

    setError("")
    setSuccess("")
    setIsSaving(true)

    try {
      const savedEntry =
        isEditingLesson || currentLesson
          ? (
              await updateTimetablePeriod({
                teacherId,
                className: cleanWizardClass,
                subject: cleanWizardSubject,
                day: currentDay,
                period: currentPeriod,
                status: "LESSON",
              })
            ).entry
          : await createTimetable({
              teacherId,
              className: cleanWizardClass,
              subject: cleanWizardSubject,
              day: currentDay,
              period: currentPeriod,
            })

      setSavedProgress((previous) => [
        ...previous.filter(
          (item) => !(item.day === currentDay && item.period === currentPeriod)
        ),
        {
          day: currentDay,
          period: currentPeriod,
          status: "LESSON",
        },
      ])

      if (savedEntry) {
        setDatabaseEntries((previous) => [
          ...previous.filter((item) => item.id !== savedEntry.id),
          savedEntry,
        ])
      }

      // Refresh from Supabase.
      try {
        setDatabaseEntries(await fetchTimetables())
      } catch (refreshError) {
        console.error("Timetable refresh failed:", refreshError)
      }

      setShowLessonForm(false)
      setIsEditingLesson(false)
      setWizardClass("")

      setSuccess(`${currentDay} Period ${currentPeriod} saved successfully.`)

      setCurrentStep((previous) => Math.min(previous + 1, 39))
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save lesson."
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

    if (databaseStatus !== "Connected to Supabase") {
      setError("Connect to Supabase before adding a timetable entry.")
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

    const exactDuplicate = databaseEntries.some(
      (entry) =>
        entry.day === day &&
        entry.period === period &&
        entry.teacherId === teacherId &&
        entry.className.trim().toLowerCase() === cleanClass.toLowerCase() &&
        entry.subject.trim().toLowerCase() === cleanSubject.toLowerCase()
    )

    if (exactDuplicate) {
      setError("This exact timetable entry already exists.")
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
      setSuccess("Timetable entry saved to Supabase successfully.")
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
        setSavedProgress((previous) =>
          previous.filter(
            (item) => !(item.day === entry.day && item.period === entry.period)
          )
        )
      }

      setSuccess("Timetable entry removed from Supabase successfully.")

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
          Manage weekly lessons, split-class groups, and teacher scheduling
          conflicts.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-cyan-400">
            {databaseStatus}
          </span>

          {databaseStatus === "Connected to Supabase" && (
            <span className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">
              Supabase Timetable Entries: {databaseEntries.length}
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
              onClick={() => {
                void handleTeacherChange(teacher.id)
              }}
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
            <p className="text-sm text-slate-400">Selected Teacher</p>

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

          {wizardWeeklyUnavail && (
            <p className="mt-2 rounded-lg border border-amber-600/50 bg-amber-950/50 p-3 text-sm text-amber-300">
              Weekly Unavailability: {selectedTeacher.name} is marked
              unavailable on {currentDay} Period {currentPeriod}
              {wizardWeeklyUnavail.reason
                ? ` (${wizardWeeklyUnavail.reason})`
                : ""}
              . Consider saving this slot as a Free Period.
            </p>
          )}

          {currentSavedPeriod && (
            <p className="mt-2 text-sm font-medium text-green-400">
              Already saved:{" "}
              {currentSavedPeriod.status === "FREE" ? "Free Period" : "Lesson"}
            </p>
          )}

          {currentLesson && (
            <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900 p-4">
              <p className="font-semibold text-cyan-400">
                Saved Lesson Details
              </p>
              <button
                type="button"
                onClick={handleEditLesson}
                disabled={isSaving || isLoadingProgress}
                className="mt-3 rounded-lg bg-amber-500 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                Edit Lesson
              </button>

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
            Completed: {completedCount} / 40 periods
          </p>

          {/* Actual Timetable Completion Progress */}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full bg-green-400 transition-all duration-300"
              style={{
                width: `${(completedCount / 40) * 100}%`,
              }}
            />
          </div>

          <p className="mt-2 text-right text-sm text-slate-400">
            {Math.round((completedCount / 40) * 100)}% completed
          </p>

          {/* Period Action Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                void handleFreePeriod()
              }}
              disabled={
                isSaving ||
                isLoadingProgress ||
                databaseStatus !== "Connected to Supabase"
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
                    onChange={(event) => setWizardSubject(event.target.value)}
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

                <select
                  id="wizard-class"
                  value={wizardClass}
                  onChange={(event) => setWizardClass(event.target.value)}
                  className="w-full rounded-lg bg-slate-700 p-3 text-white"
                >
                  <option value="">Choose a class</option>
                  {availableClassNames.map((itemName) => (
                    <option key={itemName} value={itemName}>
                      {itemName}
                    </option>
                  ))}
                </select>
              </div>

              {wizardClassPeers.length > 0 && (
                <p className="rounded-lg border border-cyan-700/60 bg-cyan-950/40 p-3 text-xs text-cyan-200">
                  Split Period Notice: {wizardClass} already has{" "}
                  {wizardClassPeers
                    .map(
                      (peer) =>
                        `${peer.subject} (${getTeacherName(peer.teacherId)})`
                    )
                    .join(", ")}{" "}
                  on {currentDay} Period {currentPeriod}. Saving creates a
                  multi-teacher split period.
                </p>
              )}

              {/* Save Lesson Button */}
              <button
                type="button"
                onClick={() => {
                  void handleSaveLesson()
                }}
                disabled={
                  isSaving ||
                  isLoadingProgress ||
                  databaseStatus !== "Connected to Supabase"
                }
                className="rounded-lg bg-cyan-600 px-5 py-3 font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? "Saving..."
                  : isEditingLesson
                    ? "Save Changes"
                    : "Save Lesson"}
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
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
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
              onChange={(event) => {
                void handleTeacherChange(event.target.value)
              }}
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

            <select
              id="manual-class"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              className="w-full rounded-lg bg-slate-700 p-3 text-white"
            >
              <option value="">Choose a class</option>
              {availableClassNames.map((itemName) => (
                <option key={itemName} value={itemName}>
                  {itemName}
                </option>
              ))}
            </select>
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
              onChange={(event) => setSubject(event.target.value)}
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
              onChange={(event) => setPeriod(Number(event.target.value))}
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

        {manualWeeklyUnavail && (
          <p className="rounded-lg border border-amber-600/50 bg-amber-950/50 p-3 text-sm text-amber-300">
            Weekly Unavailability: {getTeacherName(teacherId)} is marked
            unavailable on {day} Period {period}
            {manualWeeklyUnavail.reason
              ? ` (${manualWeeklyUnavail.reason})`
              : ""}
            .
          </p>
        )}

        {manualClassPeers.length > 0 && (
          <p className="rounded-lg border border-cyan-700/60 bg-cyan-950/40 p-3 text-sm text-cyan-200">
            Split Period Notice: {className} already has{" "}
            {manualClassPeers
              .map(
                (peer) => `${peer.subject} (${getTeacherName(peer.teacherId)})`
              )
              .join(", ")}{" "}
            on {day} Period {period}. Adding another teacher/subject creates a
            split period.
          </p>
        )}

        {error && !selectedTeacher && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        {success && !selectedTeacher && (
          <p role="status" className="text-sm text-green-400">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={isSaving || databaseStatus !== "Connected to Supabase"}
          className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Add Timetable Entry"}
        </button>
      </form>

      {/* Weekly Timetable Table */}
      <div className="rounded-xl bg-slate-800 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Weekly Timetable</h2>

          <select
            aria-label="Filter timetable by day"
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
                {visibleEntries.map((entry) => {
                  const split = isSplitPeriodEntry(entry)
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-700 text-white"
                    >
                      <td className="p-3">{entry.day}</td>
                      <td className="p-3">{entry.period}</td>
                      <td className="p-3">
                        <span>{entry.className}</span>
                        {split && (
                          <span className="ml-2 rounded bg-cyan-950 px-2 py-0.5 text-xs text-cyan-300">
                            Split
                          </span>
                        )}
                      </td>
                      <td className="p-3">{entry.subject}</td>
                      <td className="p-3">{getTeacherName(entry.teacherId)}</td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => {
                            void handleDelete(entry.id)
                          }}
                          disabled={
                            deletingId !== null ||
                            isSaving ||
                            databaseStatus !== "Connected to Supabase"
                          }
                          title="Delete Supabase timetable entry"
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deletingId === entry.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default Timetables