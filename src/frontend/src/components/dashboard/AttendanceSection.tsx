import ConfirmDialog from "@/components/dashboard/ConfirmDialog";
import EditAttendanceModal from "@/components/dashboard/EditAttendanceModal";
import PasswordModal from "@/components/dashboard/PasswordModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAttendance,
  useDeleteAttendance,
  usePersons,
} from "@/hooks/useBackend";
import { PersonType } from "@/types";
import type { AttendanceRecord, Person } from "@/types";
import { exportAttendanceCSV } from "@/utils/csvExport";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileX,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";

interface Props {
  sectionType: "NSQF" | "JIG";
  selectedDate: string;
}

interface DayRow {
  personId: string;
  name: string;
  rollNo: string;
  level: string;
  semester: string;
  courseLevel: string;
  date: string;
  entry: string;
  breakTime: string;
  afterBreak: string;
  exit: string;
  records: AttendanceRecord[];
}

function semesterLabel(sem: string | undefined): string {
  if (!sem) return "";
  if (sem === "Sem1") return "1st Semester";
  if (sem === "Sem2") return "2nd Semester";
  return sem;
}

function nsqfLevelLabel(raw: string | undefined): string {
  if (!raw) return "\u2014";
  if (raw === "LevelIII") return "Level III";
  if (raw === "LevelIV") return "Level IV";
  if (raw === "LevelV") return "Level V";
  return raw.replace("Level", "Level ");
}

function getPersonDisplay(
  person: Person | undefined,
  sectionType: "NSQF" | "JIG",
): { rollNo: string; level: string; semester: string; courseLevel: string } {
  if (!person)
    return {
      rollNo: "\u2014",
      level: "\u2014",
      semester: "",
      courseLevel: "\u2014",
    };
  const rollNo = person.rollNo ?? "\u2014";
  if (sectionType === "NSQF") {
    const level = nsqfLevelLabel(person.nsqfLevel);
    const semester = semesterLabel(person.semester);
    return { rollNo, level, semester, courseLevel: level };
  }
  return {
    rollNo,
    level: person.course ?? "\u2014",
    semester: "",
    courseLevel: person.course ?? "\u2014",
  };
}

