
-- Run once in Supabase SQL Editor after reviewing school records.
-- Initializes missing academic year state for existing schools (2026).
-- Does not overwrite existing academic year data.
INSERT INTO public.academic_year_state (school_id, year, start_date)
SELECT s.id, 2026, '2026-01-01'
FROM public.schools AS s
WHERE NOT EXISTS (
  SELECT 1 FROM public.academic_year_state AS a WHERE a.school_id = s.id
);

-- Required school-scoped lookup indexes (idempotent).
CREATE INDEX IF NOT EXISTS idx_reliefms_timetable_school_day
 ON public.timetables(school_id, day, period);
CREATE INDEX IF NOT EXISTS idx_reliefms_absences_school_date
 ON public.absences(school_id, date);
CREATE INDEX IF NOT EXISTS idx_reliefms_relief_school_date
 ON public.relief_assignments(school_id, date, period);
CREATE INDEX IF NOT EXISTS idx_reliefms_progress_school_teacher
 ON public.timetable_progress(school_id, teacher_id);
