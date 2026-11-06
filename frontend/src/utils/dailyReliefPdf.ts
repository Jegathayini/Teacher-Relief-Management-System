import { jsPDF } from "jspdf"
import type { ReliefAssignment, Teacher } from "../types"

const SCHOOL_NAME = "J/ Manipay Memorial English School"

export function downloadDailyReliefPdf(
  date: string,
  assignments: ReliefAssignment[],
  teachers: Teacher[]
): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Select a valid date.")
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const width = pdf.internal.pageSize.getWidth()
  const margin = 13
  const colX = [13, 31, 66, 109, 172]
  const colW = [18, 35, 43, 63, 112]
  const names = new Map(teachers.map(t => [t.id, t.name]))
  const sorted = [...assignments].sort((a, b) => a.period - b.period || a.className.localeCompare(b.className))
  let page = 0
  let y = 0

  function header() {
    page += 1
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(16)
    pdf.text(SCHOOL_NAME, margin, 16)
    pdf.setFontSize(12)
    pdf.text("Daily Relief Assignment Report", margin, 24)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10)
    pdf.text(`Date: ${date}`, margin, 31)
    pdf.text(`Total assignments: ${sorted.length}`, width - margin, 31, { align: "right" })
    pdf.setFillColor(230, 238, 245)
    pdf.rect(margin, 36, width - 2 * margin, 9, "F")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    ;["Period", "Class", "Subject", "Absent Teacher", "Relief Teacher"].forEach((label, i) => pdf.text(label, colX[i] + 2, 42))
    y = 48
  }

  function fit(text: string, maxWidth: number): string[] {
    const lines = pdf.splitTextToSize(text || "-", maxWidth - 4) as string[]
    return lines.length ? lines : ["-"]
  }

  header()
  pdf.setFont("helvetica", "normal")
  if (sorted.length === 0) {
    pdf.setFontSize(11)
    pdf.text("No relief assignments recorded for this date.", margin + 2, y + 8)
  }
  sorted.forEach((a, index) => {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    const cells = [String(a.period), a.className, a.subject, names.get(a.absentTeacherId) ?? "Unknown teacher", names.get(a.reliefTeacherId) ?? "Unknown teacher"]
    const lines = cells.map((value, i) => fit(value, colW[i]))
    const rowHeight = Math.max(9, Math.max(...lines.map(v => v.length)) * 4.5 + 4)
    if (y + rowHeight > 187) {
      pdf.addPage()
      header()
    }
    if (index % 2 === 0) {
      pdf.setFillColor(247, 249, 252)
      pdf.rect(margin, y - 2, width - 2 * margin, rowHeight, "F")
    }
    pdf.setTextColor(25, 35, 45)
    lines.forEach((group, i) => pdf.text(group, colX[i] + 2, y + 3.5))
    y += rowHeight
  })
  for (let i = 1; i <= page; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setTextColor(90, 100, 110)
    pdf.text(`Page ${i} of ${page}`, width - margin, 201, { align: "right" })
  }
  pdf.save(`daily-relief-${date}.pdf`)
}