function formatDateDisplay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = d.toLocaleDateString("en-GB", { weekday: "long" });
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${day} ${dd}/${mm}/${yyyy}`;
}

function formatTime(raw: string | undefined | null): string {
  if (!raw) return "\u2014";
  const [hStr, mStr] = raw.split(":");
  if (!hStr || !mStr) return raw;
  let h = Number.parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default function AttendanceSection({
  sectionType,
  selectedDate,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pwdAction, setPwdAction] = useState<null | { action: () => void }>(
    null,
  );

  const { data: allRecords = [] } = useAttendance();
  const { data: persons = [] } = usePersons();
  const deleteMut = useDeleteAttendance();

  const personMap = new Map(persons.map((p) => [String(p.id), p]));
  // Filter persons to only those belonging to this section — prevents cross-section contamination
  const sectionPersonIds = new Set(
    persons
      .filter(
        (p) =>
          p.personType ===
          (sectionType === "NSQF" ? PersonType.NSQF : PersonType.JIG),
      )
      .map((p) => String(p.id)),
  );
  const dayRecords = allRecords.filter(
    (r) => r.date === selectedDate && sectionPersonIds.has(String(r.personId)),
  );
  const rowMap = new Map<string, DayRow>();

  for (const rec of dayRecords) {
    const personId = String(rec.personId);
    const person = personMap.get(personId);
    const display = getPersonDisplay(person, sectionType);

    if (!rowMap.has(personId)) {
      rowMap.set(personId, {
        personId,
        name: person?.name ?? "Unknown",
        rollNo: display.rollNo,
        level: display.level,
        semester: display.semester,
        courseLevel: display.courseLevel,
        date: rec.date,
        entry: "",
        breakTime: "",
        afterBreak: "",
        exit: "",
        records: [],
      });
    }
    const row = rowMap.get(personId)!;
    row.records.push(rec);
    if (rec.entry) row.entry = rec.entry;
    if (rec.breakTime) row.breakTime = rec.breakTime;
    if (rec.afterBreak) row.afterBreak = rec.afterBreak;
    if (rec.exit) row.exit = rec.exit;
  }

  const rows = Array.from(rowMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const handleExport = () => {
    exportAttendanceCSV(
      dayRecords,
      persons,
      `${sectionType}-attendance-${selectedDate}`,
    );
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMut.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const colorClass =
    sectionType === "NSQF"
      ? "bg-primary/10 text-primary border-primary/30"
      : "bg-accent/10 text-accent border-accent/30";

  return (
    <div
      className="bg-card rounded-xl border border-border overflow-hidden shadow-card section-card"
      data-ocid={`dashboard.${sectionType.toLowerCase()}.section`}
    >
      {/* Section Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border"
        onClick={() => setCollapsed((c) => !c)}
        data-ocid={`dashboard.${sectionType.toLowerCase()}.toggle`}
      >
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs font-semibold ${colorClass}`}
          >
            {sectionType}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {rows.length} {rows.length === 1 ? "student" : "students"}
          </Badge>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <>
          {/* Export Bar */}
          <div className="flex justify-end px-4 py-2 border-b border-border bg-background">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2.5 btn-glow"
              onClick={handleExport}
              data-ocid={`dashboard.${sectionType.toLowerCase()}.export_button`}
            >
              <Download className="w-3 h-3 mr-1" /> Export CSV
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {rows.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-10 gap-2"
                data-ocid={`dashboard.${sectionType.toLowerCase()}.empty_state`}
              >
                <FileX className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No attendance for this date
                </p>
              </div>
            ) : (
              <table className="w-full text-xs table-refined">
                <thead>
                  <tr className="bg-primary/5 border-b-2 border-primary/20">
                    <th className="px-2 py-2 text-left text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap w-6">
                      #
                    </th>
                    <th className="px-2 py-2 text-left text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap">
                      Name
                    </th>
                    <th className="px-2 py-2 text-left text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap">
                      Roll No
                    </th>
                    {sectionType === "NSQF" ? (
                      <>
                        <th className="px-2 py-2 text-left text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap">
                          NSQF Level
                        </th>
                        <th className="px-2 py-2 text-left text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap">
                          Semester
                        </th>
                      </>
                    ) : (
                      <th className="px-2 py-2 text-left text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap">
                        Course
                      </th>
                    )}
                    <th className="px-2 py-2 text-left text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-2 py-2 text-right text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap">
                      Morning
                    </th>
                    <th className="px-2 py-2 text-right text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap">
                      Break
                    </th>
                    <th className="px-2 py-2 text-right text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap">
                      Aftr Brk
                    </th>
                    <th className="px-2 py-2 text-right text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap">
                      End
                    </th>
                    <th className="px-2 py-2 text-right text-foreground font-normal tracking-wide uppercase text-xs whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={row.personId}
                      className="border-b border-border/60 hover:bg-primary/5 transition-colors duration-150"
                      data-ocid={`dashboard.${sectionType.toLowerCase()}.item.${idx + 1}`}
                    >
                      <td className="px-2 py-2 text-muted-foreground text-xs whitespace-nowrap">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-2 font-normal text-foreground text-xs whitespace-nowrap max-w-[100px] truncate">
                        {row.name}
                      </td>
                      <td className="px-2 py-2 text-foreground text-xs whitespace-nowrap tabular-nums font-mono">
                        {row.rollNo}
                      </td>
                      {sectionType === "NSQF" ? (
                        <>
                          <td className="px-2 py-2 text-foreground text-xs whitespace-nowrap font-normal">
                            {row.level}
                          </td>
                          <td className="px-2 py-2 text-muted-foreground text-xs whitespace-nowrap">
                            {row.semester || "—"}
                          </td>
                        </>
                      ) : (
                        <td className="px-2 py-2 text-muted-foreground text-xs whitespace-nowrap">
                          {row.courseLevel}
                        </td>
                      )}
                      <td className="px-2 py-2 text-foreground text-xs whitespace-nowrap tabular-nums">
                        {formatDateDisplay(row.date)}
                      </td>
                      <td className="px-2 py-2 text-right text-foreground text-xs whitespace-nowrap tabular-nums">
                        {formatTime(row.entry)}
                      </td>
                      <td className="px-2 py-2 text-right text-foreground text-xs whitespace-nowrap tabular-nums">
                        {formatTime(row.breakTime)}
                      </td>
                      <td className="px-2 py-2 text-right text-foreground text-xs whitespace-nowrap tabular-nums">
                        {formatTime(row.afterBreak)}
                      </td>
                      <td className="px-2 py-2 text-right text-foreground text-xs whitespace-nowrap tabular-nums">
                        {formatTime(row.exit)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {row.records.map((rec) => (
                            <span
                              key={String(rec.id)}
                              className="inline-flex gap-1"
                            >
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 btn-glow"
                                aria-label="Edit attendance record"
                                onClick={() => {
                                  setPwdAction({
                                    action: () => {
                                      setEditRecord(rec);
                                      setEditOpen(true);
                                    },
                                  });
                                }}
                                data-ocid={`dashboard.${sectionType.toLowerCase()}.edit_button.${idx + 1}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive btn-glow-destructive"
                                aria-label="Delete attendance record"
                                onClick={() =>
                                  setPwdAction({
                                    action: () => setDeleteId(String(rec.id)),
                                  })
                                }
                                data-ocid={`dashboard.${sectionType.toLowerCase()}.delete_button.${idx + 1}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Edit Modal — keep mounted, control open state to avoid blank page */}
      {editRecord && (
        <EditAttendanceModal
          record={editRecord}
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            setTimeout(() => setEditRecord(null), 200);
          }}
        />
      )}

      {/* Password Gate */}
      <PasswordModal
        open={!!pwdAction}
        onSuccess={() => {
          pwdAction?.action();
          setPwdAction(null);
        }}
        onCancel={() => setPwdAction(null)}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete Record"
        description="Are you sure you want to delete this attendance record? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
