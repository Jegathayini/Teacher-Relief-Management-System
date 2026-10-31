
import {
  getTeachers,
  getTimetables,
  getAbsences,
  getReliefAssignments
} from "./storage"

export function exportBackup(): void {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    teachers: getTeachers(),
    timetables: getTimetables(),
    absences: getAbsences(),
    assignments: getReliefAssignments()
  }

  const json = JSON.stringify(backup, null, 2)

  const blob = new Blob([json], {
    type: "application/json"
  })

  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url

  const today = new Date().toLocaleDateString("en-CA")

  link.download = `teacher-relief-backup-${today}.json`

  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}
