import type { AttendanceRecord, Person } from "@/backend";
export type { AttendanceRecord, Person };
export { PersonType } from "@/backend";

export type Theme =
  | "professional-3d"
  | "soft-anime"
  | "dark-anime"
  | "ghibli"
  | "cyber-anime";

export type TimeSlot = "Entry" | "Break" | "AfterBreak" | "Exit" | "None";

export type Tab = "scan" | "register" | "dashboard" | "settings";
