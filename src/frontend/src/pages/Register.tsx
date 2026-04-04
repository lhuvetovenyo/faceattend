import { useCamera } from "@/camera/useCamera";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  SwitchCamera,
  UserPlus,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";
import { useRegisterPerson } from "../hooks/useQueries";
import { type FaceApi, MODEL_URL, getFaceApi } from "../utils/faceApiCdn";

type PersonTab = "student" | "employee";

interface CaptureState {
  preview: string | null;
  descriptor: number[] | null;
  error: string | null;
}

/** Sanitise a face descriptor: replace NaN/Infinity with 0 so Candid can serialise it */
function sanitiseDescriptor(desc: number[]): number[] {
  return desc.map((v) => (Number.isFinite(v) ? v : 0));
}

const NSQF_SEMESTERS: Record<string, string[]> = {
  "NSQF Level-III": ["1st Semester", "2nd Semester"],
  "NSQF Level-IV": ["1st Semester", "2nd Semester"],
  "NSQF Level-V": ["1st Semester"],
};

export default function Register() {
  const [tab, setTab] = useState<PersonTab>("student");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [captureState, setCaptureState] = useState<CaptureState>({
    preview: null,
    descriptor: null,
    error: null,
  });
  const [capturing, setCapturing] = useState(false);
  const faceApiRef = useRef<FaceApi | null>(null);

  // Student fields
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [nsqfLevel, setNsqfLevel] = useState("");
  const [semester, setSemester] = useState("");

  // Employee fields
  const [employeeName, setEmployeeName] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const { actor, isFetching: actorLoading } = useActor();
  const registerMutation = useRegisterPerson();

  const {
    isActive,
    isLoading,
    error: camError,
    startCamera,
    stopCamera,
    capturePhoto,
    videoRef,
    canvasRef,
    switchCamera,
    retry,
  } = useCamera({
    facingMode: "user",
    width: 640,
    height: 480,
  });

  const _processCanvasRef = useRef<HTMLCanvasElement>(null);

  const loadModels = async () => {
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
    } catch (_e) {
      toast.error("Failed to load AI models — you can still capture manually");
      // Even if AI fails, allow fallback manual capture
      setModelsLoaded(false);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleStartCamera = async () => {
    await Promise.all([loadModels(), startCamera()]);
  };

  // Auto-start camera on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    handleStartCamera();
  }, []);

  // Stop camera on unmount
  // biome-ignore lint/correctness/useExhaustiveDependencies: stopCamera is a stable ref
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  /** Capture with AI face detection */
  const handleCapture = async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    setCaptureState({ preview: null, descriptor: null, error: null });
    try {
      const fa = faceApiRef.current;

      if (modelsLoaded && fa) {
        // AI-assisted capture
        const detection = await fa
          .detectSingleFace(
            videoRef.current,
            new fa.SsdMobilenetv1Options({ minConfidence: 0.5 }),
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          // No face detected — fall through to manual capture with a placeholder descriptor
          const file = await capturePhoto();
          const preview = file ? URL.createObjectURL(file) : null;
          // Use a zero descriptor as placeholder so registration can proceed
          const placeholderDescriptor = new Array(128).fill(0);
          setCaptureState({
            preview,
            descriptor: placeholderDescriptor,
            error: null,
          });
          stopCamera();
          toast.success(
            "Photo captured (no face auto-detected — proceed to register)",
          );
          return;
        }

        const file = await capturePhoto();
        const preview = file ? URL.createObjectURL(file) : null;
        setCaptureState({
          preview,
          descriptor: sanitiseDescriptor(Array.from(detection.descriptor)),
          error: null,
        });
        stopCamera();
        toast.success("Face captured successfully!");
      } else {
        // Manual fallback — no AI, just take a photo
        const file = await capturePhoto();
        const preview = file ? URL.createObjectURL(file) : null;
        const placeholderDescriptor = new Array(128).fill(0);
        setCaptureState({
          preview,
          descriptor: placeholderDescriptor,
          error: null,
        });
        stopCamera();
        toast.success("Photo captured!");
      }
    } catch (e) {
      console.error("Capture error:", e);
      setCaptureState({
        preview: null,
        descriptor: null,
        error: "Photo capture failed. Please try again.",
      });
    } finally {
      setCapturing(false);
    }
  };

  const handleRetake = () => {
    setCaptureState({ preview: null, descriptor: null, error: null });
    startCamera();
    loadModels();
  };

  const handleSubmit = async () => {
    if (!captureState.descriptor) {
      toast.error("Please capture a face photo first");
      return;
    }

    const name = tab === "student" ? studentName.trim() : employeeName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }

    if (!actor) {
      toast.error(
        "Not connected to backend — please wait a moment and try again",
      );
      return;
    }

    const batchValue =
      tab === "student"
        ? nsqfLevel
          ? semester
            ? `${nsqfLevel} - ${semester}`
            : nsqfLevel
          : ""
        : "";

    try {
      await registerMutation.mutateAsync({
        personTypeStr: tab,
        studentId: tab === "student" ? studentId.trim() : "",
        employeeId: tab === "employee" ? employeeId.trim() : "",
        name,
        rollNo: tab === "student" ? rollNo.trim() : "",
        batch: batchValue,
        faceDescriptor: sanitiseDescriptor(captureState.descriptor),
      });

      toast.success(`${name} registered successfully!`);
      setStudentId("");
      setStudentName("");
      setRollNo("");
      setNsqfLevel("");
      setSemester("");
      setEmployeeName("");
      setEmployeeId("");
      setCaptureState({ preview: null, descriptor: null, error: null });
      // Restart camera for next registration
      startCamera();
      loadModels();
    } catch (e) {
      console.error("Registration error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Registration failed: ${msg}`);
    }
  };

  const isBackendReady = !!actor && !actorLoading;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Register Person</h1>
            <p className="text-sm text-muted-foreground">
              Add a new student or employee with face recognition
            </p>
          </div>
          {!isBackendReady && (
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Connecting...
            </span>
          )}
        </div>

        {/* Camera Section */}
        <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Face Photo</span>
            {captureState.descriptor && (
              <span className="ml-auto flex items-center gap-1 text-success text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Captured
              </span>
            )}
          </div>

          <div className="p-4">
            {captureState.preview ? (
              <div className="space-y-3">
                <div
                  className="relative rounded-lg overflow-hidden border border-success/40"
                  style={{ aspectRatio: "4/3" }}
                >
                  <img
                    src={captureState.preview}
                    alt="Captured face"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0">
                    <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-success" />
                    <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-success" />
                    <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-success" />
                    <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-success" />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetake}
                  className="w-full"
                  data-ocid="register.retake.button"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Retake Photo
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Always-mounted camera container */}
                <div
                  className="relative rounded-lg overflow-hidden bg-black"
                  style={{ aspectRatio: "4/3" }}
                >
                  {/* Video always in DOM so ref is available before isActive */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={
                      isActive ? "w-full h-full object-cover" : "hidden"
                    }
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Corner guides — visible only when active */}
                  {isActive && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-3 left-3 w-7 h-7 border-t-2 border-l-2 border-primary" />
                      <div className="absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-primary" />
                      <div className="absolute bottom-3 left-3 w-7 h-7 border-b-2 border-l-2 border-primary" />
                      <div className="absolute bottom-3 right-3 w-7 h-7 border-b-2 border-r-2 border-primary" />
                      <div className="scan-line" />
                    </div>
                  )}

                  {/* Flip camera button — visible only when active */}
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => switchCamera()}
                      className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      data-ocid="register.toggle"
                      aria-label="Switch camera"
                    >
                      <SwitchCamera className="w-5 h-5" />
                    </button>
                  )}

                  {/* Overlay when camera is not yet active */}
                  {!isActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      {isLoading || loadingModels ? (
                        <>
                          <Loader2 className="w-10 h-10 animate-spin text-primary" />
                          <p className="text-sm">
                            {loadingModels
                              ? "Loading AI..."
                              : "Starting camera..."}
                          </p>
                        </>
                      ) : (
                        <>
                          <Camera className="w-10 h-10 opacity-40" />
                          <p className="text-sm">Initializing camera...</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retry()}
                            className="mt-1"
                            data-ocid="register.retry.button"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" /> Retry
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {/* AI loading overlay when camera is active but models still loading */}
                  {isActive && loadingModels && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="flex items-center gap-2 text-white text-sm font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading AI...
                      </div>
                    </div>
                  )}
                </div>

                {captureState.error && (
                  <div
                    className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                    data-ocid="register.error_state"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {captureState.error}
                  </div>
                )}
                {camError && (
                  <div
                    className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                    data-ocid="register.camera_error_state"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {camError.message}
                  </div>
                )}

                {isActive && (
                  <Button
                    onClick={handleCapture}
                    disabled={capturing}
                    className="w-full bg-primary hover:bg-primary/90"
                    data-ocid="register.capture.button"
                  >
                    {capturing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Capturing...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        {modelsLoaded ? "Capture Face" : "Take Photo"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as PersonTab)}>
          <TabsList
            className="w-full mb-6 bg-card border border-border"
            data-ocid="register.tab"
          >
            <TabsTrigger
              value="student"
              className="flex-1"
              data-ocid="register.student.tab"
            >
              Student
            </TabsTrigger>
            <TabsTrigger
              value="employee"
              className="flex-1"
              data-ocid="register.employee.tab"
            >
              Employee
            </TabsTrigger>
          </TabsList>

          <TabsContent value="student" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="studentId">
                  Student ID{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="studentId"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. STU-2024-001"
                  className="bg-card border-border"
                  data-ocid="register.student_id.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="studentName">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="studentName"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. Aisha Sharma"
                  className="bg-card border-border"
                  data-ocid="register.name.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rollNo">
                  Roll No{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="rollNo"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="e.g. 42"
                  className="bg-card border-border"
                  data-ocid="register.roll_no.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  NSQF Level{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </Label>
                <Select
                  value={nsqfLevel}
                  onValueChange={(val) => {
                    setNsqfLevel(val);
                    setSemester("");
                  }}
                >
                  <SelectTrigger
                    className="bg-card border-border"
                    data-ocid="register.nsqf_level.select"
                  >
                    <SelectValue placeholder="Select NSQF Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NSQF Level-III">Level III</SelectItem>
                    <SelectItem value="NSQF Level-IV">Level IV</SelectItem>
                    <SelectItem value="NSQF Level-V">Level V</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {nsqfLevel && (
                <div className="space-y-1.5">
                  <Label>
                    Semester{" "}
                    <span className="text-muted-foreground text-xs">
                      (optional)
                    </span>
                  </Label>
                  <Select value={semester} onValueChange={setSemester}>
                    <SelectTrigger
                      className="bg-card border-border"
                      data-ocid="register.semester.select"
                    >
                      <SelectValue placeholder="Select Semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {(NSQF_SEMESTERS[nsqfLevel] ?? []).map((sem) => (
                        <SelectItem key={sem} value={sem}>
                          {sem}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="employee" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="employeeName">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="employeeName"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="e.g. Rahul Verma"
                  className="bg-card border-border"
                  data-ocid="register.employee_name.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="employeeId">
                  Employee ID{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-2024-007"
                  className="bg-card border-border"
                  data-ocid="register.employee_id.input"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Button
          className="w-full mt-6 h-12 text-base font-semibold bg-primary hover:bg-primary/90"
          onClick={handleSubmit}
          disabled={
            registerMutation.isPending ||
            !captureState.descriptor ||
            !isBackendReady
          }
          data-ocid="register.submit_button"
        >
          {registerMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Registering...
            </>
          ) : !isBackendReady ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Register Person
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
}
