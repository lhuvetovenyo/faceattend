import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface HttpResponsePayload {
    status: bigint;
    body: Uint8Array;
    headers: Array<HttpHeader>;
}
export interface PersonInput {
    semester?: string;
    name: string;
    personType: PersonType;
    nsqfLevel?: string;
    faceDescriptor: Array<number>;
    rollNo?: string;
    course?: string;
}
export interface AttendanceUpdateInput {
    afterBreak?: string;
    breakTime?: string;
    exit?: string;
    entry?: string;
}
export interface AttendanceRecord {
    id: string;
    afterBreak?: string;
    breakTime?: string;
    date: string;
    exit?: string;
    entry?: string;
    personId: string;
}
export interface Person {
    id: string;
    semester?: string;
    name: string;
    personType: PersonType;
    nsqfLevel?: string;
    faceDescriptor: Array<number>;
    rollNo?: string;
    course?: string;
}
export interface HttpHeader {
    value: string;
    name: string;
}
export interface TransformArgs {
    context: Uint8Array;
    response: HttpResponsePayload;
}
export enum PersonType {
    JIG = "JIG",
    NSQF = "NSQF"
}
export interface backendInterface {
    addPerson(input: PersonInput): Promise<{
        __kind__: "ok";
        ok: Person;
    } | {
        __kind__: "err";
        err: string;
    }>;
    clearAllData(): Promise<void>;
    deleteAttendance(id: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deletePerson(id: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getActiveMonths(): Promise<bigint>;
    getAllFaceDescriptors(): Promise<Array<[string, Array<number>]>>;
    getAttendance(personId: string, date: string): Promise<AttendanceRecord | null>;
    getPerson(id: string): Promise<Person | null>;
    getTodayCheckIns(): Promise<bigint>;
    getTotalCheckIns(): Promise<bigint>;
    getTotalStudents(): Promise<bigint>;
    listAttendance(): Promise<Array<AttendanceRecord>>;
    listAttendanceByDate(date: string): Promise<Array<AttendanceRecord>>;
    listPersons(): Promise<Array<Person>>;
    recordAttendance(personId: string, date: string, slot: string, time: string): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    syncAttendanceWithJwt(jwt: string, rowDataJson: string, sheetTabName: string): Promise<string>;
    testGoogleSheetsSync(jwt: string): Promise<string>;
    transformBatchUpdateResponse(raw: TransformArgs): Promise<HttpResponsePayload>;
    transformSheetsResponse(raw: TransformArgs): Promise<HttpResponsePayload>;
    transformTokenResponse(raw: TransformArgs): Promise<HttpResponsePayload>;
    updateAttendance(id: string, updates: AttendanceUpdateInput): Promise<{
        __kind__: "ok";
        ok: AttendanceRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updatePerson(id: string, input: PersonInput): Promise<{
        __kind__: "ok";
        ok: Person;
    } | {
        __kind__: "err";
        err: string;
    }>;
}
