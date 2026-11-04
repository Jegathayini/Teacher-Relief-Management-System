
import type {
  Teacher,
  Absence,
  ReliefAssignment,
} from "../types"

export type ReportType = "monthly" | "annual"

export type TeacherReportInput = {
  type: ReportType
  year: number
  month?: number
  teachers: Teacher[]
  absences: Absence[]
  reliefs: ReliefAssignment[]
  lifetimeCounts: Record<string, number>
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, char => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }
    return entities[char]
  })
}

export function printTeacherReport(input: TeacherReportInput) {
  const {
    type,
    year,
    month,
    teachers,
    absences,
    reliefs,
    lifetimeCounts,
  } = input

  const monthName =
    month !== undefined
      ? new Date(year, month - 1, 1).toLocaleString(
          "en-US",
          { month: "long" }
        )
      : ""

  const periodLabel =
    type === "monthly"
      ? `${monthName} ${year}`
      : `Academic Year ${year}`

  function belongsToPeriod(date: string) {
    const dateYear = Number(date.slice(0, 4))
    const dateMonth = Number(date.slice(5, 7))

    return (
      dateYear === year &&
      (type === "annual" || dateMonth === month)
    )
  }

  const periodAbsences = absences.filter(a =>
    belongsToPeriod(a.date)
  )

  const periodReliefs = reliefs.filter(r =>
    belongsToPeriod(r.date)
  )

  const rows = [...teachers]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((teacher, index) => {
      const absentDates = new Set(
        periodAbsences
          .filter(a => a.teacherId === teacher.id)
          .map(a => a.date)
      )

      const reliefCount = periodReliefs.filter(
        r => r.reliefTeacherId === teacher.id
      ).length

      return {
        number: index + 1,
        name: teacher.name,
        subjects: teacher.subjects.join(", ") || "—",
        absentDays: absentDates.size,
        reliefCount,
        lifetime: lifetimeCounts[teacher.id] ?? 0,
      }
    })

  const totalAbsences = rows.reduce(
    (sum, row) => sum + row.absentDays,
    0
  )

  const totalReliefs = periodReliefs.length

  const tableRows = rows
    .map(row => `
      <tr>
        <td>${row.number}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.subjects)}</td>
        <td class="number">${row.absentDays}</td>
        <td class="number">${row.reliefCount}</td>
        <td class="number">${row.lifetime}</td>
      </tr>
    `)
    .join("")

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ReliefMS - ${escapeHtml(periodLabel)} Report</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 14mm;
    }

    body {
      font-family: Arial, sans-serif;
      color: #111827;
      font-size: 11px;
      line-height: 1.5;
    }

    h1, h2, p {
      margin: 0;
    }

    header {
      text-align: center;
      border-bottom: 2px solid #111827;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }

    header h1 {
      font-size: 20px;
    }

    header h2 {
      font-size: 15px;
      margin-top: 5px;
    }

    header p {
      margin-top: 5px;
      color: #475569;
    }

    .stats {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }

    .stat {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }

    .stat strong {
      display: block;
      font-size: 22px;
    }

    .stat span {
      color: #475569;
    }

    h3 {
      font-size: 14px;
      margin-bottom: 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      border: 1px solid #94a3b8;
      padding: 7px 9px;
      text-align: left;
    }

    th {
      background: #e2e8f0;
    }

    .number {
      text-align: center;
    }

    thead {
      display: table-header-group;
    }

    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .signatures {
      display: flex;
      justify-content: space-between;
      gap: 40px;
      margin-top: 65px;
      break-inside: avoid;
    }

    .signature {
      width: 42%;
      border-top: 1px solid #111827;
      padding-top: 8px;
    }

    .note {
      margin-top: 15px;
      color: #64748b;
      font-size: 10px;
    }

    @media screen {
      body {
        max-width: 1100px;
        margin: 30px auto;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>J/ Manipay Memorial English School</h1>
    <h2>
      ${type === "monthly" ? "Monthly" : "Annual"}
      Teacher Relief &amp; Absence Summary
    </h2>
    <p>${escapeHtml(periodLabel)}</p>
  </header>

  <div class="stats">
    <div class="stat">
      <strong>${teachers.length}</strong>
      <span>Teachers</span>
    </div>
    <div class="stat">
      <strong>${totalAbsences}</strong>
      <span>Recorded Absence Days</span>
    </div>
    <div class="stat">
      <strong>${totalReliefs}</strong>
      <span>Relief Assignments</span>
    </div>
  </div>

  <h3>Teacher-wise Summary</h3>

  <table>
    <thead>
      <tr>
        <th>No.</th>
        <th>Teacher Name</th>
        <th>Subjects</th>
        <th>Absent Days</th>
        <th>Reliefs (${escapeHtml(periodLabel)})</th>
        <th>Lifetime Reliefs</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr>
        <th colspan="3">TOTAL</th>
        <th class="number">${totalAbsences}</th>
        <th class="number">${rows.reduce(
          (sum, row) => sum + row.reliefCount, 0
        )}</th>
        <th class="number">${rows.reduce(
          (sum, row) => sum + row.lifetime, 0
        )}</th>
      </tr>
    </tbody>
  </table>

  <p class="note">
    Generated by ReliefMS on
    ${escapeHtml(new Date().toLocaleDateString("en-GB"))}.
    Lifetime relief totals cover all recorded academic years.
  </p>

  <div class="signatures">
    <div class="signature">
      Prepared by<br />
      School Administrator
    </div>
    <div class="signature">
      Certified by<br />
      Principal / Signature &amp; School Seal
    </div>
  </div>
</body>
</html>
`

  const printWindow = window.open("", "_blank")

  if (!printWindow) {
    window.alert(
      "Please allow pop-ups to print the report."
    )
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
