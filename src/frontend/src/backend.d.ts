import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Stats {
    activeMonths: Array<string>;
    totalPersons: bigint;
    totalAttendance: bigint;
    todayCheckins: bigint;
}
export interface PersonSummary {
    id: bigint;
    studentId: string;
    name: string;
    createdAt: Time;
    personType: Variant_employee_student;
    employeeId: string;
    batch: string;
    rollNo: string;
}
export type Time = bigint;
export interface DescriptorEntry {
    id: bigint;
    name: string;
    personType: Variant_employee_student;
    faceDescriptor: Array<number>;
}
export interface Person {
    id: bigint;
    studentId: string;
    name: string;
    createdAt: Time;
    personType: Variant_employee_student;
    employeeId: string;
    faceDescriptor: Array<number>;
    batch: string;
    rollNo: string;
}
export interface AttendanceRecord {
    id: bigint;
    day: bigint;
    month: bigint;
    dateStr: string;
    name: string;
    slot: string;
    year: bigint;
    monthStr: string;
    personType: Variant_employee_student;
    personId: bigint;
    timestamp: bigint;
    editedAt?: Time;
    timeStr: string;
}
export enum Variant_employee_student {
    employee = "employee",
    student = "student"
}
export interface backendInterface {
    deleteAttendanceRecord(id: bigint): Promise<void>;
    deletePerson(id: bigint): Promise<void>;
    getAllFaceDescriptors(): Promise<Array<DescriptorEntry>>;
    getAllPersons(): Promise<Array<PersonSummary>>;
    getAttendanceByDate(dateStr: string): Promise<Array<AttendanceRecord>>;
    getAttendanceByMonth(monthStr: string): Promise<Array<AttendanceRecord>>;
    getAttendanceRecords(): Promise<Array<AttendanceRecord>>;
    getPerson(id: bigint): Promise<Person>;
    getPersonSummary(id: bigint): Promise<PersonSummary>;
    getStats(): Promise<Stats>;
    getTodayCheckins(dateStr: string): Promise<bigint>;
    hasAttendedSlot(personId: bigint, slot: string, dateStr: string): Promise<boolean>;
    recordAttendance(personId: bigint, personTypeStr: string, name: string, slot: string, timestamp: bigint, dateStr: string, monthStr: string, timeStr: string, year: bigint, month: bigint, day: bigint): Promise<bigint>;
    registerPerson(personTypeStr: string, studentId: string, employeeId: string, name: string, rollNo: string, batch: string, faceDescriptor: Array<number>): Promise<bigint>;
    updateAttendanceRecord(id: bigint, name: string, slot: string, dateStr: string, monthStr: string, timeStr: string): Promise<void>;
    updatePerson(id: bigint, studentId: string, employeeId: string, name: string, rollNo: string, batch: string): Promise<void>;
    updatePersonDescriptor(id: bigint, faceDescriptor: Array<number>): Promise<void>;
}
