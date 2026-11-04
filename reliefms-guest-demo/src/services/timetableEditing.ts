import type { TimetableEntry } from "../types";
export async function updateTimetablePeriod(_data:{teacherId:string;day:string;period:number;status:"FREE"|"LESSON";className?:string;subject?:string}):Promise<{message?:string;status:"FREE"|"LESSON";entry?:TimetableEntry}>{throw new Error("Guest preview is read-only.")}
