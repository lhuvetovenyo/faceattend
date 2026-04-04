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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Camera,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  SwitchCamera,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { PersonSummary } from "../hooks/useQueries";
import {
  useDeletePerson,
  useGetAllPersons,
  useGetAttendanceRecords,
  useUpdatePerson,
  useUpdatePersonDescriptor,
} from "../hooks/useQueries";
import { MODEL_URL, getFaceApi } from "../utils/faceApiCdn";

// ─────────────────────────────────────────────
// Edit Person Dialog

// Helper to parse stored batch string into display-friendly level and semester
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
  return { level: batch.replace("NSQF ", "").replace("-", " "), semester: "—" };
}

// ─────────────────────────────────────────────
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
  const isStudent = person
    ? (person.personType as any).student !== undefined
    : false;

  // Pre-fill form when dialog opens
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
    // Wait for video element to be in DOM
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

  // Cleanup camera on unmount
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
      <DialogContent className="max-w-md">
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
              data-ocid="manage.input"
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
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-roll">Roll No</Label>
                <Input
                  id="edit-roll"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="Optional"
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
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-batch">Batch</Label>
            <Input
              id="edit-batch"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {/* Face re-capture */}
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
                data-ocid="manage.toggle"
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
                    data-ocid="manage.primary_button"
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
            data-ocid="manage.cancel_button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            data-ocid="manage.save_button"
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

// ─────────────────────────────────────────────
// Delete Confirmation Dialog
// ─────────────────────────────────────────────
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
      <AlertDialogContent data-ocid="manage.dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {person?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will also permanently delete all their attendance records. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-ocid="manage.cancel_button">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-ocid="manage.delete_button"
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

