import type { Teacher, TimetableEntry, Absence, ReliefAssignment } from "../types";
import { demoData } from "../demo/demoData";
export const API_BASE_URL = "";
export type CloudGrade = {id:string;name:string};
export type CloudSchoolClass = {id:string;grade_id:string;section:string};
export type CloudSchoolConfiguration = {grades:CloudGrade[];classes:CloudSchoolClass[]};
export type SchoolGrade = {id:string;name:string};
export type SchoolClass = {id:string;gradeId:string;section:string;name:string};
export type SchoolConfiguration = {grades:SchoolGrade[];classes:SchoolClass[]};
export type TimetableProgress = {day:string;period:number;status:"FREE"|"LESSON"};
export type AcademicYearStatus = {year:number;startDate:string;timetableCount:number;progressCount:number;archivedYears:number};
export type CloudDashboardStats = {absentTeachers:number;reliefAssigned:number;pendingRelief:number};
export interface HealthResponse {status:string;message:string}
const readonly = ():never => {throw new Error("Guest preview is read-only.")};
const teachers:Teacher[] = demoData.teachers.map(t=>({...t,subjects:[...t.subjects]}));
const timetables:TimetableEntry[] = demoData.timetables.map(t=>({...t}));
const absences:Absence[] = demoData.absences.map(a=>({...a}));
const reliefs:ReliefAssignment[] = demoData.reliefs.map(r=>({...r}));
export async function getAuthenticatedHeaders():Promise<HeadersInit>{return readonly()}
export async function authenticatedFetch(_input:RequestInfo|URL,_init:RequestInit={}):Promise<Response>{return readonly()}
export async function checkBackendHealth():Promise<HealthResponse>{return {status:"ok",message:"Offline fictional guest preview"}}
export async function fetchTeachers(){return teachers}
export const fetchCloudTeachers=fetchTeachers;
export async function createCloudTeacher(_name:string,_subjects:string[]):Promise<Teacher>{return readonly()}
export async function updateCloudTeacher(_id:string,_name:string,_subjects:string[]):Promise<Teacher>{return readonly()}
export async function updateCloudTeacherStatus(_id:string,_active:boolean):Promise<Teacher>{return readonly()}
export async function deleteCloudTeacher(_id:string):Promise<void>{return readonly()}
export async function fetchCloudConfiguration():Promise<CloudSchoolConfiguration>{return {grades:demoData.grades.map(g=>({...g})),classes:demoData.classes.map(c=>({id:c.id,grade_id:c.gradeId,section:c.section}))}}
export async function fetchSchoolConfiguration():Promise<SchoolConfiguration>{return {grades:demoData.grades.map(g=>({...g})),classes:demoData.classes.map(c=>({...c}))}}
export async function createCloudGrade(_name:string):Promise<CloudGrade>{return readonly()}
export const createGrade=createCloudGrade;
export async function createCloudClass(_gradeId:string,_section:string):Promise<CloudSchoolClass>{return readonly()}
export async function createSchoolClass(_gradeId:string,_section:string):Promise<SchoolClass>{return readonly()}
export async function deleteCloudClass(_id:string):Promise<{message:string}>{return readonly()}
export const deleteSchoolClass=deleteCloudClass;
export async function deleteCloudGrade(_id:string):Promise<{message:string}>{return readonly()}
export const deleteGrade=deleteCloudGrade;
export async function fetchTimetables(){return timetables}
export async function createTimetable(_entry:Omit<TimetableEntry,"id">):Promise<TimetableEntry>{return readonly()}
export async function deleteTimetable(_id:string):Promise<void>{return readonly()}
export async function saveFreePeriod(_id:string,_day:string,_period:number):Promise<TimetableProgress>{return readonly()}
export async function fetchTimetableProgress(teacherId:string):Promise<TimetableProgress[]>{return Array.from({length:5},(_,d)=>Array.from({length:8},(_,p)=>({day:["Monday","Tuesday","Wednesday","Thursday","Friday"][d],period:p+1,status:timetables.some(t=>t.teacherId===teacherId&&t.day===["Monday","Tuesday","Wednesday","Thursday","Friday"][d]&&t.period===p+1)?"LESSON" as const:"FREE" as const}))).flat()}
export async function fetchAbsences(){return absences}
export async function createAbsence(_a:Omit<Absence,"id">):Promise<Absence>{return readonly()}
export async function deleteAbsence(_id:string):Promise<void>{return readonly()}
export async function fetchReliefAssignments(){return reliefs}
export async function createReliefAssignment(_a:Omit<ReliefAssignment,"id">):Promise<ReliefAssignment>{return readonly()}
export async function deleteReliefAssignment(_id:string):Promise<void>{return readonly()}
export async function fetchAcademicYear():Promise<AcademicYearStatus>{return fetchCloudAcademicYear()}
export async function fetchCloudAcademicYear():Promise<AcademicYearStatus>{return {year:2026,startDate:"2026-01-01",timetableCount:timetables.length,progressCount:600,archivedYears:0}}
export async function rolloverAcademicYear(_year:number,_date:string,_confirmation:string):Promise<void>{return readonly()}
export async function fetchCloudDashboardStats(date:string):Promise<CloudDashboardStats>{const absent=new Set(absences.filter(a=>a.date===date).map(a=>a.teacherId));const required=timetables.filter(t=>t.day===["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(date+"T12:00:00").getDay()]&&absent.has(t.teacherId)).length;const assigned=reliefs.filter(r=>r.date===date).length;return {absentTeachers:absent.size,reliefAssigned:assigned,pendingRelief:Math.max(0,required-assigned)}}
export async function fetchSchoolReliefCounts():Promise<Record<string,number>>{return {...demoData.counts}}
