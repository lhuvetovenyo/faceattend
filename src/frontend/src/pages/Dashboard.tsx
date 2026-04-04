import { useCamera } from "@/camera/useCamera";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  LayersIcon as Layers,
  LayoutDashboard,
  Loader2,
  Pencil,
  RefreshCw,
  SwitchCamera,
  Trash2,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useDeleteAttendance,
  useDeletePerson,
  useGetAllPersons,
  useGetAttendanceRecords,
  useGetStats,
  useUpdateAttendance,
  useUpdatePerson,
  useUpdatePersonDescriptor,
} from "../hooks/useQueries";
import type { AttendanceRecord, PersonSummary } from "../hooks/useQueries";
import { MODEL_URL, getFaceApi } from "../utils/faceApiCdn";

const SLOTS = ["Morning", "Late Morning", "Afternoon", "Evening"];

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateDisplay(day: bigint, month: bigint, year: bigint): string {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const dayName = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
  });
  return `${dd}/${mm}/${y} (${dayName})`;
}

function parseNSQFBatch(batch: string): { level: string; semester: string } {
  if (!batch) return { level: "—", semester: "—" };
  // Format: "NSQF Level-III - 1st Semester"
  const dashIdx = batch.indexOf(" - ");
  if (dashIdx !== -1) {
    const levelPart = batch
      .slice(0, dashIdx)
      .replace("NSQF ", "")
      .replace("-", " ");
    const semPart = batch.slice(dashIdx + 3);
    return { level: levelPart, semester: semPart };
  }
  return { level: batch, semester: "—" };
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-card border border-border p-4 flex items-start gap-3"
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-bold font-mono">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}

// ─── EditPersonDialog ────────────────────────────────────────────────────────

function EditPersonDialog({
  person,
  open,
  onClose,
}: {
  person: PersonSummary | null;
  open: boolean;
  onClose: () => void;
}) {
  const updatePerson = useUpdatePerson();
  const updateDescriptor = useUpdatePersonDescriptor();

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [batch, setBatch] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(
    null,
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [aiStatus, setAiStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const cameraReady = useRef(false);

  const camera = useCamera({ facingMode: "user" });
  const isStudent = person ? String(person.personType) === "student" : false;

  useEffect(() => {
    if (person && open) {
      setName(person.name);
      setStudentId(person.studentId || "");
      setEmployeeId(person.employeeId || "");
      setBatch(person.batch || "");
      setRollNo(person.rollNo || "");
      setCapturedDescriptor(null);
      setShowCamera(false);
      setAiStatus("idle");
      cameraReady.current = false;
    }
  }, [person, open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: camera methods are stable refs
  useEffect(() => {
    if (!showCamera) {
      camera.stopCamera();
      cameraReady.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      const ok = await camera.startCamera();
      if (ok) {
        cameraReady.current = true;
        setAiStatus("loading");
        const faceApi = await getFaceApi();
        if (faceApi) {
          try {
            await Promise.all([
              faceApi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
              faceApi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
              faceApi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
            setAiStatus("ready");
          } catch {
            setAiStatus("error");
          }
        } else {
          setAiStatus("error");
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [showCamera]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: camera methods are stable refs
  useEffect(() => {
    return () => {
      camera.stopCamera();
    };
  }, []);

  const handleCapture = useCallback(async () => {
    if (!camera.videoRef.current) return;
    setIsCapturing(true);
    try {
      let descriptor: number[] = new Array(128).fill(0);
      if (aiStatus === "ready") {
        const faceApi = await getFaceApi();
        if (faceApi) {
          const detection = await faceApi
            .detectSingleFace(
              camera.videoRef.current,
              new faceApi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
            )
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (detection?.descriptor) {
            descriptor = Array.from(detection.descriptor as number[]).map(
              (v) => (Number.isFinite(v) ? (v as number) : 0),
            );
          }
        }
      }
      setCapturedDescriptor(descriptor);
      toast.success("Face captured!");
      setShowCamera(false);
    } finally {
      setIsCapturing(false);
    }
  }, [camera.videoRef, aiStatus]);

  const handleSave = useCallback(async () => {
    if (!person) return;
    try {
      await updatePerson.mutateAsync({
        id: person.id,
        studentId,
        employeeId,
        name,
        rollNo,
        batch,
      });
      if (capturedDescriptor) {
        await updateDescriptor.mutateAsync({
          id: person.id,
          faceDescriptor: capturedDescriptor,
        });
      }
      toast.success("Person updated successfully!");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update person");
    }
  }, [
    person,
    updatePerson,
    updateDescriptor,
    studentId,
    employeeId,
    name,
    rollNo,
    batch,
    capturedDescriptor,
    onClose,
  ]);

  const isSaving = updatePerson.isPending || updateDescriptor.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-md"
        data-ocid="dashboard.edit_person.dialog"
      >
        <DialogHeader>
          <DialogTitle>Edit Person</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
              data-ocid="dashboard.edit_person_name.input"
            />
          </div>
          {isStudent ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="edit-sid">Student ID</Label>
                <Input
                  id="edit-sid"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Optional"
                  data-ocid="dashboard.edit_student_id.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-roll">Roll No</Label>
                <Input
                  id="edit-roll"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="Optional"
                  data-ocid="dashboard.edit_roll_no.input"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="edit-eid">Employee ID</Label>
              <Input
                id="edit-eid"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="Optional"
                data-ocid="dashboard.edit_employee_id.input"
              />
            </div>
          )}
          {isStudent && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-batch">NSQF Level / Semester</Label>
              <Input
                id="edit-batch"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. NSQF Level-III - 1st Semester"
                data-ocid="dashboard.edit_batch.input"
              />
            </div>
          )}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Face Photo
              </span>
              <Button
                type="button"
                size="sm"
                variant={showCamera ? "destructive" : "outline"}
                onClick={() => setShowCamera((v) => !v)}
              >
                <Camera className="w-3.5 h-3.5 mr-1" />
                {showCamera
                  ? "Cancel"
                  : capturedDescriptor
                    ? "Re-capture"
                    : "Re-capture Photo"}
              </Button>
            </div>
            {capturedDescriptor && !showCamera && (
              <div className="flex items-center gap-1.5 text-xs text-green-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                New face captured — will be saved
              </div>
            )}
            {showCamera && (
              <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                  <video
                    ref={camera.videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <canvas ref={camera.canvasRef} className="hidden" />
                  {camera.isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => camera.switchCamera()}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                  {aiStatus === "loading" && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-xs text-yellow-300">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading AI...
                    </div>
                  )}
                  {aiStatus === "ready" && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-xs text-green-300">
                      <CheckCircle2 className="w-3 h-3" /> AI Active
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    onClick={handleCapture}
                    disabled={isCapturing || !camera.isActive}
                    data-ocid="dashboard.edit_person.capture_button"
                  >
                    {isCapturing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />{" "}
                        Capturing...
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5 mr-1" /> Capture Face
                      </>
                    )}
                  </Button>
                  {camera.error && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => camera.retry()}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-ocid="dashboard.edit_person.cancel_button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            data-ocid="dashboard.edit_person.save_button"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── DeletePersonDialog ──────────────────────────────────────────────────────

function DeletePersonDialog({
  person,
  open,
  onClose,
}: {
  person: PersonSummary | null;
  open: boolean;
  onClose: () => void;
}) {
  const deletePerson = useDeletePerson();

  const handleDelete = useCallback(async () => {
    if (!person) return;
    try {
      await deletePerson.mutateAsync(person.id);
      toast.success("Person and all attendance records deleted");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete person");
    }
  }, [person, deletePerson, onClose]);

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent data-ocid="dashboard.delete_person.dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {person?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will also permanently delete all their attendance records. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-ocid="dashboard.delete_person.cancel_button">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-ocid="dashboard.delete_person.confirm_button"
          >
            {deletePerson.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" /> Deleting...
              </>
            ) : (
              "Delete Everything"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── ManagePersons ───────────────────────────────────────────────────────────

function ManagePersons() {
  const { data: persons = [], isLoading } = useGetAllPersons();
  const [editTarget, setEditTarget] = useState<PersonSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PersonSummary | null>(null);

  return (
    <div>
      {isLoading ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-ocid="dashboard.people.loading_state"
        >
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading persons...
        </div>
      ) : persons.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-ocid="dashboard.people.empty_state"
        >
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No registered persons</p>
          <p className="text-xs mt-1">Register a person to manage them here</p>
        </div>
      ) : (
        <div
          className="rounded-xl border border-border overflow-hidden"
          data-ocid="dashboard.people.table"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    #
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    Batch / Roll
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {persons.map((p, i) => {
                  const isStudent = String(p.personType) === "student";
                  const idValue = isStudent ? p.studentId : p.employeeId;
                  const batchRoll =
                    [p.batch, p.rollNo].filter(Boolean).join(" / ") || "—";
                  return (
                    <tr
                      key={String(p.id)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      data-ocid={`dashboard.people.row.item.${i + 1}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {p.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isStudent
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                          }`}
                        >
                          {isStudent ? "Student" : "Employee"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {idValue || "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground">{batchRoll}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
                            onClick={() => setEditTarget(p)}
                            data-ocid={`dashboard.people.edit_button.${i + 1}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(p)}
                            data-ocid={`dashboard.people.delete_button.${i + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground border-t border-border">
            {persons.length} person{persons.length !== 1 ? "s" : ""} registered
          </div>
        </div>
      )}
      <EditPersonDialog
        person={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
      />
      <DeletePersonDialog
        person={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const today = new Date();

  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: attendance = [], isLoading: attLoading } =
    useGetAttendanceRecords();
  const { data: persons = [] } = useGetAllPersons();

  const personBatchMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of persons) map.set(p.id.toString(), p.batch || "");
    return map;
  }, [persons]);

  const personRollNoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of persons) map.set(p.id.toString(), p.rollNo || "");
    return map;
  }, [persons]);

  const updateAttendance = useUpdateAttendance();
  const deleteAttendance = useDeleteAttendance();

  const [dateFilter, setDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const [editAtt, setEditAtt] = useState<AttendanceRecord | null>(null);
  const [editAttForm, setEditAttForm] = useState({
    name: "",
    slot: "",
    dateStr: "",
    monthStr: "",
    timeStr: "",
  });

  const [deleteAttId, setDeleteAttId] = useState<bigint | null>(null);

  const filteredAttendance = attendance.filter((r) => {
    if (dateFilter && r.dateStr !== dateFilter) return false;
    if (monthFilter && r.monthStr !== monthFilter) return false;
    return true;
  });

  const openEditAtt = (r: AttendanceRecord) => {
    setEditAtt(r);
    setEditAttForm({
      name: r.name,
      slot: r.slot,
      dateStr: r.dateStr,
      monthStr: r.monthStr,
      timeStr: r.timeStr,
    });
  };

  const handleSaveAttendance = async () => {
    if (!editAtt) return;
    try {
      await updateAttendance.mutateAsync({ id: editAtt.id, ...editAttForm });
      toast.success("Record updated");
      setEditAtt(null);
    } catch (_e) {
      toast.error("Update failed");
    }
  };

  const handleDeleteAttendance = async () => {
    if (deleteAttId === null) return;
    try {
      await deleteAttendance.mutateAsync(deleteAttId);
      toast.success("Record deleted");
      setDeleteAttId(null);
    } catch (_e) {
      toast.error("Delete failed");
    }
  };

  const downloadCSV = useCallback(() => {
    const batchMap = new Map<string, string>();
    const rollMap = new Map<string, string>();
    for (const p of persons) {
      batchMap.set(p.id.toString(), p.batch || "");
      rollMap.set(p.id.toString(), p.rollNo || "");
    }
    const header = [
      "Name",
      "Type",
      "Roll No",
      "NSQF Level",
      "Semester",
      "Entry Time",
      "Date",
      "Slot",
    ];
    const rows = attendance.map((r) => {
      const isStudent = String(r.personType) === "student";
      const batchVal = batchMap.get(r.personId.toString()) || "";
      const rollNo = rollMap.get(r.personId.toString()) || "";
      const { level, semester } = isStudent
        ? parseNSQFBatch(batchVal)
        : { level: "—", semester: "—" };
      const dateDisplay = formatDateDisplay(r.day, r.month, r.year);
      return [
        r.name,
        isStudent ? "Student" : "Employee",
        rollNo || "—",
        level,
        semester,
        r.timeStr,
        dateDisplay,
        r.slot,
      ];
    });
    const csv = [header, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, [attendance, persons]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{formatDate(today)}</p>
        </div>
      </div>

      {statsLoading ? (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          data-ocid="dashboard.loading_state"
        >
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total People"
            value={Number(stats?.totalPersons ?? 0)}
            icon={Users}
            color="bg-primary/20 text-primary"
          />
          <StatCard
            label="Total Attendance"
            value={Number(stats?.totalAttendance ?? 0)}
            icon={CalendarCheck}
            color="bg-chart-2/20 text-chart-2"
          />
          <StatCard
            label="Today's Check-ins"
            value={Number(stats?.todayCheckins ?? 0)}
            icon={Clock}
            color="bg-chart-3/20 text-chart-3"
          />
          <StatCard
            label="Active Months"
            value={stats?.activeMonths.length ?? 0}
            icon={Layers}
            color="bg-chart-5/20 text-chart-5"
          />
        </div>
      )}

      <Tabs defaultValue="attendance">
        <TabsList
          className="bg-card border border-border mb-6"
          data-ocid="dashboard.tab"
        >
          <TabsTrigger value="attendance" data-ocid="dashboard.attendance.tab">
            Attendance Records
          </TabsTrigger>
          <TabsTrigger value="people" data-ocid="dashboard.people.tab">
            Manage People
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                Filter by date
              </Label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-8 text-sm bg-card border-border w-40"
                data-ocid="dashboard.date_filter.input"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                Filter by month
              </Label>
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="h-8 text-sm bg-card border-border w-36"
                data-ocid="dashboard.month_filter.input"
              />
            </div>
            {(dateFilter || monthFilter) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setDateFilter("");
                  setMonthFilter("");
                }}
              >
                Clear
              </Button>
            )}
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadCSV}
                disabled={attendance.length === 0}
                className="flex items-center gap-2 h-8"
                data-ocid="dashboard.csv_download.button"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </Button>
            </div>
          </div>

          {attLoading ? (
            <div
              className="space-y-2"
              data-ocid="dashboard.attendance.loading_state"
            >
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : filteredAttendance.length === 0 ? (
            <div
              className="rounded-xl border border-dashed border-border p-10 text-center"
              data-ocid="dashboard.attendance.empty_state"
            >
              <CalendarCheck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">
                No attendance records found
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl border border-border overflow-hidden"
              data-ocid="dashboard.attendance.table"
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-card hover:bg-card border-border">
                    <TableHead className="text-muted-foreground">#</TableHead>
                    <TableHead className="text-muted-foreground">
                      Name
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Type
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Roll No
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      NSQF Level
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Semester
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Slot
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Time
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance.map((r, idx) => {
                    const isStudent = String(r.personType) === "student";
                    const { level, semester } = isStudent
                      ? parseNSQFBatch(
                          personBatchMap.get(r.personId.toString()) || "",
                        )
                      : { level: "—", semester: "—" };
                    return (
                      <TableRow
                        key={String(r.id)}
                        className="border-border"
                        data-ocid={`dashboard.attendance.row.item.${idx + 1}`}
                      >
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isStudent
                                ? "border-primary/40 text-primary"
                                : "border-chart-2/40 text-chart-2"
                            }
                          >
                            {isStudent ? "Student" : "Employee"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-black dark:text-foreground">
                          {personRollNoMap.get(r.personId.toString()) || "—"}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-black dark:text-foreground">
                          {level}
                        </TableCell>
                        <TableCell className="text-sm text-black dark:text-foreground">
                          {semester}
                        </TableCell>
                        <TableCell className="text-sm">{r.slot}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {r.timeStr}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {r.dateStr}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => openEditAtt(r)}
                              data-ocid={`dashboard.attendance.edit_button.${idx + 1}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteAttId(r.id)}
                              data-ocid={`dashboard.attendance.delete_button.${idx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="people">
          <ManagePersons />
        </TabsContent>
      </Tabs>

      {/* Edit Attendance Dialog */}
      <Dialog open={!!editAtt} onOpenChange={(o) => !o && setEditAtt(null)}>
        <DialogContent
          className="bg-card border-border"
          data-ocid="dashboard.edit_attendance.dialog"
        >
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={editAttForm.name}
                onChange={(e) =>
                  setEditAttForm((p) => ({ ...p, name: e.target.value }))
                }
                className="bg-background border-border"
                data-ocid="dashboard.edit_name.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slot</Label>
              <select
                value={editAttForm.slot}
                onChange={(e) =>
                  setEditAttForm((p) => ({ ...p, slot: e.target.value }))
                }
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                data-ocid="dashboard.edit_slot.select"
              >
                {SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editAttForm.dateStr}
                  onChange={(e) => {
                    const d = e.target.value;
                    setEditAttForm((p) => ({
                      ...p,
                      dateStr: d,
                      monthStr: d.slice(0, 7),
                    }));
                  }}
                  className="bg-background border-border"
                  data-ocid="dashboard.edit_date.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={editAttForm.timeStr}
                  onChange={(e) =>
                    setEditAttForm((p) => ({ ...p, timeStr: e.target.value }))
                  }
                  className="bg-background border-border"
                  data-ocid="dashboard.edit_time.input"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditAtt(null)}
              data-ocid="dashboard.edit_attendance.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAttendance}
              disabled={updateAttendance.isPending}
              data-ocid="dashboard.edit_attendance.save_button"
            >
              {updateAttendance.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Attendance */}
      <Dialog
        open={deleteAttId !== null}
        onOpenChange={(o) => !o && setDeleteAttId(null)}
      >
        <DialogContent
          className="bg-card border-border"
          data-ocid="dashboard.delete_attendance.dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Delete Record?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteAttId(null)}
              data-ocid="dashboard.delete_attendance.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAttendance}
              disabled={deleteAttendance.isPending}
              data-ocid="dashboard.delete_attendance.confirm_button"
            >
              {deleteAttendance.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
