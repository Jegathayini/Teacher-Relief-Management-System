
import { useState } from "react"
import type {
  Teacher,
  TimetableEntry,
  Absence,
  ReliefAssignment
} from "../types"

import {
  getTeachers,
  getTimetables,
  getAbsences,
  getReliefAssignments
} from "../utils/storage"

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

function Dashboard() {
  const [teachers] = useState<Teacher[]>(getTeachers)
  const [timetables] = useState<TimetableEntry[]>(getTimetables)
  const [absences] = useState<Absence[]>(getAbsences)
  const [assignments] =
    useState<ReliefAssignment[]>(getReliefAssignments)

  const [date, setDate] = useState(getToday)

  const dayName = getDayName(date)

  const dailyAbsences = absences.filter(
    (absence) => absence.date === date
  )

  const dailyAssignments = assignments.filter(
    (assignment) => assignment.date === date
  )

  const absentIds = new Set(
    dailyAbsences.map((absence) => absence.teacherId)
  )

  const affectedLessons = timetables.filter(
    (entry) =>
      entry.day === dayName &&
      absentIds.has(entry.teacherId)
  )

  const assignedLessons = affectedLessons.filter(
    (entry) =>
      dailyAssignments.some(
        (assignment) =>
          assignment.period === entry.period &&
          assignment.className === entry.className &&
          assignment.absentTeacherId === entry.teacherId
      )
  )

  const pendingLessons =
    affectedLessons.length - assignedLessons.length

  const activeTeachers = teachers.filter(
    (teacher) => teacher.active
  ).length

  function getTeacherName(id: string): string {
    return teachers.find((teacher) => teacher.id === id)?.name
      ?? "Unknown Teacher"
  }

  const summaryCards = [
    {
      title: "Active Teachers",
      value: activeTeachers,
      color: "text-cyan-400"
    },
    {
      title: "Absent Teachers",
      value: dailyAbsences.length,
      color: "text-red-400"
    },
    {
      title: "Relief Assigned",
      value: assignedLessons.length,
      color: "text-green-400"
    },
    {
      title: "Pending Relief",
      value: pendingLessons,
      color: "text-amber-400"
    }
  ]

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cyan-400">
            Dashboard Overview
          </h1>
          <p className="mt-1 text-slate-400">
            Monitor daily teacher availability and relief coverage.
          </p>
        </div>

        <div>
          <label
            htmlFor="dashboard-date"
            className="mb-2 block text-sm text-slate-300"
          >
            Select Date
          </label>
          <input
            id="dashboard-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg bg-slate-700 p-3 text-white"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-slate-700 bg-slate-800 p-6"
          >
            <p className="text-sm text-slate-400">
              {card.title}
            </p>
            <p
              className={`mt-3 text-4xl font-bold ${card.color}`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-slate-800 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Absent Teachers — {date}
          </h2>

          {dailyAbsences.length === 0 ? (
            <p className="text-sm text-slate-400">
              No absences recorded for this date.
            </p>
          ) : (
            <div className="space-y-3">
              {dailyAbsences.map((absence) => (
                <div
                  key={absence.id}
                  className="rounded-lg bg-slate-700 p-4"
                >
                  <p className="font-semibold text-white">
                    {getTeacherName(absence.teacherId)}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {absence.reason || "No reason specified"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-slate-800 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Relief Assignments — {date}
          </h2>

          {dailyAssignments.length === 0 ? (
            <p className="text-sm text-slate-400">
              No relief assignments recorded for this date.
            </p>
          ) : (
            <div className="space-y-3">
              {dailyAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg bg-slate-700 p-4"
                >
                  <p className="font-semibold text-white">
                    {assignment.className} — Period {assignment.period}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {getTeacherName(assignment.reliefTeacherId)}
                    {" "}replaces{" "}
                    {getTeacherName(assignment.absentTeacherId)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-slate-800 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Lessons Needing Relief
        </h2>

        {affectedLessons.length === 0 ? (
          <p className="text-sm text-slate-400">
            No lessons require relief for this date.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-600 text-slate-300">
                <tr>
                  <th className="p-3">Period</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Absent Teacher</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {affectedLessons
                  .sort((a, b) => a.period - b.period)
                  .map((entry) => {
                    const assigned = assignedLessons.some(
                      (lesson) => lesson.id === entry.id
                    )

                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-slate-700 text-white"
                      >
                        <td className="p-3">{entry.period}</td>
                        <td className="p-3">{entry.className}</td>
                        <td className="p-3">{entry.subject}</td>
                        <td className="p-3">
                          {getTeacherName(entry.teacherId)}
                        </td>
                        <td className="p-3">
                          <span
                            className={
                              assigned
                                ? "text-green-400"
                                : "text-amber-400"
                            }
                          >
                            {assigned ? "Assigned" : "Pending"}
                          </span>
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

export default Dashboard
