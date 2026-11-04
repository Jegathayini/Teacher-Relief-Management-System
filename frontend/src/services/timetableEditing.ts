import type { TimetableEntry } from "../types"

import { API_BASE_URL, authenticatedFetch } from "./api"

type UpdateTimetablePeriodRequest = {
  teacherId: string
  day: string
  period: number
  status: "FREE" | "LESSON"
  className?: string
  subject?: string
}

type UpdateTimetablePeriodResponse = {
  message?: string
  status: "FREE" | "LESSON"
  entry?: TimetableEntry
}

export async function updateTimetablePeriod(
  data: UpdateTimetablePeriodRequest
): Promise<UpdateTimetablePeriodResponse> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/cloud/v2/timetable-period`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.message ||
      result.error ||
      "Failed to update timetable period."
    )
  }

  return result as UpdateTimetablePeriodResponse
}