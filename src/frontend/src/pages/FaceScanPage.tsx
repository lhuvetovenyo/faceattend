import { createActor } from "@/backend";
import {
  useAttendance,
  useFaceDescriptors,
  usePersons,
  useRecordAttendance,
} from "@/hooks/useBackend";
import { PersonType } from "@/types";
import type { TimeSlot } from "@/types";
import {
  SLOT_LABELS,
  getClosestSlot,
  getCurrentTimeSlot,
} from "@/utils/timeSlot";
import { useCamera } from "@caffeineai/camera";
import { useActor } from "@caffeineai/core-infrastructure";
import * as faceapi from "@vladmandic/face-api";
import { useCallback, useEffect, useRef, useState } from "react";

type ScanStatus =
  | { kind: "loading"; message: string }
  | { kind: "idle"; message: string }
  | { kind: "noface"; message: string }
  | {
      kind: "match";
      name: string;
      slot: TimeSlot;
      timeStr: string;
      confidence: number;
    }
  | { kind: "already"; name: string; slot: TimeSlot; markedAt: string }
  | { kind: "nomatch"; message: string }
  | { kind: "outside"; message: string }
  | { kind: "error"; message: string };

const _TIME_SLOTS: TimeSlot[] = ["Entry", "Break", "AfterBreak", "Exit"];

function slotToAttendanceSlot(slot: TimeSlot): string | null {
  switch (slot) {
    case "Entry":
      return "entry";
    case "Break":
      return "breakTime";
    case "AfterBreak":
      return "afterBreak";
    case "Exit":
      return "exit";
    default:
      return null;
  }
}

function nsqfLevelLabel(raw: string | undefined): string {
  if (!raw) return "";
  if (raw === "LevelIII") return "Level III";
  if (raw === "LevelIV") return "Level IV";
  if (raw === "LevelV") return "Level V";
  return raw.replace("Level", "Level ");
}

function semesterLabel(sem: string | undefined): string {
  if (!sem) return "";
  if (sem === "Sem1") return "1st Semester";
  if (sem === "Sem2") return "2nd Semester";
  return sem;
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function formatTime12h(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Match threshold — lower = stricter
const MATCH_THRESHOLD = 0.4;
// Debounce: require N consecutive matching frames
const DEBOUNCE_FRAMES = 3;
// Cooldown after recording (ms)
const RECORD_COOLDOWN = 5000;
// Success overlay auto-dismiss (ms)
const SUCCESS_DISMISS = 3000;

// Model URLs — try CDN first, /models as fallback
const CDN_MODELS_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
const LOCAL_MODELS_URL = "/models";

async function loadFaceApiModels(): Promise<void> {
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(CDN_MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(CDN_MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(CDN_MODELS_URL),
    ]);
  } catch {
    // Fallback to local models
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(LOCAL_MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_MODELS_URL),
    ]);
  }
}

// --- Audio helpers using Web Audio API ---
function playSuccessSound(): void {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);

    // First chime — 880 Hz for 0.3s
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc1.connect(gain);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Second chime — 1100 Hz after 0.25s
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.25);
    osc2.connect(gain);
    osc2.start(ctx.currentTime + 0.25);
    osc2.stop(ctx.currentTime + 0.55);

    osc2.onended = () => ctx.close();
  } catch {
    // ignore audio errors in restricted environments
  }
}

function playFailSound(): void {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.5);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

    osc.onended = () => ctx.close();
  } catch {
    // ignore
  }
}

function speak(text: string): void {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      utterance.volume = 1;
      const applyVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          // Prefer modern, clear, natural-sounding voices in priority order
          const preferred =
            voices.find((v) => /Google US English/i.test(v.name)) ||
            voices.find((v) => /Microsoft Aria/i.test(v.name)) ||
            voices.find((v) => /Microsoft Jenny/i.test(v.name)) ||
            voices.find((v) => /Microsoft Zira/i.test(v.name)) ||
            voices.find((v) => /Samantha/i.test(v.name)) ||
            voices.find((v) => /Karen/i.test(v.name)) ||
            voices.find((v) => v.lang === "en-US" && !v.localService) ||
            voices.find((v) => v.lang === "en-US") ||
            voices.find((v) => v.lang.startsWith("en")) ||
            voices[0];
          if (preferred) utterance.voice = preferred;
        }
        window.speechSynthesis.speak(utterance);
      };
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          applyVoiceAndSpeak();
        };
      } else {
        applyVoiceAndSpeak();
      }
    }, 150);
  } catch {
    // ignore
  }
}

