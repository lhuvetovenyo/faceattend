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
  { name: "Morning", label: "Morning", time: "6–10 AM", start: 6, end: 10 },
  {
    name: "Late Morning",
    label: "Late Morning",
    time: "10–12 PM",
    start: 10,
    end: 12,
  },
  {
    name: "Afternoon",
    label: "Afternoon",
    time: "12–4 PM",
    start: 12,
    end: 16,
  },
  { name: "Evening", label: "Evening", time: "4–8 PM", start: 16, end: 20 },
];

function getCurrentSlot(): string {
  const h = new Date().getHours();
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
  } = useCamera({ facingMode: "user", width: 640, height: 480 });

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
    manualBtnTimerRef.current = setTimeout(() => setShowManualBtn(true), 5000);
    autoManualTimerRef.current = setTimeout(() => {
      if (!modelsLoadedRef.current) {
        setManualMode((prev) => {
          if (!prev) toast.info("AI not available — switched to manual mode");
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
      const { webhookUrl } = loadSettings();
      if (webhookUrl && actor) {
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
          if (batchStr.includes(" - ")) {
            const parts = batchStr.split(" - ");
            nsqfLevel = (parts[0]?.trim() ?? "")
              .replace("NSQF ", "")
              .replace("-", " ");
            semester = parts[1]?.trim() ?? "";
          } else if (batchStr) {
            nsqfLevel = batchStr.trim().replace("NSQF ", "").replace("-", " ");
          }
        } catch (_err) {}
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
      } else if (webhookUrl) {
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
  const isMatch = scanStatus === "match";

  // Clean bracket color: indigo for active, slate for idle
  const bracketColor = isMatch
    ? "oklch(0.55 0.18 150)"
    : "oklch(0.52 0.22 265)";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl icon-badge icon-badge-sky">
              <ScanFace style={{ width: 22, height: 22 }} />
            </div>
            <div>
              <h1
                className="heading-display text-foreground"
                style={{ fontSize: "1.55rem" }}
              >
                Biometric Scan
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {manualMode
                  ? "Manual Attendance Verification"
                  : "AI-Powered Attendance Verification"}
              </p>
            </div>
            <div
              className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: "oklch(0.92 0.05 265)",
                color: "oklch(0.52 0.22 265)",
              }}
            >
              {slot} Slot
            </div>
          </div>
        </div>

        {/* Manual mode banner */}
        {manualMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl flex items-center gap-2 text-sm"
            style={{
              background: "oklch(0.97 0.06 80)",
              border: "1px solid oklch(0.88 0.10 75)",
              color: "oklch(0.50 0.16 70)",
            }}
            data-ocid="scan.manual_mode.panel"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            AI not available — select person manually
          </motion.div>
        )}

        {/* AI loading indicator */}
        {!manualMode && (loadingModels || (!modelsLoaded && !camLoading)) && (
          <div
            className="mb-4 p-3 rounded-xl flex items-center gap-2 text-sm"
            style={{
              background: "oklch(0.94 0.04 265)",
              border: "1px solid oklch(0.82 0.08 265)",
              color: "oklch(0.52 0.22 265)",
            }}
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
                className="ml-auto text-xs underline underline-offset-2"
                style={{ color: "oklch(0.52 0.22 265)" }}
                data-ocid="scan.manual_mode.button"
              >
                Use Manual
              </button>
            )}
          </div>
        )}

        {/* Camera viewfinder */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            aspectRatio: "4/3",
            background: "#0a0a0a",
            border: `2px solid ${isMatch ? "oklch(0.70 0.18 150)" : "oklch(0.82 0.06 265)"}`,
            boxShadow: isMatch
              ? "0 0 0 4px oklch(0.92 0.06 150), 0 8px 24px rgba(0,0,0,0.12)"
              : "0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Subtle scan ring */}
          {isActive && modelsLoaded && (
            <div
              className="absolute pointer-events-none spin-slow"
              style={{
                inset: "12%",
                borderRadius: "50%",
                border: `1.5px dashed ${bracketColor}`,
                opacity: 0.35,
              }}
            />
          )}

          {/* Clean corner markers */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute top-4 left-4 w-6 h-6"
              style={{
                borderTopWidth: 2.5,
                borderLeftWidth: 2.5,
                borderTopStyle: "solid",
                borderLeftStyle: "solid",
                borderColor: bracketColor,
                borderTopLeftRadius: 4,
              }}
            />
            <div
              className="absolute top-4 right-4 w-6 h-6"
              style={{
                borderTopWidth: 2.5,
                borderRightWidth: 2.5,
                borderTopStyle: "solid",
                borderRightStyle: "solid",
                borderColor: bracketColor,
                borderTopRightRadius: 4,
              }}
            />
            <div
              className="absolute bottom-4 left-4 w-6 h-6"
              style={{
                borderBottomWidth: 2.5,
                borderLeftWidth: 2.5,
                borderBottomStyle: "solid",
                borderLeftStyle: "solid",
                borderColor: bracketColor,
                borderBottomLeftRadius: 4,
              }}
            />
            <div
              className="absolute bottom-4 right-4 w-6 h-6"
              style={{
                borderBottomWidth: 2.5,
                borderRightWidth: 2.5,
                borderBottomStyle: "solid",
                borderRightStyle: "solid",
                borderColor: bracketColor,
                borderBottomRightRadius: 4,
              }}
            />
            {/* Subtle status label */}
            {isActive && (
              <div
                className="absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full text-[10px] font-medium"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  color: bracketColor,
                  backdropFilter: "blur(4px)",
                }}
              >
                SCANNING
              </div>
            )}
          </div>

          {/* Flip camera button */}
          {isActive && (
            <button
              type="button"
              onClick={() => switchCamera()}
              className="absolute top-12 right-3 z-10 p-2 rounded-xl transition-colors"
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
              data-ocid="scan.toggle"
              aria-label="Switch camera"
            >
              <SwitchCamera className="w-4 h-4 text-white" />
            </button>
          )}

          {camError && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(10,10,10,0.85)" }}
            >
              <div className="text-center space-y-2 px-4">
                <AlertCircle
                  className="w-10 h-10 mx-auto"
                  style={{ color: "oklch(0.65 0.18 20)" }}
                />
                <p className="text-sm text-white/80">{camError.message}</p>
              </div>
            </div>
          )}
          {!isActive && !camLoading && !camError && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(10,10,10,0.80)" }}
            >
              <div className="text-center space-y-2">
                <ScanFace
                  className="w-12 h-12 mx-auto opacity-40"
                  style={{ color: "oklch(0.75 0.12 265)" }}
                />
                <p className="text-sm text-white/60">Starting camera...</p>
              </div>
            </div>
          )}
          {camLoading && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(10,10,10,0.80)" }}
            >
              <Loader2
                className="w-8 h-8 animate-spin"
                style={{ color: "oklch(0.75 0.12 265)" }}
              />
            </div>
          )}
        </div>

        {/* AI status panel */}
        {!manualMode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-3 px-4 py-3 rounded-xl flex items-center gap-3"
            style={{
              background:
                scanStatus === "match"
                  ? "oklch(0.94 0.06 150)"
                  : scanStatus === "unknown"
                    ? "oklch(0.96 0.05 75)"
                    : "oklch(0.97 0.01 255)",
              border:
                scanStatus === "match"
                  ? "1px solid oklch(0.82 0.12 150)"
                  : scanStatus === "unknown"
                    ? "1px solid oklch(0.88 0.08 75)"
                    : "1px solid oklch(0.88 0.015 255)",
            }}
            data-ocid={
              scanStatus === "match"
                ? "scan.match.success_state"
                : "scan.status.panel"
            }
          >
            {scanStatus === "match" && (
              <CheckCircle2
                className="w-5 h-5 flex-shrink-0"
                style={{ color: "oklch(0.55 0.18 150)" }}
              />
            )}
            {scanStatus === "unknown" && (
              <AlertCircle
                className="w-5 h-5 flex-shrink-0"
                style={{ color: "oklch(0.60 0.16 70)" }}
              />
            )}
            {(scanStatus === "idle" || scanStatus === "no-face") && (
              <ScanFace
                className="w-5 h-5 flex-shrink-0"
                style={{ color: "oklch(0.55 0.04 255)" }}
              />
            )}
            <div className="flex-1">
              <p
                className="font-semibold text-sm"
                style={{
                  color:
                    scanStatus === "match"
                      ? "oklch(0.40 0.16 150)"
                      : scanStatus === "unknown"
                        ? "oklch(0.45 0.14 70)"
                        : "oklch(0.35 0.03 255)",
                }}
              >
                {scanStatus === "match" && matchResult
                  ? `Match: ${matchResult.name}`
                  : scanStatus === "no-face"
                    ? "No face detected"
                    : scanStatus === "unknown"
                      ? "Unknown face"
                      : "Initializing..."}
              </p>
              {matchResult && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Type: {matchResult.personTypeStr}
                </p>
              )}
            </div>
            {modelsLoaded && isActive && (
              <span
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: "oklch(0.52 0.22 265)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full pulse-dot"
                  style={{ background: "oklch(0.52 0.22 265)" }}
                />
                AI Active
              </span>
            )}
          </motion.div>
        )}

        {/* Slot grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SLOTS.map((s, i) => {
            const isCurrentSlot = slot === s.name;
            return (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="rounded-xl p-2.5 text-center text-xs border transition-all"
                style={{
                  background: isCurrentSlot
                    ? "oklch(0.92 0.05 265)"
                    : "oklch(1 0 0)",
                  borderColor: isCurrentSlot
                    ? "oklch(0.72 0.14 265)"
                    : "oklch(0.88 0.015 255)",
                  color: isCurrentSlot
                    ? "oklch(0.45 0.22 265)"
                    : "oklch(0.45 0.03 255)",
                  boxShadow: isCurrentSlot
                    ? "0 2px 8px oklch(0.52 0.22 265 / 0.15)"
                    : "0 1px 3px rgba(0,0,0,0.04)",
                  fontWeight: isCurrentSlot ? 600 : 400,
                }}
              >
                <div>{s.label}</div>
                <div className="opacity-60 mt-0.5 text-[10px]">{s.time}</div>
              </motion.div>
            );
          })}
          {slot === "General" && (
            <div
              className="rounded-xl p-2 text-center text-xs border col-span-4"
              style={{
                background: "oklch(0.92 0.05 265)",
                borderColor: "oklch(0.72 0.14 265)",
                color: "oklch(0.45 0.22 265)",
                fontWeight: 600,
              }}
            >
              <div>General</div>
              <div className="text-[10px] opacity-60">
                Outside regular hours
              </div>
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
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Select person to mark attendance:
            </h2>
            {persons.length === 0 ? (
              <div
                className="text-center py-10 text-muted-foreground text-sm"
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
                    className="flex items-center gap-3 p-3.5 rounded-xl glass-card transition-all hover:shadow-lift"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{
                        background: isStudent
                          ? "oklch(0.92 0.05 265)"
                          : "oklch(0.92 0.05 290)",
                        color: isStudent
                          ? "oklch(0.52 0.22 265)"
                          : "oklch(0.58 0.20 290)",
                      }}
                    >
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">
                        {person.name}
                      </p>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
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
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleManualMark(person)}
                      disabled={markingAttendance}
                      className="h-8 px-3 text-xs font-medium"
                      style={{
                        background: "oklch(0.52 0.22 265)",
                        color: "white",
                      }}
                      data-ocid={`scan.mark_button.${idx + 1}`}
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
                className="p-3.5 rounded-xl flex items-center gap-2"
                style={{
                  background: "oklch(0.94 0.06 150)",
                  border: "1px solid oklch(0.82 0.12 150)",
                }}
                data-ocid="scan.already_checked.success_state"
              >
                <CheckCircle2
                  className="w-5 h-5"
                  style={{ color: "oklch(0.55 0.18 150)" }}
                />
                <span
                  className="text-sm font-semibold"
                  style={{ color: "oklch(0.40 0.16 150)" }}
                >
                  Already checked in for {slot} slot
                </span>
              </div>
            ) : (
              <Button
                className="w-full h-12 text-sm font-semibold"
                style={{
                  background: "oklch(0.52 0.22 265)",
                  color: "white",
                  boxShadow: "0 4px 16px oklch(0.52 0.22 265 / 0.40)",
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
