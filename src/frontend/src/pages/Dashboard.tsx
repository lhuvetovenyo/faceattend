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
  BarChart2,
  Briefcase,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  Pencil,
  RefreshCw,
  SwitchCamera,
  Trash2,
  Users,
  Users2,
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

// ── Clean 3D Stat Card ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  badgeClass,
  delay = 0,
}: {
  label: string;
  value: string | number;
  icon: any;
  badgeClass: string;
  delay?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    card.style.transform = `perspective(800px) rotateX(${-dy * 6}deg) rotateY(${dx * 6}deg) translateY(-2px)`;
    card.style.transition = "transform 0.1s";
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform =
      "perspective(800px) rotateX(0) rotateY(0) translateY(0)";
    card.style.transition = "transform 0.4s ease";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      style={{ perspective: "800px" }}
    >
      <div
        ref={cardRef}
        className="glass-card p-4 flex items-start gap-3.5 cursor-default"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ willChange: "transform" }}
      >
        <div className={`w-10 h-10 rounded-xl icon-badge ${badgeClass}`}>
          <Icon style={{ width: 18, height: 18 }} />
        </div>
        <div>
          <p
            className="stat-value text-3xl text-foreground"
            style={{ fontSize: "1.75rem" }}
          >
            {value}
          </p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            {label}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ── EditPersonDialog ────────────────────────────────────────────────────────

