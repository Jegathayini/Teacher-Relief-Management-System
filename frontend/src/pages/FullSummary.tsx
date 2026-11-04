
import { useEffect, useMemo, useState } from "react"
import type {
  Teacher,
  Absence,
  ReliefAssignment,
} from "../types"
import {
  fetchCloudTeachers,
  fetchAbsences,
  fetchReliefAssignments,
  fetchSchoolReliefCounts,
  fetchAcademicYear,
} from "../services/api"
import { printTeacherReport } from "../utils/printTeacherReport"
type SummaryData = {
  teachers: Teacher[]
  absences: Absence[]
  reliefs: ReliefAssignment[]
  lifetimeCounts: Record<string, number>
  academicYear: number
}

type Tab = "teachers" | "absences" | "reliefs" | "counts"

const tabs: { id: Tab; label: string }[] = [
  { id: "teachers", label: "Teachers" },
  { id: "absences", label: "Absence Records" },
  { id: "reliefs", label: "Relief Records" },
  { id: "counts", label: "Relief Counts" },
]

function SummaryCard({
  title,
  value,
}: {
  title: string
  value: number
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-bold text-cyan-400">
        {value.toLocaleString()}
      </p>
    </div>
  )
}

export default function FullSummary() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<Tab>("teachers")
  const [search, setSearch] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [reportYear, setReportYear] = useState(
  new Date().getFullYear()
)

