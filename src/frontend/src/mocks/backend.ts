import type { TransformArgs, backendInterface } from "../backend";
import { PersonType } from "../backend";

export const mockBackend: backendInterface = {
  addPerson: async () => ({ __kind__: "ok" as const, ok: {
    id: "1",
    name: "Test Person",
    personType: PersonType.NSQF,
    faceDescriptor: Array(128).fill(0.01),
    rollNo: undefined,
    nsqfLevel: undefined,
    semester: undefined,
    course: undefined,
  }}),

  clearAllData: async () => {},

  deleteAttendance: async () => ({ __kind__: "ok" as const, ok: null }),

  deletePerson: async () => ({ __kind__: "ok" as const, ok: null }),

  getActiveMonths: async () => 0n,

  getAllFaceDescriptors: async () => [
    ["1", Array(128).fill(0.01)],
    ["2", Array(128).fill(0.02)],
  ],

  getAttendance: async () => ({
    id: "1",
    date: "2026-05-14",
    personId: "1",
    entry: "09:00",
    breakTime: "12:00",
    afterBreak: "12:26",
    exit: "15:30",
  }),

  getPerson: async () => ({
    id: "1",
    name: "Ananya Sharma",
    personType: PersonType.NSQF,
    rollNo: "NSQF2024001",
    nsqfLevel: "Level-III",
    semester: "1st Semester",
    course: undefined,
    faceDescriptor: Array(128).fill(0.01),
  }),

  getTodayCheckIns: async () => 0n,

  getTotalCheckIns: async () => 0n,

  getTotalStudents: async () => 0n,

  listAttendance: async () => [
    {
      id: "1",
      date: "2026-05-14",
      personId: "1",
      entry: "09:02",
      breakTime: "12:05",
      afterBreak: "12:26",
      exit: "15:30",
    },
    {
      id: "2",
      date: "2026-05-14",
      personId: "2",
      entry: "09:15",
      breakTime: undefined,
      afterBreak: undefined,
      exit: undefined,
    },
  ],

  listAttendanceByDate: async () => [],

  listPersons: async () => [
    {
      id: "1",
      name: "Ananya Sharma",
      personType: PersonType.NSQF,
      rollNo: "NSQF2024001",
      nsqfLevel: "Level-III",
      semester: "1st Semester",
      course: undefined,
      faceDescriptor: Array(128).fill(0.01),
    },
    {
      id: "2",
      name: "Rohan Mehta",
      personType: PersonType.NSQF,
      rollNo: "NSQF2024002",
      nsqfLevel: "Level-IV",
      semester: "2nd Semester",
      course: undefined,
      faceDescriptor: Array(128).fill(0.02),
    },
    {
      id: "3",
      name: "Priya Nair",
      personType: PersonType.JIG,
      rollNo: "JIG2024001",
      nsqfLevel: undefined,
      semester: undefined,
      course: "Electrical",
      faceDescriptor: Array(128).fill(0.03),
    },
  ],

  recordAttendance: async () => ({ __kind__: "ok" as const, ok: "rec-1" }),

  syncAttendanceWithJwt: async (_jwt: string, _rowDataJson: string, _sheetTabName: string) => "ok",

  testGoogleSheetsSync: async (_jwt: string) => "Success: mock test",

  transformBatchUpdateResponse: async (_raw: TransformArgs) => ({
    status: 200n,
    headers: [],
    body: new Uint8Array(),
  }),

  transformSheetsResponse: async (_raw: TransformArgs) => ({
    status: 200n,
    headers: [],
    body: new Uint8Array(),
  }),

  transformTokenResponse: async (_raw: TransformArgs) => ({
    status: 200n,
    headers: [],
    body: new Uint8Array(),
  }),

  updateAttendance: async () => ({ __kind__: "ok" as const, ok: {
    id: "1",
    date: "2026-05-14",
    personId: "1",
    entry: undefined,
    breakTime: undefined,
    afterBreak: undefined,
    exit: undefined,
  }}),

  updatePerson: async () => ({ __kind__: "ok" as const, ok: {
    id: "1",
    name: "Test Person",
    personType: PersonType.NSQF,
    faceDescriptor: Array(128).fill(0.01),
    rollNo: undefined,
    nsqfLevel: undefined,
    semester: undefined,
    course: undefined,
  }}),
};
