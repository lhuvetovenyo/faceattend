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

  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [nsqfLevel, setNsqfLevel] = useState("");
  const [semester, setSemester] = useState("");
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
  } = useCamera({ facingMode: "user", width: 640, height: 480 });

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
      setModelsLoaded(false);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleStartCamera = async () => {
    await Promise.all([loadModels(), startCamera()]);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    handleStartCamera();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stopCamera is a stable ref
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    setCaptureState({ preview: null, descriptor: null, error: null });
    try {
      const fa = faceApiRef.current;
      if (modelsLoaded && fa) {
        const detection = await fa
          .detectSingleFace(
            videoRef.current,
            new fa.SsdMobilenetv1Options({ minConfidence: 0.5 }),
          )
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (!detection) {
          const file = await capturePhoto();
          const preview = file ? URL.createObjectURL(file) : null;
          setCaptureState({
            preview,
            descriptor: new Array(128).fill(0),
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
        const file = await capturePhoto();
        const preview = file ? URL.createObjectURL(file) : null;
        setCaptureState({
          preview,
          descriptor: new Array(128).fill(0),
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
      startCamera();
      loadModels();
    } catch (e) {
      console.error("Registration error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Registration failed: ${msg}`);
    }
  };

  const isBackendReady = !!actor && !actorLoading;

  const inputClass =
    "bg-white border-border focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-all focus:shadow-[0_0_0_3px_oklch(0.52_0.22_265_/_0.12)]";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl icon-badge icon-badge-indigo">
            <UserPlus style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              Register Person
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enroll Biometric Profile
            </p>
          </div>
          {!isBackendReady && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Connecting...
            </span>
          )}
        </div>

        {/* Camera Section */}
        <div className="mb-6 glass-card overflow-hidden">
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom: "1px solid oklch(0.88 0.015 255)" }}
          >
            <div className="w-7 h-7 rounded-lg icon-badge icon-badge-sky flex-shrink-0">
              <Camera style={{ width: 14, height: 14 }} />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Face Photo
            </span>
            {captureState.descriptor && (
              <span
                className="ml-auto flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "oklch(0.50 0.16 150)" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Captured
              </span>
            )}
          </div>

          <div className="p-4">
            {captureState.preview ? (
              <div className="space-y-3">
                <div
                  className="relative rounded-xl overflow-hidden"
                  style={{
                    aspectRatio: "4/3",
                    border: "2px solid oklch(0.82 0.12 150)",
                    boxShadow: "0 0 0 3px oklch(0.92 0.06 150)",
                  }}
                >
                  <img
                    src={captureState.preview}
                    alt="Captured face"
                    className="w-full h-full object-cover"
                  />
                  {/* Clean corner brackets */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div
                      className="absolute top-3 left-3 w-5 h-5"
                      style={{
                        borderTop: "2.5px solid oklch(0.55 0.18 150)",
                        borderLeft: "2.5px solid oklch(0.55 0.18 150)",
                        borderTopLeftRadius: 3,
                      }}
                    />
                    <div
                      className="absolute top-3 right-3 w-5 h-5"
                      style={{
                        borderTop: "2.5px solid oklch(0.55 0.18 150)",
                        borderRight: "2.5px solid oklch(0.55 0.18 150)",
                        borderTopRightRadius: 3,
                      }}
                    />
                    <div
                      className="absolute bottom-3 left-3 w-5 h-5"
                      style={{
                        borderBottom: "2.5px solid oklch(0.55 0.18 150)",
                        borderLeft: "2.5px solid oklch(0.55 0.18 150)",
                        borderBottomLeftRadius: 3,
                      }}
                    />
                    <div
                      className="absolute bottom-3 right-3 w-5 h-5"
                      style={{
                        borderBottom: "2.5px solid oklch(0.55 0.18 150)",
                        borderRight: "2.5px solid oklch(0.55 0.18 150)",
                        borderBottomRightRadius: 3,
                      }}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetake}
                  className="w-full text-xs font-medium"
                  data-ocid="register.retake.button"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Retake Photo
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className="relative rounded-xl overflow-hidden bg-gray-950"
                  style={{ aspectRatio: "4/3" }}
                >
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
                  {isActive && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div
                        className="absolute top-3 left-3 w-6 h-6"
                        style={{
                          borderTop: "2px solid oklch(0.75 0.12 265)",
                          borderLeft: "2px solid oklch(0.75 0.12 265)",
                          borderTopLeftRadius: 3,
                        }}
                      />
                      <div
                        className="absolute top-3 right-3 w-6 h-6"
                        style={{
                          borderTop: "2px solid oklch(0.75 0.12 265)",
                          borderRight: "2px solid oklch(0.75 0.12 265)",
                          borderTopRightRadius: 3,
                        }}
                      />
                      <div
                        className="absolute bottom-3 left-3 w-6 h-6"
                        style={{
                          borderBottom: "2px solid oklch(0.75 0.12 265)",
                          borderLeft: "2px solid oklch(0.75 0.12 265)",
                          borderBottomLeftRadius: 3,
                        }}
                      />
                      <div
                        className="absolute bottom-3 right-3 w-6 h-6"
                        style={{
                          borderBottom: "2px solid oklch(0.75 0.12 265)",
                          borderRight: "2px solid oklch(0.75 0.12 265)",
                          borderBottomRightRadius: 3,
                        }}
                      />
                    </div>
                  )}
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => switchCamera()}
                      className="absolute top-2 right-2 z-10 p-2 rounded-xl transition-colors"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.3)",
                      }}
                      aria-label="Switch camera"
                      data-ocid="register.switch_camera.button"
                    >
                      <SwitchCamera className="w-4 h-4 text-white" />
                    </button>
                  )}
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80">
                      <div className="flex items-center gap-2 text-white/70 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading
                        AI...
                      </div>
                    </div>
                  )}
                  {!isActive && !isLoading && !camError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-gray-950/80">
                      <Camera
                        className="w-10 h-10 opacity-40"
                        style={{ color: "oklch(0.75 0.12 265)" }}
                      />
                      <p className="text-sm text-white/60">
                        Camera starting...
                      </p>
                    </div>
                  )}
                </div>
                {camError && (
                  <div
                    className="flex items-center gap-2 text-sm p-3 rounded-xl"
                    style={{
                      background: "oklch(0.96 0.04 20)",
                      border: "1px solid oklch(0.88 0.08 20)",
                      color: "oklch(0.50 0.20 20)",
                    }}
                    data-ocid="register.camera_error_state"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {camError.message}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={retry}
                      className="ml-auto text-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
                    </Button>
                  </div>
                )}
                {captureState.error && (
                  <div
                    className="flex items-center gap-2 text-sm p-3 rounded-xl"
                    style={{
                      background: "oklch(0.96 0.04 20)",
                      border: "1px solid oklch(0.88 0.08 20)",
                      color: "oklch(0.50 0.20 20)",
                    }}
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {captureState.error}
                  </div>
                )}
                {isActive && (
                  <Button
                    onClick={handleCapture}
                    disabled={capturing}
                    className="w-full text-sm font-semibold"
                    style={{
                      background: "oklch(0.52 0.22 265)",
                      color: "white",
                      boxShadow: "0 4px 14px oklch(0.52 0.22 265 / 0.35)",
                    }}
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

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as PersonTab)}>
          <TabsList
            className="w-full mb-5"
            style={{
              background: "oklch(0.94 0.012 255)",
              border: "1px solid oklch(0.88 0.015 255)",
              borderRadius: "10px",
              padding: "4px",
            }}
            data-ocid="register.tab"
          >
            <TabsTrigger
              value="student"
              className="flex-1 text-sm font-medium transition-all data-[state=active]:shadow-sm"
              style={
                tab === "student"
                  ? {
                      background: "oklch(0.52 0.22 265)",
                      color: "white",
                      borderRadius: "7px",
                    }
                  : { color: "oklch(0.45 0.03 255)" }
              }
              data-ocid="register.student.tab"
            >
              Student
            </TabsTrigger>
            <TabsTrigger
              value="employee"
              className="flex-1 text-sm font-medium transition-all data-[state=active]:shadow-sm"
              style={
                tab === "employee"
                  ? {
                      background: "oklch(0.52 0.22 265)",
                      color: "white",
                      borderRadius: "7px",
                    }
                  : { color: "oklch(0.45 0.03 255)" }
              }
              data-ocid="register.employee.tab"
            >
              Employee
            </TabsTrigger>
          </TabsList>

          <TabsContent value="student">
            <div className="glass-card p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="studentId"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Student ID{" "}
                    <span className="text-muted-foreground/50 normal-case">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="studentId"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. STU-2024-001"
                    className={inputClass}
                    data-ocid="register.student_id.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="studentName"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="studentName"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Aisha Sharma"
                    className={inputClass}
                    data-ocid="register.name.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="rollNo"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Roll No{" "}
                    <span className="text-muted-foreground/50 normal-case">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="rollNo"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    placeholder="e.g. 42"
                    className={inputClass}
                    data-ocid="register.roll_no.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    NSQF Level{" "}
                    <span className="text-muted-foreground/50 normal-case">
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
                      className={inputClass}
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
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Semester{" "}
                      <span className="text-muted-foreground/50 normal-case">
                        (optional)
                      </span>
                    </Label>
                    <Select value={semester} onValueChange={setSemester}>
                      <SelectTrigger
                        className={inputClass}
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
            </div>
          </TabsContent>

          <TabsContent value="employee">
            <div className="glass-card p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label
                    htmlFor="employeeName"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="employeeName"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    placeholder="e.g. Rahul Verma"
                    className={inputClass}
                    data-ocid="register.employee_name.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="employeeId"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Employee ID{" "}
                    <span className="text-muted-foreground/50 normal-case">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="employeeId"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g. EMP-2024-007"
                    className={inputClass}
                    data-ocid="register.employee_id.input"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Button
          className="w-full mt-5 h-12 text-sm font-semibold"
          onClick={handleSubmit}
          disabled={
            registerMutation.isPending ||
            !captureState.descriptor ||
            !isBackendReady
          }
          style={{
            background: "oklch(0.52 0.22 265)",
            color: "white",
            boxShadow: "0 4px 14px oklch(0.52 0.22 265 / 0.35)",
          }}
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