const [reportMonth, setReportMonth] = useState(
  new Date().getMonth() === 0
    ? 12
    : new Date().getMonth()
)
  useEffect(() => {
    let active = true

    async function loadSummary() {
      setLoading(true)
      setError("")

      try {
        const [
          teachers,
          absences,
          reliefs,
          lifetimeCounts,
          academicYear,
        ] = await Promise.all([
          fetchCloudTeachers(),
          fetchAbsences(),
          fetchReliefAssignments(),
          fetchSchoolReliefCounts(),
          fetchAcademicYear(),
        ])

        if (!active) return

        setData({
          teachers,
          absences,
          reliefs,
          lifetimeCounts,
          academicYear: academicYear.year,
        })
      } catch (err) {
        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load school summary."
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSummary()

    return () => {
      active = false
    }
  }, [refreshKey])

  const teacherNames = useMemo(() => {
    const names = new Map<string, string>()

    for (const teacher of data?.teachers ?? []) {
      names.set(teacher.id, teacher.name)
    }

    return names
  }, [data])

  function teacherName(id: string) {
    return teacherNames.get(id) ?? "Unknown teacher"
  }

  const lifetimeTotal = Object.values(
    data?.lifetimeCounts ?? {}
  ).reduce((sum, count) => sum + count, 0)

  const query = search.trim().toLowerCase()

  const filteredTeachers = (data?.teachers ?? []).filter(
    teacher =>
      `${teacher.name} ${teacher.subjects.join(" ")}`
        .toLowerCase()
        .includes(query)
  )

  const filteredAbsences = (data?.absences ?? []).filter(
    absence =>
      `${teacherName(absence.teacherId)} ${absence.date} ${absence.reason}`
        .toLowerCase()
        .includes(query)
  )

  const filteredReliefs = (data?.reliefs ?? []).filter(
    relief =>
      `${relief.date} ${relief.className} ${relief.subject} ${teacherName(relief.absentTeacherId)} ${teacherName(relief.reliefTeacherId)}`
        .toLowerCase()
        .includes(query)
  )

  const filteredCounts = [...(data?.teachers ?? [])]
    .filter(teacher =>
      teacher.name.toLowerCase().includes(query)
    )
    .sort(
      (a, b) =>
        (data?.lifetimeCounts[b.id] ?? 0) -
        (data?.lifetimeCounts[a.id] ?? 0)
    )

  const cellClass = "px-4 py-3 text-sm text-slate-300"
  const headClass =
    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
function handlePrintReport(type: "monthly" | "annual") {
  if (!data) return

  printTeacherReport({
    type,
    year: reportYear,
    month: reportMonth,
    teachers: data.teachers,
    absences: data.absences,
    reliefs: data.reliefs,
    lifetimeCounts: data.lifetimeCounts,
  })
}
  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Full School Summary
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Teacher records, absence history, relief assignments,
            and lifetime relief statistics.
          </p>

          {data && (
            <p className="mt-2 text-xs text-cyan-400">
              Current Academic Year: {data.academicYear}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey(value => value + 1)}
          disabled={loading}
          className="rounded-lg border border-cyan-500/50 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
        >
          Refresh Data
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate-400">
          Loading school records...
        </p>
      )}

      {data && !loading && (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <SummaryCard
              title="Total Teachers"
              value={data.teachers.length}
            />

            <SummaryCard
              title="Absence Records"
              value={data.absences.length}
            />

            <SummaryCard
              title="Relief Records"
              value={data.reliefs.length}
            />

            <SummaryCard
              title="Lifetime Reliefs"
              value={lifetimeTotal}
            />
          </div>
            
{/* Report Printing */}
<section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
  <h2 className="text-lg font-semibold text-white">
    Print School Reports
  </h2>

  <p className="mt-1 text-sm text-slate-400">
    Generate monthly or annual teacher summaries for
    school administration.
  </p>

  <div className="mt-5 flex flex-wrap items-end gap-4">
    <div>
      <label
        htmlFor="report-year"
        className="mb-2 block text-sm text-slate-300"
      >
        Year
      </label>

      <input
        id="report-year"
        type="number"
        min="2020"
        max={new Date().getFullYear()}
        value={reportYear}
        onChange={event =>
          setReportYear(Number(event.target.value))
        }
        className="w-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
      />
    </div>

    <div>
      <label
        htmlFor="report-month"
        className="mb-2 block text-sm text-slate-300"
      >
        Month
      </label>

      <select
        id="report-month"
        value={reportMonth}
        onChange={event =>
          setReportMonth(Number(event.target.value))
        }
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
      >
        {[
          "January", "February", "March", "April",
          "May", "June", "July", "August",
          "September", "October", "November", "December",
        ].map((month, index) => (
          <option key={month} value={index + 1}>
            {month}
          </option>
        ))}
      </select>
    </div>

    <button
      type="button"
      onClick={() => handlePrintReport("monthly")}
      className="rounded-lg bg-cyan-500 px-5 py-2 font-semibold text-slate-950 hover:bg-cyan-400"
    >
      🖨 Print Monthly Report
    </button>

    <button
      type="button"
      onClick={() => handlePrintReport("annual")}
      className="rounded-lg border border-cyan-500 px-5 py-2 font-semibold text-cyan-300 hover:bg-cyan-500/10"
    >
      🖨 Print Annual Report
    </button>
  </div>
</section>

          {/* Detailed Tables */}
          <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
            <div className="border-b border-slate-700 p-5">
              <h2 className="text-lg font-semibold text-white">
                Detailed School Records
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Read-only information from your school database.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {tabs.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id)
                      setSearch("")
                    }}
                    className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                      tab === item.id
                        ? "bg-cyan-500 font-semibold text-slate-950"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search records..."
                aria-label="Search school records"
                className="mt-5 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead className="bg-slate-800/70">
                  <tr>
                    {tab === "teachers" && (
                      <>
                        <th className={headClass}>Teacher</th>
                        <th className={headClass}>Subjects</th>
                        <th className={headClass}>Status</th>
                        <th className={headClass}>Lifetime Reliefs</th>
                      </>
                    )}

                    {tab === "absences" && (
                      <>
                        <th className={headClass}>Date</th>
                        <th className={headClass}>Absent Teacher</th>
                        <th className={headClass}>Reason</th>
                      </>
                    )}

                    {tab === "reliefs" && (
                      <>
                        <th className={headClass}>Date</th>
                        <th className={headClass}>Period</th>
                        <th className={headClass}>Class</th>
                        <th className={headClass}>Absent Teacher</th>
                        <th className={headClass}>Relief Teacher</th>
                        <th className={headClass}>Subject</th>
                      </>
                    )}

                    {tab === "counts" && (
                      <>
                        <th className={headClass}>Teacher</th>
                        <th className={headClass}>Status</th>
                        <th className={headClass}>Lifetime Relief Count</th>
                      </>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {tab === "teachers" &&
                    filteredTeachers.map(teacher => (
                      <tr key={teacher.id} className="hover:bg-slate-800/40">
                        <td className={cellClass}>{teacher.name}</td>
                        <td className={cellClass}>
                          {teacher.subjects.join(", ") || "—"}
                        </td>
                        <td className={cellClass}>
                          {teacher.active ? "Active" : "Inactive"}
                        </td>
                        <td className={cellClass}>
                          {data.lifetimeCounts[teacher.id] ?? 0}
                        </td>
                      </tr>
                    ))}

                  {tab === "absences" &&
                    filteredAbsences.map(absence => (
                      <tr key={absence.id} className="hover:bg-slate-800/40">
                        <td className={cellClass}>{absence.date}</td>
                        <td className={cellClass}>
                          {teacherName(absence.teacherId)}
                        </td>
                        <td className={cellClass}>
                          {absence.reason || "—"}
                        </td>
                      </tr>
                    ))}

                  {tab === "reliefs" &&
                    filteredReliefs.map(relief => (
                      <tr key={relief.id} className="hover:bg-slate-800/40">
                        <td className={cellClass}>{relief.date}</td>
                        <td className={cellClass}>{relief.period}</td>
                        <td className={cellClass}>{relief.className}</td>
                        <td className={cellClass}>
                          {teacherName(relief.absentTeacherId)}
                        </td>
                        <td className={cellClass}>
                          {teacherName(relief.reliefTeacherId)}
                        </td>
                        <td className={cellClass}>{relief.subject}</td>
                      </tr>
                    ))}

                  {tab === "counts" &&
                    filteredCounts.map(teacher => (
                      <tr key={teacher.id} className="hover:bg-slate-800/40">
                        <td className={cellClass}>{teacher.name}</td>
                        <td className={cellClass}>
                          {teacher.active ? "Active" : "Inactive"}
                        </td>
                        <td className={cellClass}>
                          <span className="font-bold text-cyan-400">
                            {data.lifetimeCounts[teacher.id] ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-700 px-5 py-4 text-xs text-slate-400">
              {tab === "teachers" &&
                `${filteredTeachers.length} teacher records`}
              {tab === "absences" &&
                `${filteredAbsences.length} absence records`}
              {tab === "reliefs" &&
                `${filteredReliefs.length} relief records`}
              {tab === "counts" &&
                `${filteredCounts.length} teachers`}
            </div>
          </section>

          <p className="text-xs leading-5 text-slate-500">
            Lifetime relief counts are retrieved separately from
            the academic-year records and are intended to remain
            cumulative across academic-year rollovers.
          </p>
        </>
      )}
    </div>
  )
}
