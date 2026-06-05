import type { TimeSlot } from "@/types";

export function getCurrentTimeSlot(): TimeSlot {
  // Always delegate to getClosestSlot — never return None or block attendance
  return getClosestSlot();
}
/**
 * When the current time falls outside all windows, return the closest
 * upcoming slot for today. If past all windows, return "Exit".
 */
/**
 * Maps ANY time to the most appropriate slot using boundary rules.
 * Never returns None — every minute of the day maps to exactly one slot.
 *
 * Boundaries (minutes from midnight):
 *   00:00 – 11:54  → Entry  (early morning / pre-break)
 *   11:55 – 12:24  → Break  (noon window)
 *   12:25 – 15:24  → AfterBreak
 *   15:25 – 23:59  → Exit
 */
export function getClosestSlot(): Exclude<TimeSlot, "None"> {
  const now = new Date();
  const total = now.getHours() * 60 + now.getMinutes();

  // Break window start: 11:55 (715)
  if (total < 11 * 60 + 55) return "Entry";
  // AfterBreak window start: 12:25 (745)
  if (total < 12 * 60 + 25) return "Break";
  // Exit window start: 15:25 (925)
  if (total < 15 * 60 + 25) return "AfterBreak";
  return "Exit";
}

// Human-readable labels
export const SLOT_LABELS: Record<TimeSlot, string> = {
  Entry: "Morning",
  Break: "Break",
  AfterBreak: "After Break",
  Exit: "End",
  None: "None",
};

// Time window display strings
export const SLOT_WINDOWS: Record<Exclude<TimeSlot, "None">, string> = {
  Entry: "8:50 – 9:05 AM",
  Break: "12:00 Noon",
  AfterBreak: "12:25 – 12:30 PM",
  Exit: "3:30 PM",
};
