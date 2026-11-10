
import { supabase } from "../lib/supabase";
import type { TimetableEntry } from "../types";

type UpdateTimetablePeriodRequest = {
  teacherId: string;
  day: string;
  period: number;
  status: "FREE" | "LESSON";
  className?: string;
  subject?: string;
};

type UpdateTimetablePeriodResponse = {
  message?: string;
  status: "FREE" | "LESSON";
  entry?: TimetableEntry;
};

export async function updateTimetablePeriod(
  data: UpdateTimetablePeriodRequest
): Promise<UpdateTimetablePeriodResponse> {
  const { data: result, error } = await supabase.rpc(
    "update_school_timetable_period",
    {
      p_teacher_id: data.teacherId,
      p_day: data.day,
      p_period: data.period,
      p_status: data.status,
      p_class_name: data.className ?? null,
      p_subject: data.subject ?? null,
    }
  );

  if (error) {
    throw new Error(
      `Failed to update timetable period: ${error.message}`
    );
  }

  if (!result) {
    throw new Error(
      "Supabase did not return a timetable update result."
    );
  }

  return result as UpdateTimetablePeriodResponse;
}
