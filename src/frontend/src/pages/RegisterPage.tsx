import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddPerson } from "@/hooks/useBackend";

import { PersonType } from "@/backend";
import { useCamera } from "@caffeineai/camera";
import * as faceapi from "@vladmandic/face-api";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  User,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type PersonTab = "NSQF" | "JIG";
type AutoCaptureState = "idle" | "detecting" | "countdown" | "captured";

const CDN_MODELS_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
const LOCAL_MODELS_URL = "/models";

let modelsLoaded = false;
let modelsLoading = false;
let modelsError = false;

async function ensureModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) {
    await new Promise<void>((resolve, reject) => {
      const interval = setInterval(() => {
        if (modelsLoaded) {
          clearInterval(interval);
          resolve();
        }
        if (modelsError) {
          clearInterval(interval);
          reject(new Error("Models failed to load"));
        }
      }, 100);
    });
    return;
  }
  modelsLoading = true;
  modelsError = false;
  try {
    try {
      console.log("[FaceAttend] Loading face-api models from CDN…");
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(CDN_MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(CDN_MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(CDN_MODELS_URL),
      ]);
    } catch {
      console.log("[FaceAttend] CDN failed, trying local models…");
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(LOCAL_MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_MODELS_URL),
      ]);
    }
    modelsLoaded = true;
    console.log("[FaceAttend] Face models loaded successfully.");
  } catch (err) {
    modelsError = true;
    modelsLoaded = false;
    throw err;
  } finally {
    modelsLoading = false;
  }
}