// ─────────────────────────────────────────────
// Manage Persons Tab
// ─────────────────────────────────────────────
function ManagePersons() {
  const { data: persons = [], isLoading } = useGetAllPersons();
  const [editTarget, setEditTarget] = useState<PersonSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PersonSummary | null>(null);

  return (
    <div>
      {isLoading ? (
        <div
          data-ocid="manage.loading_state"
          className="text-center py-16 text-muted-foreground"
        >
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading persons...
        </div>
      ) : persons.length === 0 ? (
        <div
          data-ocid="manage.empty_state"
          className="text-center py-16 text-muted-foreground"
        >
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No registered persons</p>
          <p className="text-xs mt-1">Register a person to manage them here</p>
        </div>
      ) : (
        <div
          className="rounded-xl border border-border overflow-hidden"
          data-ocid="manage.table"
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
                  const isStudent = (p.personType as any).student !== undefined;
                  const idValue = isStudent ? p.studentId : p.employeeId;
                  const batchRoll =
                    [p.batch, p.rollNo].filter(Boolean).join(" / ") || "—";
                  return (
                    <tr
                      key={String(p.id)}
                      data-ocid={`manage.item.${i + 1}`}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
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
                            data-ocid={`manage.edit_button.${i + 1}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(p)}
                            data-ocid={`manage.delete_button.${i + 1}`}
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

// ─────────────────────────────────────────────
// Helper: format date as DD/MM/YYYY (DayName)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Main Report Page
// ─────────────────────────────────────────────
export default function Report() {
  const { data: records = [], isLoading } = useGetAttendanceRecords();
  const { data: persons = [] } = useGetAllPersons();
  const [dateFilter, setDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  // Build personId -> batch map
  const personBatchMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of persons) {
      map.set(p.id.toString(), p.batch || "");
    }
    return map;
  }, [persons]);

  const filtered = useMemo(() => {
    let list = [...records].sort((a, b) => Number(b.timestamp - a.timestamp));
    if (dateFilter) {
      const [fyear, fmonth, fday] = dateFilter.split("-").map(Number);
      list = list.filter(
        (r) =>
          Number(r.day) === fday &&
          Number(r.month) === fmonth &&
          Number(r.year) === fyear,
      );
    }
    if (monthFilter) {
      list = list.filter((r) => r.monthStr === monthFilter);
    }
    return list;
  }, [records, dateFilter, monthFilter]);

  function downloadCSV() {
    const header = [
      "Name",
      "Type",
      "NSQF Level / Semester",
      "Entry Time",
      "Date",
      "Slot",
    ];
    const rows = filtered.map((r) => {
      const isStudent = (r.personType as any).student !== undefined;
      const batchVal = personBatchMap.get(r.personId.toString()) || "";
      const { level: nsqfLvl, semester: nsqfSem } =
        isStudent && batchVal
          ? parseNSQFBatch(batchVal)
          : { level: "—", semester: "—" };
      const dateDisplay = formatDateDisplay(r.day, r.month, r.year);
      return [
        r.name,
        isStudent ? "Student" : "Employee",
        isStudent
          ? nsqfLvl !== "—"
            ? `${nsqfLvl}${nsqfSem !== "—" ? ` - ${nsqfSem}` : ""}`
            : "—"
          : "—",
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
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Attendance Report
          </h1>
          <p className="text-sm text-muted-foreground">
            View records and manage registered persons
          </p>
        </div>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList className="mb-5">
          <TabsTrigger value="attendance" data-ocid="report.tab">
            <FileText className="w-4 h-4 mr-1.5" />
            Attendance Records
          </TabsTrigger>
          <TabsTrigger value="persons" data-ocid="manage.tab">
            <Users className="w-4 h-4 mr-1.5" />
            Manage Persons
          </TabsTrigger>
        </TabsList>

        {/* ── Attendance Records Tab ── */}
        <TabsContent value="attendance">
          {/* Filters + Download */}
          <div className="flex flex-wrap gap-3 mb-5 items-end">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="date-filter"
                className="text-xs font-medium text-muted-foreground"
              >
                Filter by Date
              </label>
              <input
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                data-ocid="report.search_input"
                className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="month-filter"
                className="text-xs font-medium text-muted-foreground"
              >
                Filter by Month
              </label>
              <input
                id="month-filter"
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                data-ocid="report.select"
                className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            {(dateFilter || monthFilter) && (
              <button
                type="button"
                onClick={() => {
                  setDateFilter("");
                  setMonthFilter("");
                }}
                className="px-3 py-2 rounded-lg border border-border bg-accent text-foreground text-sm hover:bg-accent/80 transition-colors self-end"
              >
                Clear
              </button>
            )}
            <div className="ml-auto">
              <button
                type="button"
                onClick={downloadCSV}
                disabled={filtered.length === 0}
                data-ocid="report.primary_button"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </button>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div
              data-ocid="report.loading_state"
              className="text-center py-16 text-muted-foreground"
            >
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading records...
            </div>
          ) : filtered.length === 0 ? (
            <div
              data-ocid="report.empty_state"
              className="text-center py-16 text-muted-foreground"
            >
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No records found</p>
              <p className="text-xs mt-1">
                Verifications will appear here after they are completed
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl border border-border overflow-hidden"
              data-ocid="report.table"
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
                        NSQF Level / Semester
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">
                        Entry Time
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">
                        Slot
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const isStudent =
                        (r.personType as any).student !== undefined;
                      const batchVal =
                        personBatchMap.get(r.personId.toString()) || "";
                      const { level: nsqfLvl2, semester: nsqfSem2 } =
                        isStudent && batchVal
                          ? parseNSQFBatch(batchVal)
                          : { level: "—", semester: "—" };
                      const nsqfLevel =
                        isStudent && batchVal
                          ? nsqfLvl2 !== "—"
                            ? `${nsqfLvl2}${nsqfSem2 !== "—" ? ` - ${nsqfSem2}` : ""}`
                            : "—"
                          : "—";
                      const dateDisplay = formatDateDisplay(
                        r.day,
                        r.month,
                        r.year,
                      );
                      return (
                        <tr
                          key={String(r.id)}
                          data-ocid={`report.item.${i + 1}`}
                          className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-muted-foreground">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {r.name}
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
                            {nsqfLevel}
                          </td>
                          <td className="px-4 py-3 text-foreground font-mono">
                            {r.timeStr}
                          </td>
                          <td className="px-4 py-3 text-foreground whitespace-nowrap">
                            {dateDisplay}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {r.slot}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground border-t border-border">
                {filtered.length} record{filtered.length !== 1 ? "s" : ""} shown
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Manage Persons Tab ── */}
        <TabsContent value="persons">
          <ManagePersons />
        </TabsContent>
      </Tabs>
    </div>
  );
}
