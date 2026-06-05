import type { AttendanceRecord, Person } from "@/types";

export function exportAttendanceCSV(
  rows: AttendanceRecord[],
  persons: Person[],
  filename: string,
): void {
  const personMap = new Map(persons.map((p) => [String(p.id), p]));

  function nsqfLevelLabel(raw: string | undefined | null): string {
    if (!raw) return "";
    if (raw === "LevelIII") return "Level III";
    if (raw === "LevelIV") return "Level IV";
    if (raw === "LevelV") return "Level V";
    return raw.replace("Level", "Level ");
  }

  function semesterLabel(sem: string | undefined | null): string {
    if (!sem) return "";
    if (sem === "Sem1") return "1st Semester";
    if (sem === "Sem2") return "2nd Semester";
    return sem;
  }

  function getPersonType(p: Person): "NSQF" | "JIG" {
    const pt = p.personType as unknown as string;
    if (
      pt === "NSQF" ||
      (typeof p.personType === "object" && "NSQF" in p.personType)
    )
      return "NSQF";
    return "JIG";
  }

  function formatDateFull(isoDate: string | undefined | null): string {
    if (!isoDate) return "";
    const d = new Date(`${isoDate}T00:00:00`);
    const day = d.toLocaleDateString("en-GB", { weekday: "long" });
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${day} ${dd}/${mm}/${yyyy}`;
  }

  const escapeCell = (val: string | undefined | null): string => {
    const s = val ?? "";
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  // NSQF headers
  const nsqfHeaders = [
    "#",
    "Name",
    "RollNo",
    "NSQF Level",
    "Semester",
    "EntryTime",
    "Break",
    "AfterBreak",
    "ExitTime",
    "Date",
  ];
  // JIG headers
  const jigHeaders = [
    "#",
    "Name",
    "RollNo",
    "Course",
    "EntryTime",
    "Break",
    "AfterBreak",
    "ExitTime",
    "Date",
  ];

  const nsqfRows: string[] = [nsqfHeaders.join(",")];
  const jigRows: string[] = [jigHeaders.join(",")];
  let nsqfIdx = 0;
  let jigIdx = 0;

  for (const rec of rows) {
    const person = personMap.get(String(rec.personId));
    const name = person?.name ?? "Unknown";
    const rollNo = person?.rollNo ?? "";
    const pType = person ? getPersonType(person) : "JIG";

    if (pType === "NSQF") {
      nsqfIdx++;
      const level = nsqfLevelLabel(person?.nsqfLevel);
      const semester = semesterLabel(person?.semester);
      nsqfRows.push(
        [
          String(nsqfIdx),
          escapeCell(name),
          escapeCell(rollNo),
          escapeCell(level),
          escapeCell(semester),
          escapeCell(rec.entry),
          escapeCell(rec.breakTime),
          escapeCell(rec.afterBreak),
          escapeCell(rec.exit),
          formatDateFull(rec.date),
        ].join(","),
      );
    } else {
      jigIdx++;
      const course = person?.course ?? "";
      jigRows.push(
        [
          String(jigIdx),
          escapeCell(name),
          escapeCell(rollNo),
          escapeCell(course),
          escapeCell(rec.entry),
          escapeCell(rec.breakTime),
          escapeCell(rec.afterBreak),
          escapeCell(rec.exit),
          formatDateFull(rec.date),
        ].join(","),
      );
    }
  }

  // Combine both sections with a blank separator line between them
  const allLines: string[] = [];
  if (nsqfRows.length > 1) {
    allLines.push("NSQF");
    allLines.push(...nsqfRows);
  }
  if (jigRows.length > 1) {
    if (allLines.length > 0) allLines.push("");
    allLines.push("JIG");
    allLines.push(...jigRows);
  }
  if (allLines.length === 0) {
    allLines.push(nsqfHeaders.join(","));
  }

  const csv = allLines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