export default function RegisterPage() {
  const [activeTab, setActiveTab] = useState<PersonTab>("NSQF");
  const [name, setName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [course, setCourse] = useState("");
  const [nsqfLevel, setNsqfLevel] = useState<string>("");
  const [semester, setSemester] = useState<string>("");
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [modelsReady, setModelsReady] = useState(modelsLoaded);
  const [modelsLoadError, setModelsLoadError] = useState(false);
  const [autoState, setAutoState] = useState<AutoCaptureState>("idle");
  const [countdown, setCountdown] = useState(3);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const addPerson = useAddPerson();
  const mountedRef = useRef(true);
  const autoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDetectingRef = useRef(false);
  const autoStateRef = useRef<AutoCaptureState>("idle");
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);

  const {
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    isActive,
    isLoading: cameraLoading,
    error: cameraError,
  } = useCamera({ facingMode: "user" });

  const loadModels = useCallback(async () => {
    setModelsLoadError(false);
    try {
      await ensureModels();
      if (mountedRef.current) {
        setModelsReady(true);
        setModelsLoadError(false);
      }
    } catch (err) {
      console.error("[FaceAttend] Model load error:", err);
      if (mountedRef.current) {
        setModelsReady(false);
        setModelsLoadError(true);
        modelsError = false;
        modelsLoaded = false;
        modelsLoading = false;
      }
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only
  useEffect(() => {
    mountedRef.current = true;
    loadModels();
    startCamera();
    return () => {
      mountedRef.current = false;
      stopCamera();
      if (autoPollRef.current) clearInterval(autoPollRef.current);
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reactive on nsqfLevel only
  useEffect(() => {
    setSemester("");
  }, [nsqfLevel]);

  useEffect(() => {
    autoStateRef.current = autoState;
  }, [autoState]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reactive on activeTab only
  useEffect(() => {
    setName("");
    setRollNo("");
    setCourse("");
    setNsqfLevel("");
    setSemester("");
    setDescriptor(null);
    setAutoState("idle");
    setConfidence(null);
    autoStateRef.current = "idle";
    setRegistrationSuccess(false);
  }, [activeTab]);

  const captureNow = useCallback(async () => {
    const video = videoRef.current;
    const canvas = hiddenCanvasRef.current;
    if (!video || !canvas || !isActive || !modelsReady) {
      setAutoState("idle");
      autoStateRef.current = "idle";
      setCountdown(3);
      return;
    }
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    if (vw === 0 || vh === 0) {
      setAutoState("idle");
      autoStateRef.current = "idle";
      setCountdown(3);
      return;
    }
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setAutoState("idle");
      autoStateRef.current = "idle";
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const detection = await faceapi
        .detectSingleFace(
          canvas,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!detection) {
        if (mountedRef.current) {
          setAutoState("idle");
          autoStateRef.current = "idle";
          setCountdown(3);
          setConfidence(null);
        }
        return;
      }
      const captureConf = Math.round(detection.detection.score * 100);
      if (mountedRef.current) setConfidence(captureConf);
      const box = detection.detection.box;
      const padX = Math.max(0, box.x - 20);
      const padY = Math.max(0, box.y - 20);
      const padW = Math.min(canvas.width - padX, box.width + 40);
      const padH = Math.min(canvas.height - padY, box.height + 40);
      let finalDescriptor: number[];
      if (padW > 0 && padH > 0) {
        const faceCanvas = document.createElement("canvas");
        faceCanvas.width = padW;
        faceCanvas.height = padH;
        const fctx = faceCanvas.getContext("2d");
        if (fctx)
          fctx.drawImage(canvas, padX, padY, padW, padH, 0, 0, padW, padH);
        const croppedDet = await faceapi
          .detectSingleFace(
            faceCanvas,
            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }),
          )
          .withFaceLandmarks()
          .withFaceDescriptor();
        finalDescriptor = Array.from(
          croppedDet ? croppedDet.descriptor : detection.descriptor,
        );
      } else {
        finalDescriptor = Array.from(detection.descriptor);
      }
      if (finalDescriptor.length !== 128) {
        if (mountedRef.current) {
          setAutoState("idle");
          autoStateRef.current = "idle";
          setCountdown(3);
          toast.error("Face descriptor extraction failed, please try again.");
        }
        return;
      }
      if (mountedRef.current) {
        setDescriptor(finalDescriptor);
        setAutoState("captured");
        autoStateRef.current = "captured";
      }
    } catch (err) {
      console.error("[FaceAttend] captureNow error:", err);
      if (mountedRef.current) {
        setAutoState("idle");
        autoStateRef.current = "idle";
        setCountdown(3);
      }
    }
  }, [isActive, modelsReady, videoRef]);

  const runAutoDetect = useCallback(async () => {
    if (!modelsReady || !isActive || autoDetectingRef.current || descriptor)
      return;
    if (autoStateRef.current === "captured") return;
    const video = videoRef.current;
    const canvas = hiddenCanvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    autoDetectingRef.current = true;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      autoDetectingRef.current = false;
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const det = await faceapi
        .detectSingleFace(
          canvas,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!mountedRef.current) return;
      if (det) {
        const liveConf = Math.round(det.detection.score * 100);
        setConfidence(liveConf);
        if (autoStateRef.current === "idle" && liveConf >= 60) {
          setAutoState("countdown");
          autoStateRef.current = "countdown";
          setCountdown(3);
          let c = 3;
          const tick = () => {
            c -= 1;
            if (c <= 0) {
              captureNow();
            } else {
              setCountdown(c);
              countdownTimerRef.current = setTimeout(tick, 1000);
            }
          };
          countdownTimerRef.current = setTimeout(tick, 1000);
        }
      } else {
        setConfidence(null);
        if (autoStateRef.current === "countdown") {
          if (countdownTimerRef.current)
            clearTimeout(countdownTimerRef.current);
          setAutoState("idle");
          autoStateRef.current = "idle";
          setCountdown(3);
        }
      }
    } catch {
      /* ignore */
    } finally {
      autoDetectingRef.current = false;
    }
  }, [modelsReady, isActive, descriptor, videoRef, captureNow]);

  useEffect(() => {
    if (!modelsReady || !isActive || descriptor) {
      if (autoPollRef.current) clearInterval(autoPollRef.current);
      return;
    }
    autoPollRef.current = setInterval(runAutoDetect, 600);
    return () => {
      if (autoPollRef.current) clearInterval(autoPollRef.current);
    };
  }, [modelsReady, isActive, descriptor, runAutoDetect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!descriptor || descriptor.length !== 128) {
      toast.error("Please wait for face capture to complete.");
      if (descriptor) {
        setDescriptor(null);
        setAutoState("idle");
        autoStateRef.current = "idle";
      }
      return;
    }
    const personType = activeTab === "NSQF" ? PersonType.NSQF : PersonType.JIG;
    addPerson.mutate(
      {
        name: name.trim(),
        personType,
        faceDescriptor: Array.from(descriptor),
        rollNo: rollNo.trim() || undefined,
        course: course.trim() || undefined,
        nsqfLevel: nsqfLevel || undefined,
        semester: semester || undefined,
      },
      {
        onSuccess: (newId) => {
          console.log(`[FaceAttend] Registered ${name.trim()} (ID: ${newId})`);
          setRegistrationSuccess(true);
          toast.success("Registered successfully!");
          setTimeout(() => {
            if (mountedRef.current) {
              setName("");
              setRollNo("");
              setCourse("");
              setNsqfLevel("");
              setSemester("");
              setDescriptor(null);
              setAutoState("idle");
              autoStateRef.current = "idle";
              setCountdown(3);
              setConfidence(null);
              setRegistrationSuccess(false);
            }
          }, 2500);
        },
        onError: (err) => {
          toast.error(
            `Registration failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      },
    );
  }

  const canSubmit =
    name.trim().length > 0 &&
    descriptor !== null &&
    descriptor.length === 128 &&
    !addPerson.isPending;
  const semesterOptions =
    nsqfLevel === "Level-V"
      ? [{ value: "1st Semester", label: "1st Semester" }]
      : [
          { value: "1st Semester", label: "1st Semester" },
          { value: "2nd Semester", label: "2nd Semester" },
        ];

  const captureStatusText = descriptor
    ? "✓ Face captured"
    : autoState === "countdown"
      ? `Hold still… (${countdown})`
      : confidence !== null && confidence > 0
        ? `Detecting… ${confidence}%`
        : "Scanning…";

  const captureStatusColor = descriptor
    ? "text-green-600 dark:text-green-400"
    : autoState === "countdown"
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-muted-foreground";

  return (
    <div
      className="flex flex-col"
      style={{
        height: "100%",
        fontFamily: "'Times New Roman', Times, serif",
        overflow: "hidden",
        minHeight: "calc(100dvh - 52px)",
      }}
      data-ocid="register.page"
    >
      <canvas ref={hiddenCanvasRef} className="hidden" />

      {/* Section toggle — compact bar at top */}
      <div className="flex px-2 pt-1.5 pb-1 gap-1 shrink-0">
        {(["NSQF", "JIG"] as PersonTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            data-ocid={`register.${tab.toLowerCase()}_tab`}
            onClick={() => setActiveTab(tab)}
            className={[
              "flex-1 py-1.5 px-2 rounded-lg text-xs transition-smooth",
              activeTab === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground",
            ].join(" ")}
            style={{
              fontFamily: "'Times New Roman', Times, serif",
              fontWeight: 400,
            }}
          >
            {tab === "NSQF" ? "NSQF" : "JIG"}
          </button>
        ))}
      </div>

      {/* Camera — same height as scan page camera, fills proportionally */}
      <div
        className="relative mx-2 shrink-0"
        style={{
          background: "#000",
          borderRadius: 8,
          border: descriptor
            ? "2px solid #22c55e"
            : autoState === "countdown"
              ? "2px solid #eab308"
              : "2.5px solid #000",
          overflow: "hidden",
          height: "calc(100dvh - 310px)",
          minHeight: 200,
          maxHeight: 380,
        }}
        data-ocid="register.camera-area"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning line */}
        {isActive && !cameraError && (
          <div
            className={[
              "absolute left-0 right-0 h-0.5 animate-scan z-10 pointer-events-none",
              descriptor
                ? "bg-green-400 shadow-[0_0_8px_2px_rgba(74,222,128,0.8)]"
                : autoState === "countdown" ||
                    (confidence !== null && confidence > 0)
                  ? "bg-yellow-400 shadow-[0_0_8px_2px_rgba(250,204,21,0.8)]"
                  : "bg-primary/80",
            ].join(" ")}
          />
        )}

        {/* Camera loading */}
        {(cameraLoading || !isActive) && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 gap-1.5 z-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">
              {cameraLoading ? "Starting…" : "Initializing…"}
            </span>
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 gap-2 px-4 text-center z-20">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-xs text-destructive">{cameraError.message}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => startCamera()}
              data-ocid="register.retry_camera_button"
              className="rounded-lg h-7 text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </div>
        )}

        {/* Model loading */}
        {!modelsReady && !modelsLoadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 gap-1.5 z-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">
              Loading face detection…
            </span>
          </div>
        )}

        {/* Model error */}
        {modelsLoadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 gap-2 px-4 text-center z-20">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-xs text-destructive">
              Face detection models failed.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                modelsLoaded = false;
                modelsLoading = false;
                modelsError = false;
                loadModels();
              }}
              data-ocid="register.retry_models_button"
              className="rounded-lg h-7 text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </div>
        )}

        {/* Countdown overlay */}
        {autoState === "countdown" && !descriptor && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-30">
            <span className="text-4xl text-white drop-shadow-lg">
              {countdown}
            </span>
            <span className="text-xs text-white/90 mt-1">Hold still…</span>
          </div>
        )}

        {/* Success overlay */}
        {registrationSuccess && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/90 z-40 gap-1">
            <CheckCircle2 className="w-10 h-10 text-white" />
            <span className="text-white text-sm">Registered!</span>
          </div>
        )}

        {/* Auto-detecting label */}
        {modelsReady && isActive && !descriptor && autoState === "idle" && (
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10">
            <span className="text-[10px] bg-black/60 text-white/90 rounded-full px-2 py-0.5">
              {confidence !== null && confidence > 0
                ? `${confidence}% — detecting…`
                : "Auto-detecting…"}
            </span>
          </div>
        )}
      </div>

      {/* Capture status — single compact line */}
      <div
        className="mx-2 mt-1 px-2.5 py-1 bg-muted/40 border border-border shrink-0"
        style={{ borderRadius: 6 }}
      >
        <div className="flex items-center gap-1.5">
          {descriptor ? (
            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
          ) : autoState === "countdown" ? (
            <Loader2 className="w-3 h-3 text-yellow-500 animate-spin shrink-0" />
          ) : (
            <div className="w-3 h-3 rounded-full border border-muted-foreground/40 shrink-0" />
          )}
          <span
            className={`text-[10px] ${captureStatusColor}`}
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            {captureStatusText}
          </span>
        </div>
      </div>

      {/* Registration form — compact, no scroll needed */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-1.5 px-2 pt-1.5 pb-2 flex-1"
        style={{ overflow: "visible" }}
      >
        {/* Name + Roll No */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="reg-name"
              className="text-[10px] flex items-center gap-0.5"
              style={{ fontWeight: 400 }}
            >
              <User className="w-2.5 h-2.5" /> Name{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reg-name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-8 text-xs rounded-lg px-2"
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
              data-ocid="register.name_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="reg-roll"
              className="text-[10px]"
              style={{ fontWeight: 400 }}
            >
              Roll No
            </Label>
            <Input
              id="reg-roll"
              placeholder="e.g. R-001"
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value)}
              className="h-8 text-xs rounded-lg px-2"
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
              data-ocid="register.roll_no_input"
            />
          </div>
        </div>

        {/* NSQF fields */}
        {activeTab === "NSQF" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="nsqf-level"
                className="text-[10px]"
                style={{ fontWeight: 400 }}
              >
                Level
              </Label>
              <Select value={nsqfLevel} onValueChange={(v) => setNsqfLevel(v)}>
                <SelectTrigger
                  id="nsqf-level"
                  className="h-8 text-xs rounded-lg"
                  data-ocid="register.nsqf_level_select"
                >
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Level-III">Level III</SelectItem>
                  <SelectItem value="Level-IV">Level IV</SelectItem>
                  <SelectItem value="Level-V">Level V</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="nsqf-semester"
                className="text-[10px]"
                style={{ fontWeight: 400 }}
              >
                Semester
              </Label>
              <Select
                value={semester}
                onValueChange={(v) => setSemester(v)}
                disabled={!nsqfLevel}
              >
                <SelectTrigger
                  id="nsqf-semester"
                  className="h-8 text-xs rounded-lg"
                  data-ocid="register.semester_select"
                >
                  <SelectValue
                    placeholder={nsqfLevel ? "Select" : "Pick level first"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {semesterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* JIG field */}
        {activeTab === "JIG" && (
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="jig-course"
              className="text-[10px]"
              style={{ fontWeight: 400 }}
            >
              Course (optional)
            </Label>
            <Input
              id="jig-course"
              placeholder="e.g. Web Development"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="h-8 text-xs rounded-lg px-2"
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
              data-ocid="register.course_input"
            />
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-9 text-sm rounded-xl mt-auto"
          disabled={!canSubmit}
          data-ocid="register.submit_button"
          style={{
            fontFamily: "'Times New Roman', Times, serif",
            fontWeight: 400,
          }}
        >
          {addPerson.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Registering…
            </>
          ) : registrationSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Registered!
            </>
          ) : (
            "Register Person"
          )}
        </Button>
      </form>

      {/* Footer */}
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
