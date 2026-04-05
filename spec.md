# FaceAttend

## Current State
- Slots: Morning (6–10 AM), Late Morning (10–12 PM), Afternoon (12–4 PM), Evening (4–8 PM)
- Webhook fires for ALL slots on all devices
- Attendance table sorted by timestamp (newest/oldest), no grouping by person

## Requested Changes (Diff)

### Add
- Grouped attendance table: records grouped by person (in order of first verification), all of a person's records appear consecutively

### Modify
- Slot names and time ranges:
  - Morning → Entry Time (08:00–09:30)
  - Late Morning → Break (12:00–13:30)
  - Afternoon → Afterbreak (13:40–14:30)
  - Evening → Exit Time (15:00–16:30)
- Webhook: only POST when slot is "Entry Time" or "Exit Time"; silently skip Break and Afterbreak
- SLOTS array in both FaceScan.tsx and Dashboard.tsx updated to new names/ranges
- Edit dialog slot dropdown updated to new names

### Remove
- Nothing removed

## Implementation Plan
1. In FaceScan.tsx: update SLOTS array (names, labels, times, start/end hours). Update webhook logic to skip POST if slot is not Entry Time or Exit Time.
2. In Dashboard.tsx: update SLOTS array for edit dialog. Update filteredAttendance rendering to group records by person (preserving person order by first-seen timestamp), so all verifications for the same person appear consecutively.
