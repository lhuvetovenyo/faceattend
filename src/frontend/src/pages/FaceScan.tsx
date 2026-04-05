import { useCamera } from "@/camera/useCamera";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ScanFace,
  SwitchCamera,
  UserCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";
import {
  type DescriptorEntry,
  type PersonSummary,
  useGetAllFaceDescriptors,
  useGetAllPersons,
  useRecordAttendance,
} from "../hooks/useQueries";
import { loadSettings } from "../hooks/useSettings";
import { type FaceApi, MODEL_URL, getFaceApi } from "../utils/faceApiCdn";

type ScanStatus = "idle" | "no-face" | "unknown" | "match";

interface MatchResult {
  personId: bigint;
  name: string;
  personTypeStr: string;
  entry: DescriptorEntry;
}

const SLOTS = [
  {
    name: "Entry Time",
    label: "Entry Time",
    time: "8:00–9:30",
    start: 8,
    end: 9.5,
  },
  { name: "Break", label: "Break", time: "12:00–13:30", start: 12, end: 13.5 },
  {
    name: "Afterbreak",
    label: "Afterbreak",
    time: "13:40–14:30",
    start: 13.67,
    end: 14.5,
  },
  {
    name: "Exit Time",
    label: "Exit Time",
    time: "15:00–16:30",
    start: 15,
    end: 16.5,
  },
];