// Crop canvas to face bounding box with padding
function cropFaceCanvas(
  source: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
  padding = 20,
): HTMLCanvasElement {
  const x = Math.max(0, box.x - padding);
  const y = Math.max(0, box.y - padding);
  const w = Math.min(source.width - x, box.width + padding * 2);
  const h = Math.min(source.height - y, box.height + padding * 2);

  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = w;
  faceCanvas.height = h;
  const ctx = faceCanvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
  }
  return faceCanvas;
}

export default function FaceScanPage() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [status, setStatus] = useState<ScanStatus>({
    kind: "loading",
    message: "Loading AI models…",
  });
  const [successOverlay, setSuccessOverlay] = useState<{
    name: string;
    slot: TimeSlot;
    timeStr: string;
    confidence: number;
    dateStr: string;
    dayStr: string;
  } | null>(null);
  const [alreadyOverlay, setAlreadyOverlay] = useState<{
    name: string;
    slot: TimeSlot;
    markedAt: string;
  } | null>(null);

  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  const lastFailSoundRef = useRef(0);
  const debounceRef = useRef<{ personId: bigint; name: string; count: number }>(
    { personId: 0n, name: "", count: 0 },
  );

  const { actor } = useActor(createActor);
  const { videoRef, canvasRef, startCamera, isActive, isLoading, error } =
    useCamera({ facingMode: "user" });
  const { data: descriptors } = useFaceDescriptors();
  const { data: persons = [] } = usePersons();
  const personNameMap = new Map(persons.map((p) => [String(p.id), p.name]));
  const recordAttendance = useRecordAttendance();
  const today = new Date().toISOString().split("T")[0] ?? "";
  const { data: allAttendance = [] } = useAttendance();
  const todayAttendance = allAttendance.filter((r) => r.date === today);

  useEffect(() => {
    let cancelled = false;
    async function loadModels() {
      try {
        await loadFaceApiModels();
        if (!cancelled) {
          setModelsLoaded(true);
          setModelError(false);
          setStatus({ kind: "idle", message: "Point your face at the camera" });
        }
      } catch (_e) {
        if (!cancelled) {
          setModelError(true);
          setStatus({ kind: "error", message: "Failed to load AI models" });
        }
      }
    }
    loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (modelsLoaded && !isActive && !isLoading) {
      startCamera();
    }
  }, [modelsLoaded, isActive, isLoading, startCamera]);

  const runDetection = useCallback(async () => {
    if (pausedRef.current) return;
    const video = videoRef.current;
    const canvas = hiddenCanvasRef.current;
    if (
      !video ||
      !canvas ||
      !isActive ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      setStatus({ kind: "idle", message: "Waiting for camera..." });
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const detections = await faceapi
        .detectAllFaces(
          canvas,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.55 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptors();
      if (!detections || detections.length === 0) {
        debounceRef.current = { personId: 0n, name: "", count: 0 };
        setStatus({ kind: "noface", message: "No face detected" });
        return;
      }
      const detection = detections[0];
      const box = detection.detection.box;
      const faceCanvas = cropFaceCanvas(
        canvas,
        { x: box.x, y: box.y, width: box.width, height: box.height },
        24,
      );
      const croppedDetection = await faceapi
        .detectSingleFace(
          faceCanvas,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();
      const queryDescriptor = Array.from(
        croppedDetection ? croppedDetection.descriptor : detection.descriptor,
      );
      const storedDescriptors = descriptors ?? [];
      if (storedDescriptors.length === 0) {
        debounceRef.current = { personId: 0n, name: "", count: 0 };
        setStatus({ kind: "nomatch", message: "No registered faces" });
        return;
      }
      let bestDist = Number.POSITIVE_INFINITY;
      let bestName = "";
      let bestPersonId = 0n;
      for (const entry of storedDescriptors) {
        const personIdStr = entry[0];
        const descriptor = entry[1];
        const dist = euclideanDistance(queryDescriptor, Array.from(descriptor));
        if (dist < bestDist) {
          bestDist = dist;
          bestName = personNameMap.get(personIdStr) ?? personIdStr;
          bestPersonId = BigInt(personIdStr);
        }
      }
      if (bestDist >= MATCH_THRESHOLD) {
        debounceRef.current = { personId: 0n, name: "", count: 0 };
        setStatus({ kind: "nomatch", message: "Face not recognised" });
        const now = Date.now();
        if (now - lastFailSoundRef.current > 4000) {
          lastFailSoundRef.current = now;
          playFailSound();
          speak("Failed. Please try again.");
        }
        return;
      }
      const rawSlot = getCurrentTimeSlot();
      const currentSlot = rawSlot === "None" ? getClosestSlot() : rawSlot;
      const db = debounceRef.current;
      if (db.personId === bestPersonId) {
        debounceRef.current.count += 1;
      } else {
        debounceRef.current = {
          personId: bestPersonId,
          name: bestName,
          count: 1,
        };
      }
      if (debounceRef.current.count < DEBOUNCE_FRAMES) {
        setStatus({ kind: "idle", message: `Recognising ${bestName}…` });
        return;
      }
      debounceRef.current = { personId: 0n, name: "", count: 0 };
      pausedRef.current = true;
      const attendanceSlot = slotToAttendanceSlot(currentSlot);
      const now = new Date();
      const timeStr = formatTime12h(now);
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const date = now.toISOString().split("T")[0] ?? now.toLocaleDateString();
      const existingRecord = todayAttendance.find(
        (r) => String(r.personId) === String(bestPersonId),
      );
      const slotAlreadyMarked = (() => {
        if (!existingRecord) return null;
        switch (currentSlot) {
          case "Entry":
            return existingRecord.entry ?? null;
          case "Break":
            return existingRecord.breakTime ?? null;
          case "AfterBreak":
            return existingRecord.afterBreak ?? null;
          case "Exit":
            return existingRecord.exit ?? null;
          default:
            return null;
        }
      })();
      if (slotAlreadyMarked) {
        playFailSound();
        speak("Attendance already marked for this slot.");
        setAlreadyOverlay({
          name: bestName,
          slot: currentSlot,
          markedAt: slotAlreadyMarked,
        });
        setStatus({
          kind: "already",
          name: bestName,
          slot: currentSlot,
          markedAt: slotAlreadyMarked,
        });
        setTimeout(() => {
          setAlreadyOverlay(null);
          pausedRef.current = false;
          setStatus({ kind: "idle", message: "Point your face at the camera" });
        }, SUCCESS_DISMISS);
        return;
      }
      const dayStr = now.toLocaleDateString("en-GB", { weekday: "long" });
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const dateStr = `${dd}/${mm}/${yyyy}`;
      try {
        let result:
          | { __kind__: "ok"; ok: string }
          | { __kind__: "err"; err: string } = { __kind__: "ok", ok: "" };
        if (attendanceSlot !== null) {
          result = await recordAttendance.mutateAsync({
            personId: String(bestPersonId),
            date,
            slot: attendanceSlot,
            time,
          });
        }
        if (actor && result.__kind__ === "ok") {
          const person = persons.find(
            (p) => String(p.id) === String(bestPersonId),
          );
          if (person) {
            const nowDate = new Date();
            const dd2 = String(nowDate.getDate()).padStart(2, "0");
            const mm2 = String(nowDate.getMonth() + 1).padStart(2, "0");
            const yyyy2 = nowDate.getFullYear();
            const dateForTab = `${dd2}/${mm2}/${yyyy2}`;
            const dayForTab = nowDate.toLocaleDateString("en-GB", {
              weekday: "long",
            });
            const isNsqf = person.personType === PersonType.NSQF;
            const sectionLabel = isNsqf ? "NSQF" : "JIG";
            const sheetTabName = `${sectionLabel} - ${dateForTab} (${dayForTab})`;
            const rollNo =
              typeof person.rollNo === "string"
                ? person.rollNo
                : ((person.rollNo as string[] | undefined)?.[0] ?? "");
            const rec = allAttendance.find(
              (r) => r.personId === String(bestPersonId) && r.date === date,
            );
            const entryTime =
              rec?.entry ?? (currentSlot === "Entry" ? time : "");
            const breakTime2 =
              rec?.breakTime ?? (currentSlot === "Break" ? time : "");
            const afterBreakTime =
              rec?.afterBreak ?? (currentSlot === "AfterBreak" ? time : "");
            const exitTime = rec?.exit ?? (currentSlot === "Exit" ? time : "");
            let rowData: string[];
            if (isNsqf) {
              const nsqfLevel =
                typeof person.nsqfLevel === "string"
                  ? nsqfLevelLabel(person.nsqfLevel)
                  : nsqfLevelLabel(
                      (person.nsqfLevel as string[] | undefined)?.[0],
                    );
              const semester =
                typeof person.semester === "string"
                  ? semesterLabel(person.semester)
                  : semesterLabel(
                      (person.semester as string[] | undefined)?.[0],
                    );
              rowData = [
                person.name,
                rollNo,
                nsqfLevel,
                semester,
                entryTime,
                breakTime2,
                afterBreakTime,
                exitTime,
                dateStr,
                dayStr,
              ];
            } else {
              const course =
                typeof person.course === "string"
                  ? person.course
                  : ((person.course as string[] | undefined)?.[0] ?? "");
              rowData = [
                person.name,
                rollNo,
                course,
                entryTime,
                breakTime2,
                afterBreakTime,
                exitTime,
                dateStr,
                dayStr,
              ];
            }
            const rowDataJson = JSON.stringify(rowData);
            (async () => {
              try {
                const { createSignedJwt } = await import(
                  "../utils/googleSheets"
                );
                const jwt = await createSignedJwt();
                const syncRes = await actor.syncAttendanceWithJwt(
                  jwt,
                  rowDataJson,
                  sheetTabName,
                );
                console.log("Sheets sync result:", syncRes);
              } catch (e) {
                console.error("Sheets sync failed:", e);
              }
            })();
          }
        }
        playSuccessSound();
        speak("Thank you");
        const confidence = Math.round(
          Math.max(0, 1 - bestDist / MATCH_THRESHOLD) * 100,
        );
        setStatus({
          kind: "match",
          name: bestName,
          slot: currentSlot,
          timeStr,
          confidence,
        });
        setSuccessOverlay({
          name: bestName,
          slot: currentSlot,
          timeStr,
          confidence,
          dateStr,
          dayStr,
        });
        setTimeout(() => {
          setSuccessOverlay(null);
        }, SUCCESS_DISMISS);
      } catch {
        setStatus({ kind: "error", message: "Failed to record attendance" });
        playFailSound();
        speak("Unable to record attendance. Please try again.");
      }
      setTimeout(() => {
        pausedRef.current = false;
        setStatus({ kind: "idle", message: "Point your face at the camera" });
      }, RECORD_COOLDOWN);
    } catch {
      // silently ignore detection errors
    }
  }, [
    isActive,
    descriptors,
    personNameMap,
    recordAttendance,
    videoRef,
    todayAttendance,
    actor,
    allAttendance,
    persons,
  ]);

  useEffect(() => {
    if (!modelsLoaded || !isActive) return;
    intervalRef.current = setInterval(runDetection, 800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [modelsLoaded, isActive, runDetection]);

  const [liveClock, setLiveClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => {
      setLiveClock(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const greeting = (() => {
    const h = liveClock.getHours();
    if (h >= 5 && h < 12) return "Morning";
    if (h >= 12 && h < 17) return "Afternoon";
    if (h >= 17 && h < 21) return "Evening";
    return "Night";
  })();

  const ledHours = String(liveClock.getHours()).padStart(2, "0");
  const ledMinutes = String(liveClock.getMinutes()).padStart(2, "0");
  const ledSeconds = String(liveClock.getSeconds()).padStart(2, "0");

  type EmoteState = "neutral" | "smile" | "frown" | "angry";
  const emoteState: EmoteState = (() => {
    switch (status.kind) {
      case "match":
        return "smile";
      case "nomatch":
        return "frown";
      case "already":
        return "angry";
      default:
        return "neutral";
    }
  })();

  const emoteLabel: string = (() => {
    switch (emoteState) {
      case "smile":
        return "Thank you";
      case "frown":
        return "sad";
      case "angry":
        return "really";
      default:
        return "zzzzz";
    }
  })();

  const cameraStatusText = (() => {
    switch (status.kind) {
      case "loading":
        return status.message;
      case "match":
        return `✓ ${status.name} — Attendance Recorded`;
      case "already":
        return `Already marked — ${SLOT_LABELS[status.slot]}`;
      case "nomatch":
        return "Face not recognised — try again";
      case "noface":
        return "No face detected | AI Active";
      case "idle":
        return "Ready — Point your face at the camera";
      case "error":
        return status.message;
      default:
        return "AI Active";
    }
  })();

  return (
    <div
      className="flex flex-col"
      style={{
        height: "100%",
        fontFamily: "'Times New Roman', Times, serif",
        overflow: "hidden",
      }}
      data-ocid="face-scan.page"
    >
      {/* Camera — fills most of the vertical space */}
      <div
        className="relative mx-2 mt-1.5 shrink-0"
        style={{
          background: "#000",
          borderRadius: 10,
          border: "2.5px solid #000",
          overflow: "hidden",
          flex: "0 0 calc(100dvh - 250px)",
          maxHeight: "calc(100dvh - 250px)",
          minHeight: 180,
        }}
        data-ocid="face-scan.camera-area"
      >
        <canvas ref={hiddenCanvasRef} className="hidden" />
        <canvas ref={canvasRef} className="hidden" />

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background p-4">
            <span className="text-3xl">📷</span>
            <p
              className="text-center text-xs text-foreground"
              style={{ fontWeight: 400 }}
            >
              {error.type === "permission"
                ? "Camera access denied. Please allow camera."
                : error.message}
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
        )}

        {/* Scanning line */}
        {isActive && modelsLoaded && (
          <div
            className={[
              "absolute left-0 right-0 h-0.5 animate-scan z-10 pointer-events-none",
              status.kind === "match"
                ? "bg-green-400 shadow-[0_0_8px_3px_rgba(74,222,128,0.8)]"
                : status.kind === "nomatch"
                  ? "bg-red-400 shadow-[0_0_8px_3px_rgba(248,113,113,0.8)]"
                  : status.kind === "noface" || status.kind === "idle"
                    ? "bg-primary/60"
                    : "bg-yellow-400 shadow-[0_0_8px_3px_rgba(250,204,21,0.8)]",
            ].join(" ")}
          />
        )}

        {/* Loading overlay */}
        {(status.kind === "loading" || isLoading || (!isActive && !error)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
            <div className="flex flex-col items-center gap-2">
              <svg
                className="animate-spin h-7 w-7 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                aria-label="Loading"
                role="img"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span
                className="text-xs text-white/80"
                style={{ fontWeight: 400 }}
              >
                {status.kind === "loading"
                  ? status.message
                  : "Starting camera..."}
              </span>
              {modelError && (
                <button
                  type="button"
                  className="mt-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-xl"
                  style={{
                    fontFamily: "'Times New Roman', Times, serif",
                    fontWeight: 400,
                  }}
                  onClick={() => {
                    setModelError(false);
                    setStatus({
                      kind: "loading",
                      message: "Retrying AI models…",
                    });
                    loadFaceApiModels()
                      .then(() => {
                        setModelsLoaded(true);
                        setStatus({
                          kind: "idle",
                          message: "Point your face at the camera",
                        });
                      })
                      .catch(() => {
                        setModelError(true);
                        setStatus({
                          kind: "error",
                          message: "Failed to load AI models",
                        });
                      });
                  }}
                  data-ocid="face-scan.retry_models_button"
                >
                  Retry Loading Models
                </button>
              )}
            </div>
          </div>
        )}

        {/* Success overlay */}
        {successOverlay && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20"
            data-ocid="face-scan.success_state"
          >
            <div
              className="flex flex-col items-center gap-1.5 bg-card/95 backdrop-blur-sm px-6 py-4 shadow-xl mx-4"
              style={{ borderRadius: 14 }}
            >
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-2xl text-green-500">✓</span>
              </div>
              <p
                className="text-sm text-foreground text-center"
                style={{ fontWeight: 400 }}
              >
                Thank you
              </p>
              <p
                className="text-xs text-primary text-center"
                style={{ fontWeight: 400 }}
              >
                {SLOT_LABELS[successOverlay.slot]}
              </p>
              <p
                className="text-lg text-foreground tabular-nums"
                style={{ fontWeight: 400 }}
              >
                {successOverlay.timeStr}
              </p>
              <p
                className="text-xs text-muted-foreground tabular-nums"
                style={{ fontWeight: 400 }}
              >
                {successOverlay.dayStr}, {successOverlay.dateStr}
              </p>
              <p className="text-xs text-green-500" style={{ fontWeight: 400 }}>
                Attendance Recorded ✓
              </p>
            </div>
          </div>
        )}

        {/* Already-marked overlay */}
        {alreadyOverlay && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20"
            data-ocid="face-scan.already_marked_state"
          >
            <div
              className="flex flex-col items-center gap-1.5 bg-card/95 backdrop-blur-sm px-6 py-4 shadow-xl mx-4"
              style={{ borderRadius: 14 }}
            >
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                <span className="text-2xl text-destructive">✗</span>
              </div>
              <p
                className="text-sm text-destructive text-center"
                style={{ fontWeight: 400 }}
              >
                Already Marked
              </p>
              <p
                className="text-xs text-muted-foreground text-center"
                style={{ fontWeight: 400 }}
              >
                {SLOT_LABELS[alreadyOverlay.slot]} recorded at{" "}
                <span className="text-foreground tabular-nums">
                  {formatTime12h(
                    new Date(`1970-01-01T${alreadyOverlay.markedAt}:00`),
                  )}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Schedule box — NSQF / JIG time slots */}
      <div
        className="mx-2 mt-1 shrink-0"
        style={{
          border: "1.5px solid #1a1a3a",
          borderRadius: 8,
          background: "#050510",
          overflow: "hidden",
        }}
        data-ocid="face-scan.schedule-display"
      >
        {/* NSQF row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "4px 10px",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "0.52rem",
              color: "#00fff7",
              textShadow: "0 0 5px #00fff7",
              letterSpacing: "0.12em",
              minWidth: 30,
            }}
          >
            NSQF
          </span>
          <div
            style={{
              width: 1,
              alignSelf: "stretch",
              background: "#1a1a3a",
              flexShrink: 0,
            }}
          />
          {[
            { label: "Entry", time: "08:50" },
            { label: "Break", time: "12:00" },
            { label: "After Brk", time: "12:25" },
            { label: "Exit", time: "15:30" },
          ].map((slot, i) => (
            <div
              key={slot.label}
              style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}
            >
              {i > 0 && (
                <div
                  style={{
                    width: 1,
                    height: 12,
                    background: "#1a1a3a",
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: "0.45rem",
                  color: "#00ff41aa",
                  letterSpacing: "0.05em",
                  minWidth: 28,
                }}
              >
                {slot.label}
              </span>
              <span
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: "0.52rem",
                  color: "#00ff41",
                  textShadow: "0 0 4px #00ff41",
                  letterSpacing: "0.08em",
                }}
              >
                {slot.time}
              </span>
            </div>
          ))}
        </div>
        {/* Divider */}
        <div style={{ height: 1, background: "#1a1a3a", margin: "0 8px" }} />
        {/* JIG row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "4px 10px",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "0.52rem",
              color: "#ff9944",
              textShadow: "0 0 5px #ff9944",
              letterSpacing: "0.12em",
              minWidth: 30,
            }}
          >
            JIG
          </span>
          <div
            style={{
              width: 1,
              alignSelf: "stretch",
              background: "#1a1a3a",
              flexShrink: 0,
            }}
          />
          {[
            { label: "Entry", time: "08:50" },
            { label: "Break", time: "12:00" },
            { label: "After Brk", time: "12:25" },
            { label: "Exit", time: "15:30" },
          ].map((slot, i) => (
            <div
              key={slot.label}
              style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}
            >
              {i > 0 && (
                <div
                  style={{
                    width: 1,
                    height: 12,
                    background: "#1a1a3a",
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: "0.45rem",
                  color: "#ff9944aa",
                  letterSpacing: "0.05em",
                  minWidth: 28,
                }}
              >
                {slot.label}
              </span>
              <span
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: "0.52rem",
                  color: "#ff9944",
                  textShadow: "0 0 4px #ff9944",
                  letterSpacing: "0.08em",
                }}
              >
                {slot.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Info bar: Emote LEFT | divider | LED Clock RIGHT */}
      <div
        className="mx-2 mt-1 flex items-stretch overflow-hidden shrink-0"
        style={{
          border: "1.5px solid #1a1a3a",
          borderRadius: 8,
          background: "#050510",
          height: 64,
        }}
        data-ocid="face-scan.time-display"
      >
        {/* LEFT — Pixel emote */}
        <div
          className="flex flex-col items-center justify-center shrink-0"
          style={{
            width: "30%",
            borderRight: "1px solid #1a1a3a",
            background: "#07071a",
            gap: 2,
          }}
        >
          {emoteState === "neutral" && (
            <svg
              width="30"
              height="30"
              viewBox="0 0 44 44"
              fill="none"
              aria-label="Neutral face"
              role="img"
            >
              <circle
                cx="22"
                cy="22"
                r="19"
                fill="oklch(0.88 0.06 260)"
                stroke="oklch(0.55 0.12 260)"
                strokeWidth="1.5"
              />
              <rect
                x="13"
                y="16"
                width="5"
                height="5"
                rx="1"
                fill="oklch(0.22 0.06 260)"
              />
              <rect
                x="26"
                y="16"
                width="5"
                height="5"
                rx="1"
                fill="oklch(0.22 0.06 260)"
              />
              <rect
                x="14"
                y="29"
                width="16"
                height="2.5"
                rx="1.2"
                fill="oklch(0.42 0.08 260)"
              />
              <text
                x="28"
                y="12"
                fontSize="5"
                fill="#00fff7"
                opacity="0.7"
                style={{ fontFamily: "monospace" }}
              >
                z
              </text>
              <text
                x="31"
                y="9"
                fontSize="4"
                fill="#00fff7"
                opacity="0.5"
                style={{ fontFamily: "monospace" }}
              >
                z
              </text>
              <text
                x="33"
                y="7"
                fontSize="3"
                fill="#00fff7"
                opacity="0.35"
                style={{ fontFamily: "monospace" }}
              >
                z
              </text>
            </svg>
          )}
          {emoteState === "smile" && (
            <svg
              width="30"
              height="30"
              viewBox="0 0 44 44"
              fill="none"
              aria-label="Smiling face"
              role="img"
            >
              <circle
                cx="22"
                cy="22"
                r="19"
                fill="oklch(0.88 0.12 145)"
                stroke="oklch(0.55 0.16 145)"
                strokeWidth="1.5"
              />
              <rect
                x="13"
                y="16"
                width="5"
                height="5"
                rx="1"
                fill="oklch(0.22 0.08 145)"
              />
              <rect
                x="26"
                y="16"
                width="5"
                height="5"
                rx="1"
                fill="oklch(0.22 0.08 145)"
              />
              <path
                d="M14 27 Q22 36 30 27"
                stroke="oklch(0.32 0.12 145)"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
              <ellipse
                cx="13"
                cy="28"
                rx="3.5"
                ry="2"
                fill="oklch(0.75 0.14 20)"
                opacity="0.35"
              />
              <ellipse
                cx="31"
                cy="28"
                rx="3.5"
                ry="2"
                fill="oklch(0.75 0.14 20)"
                opacity="0.35"
              />
            </svg>
          )}
          {emoteState === "frown" && (
            <svg
              width="30"
              height="30"
              viewBox="0 0 44 44"
              fill="none"
              aria-label="Sad face"
              role="img"
            >
              <circle
                cx="22"
                cy="22"
                r="19"
                fill="oklch(0.88 0.08 25)"
                stroke="oklch(0.55 0.18 25)"
                strokeWidth="1.5"
              />
              <rect
                x="13"
                y="16"
                width="5"
                height="5"
                rx="1"
                fill="oklch(0.22 0.08 25)"
              />
              <rect
                x="26"
                y="16"
                width="5"
                height="5"
                rx="1"
                fill="oklch(0.22 0.08 25)"
              />
              <path
                d="M14 33 Q22 24 30 33"
                stroke="oklch(0.42 0.15 25)"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
              <ellipse
                cx="16"
                cy="25"
                rx="1.5"
                ry="3"
                fill="oklch(0.65 0.2 260)"
                opacity="0.7"
              />
            </svg>
          )}
          {emoteState === "angry" && (
            <svg
              width="30"
              height="30"
              viewBox="0 0 44 44"
              fill="none"
              aria-label="Angry face"
              role="img"
            >
              <circle
                cx="22"
                cy="22"
                r="19"
                fill="oklch(0.85 0.14 30)"
                stroke="oklch(0.55 0.22 30)"
                strokeWidth="1.5"
              />
              <line
                x1="11"
                y1="13"
                x2="19"
                y2="16"
                stroke="oklch(0.22 0.1 30)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="33"
                y1="13"
                x2="25"
                y2="16"
                stroke="oklch(0.22 0.1 30)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <rect
                x="13"
                y="17"
                width="5"
                height="5"
                rx="1"
                fill="oklch(0.22 0.1 30)"
              />
              <rect
                x="26"
                y="17"
                width="5"
                height="5"
                rx="1"
                fill="oklch(0.22 0.1 30)"
              />
              <rect
                x="14"
                y="30"
                width="16"
                height="3"
                rx="1"
                fill="oklch(0.38 0.14 30)"
              />
            </svg>
          )}
          <span
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "0.55rem",
              color:
                emoteState === "smile"
                  ? "#00ff41"
                  : emoteState === "frown"
                    ? "#ff6b6b"
                    : emoteState === "angry"
                      ? "#ff9944"
                      : "#00fff7",
              textShadow:
                emoteState === "smile"
                  ? "0 0 6px #00ff41"
                  : emoteState === "frown"
                    ? "0 0 6px #ff6b6b"
                    : emoteState === "angry"
                      ? "0 0 6px #ff9944"
                      : "0 0 6px #00fff7",
              letterSpacing: "0.05em",
            }}
            data-ocid="face-scan.emote-label"
          >
            {emoteLabel}
          </span>
        </div>

        {/* RIGHT — Futuristic LED digital clock */}
        <div
          className="flex flex-col items-center justify-center flex-1"
          style={{
            background: "linear-gradient(180deg, #020214 0%, #050520 100%)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.02) 2px, rgba(0,255,65,0.02) 4px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              fontSize: "0.4rem",
              letterSpacing: "0.3em",
              color: "#00fff7",
              textShadow: "0 0 6px #00fff7",
              fontFamily: "'Courier New', monospace",
              opacity: 0.8,
              marginBottom: 1,
            }}
          >
            ▸ {greeting} ◂
          </div>
          <div
            className="tabular-nums leading-none"
            style={{
              fontFamily: "'Courier New', 'Lucida Console', monospace",
              fontSize: "1.55rem",
              fontWeight: 400,
              letterSpacing: "0.08em",
              color: "#00ff41",
              textShadow:
                "0 0 3px #fff, 0 0 8px #00ff41, 0 0 18px #00ff41cc, 0 0 35px #00ff4188",
              lineHeight: 1,
              filter: "drop-shadow(0 0 4px #00ff41)",
            }}
            data-ocid="face-scan.led-clock"
          >
            <span style={{ color: "#e0ffe8", textShadow: "0 0 6px #00ff41" }}>
              {ledHours}
            </span>
            <span
              style={{
                color: "#00ff41",
                animation: "led-blink 1s step-end infinite",
                margin: "0 1px",
              }}
            >
              :
            </span>
            <span style={{ color: "#e0ffe8", textShadow: "0 0 6px #00ff41" }}>
              {ledMinutes}
            </span>
            <span
              style={{
                color: "#00ff41",
                animation: "led-blink 1s step-end infinite",
                margin: "0 1px",
              }}
            >
              :
            </span>
            <span
              style={{ fontSize: "0.85rem", color: "#a0ffb8", opacity: 0.8 }}
            >
              {ledSeconds}
            </span>
          </div>
        </div>
      </div>

      {/* Status bar — compact single line */}
      <div
        className="mx-2 mt-1 flex items-center justify-between px-2.5 py-1.5 bg-card border border-border shrink-0"
        style={{ borderRadius: 7 }}
        data-ocid="face-scan.status-bar"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {status.kind === "loading" ? (
            <svg
              className="animate-spin h-3 w-3 text-primary shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              aria-label="Loading"
              role="img"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : status.kind === "match" ? (
            <span className="text-green-500 text-xs shrink-0">✓</span>
          ) : status.kind === "nomatch" || status.kind === "already" ? (
            <span className="text-destructive text-xs shrink-0">✗</span>
          ) : (
            <span className="text-primary text-xs shrink-0">⊙</span>
          )}
          <span
            className="text-[10px] text-foreground truncate"
            style={{
              fontFamily: "'Times New Roman', Times, serif",
              fontWeight: 400,
            }}
            data-ocid="face-scan.status-text"
          >
            {cameraStatusText}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span
            className="text-[10px] text-muted-foreground"
            style={{ fontWeight: 400 }}
          >
            AI Active
          </span>
        </div>
      </div>

      {/* Footer — very compact */}
      <div className="flex items-center justify-center py-1 shrink-0">
        <span
          className="text-[9px] text-muted-foreground"
          style={{
            fontFamily: "'Times New Roman', Times, serif",
            fontWeight: 400,
          }}
        >
          Build by Atoto
        </span>
      </div>
    </div>
  );
}