function EditPersonDialog({
  person,
  open,
  onClose,
}: { person: PersonSummary | null; open: boolean; onClose: () => void }) {
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
          if (detection) {
            descriptor = (Array.from(detection.descriptor) as number[]).map(
              (v) => (Number.isFinite(v) ? v : 0),
            );
          }
        }
      }
      const file = await camera.capturePhoto();
      if (file) {
        setCapturedDescriptor(descriptor);
        toast.success("Face captured");
        setShowCamera(false);
      }
    } catch (_err) {
      toast.error("Capture failed");
    } finally {
      setIsCapturing(false);
    }
  }, [camera, aiStatus]);

  const handleSave = useCallback(async () => {
    if (!person || !name.trim()) return;
    try {
      await updatePerson.mutateAsync({
        id: person.id,
        name,
        studentId,
        employeeId,
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
  const inputClass =
    "bg-white border-border focus:border-primary text-foreground focus:shadow-[0_0_0_3px_oklch(0.52_0.22_265_/_0.12)]";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-md"
        data-ocid="dashboard.edit_person.dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Edit Person
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="edit-name"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Full Name *
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
              className={inputClass}
              data-ocid="dashboard.edit_person_name.input"
            />
          </div>
          {isStudent ? (
            <>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-sid"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Student ID
                </Label>
                <Input
                  id="edit-sid"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                  data-ocid="dashboard.edit_student_id.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-roll"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Roll No
                </Label>
                <Input
                  id="edit-roll"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                  data-ocid="dashboard.edit_roll_no.input"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-eid"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Employee ID
              </Label>
              <Input
                id="edit-eid"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="Optional"
                className={inputClass}
                data-ocid="dashboard.edit_employee_id.input"
              />
            </div>
          )}
          {isStudent && (
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-batch"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                NSQF Level / Semester
              </Label>
              <Input
                id="edit-batch"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. NSQF Level-III - 1st Semester"
                className={inputClass}
                data-ocid="dashboard.edit_batch.input"
              />
            </div>
          )}
          <div
            className="rounded-xl p-3.5 space-y-2"
            style={{
              border: "1px solid oklch(0.88 0.015 255)",
              background: "oklch(0.97 0.008 250)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              <div
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: "oklch(0.50 0.16 150)" }}
              >
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
                    <div
                      className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-xs"
                      style={{ color: "oklch(0.75 0.16 75)" }}
                    >
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading AI...
                    </div>
                  )}
                  {aiStatus === "ready" && (
                    <div
                      className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-xs font-medium"
                      style={{ color: "oklch(0.78 0.16 150)" }}
                    >
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
                    style={{
                      background: "oklch(0.52 0.22 265)",
                      color: "white",
                    }}
                    data-ocid="dashboard.recapture.button"
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => camera.retry?.()}
                    disabled={camera.isLoading}
                    data-ocid="dashboard.retry_camera.button"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
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
            style={{
              background: "oklch(0.52 0.22 265)",
              color: "white",
            }}
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

// ── DeletePersonDialog ───────────────────────────────────────────────────

function DeletePersonDialog({
  person,
  open,
  onClose,
}: { person: PersonSummary | null; open: boolean; onClose: () => void }) {
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
          <AlertDialogTitle className="text-destructive">
            Delete {person?.name}?
          </AlertDialogTitle>
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

// ── ManagePersons ─────────────────────────────────────────────────────────

function ManagePersons() {
  const { data: persons = [], isLoading } = useGetAllPersons();
  const [editTarget, setEditTarget] = useState<PersonSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PersonSummary | null>(null);

  return (
    <div>
      {isLoading ? (
        <div
          className="text-center py-16 text-muted-foreground text-sm"
          data-ocid="dashboard.people.loading_state"
        >
          <Loader2
            className="w-7 h-7 animate-spin mx-auto mb-3"
            style={{ color: "oklch(0.52 0.22 265)" }}
          />
          Loading personnel...
        </div>
      ) : persons.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-ocid="dashboard.people.empty_state"
        >
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 icon-badge icon-badge-indigo">
            <Users style={{ width: 26, height: 26 }} />
          </div>
          <p className="font-semibold text-foreground text-sm">
            No registered personnel
          </p>
          <p className="text-xs mt-1 text-muted-foreground">
            Register a person to manage them here
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid oklch(0.88 0.015 255)" }}
          data-ocid="dashboard.people.table"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    background: "oklch(0.96 0.01 255)",
                    borderBottom: "1px solid oklch(0.88 0.015 255)",
                  }}
                >
                  {["#", "Name", "Type", "ID", "Batch / Roll", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ),
                  )}
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
                      className="transition-colors hover:bg-muted/40"
                      style={{
                        borderBottom: "1px solid oklch(0.92 0.01 255)",
                      }}
                      data-ocid={`dashboard.people.row.item.${i + 1}`}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {p.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={
                            isStudent
                              ? {
                                  background: "oklch(0.92 0.05 265)",
                                  color: "oklch(0.52 0.22 265)",
                                }
                              : {
                                  background: "oklch(0.92 0.05 290)",
                                  color: "oklch(0.58 0.20 290)",
                                }
                          }
                        >
                          {isStudent ? "Student" : "Employee"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {idValue || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {batchRoll}
                      </td>
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
          <div
            className="px-4 py-2.5 text-xs text-muted-foreground"
            style={{
              borderTop: "1px solid oklch(0.92 0.01 255)",
              background: "oklch(0.97 0.006 255)",
            }}
          >
            {persons.length} personnel registered
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

// ── Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const today = new Date();
  const [activeTab, setActiveTab] = useState("attendance");
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

  const inputClass =
    "bg-white border-border focus:border-primary text-foreground focus:shadow-[0_0_0_3px_oklch(0.52_0.22_265_/_0.12)]";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3 mb-8"
      >
        <div className="w-11 h-11 rounded-2xl icon-badge icon-badge-indigo">
          <LayoutDashboard style={{ width: 20, height: 20 }} />
        </div>
        <div>
          <h1
            className="heading-display text-foreground"
            style={{ fontSize: "1.55rem" }}
          >
            Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(today)}
          </p>
        </div>
      </motion.div>

      {/* Stat cards */}
      {statsLoading ? (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          data-ocid="dashboard.loading_state"
        >
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[88px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total People"
            value={Number(stats?.totalPersons ?? 0)}
            icon={Users}
            badgeClass="icon-badge-indigo"
            delay={0}
          />
          <StatCard
            label="Total Attendance"
            value={Number(stats?.totalAttendance ?? 0)}
            icon={CalendarCheck}
            badgeClass="icon-badge-emerald"
            delay={0.05}
          />
          <StatCard
            label="Today's Check-ins"
            value={Number(stats?.todayCheckins ?? 0)}
            icon={Clock}
            badgeClass="icon-badge-violet"
            delay={0.1}
          />
          <StatCard
            label="Active Months"
            value={stats?.activeMonths.length ?? 0}
            icon={BarChart2}
            badgeClass="icon-badge-amber"
            delay={0.15}
          />
        </div>
      )}

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          className="mb-6"
          style={{
            background: "oklch(0.94 0.012 255)",
            border: "1px solid oklch(0.88 0.015 255)",
            borderRadius: "10px",
            padding: "4px",
          }}
          data-ocid="dashboard.tab"
        >
          <TabsTrigger
            value="attendance"
            className="text-sm font-medium transition-all"
            style={
              activeTab === "attendance"
                ? {
                    background: "oklch(0.52 0.22 265)",
                    color: "white",
                    borderRadius: "7px",
                    boxShadow: "0 2px 8px oklch(0.52 0.22 265 / 0.30)",
                  }
                : { color: "oklch(0.45 0.03 255)" }
            }
            data-ocid="dashboard.attendance.tab"
          >
            <ClipboardList className="w-4 h-4 mr-1.5" />
            Attendance Records
          </TabsTrigger>
          <TabsTrigger
            value="people"
            className="text-sm font-medium transition-all"
            style={
              activeTab === "people"
                ? {
                    background: "oklch(0.52 0.22 265)",
                    color: "white",
                    borderRadius: "7px",
                    boxShadow: "0 2px 8px oklch(0.52 0.22 265 / 0.30)",
                  }
                : { color: "oklch(0.45 0.03 255)" }
            }
            data-ocid="dashboard.people.tab"
          >
            <Users2 className="w-4 h-4 mr-1.5" />
            Manage People
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          {/* Filters + CSV */}
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Date
              </Label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className={`h-8 text-sm w-40 ${inputClass}`}
                data-ocid="dashboard.date_filter.input"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Month
              </Label>
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className={`h-8 text-sm w-36 ${inputClass}`}
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
                size="sm"
                onClick={downloadCSV}
                disabled={attendance.length === 0}
                className="flex items-center gap-2 h-8 text-xs font-semibold"
                style={{
                  background: "oklch(0.52 0.22 265)",
                  color: "white",
                  boxShadow: "0 2px 8px oklch(0.52 0.22 265 / 0.25)",
                }}
                data-ocid="dashboard.csv_download.button"
              >
                <Download className="w-3.5 h-3.5" />
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
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : filteredAttendance.length === 0 ? (
            <div
              className="text-center py-16 glass-card"
              data-ocid="dashboard.attendance.empty_state"
            >
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 icon-badge icon-badge-violet">
                <ClipboardList style={{ width: 26, height: 26 }} />
              </div>
              <p className="font-semibold text-foreground text-sm">
                No attendance records
              </p>
              <p className="text-xs mt-1 text-muted-foreground">
                {dateFilter || monthFilter
                  ? "No records match your filter"
                  : "Mark attendance from the Face Scan page"}
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid oklch(0.88 0.015 255)" }}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow
                      style={{
                        background: "oklch(0.96 0.01 255)",
                        borderBottom: "1px solid oklch(0.88 0.015 255)",
                      }}
                    >
                      {[
                        "#",
                        "Name",
                        "Type",
                        "Roll No",
                        "NSQF Level",
                        "Semester",
                        "Slot",
                        "Time",
                        "Date",
                        "Actions",
                      ].map((h) => (
                        <TableHead
                          key={h}
                          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-3"
                        >
                          {h}
                        </TableHead>
                      ))}
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
                          style={{
                            borderBottom: "1px solid oklch(0.92 0.01 255)",
                          }}
                          className="hover:bg-muted/30 transition-colors"
                          data-ocid={`dashboard.attendance.row.item.${idx + 1}`}
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {r.name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-xs font-semibold"
                              style={
                                isStudent
                                  ? {
                                      borderColor: "oklch(0.82 0.08 265)",
                                      color: "oklch(0.52 0.22 265)",
                                      background: "oklch(0.94 0.03 265)",
                                    }
                                  : {
                                      borderColor: "oklch(0.82 0.08 290)",
                                      color: "oklch(0.58 0.20 290)",
                                      background: "oklch(0.94 0.03 290)",
                                    }
                              }
                            >
                              {isStudent ? "Student" : "Employee"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-foreground">
                            {personRollNoMap.get(r.personId.toString()) || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium text-foreground">
                            {level}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-foreground">
                            {semester}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.slot}
                          </TableCell>
                          <TableCell
                            className="font-mono text-sm font-semibold"
                            style={{ color: "oklch(0.52 0.22 265)" }}
                          >
                            {r.timeStr}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {r.dateStr}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                                onClick={() => openEditAtt(r)}
                                data-ocid={`dashboard.attendance.edit_button.${idx + 1}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="people">
          <ManagePersons />
        </TabsContent>
      </Tabs>

      {/* Edit Attendance Dialog */}
      <Dialog open={!!editAtt} onOpenChange={(o) => !o && setEditAtt(null)}>
        <DialogContent data-ocid="dashboard.edit_attendance.dialog">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Edit Attendance Record
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </Label>
              <Input
                value={editAttForm.name}
                onChange={(e) =>
                  setEditAttForm((p) => ({ ...p, name: e.target.value }))
                }
                className={inputClass}
                data-ocid="dashboard.edit_name.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Slot
              </Label>
              <select
                value={editAttForm.slot}
                onChange={(e) =>
                  setEditAttForm((p) => ({ ...p, slot: e.target.value }))
                }
                className="w-full h-10 rounded-lg px-3 text-sm bg-white border border-border text-foreground focus:outline-none focus:border-primary"
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </Label>
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
                  className={inputClass}
                  data-ocid="dashboard.edit_date.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Time
                </Label>
                <Input
                  type="time"
                  value={editAttForm.timeStr}
                  onChange={(e) =>
                    setEditAttForm((p) => ({ ...p, timeStr: e.target.value }))
                  }
                  className={inputClass}
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
              style={{ background: "oklch(0.52 0.22 265)", color: "white" }}
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

      {/* Delete Attendance Dialog */}
      <Dialog
        open={deleteAttId !== null}
        onOpenChange={(o) => !o && setDeleteAttId(null)}
      >
        <DialogContent data-ocid="dashboard.delete_attendance.dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
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