function getCurrentSlot(): string {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const slot = SLOTS.find((s) => h >= s.start && h < s.end);
  return slot ? slot.name : "General";
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FaceScan() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [showManualBtn, setShowManualBtn] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);
  const faceApiRef = useRef<FaceApi | null>(null);
  const manualBtnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoManualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelsLoadedRef = useRef(false);

  const { actor } = useActor();
  const { data: descriptors = [] } = useGetAllFaceDescriptors();
  const { data: persons = [] } = useGetAllPersons();
  const recordAttendance = useRecordAttendance();

  const {
    isActive,
    isLoading: camLoading,
    error: camError,
    startCamera,
    videoRef,
    canvasRef,
    switchCamera,
  } = useCamera({
    facingMode: "user",
    width: 640,
    height: 480,
  });

  const loadModels = useCallback(async () => {
    if (modelsLoaded || loadingModels) return;
    setLoadingModels(true);
    try {
      const fa = await getFaceApi();
      faceApiRef.current = fa;
      await Promise.all([
        fa.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      // Clear timers since models loaded successfully
      if (manualBtnTimerRef.current) clearTimeout(manualBtnTimerRef.current);
      if (autoManualTimerRef.current) clearTimeout(autoManualTimerRef.current);
    } catch (_e) {
      toast.error("Failed to load AI models — switching to manual mode");
      setManualMode(true);
    } finally {
      setLoadingModels(false);
    }
  }, [modelsLoaded, loadingModels]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    loadModels();
    startCamera();

    // Show manual mode button after 5 seconds if models haven't loaded
    manualBtnTimerRef.current = setTimeout(() => {
      setShowManualBtn(true);
    }, 5000);

    // Auto-switch to manual mode after 12 seconds if models still haven't loaded
    autoManualTimerRef.current = setTimeout(() => {
      if (!modelsLoadedRef.current) {
        setManualMode((prev) => {
          if (!prev) {
            toast.info("AI not available — switched to manual mode");
          }
          return true;
        });
      }
    }, 12000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (manualBtnTimerRef.current) clearTimeout(manualBtnTimerRef.current);
      if (autoManualTimerRef.current) clearTimeout(autoManualTimerRef.current);
    };
  }, []);

  // Clear fallback timers once models load
  useEffect(() => {
    if (modelsLoaded) {
      modelsLoadedRef.current = true;
      setShowManualBtn(false);
      setManualMode(false);
      if (manualBtnTimerRef.current) clearTimeout(manualBtnTimerRef.current);
      if (autoManualTimerRef.current) clearTimeout(autoManualTimerRef.current);
    }
  }, [modelsLoaded]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: videoRef is stable
  useEffect(() => {
    if (!isActive || !modelsLoaded) return;
    const fa = faceApiRef.current;
    if (!fa) return;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      if (isProcessingRef.current || !videoRef.current) return;
      isProcessingRef.current = true;

      try {
        const detection = await fa
          .detectSingleFace(
            videoRef.current,
            new fa.SsdMobilenetv1Options({ minConfidence: 0.5 }),
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          setScanStatus("no-face");
          setMatchResult(null);
          setAlreadyCheckedIn(false);
          isProcessingRef.current = false;
          return;
        }

        if (descriptors.length === 0) {
          setScanStatus("unknown");
          setMatchResult(null);
          isProcessingRef.current = false;
          return;
        }

        let bestDist = Number.POSITIVE_INFINITY;
        let bestEntry: DescriptorEntry | null = null;
        const queryDesc = detection.descriptor;

        for (const entry of descriptors) {
          const stored = new Float32Array(entry.faceDescriptor);
          const dist = fa.euclideanDistance(queryDesc, stored);
          if (dist < bestDist) {
            bestDist = dist;
            bestEntry = entry;
          }
        }

        if (bestDist < 0.6 && bestEntry) {
          const typeStr =
            bestEntry.personType === "student" ? "student" : "employee";
          const result: MatchResult = {
            personId: bestEntry.id,
            name: bestEntry.name,
            personTypeStr: typeStr,
            entry: bestEntry,
          };
          setScanStatus("match");
          setMatchResult(result);

          const slot = getCurrentSlot();
          const dateStr = toLocalDateStr(new Date());
          if (slot && actor) {
            const already = await actor.hasAttendedSlot(
              bestEntry.id,
              slot,
              dateStr,
            );
            setAlreadyCheckedIn(already);
          }
        } else {
          setScanStatus("unknown");
          setMatchResult(null);
          setAlreadyCheckedIn(false);
        }
      } catch (_e) {
        // silently ignore frame errors
      } finally {
        isProcessingRef.current = false;
      }
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, modelsLoaded, descriptors, actor]);

  const handleMarkAttendance = async (overrideMatch?: MatchResult) => {
    const target = overrideMatch ?? matchResult;
    if (!target) return;
    const slot = getCurrentSlot();

    const now = new Date();
    const dateStr = toLocalDateStr(now);
    const monthStr = dateStr.slice(0, 7);
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const year = BigInt(now.getFullYear());
    const month = BigInt(now.getMonth() + 1);
    const day = BigInt(now.getDate());

    if (!overrideMatch && alreadyCheckedIn) {
      toast.warning(`${target.name} already checked in for ${slot} slot`);
      return;
    }

    setMarkingAttendance(true);
    try {
      await recordAttendance.mutateAsync({
        personId: target.personId,
        personTypeStr: target.personTypeStr,
        name: target.name,
        slot,
        dateStr,
        monthStr,
        timeStr,
        year,
        month,
        day,
      });

      // Fire-and-forget webhook POST with full updated payload
      // Only send webhook for Entry Time and Exit Time slots
      const webhookSlots = ["Entry Time", "Exit Time"];
      const { webhookUrl } = loadSettings();
      if (webhookSlots.includes(slot) && webhookUrl && actor) {
        // Fetch full person details to get rollNo, batch, studentId, employeeId
        let rollNo = "";
        let studentId = "";
        let employeeId = "";
        let nsqfLevel = "";
        let semester = "";

        try {
          const personSummary = await actor.getPersonSummary(target.personId);
          rollNo = personSummary.rollNo ?? "";
          studentId = personSummary.studentId ?? "";
          employeeId = personSummary.employeeId ?? "";
          const batchStr = personSummary.batch ?? "";
          // batch is stored as "NSQF Level-III - 1st Semester" for students
          if (batchStr.includes(" - ")) {
            const parts = batchStr.split(" - ");
            nsqfLevel = (parts[0]?.trim() ?? "")
              .replace("NSQF ", "")
              .replace("-", " ");
            semester = parts[1]?.trim() ?? "";
          } else if (batchStr) {
            nsqfLevel = batchStr.trim().replace("NSQF ", "").replace("-", " ");
          }
        } catch (_err) {
          // Gracefully fall back — don't let a fetch failure break the success flow
        }

        const payload = new URLSearchParams({
          personId: String(target.personId),
          name: target.name,
          personType: target.personTypeStr,
          rollNo,
          studentId,
          employeeId,
          nsqfLevel,
          semester,
          slot,
          date: dateStr,
          month: monthStr,
          time: timeStr,
          year: String(now.getFullYear()),
          day: String(now.getDate()),
          verificationCount: "",
        });

        fetch(webhookUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload.toString(),
        }).catch(() => {});
      } else if (webhookSlots.includes(slot) && webhookUrl) {
        // actor not available — send minimal payload without person details
        const payload = new URLSearchParams({
          personId: String(target.personId),
          name: target.name,
          personType: target.personTypeStr,
          rollNo: "",
          studentId: "",
          employeeId: "",
          nsqfLevel: "",
          semester: "",
          slot,
          date: dateStr,
          month: monthStr,
          time: timeStr,
          year: String(now.getFullYear()),
          day: String(now.getDate()),
          verificationCount: "",
        });

        fetch(webhookUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload.toString(),
        }).catch(() => {});
      }

      toast.success(
        `✓ Attendance marked for ${target.name} — ${slot} at ${timeStr}`,
      );
      if (!overrideMatch) setAlreadyCheckedIn(true);
    } catch (_e) {
      toast.error("Failed to record attendance");
    } finally {
      setMarkingAttendance(false);
    }
  };

  const handleManualMark = async (person: PersonSummary) => {
    const typeStr = person.personType === "student" ? "student" : "employee";
    const fakeMatch: MatchResult = {
      personId: person.id,
      name: person.name,
      personTypeStr: typeStr,
      entry: {
        id: person.id,
        personType: person.personType,
        name: person.name,
        faceDescriptor: [],
      },
    };
    await handleMarkAttendance(fakeMatch);
  };

  const slot = getCurrentSlot();

  const statusConfig: Record<
    ScanStatus,
    { label: string; color: string; bg: string; border: string }
  > = {
    idle: {
      label: "Initializing...",
      color: "text-muted-foreground",
      bg: "bg-muted/30",
      border: "border-border",
    },
    "no-face": {
      label: "No face detected",
      color: "text-muted-foreground",
      bg: "bg-muted/20",
      border: "border-border",
    },
    unknown: {
      label: "Unknown face",
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/30",
    },
    match: {
      label: matchResult ? `Match found: ${matchResult.name}` : "Match found!",
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/30",
    },
  };

  const status = statusConfig[scanStatus];
  const bracketColor =
    scanStatus === "match" ? "oklch(0.65 0.18 142)" : "oklch(0.58 0.20 250)";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <ScanFace className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Face Scan</h1>
            <p className="text-sm text-muted-foreground">
              {manualMode
                ? "Manual attendance verification"
                : "AI-powered attendance verification"}
            </p>
          </div>
          <div className="ml-auto px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold">
            {slot} Slot
          </div>
        </div>

        {/* Manual mode banner */}
        {manualMode && (
          <div
            className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-center gap-2 text-sm text-warning"
            data-ocid="scan.manual_mode.panel"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            AI not available — select person manually
          </div>
        )}

        {/* AI loading indicator */}
        {!manualMode && (loadingModels || (!modelsLoaded && !camLoading)) && (
          <div
            className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2 text-sm text-primary"
            data-ocid="scan.loading_state"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            {loadingModels
              ? "Loading AI face recognition models..."
              : "Preparing..."}
            {showManualBtn && !modelsLoaded && (
              <button
                type="button"
                onClick={() => setManualMode(true)}
                className="ml-auto text-xs underline underline-offset-2 text-primary/80 hover:text-primary"
                data-ocid="scan.manual_mode.button"
              >
                Use Manual Mode
              </button>
            )}
          </div>
        )}

        {/* Camera viewfinder */}
        <div
          className="rounded-xl overflow-hidden border border-border bg-black relative"
          style={{ aspectRatio: "4/3" }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Corner brackets */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute top-4 left-4 w-8 h-8"
              style={{
                borderTopWidth: 3,
                borderLeftWidth: 3,
                borderTopStyle: "solid",
                borderLeftStyle: "solid",
                borderColor: bracketColor,
              }}
            />
            <div
              className="absolute top-4 right-4 w-8 h-8"
              style={{
                borderTopWidth: 3,
                borderRightWidth: 3,
                borderTopStyle: "solid",
                borderRightStyle: "solid",
                borderColor: bracketColor,
              }}
            />
            <div
              className="absolute bottom-4 left-4 w-8 h-8"
              style={{
                borderBottomWidth: 3,
                borderLeftWidth: 3,
                borderBottomStyle: "solid",
                borderLeftStyle: "solid",
                borderColor: bracketColor,
              }}
            />
            <div
              className="absolute bottom-4 right-4 w-8 h-8"
              style={{
                borderBottomWidth: 3,
                borderRightWidth: 3,
                borderBottomStyle: "solid",
                borderRightStyle: "solid",
                borderColor: bracketColor,
              }}
            />
            {isActive && (
              <div
                className={
                  scanStatus === "match" ? "scan-line-green" : "scan-line"
                }
              />
            )}
          </div>

          {/* Flip camera button */}
          {isActive && (
            <button
              type="button"
              onClick={() => switchCamera()}
              className="absolute top-14 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              data-ocid="scan.toggle"
              aria-label="Switch camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}

          {camError && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/90">
              <div className="text-center space-y-2">
                <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
                <p className="text-sm text-destructive">{camError.message}</p>
              </div>
            </div>
          )}
          {!isActive && !camLoading && !camError && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/80">
              <div className="text-center space-y-2">
                <ScanFace className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
                <p className="text-sm text-muted-foreground">
                  Starting camera...
                </p>
              </div>
            </div>
          )}
          {camLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/80">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
        </div>

        {/* AI status pill — only show when NOT in manual mode */}
        {!manualMode && (
          <div
            className={`mt-4 px-4 py-3 rounded-xl border ${status.bg} ${status.border} flex items-center gap-3`}
          >
            {scanStatus === "match" && (
              <CheckCircle2 className="w-5 h-5 text-success" />
            )}
            {scanStatus === "unknown" && (
              <AlertCircle className="w-5 h-5 text-warning" />
            )}
            {(scanStatus === "idle" || scanStatus === "no-face") && (
              <ScanFace className="w-5 h-5 text-muted-foreground" />
            )}
            <div className="flex-1">
              <p className={`font-semibold ${status.color}`}>{status.label}</p>
              {matchResult && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Type:{" "}
                  {matchResult.personTypeStr === "student"
                    ? "Student"
                    : "Employee"}
                </p>
              )}
            </div>
            {modelsLoaded && isActive && (
              <span className="text-xs text-muted-foreground font-mono">
                AI Active
              </span>
            )}
          </div>
        )}

        {/* Attendance slots info */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {SLOTS.map((s) => {
            const isCurrentSlot = slot === s.name;
            return (
              <div
                key={s.name}
                className={`rounded-lg p-2 text-center text-xs border transition-all ${
                  isCurrentSlot
                    ? "bg-primary/20 border-primary/40 text-primary font-semibold"
                    : "bg-muted/20 border-border text-muted-foreground"
                }`}
              >
                <div>{s.label}</div>
                <div>{s.time}</div>
              </div>
            );
          })}
          {slot === "General" && (
            <div className="rounded-lg p-2 text-center text-xs border transition-all bg-primary/20 border-primary/40 text-primary font-semibold col-span-4">
              <div>General</div>
              <div>Outside regular hours</div>
            </div>
          )}
        </div>

        {/* Manual mode: person list */}
        {manualMode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-2"
            data-ocid="scan.manual_mode.panel"
          >
            <h2 className="text-sm font-semibold text-foreground mb-2">
              Select person to mark attendance:
            </h2>
            {persons.length === 0 ? (
              <div
                className="text-center py-8 text-muted-foreground text-sm"
                data-ocid="scan.empty_state"
              >
                No registered persons. Register someone first.
              </div>
            ) : (
              persons.map((person, idx) => {
                const isStudent = person.personType === "student";
                return (
                  <div
                    key={String(person.id)}
                    data-ocid={`scan.item.${idx + 1}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">
                        {person.name}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isStudent
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-violet-500/20 text-violet-400"
                        }`}
                      >
                        {isStudent ? "Student" : "Employee"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      disabled={markingAttendance}
                      onClick={() => handleManualMark(person)}
                      data-ocid="scan.mark_attendance.button"
                      style={{
                        backgroundColor: "oklch(0.58 0.18 142)",
                        color: "white",
                      }}
                    >
                      {markingAttendance ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <UserCheck className="w-3 h-3 mr-1" />
                          Mark
                        </>
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {/* AI mode: mark attendance button */}
        {!manualMode && scanStatus === "match" && matchResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4"
          >
            {alreadyCheckedIn ? (
              <div
                className="p-3 rounded-xl bg-muted/30 border border-border flex items-center gap-2 text-muted-foreground"
                data-ocid="scan.already_checked.success_state"
              >
                <CheckCircle2 className="w-5 h-5 text-success" />
                <span className="text-sm">
                  Already checked in for {slot} slot
                </span>
              </div>
            ) : (
              <Button
                className="w-full h-12 text-base font-semibold"
                style={{
                  backgroundColor: "oklch(0.58 0.18 142)",
                  color: "white",
                }}
                onClick={() => handleMarkAttendance()}
                disabled={markingAttendance}
                data-ocid="scan.mark_attendance.button"
              >
                {markingAttendance ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Marking...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Mark Attendance — {slot}
                  </>
                )}
              </Button>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
