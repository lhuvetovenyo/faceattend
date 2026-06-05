import AttendanceSection from "@/components/dashboard/AttendanceSection";
import ManagePeopleTab from "@/components/dashboard/ManagePeopleTab";
import StatsGrid from "@/components/dashboard/StatsGrid";
import { Button } from "@/components/ui/button";
import {
  useClearAllData,
  useStats,
  useTestGoogleSheetsSync,
} from "@/hooks/useBackend";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0] ?? "";
}

function formatNavDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { data: stats, refetch: refetchStats } = useStats();
  const totalPeople = Number(stats?.totalPersons ?? 0n);
  const todayCheckIns = Number(stats?.todayCheckIns ?? 0n);
  const totalCheckIns = Number(stats?.totalRecords ?? 0n);
  const activeMonths = Number(stats?.activeMonths ?? 0n);
  const testSyncMutation = useTestGoogleSheetsSync();
  const clearMutation = useClearAllData();
  const [tab, setTab] = useState<"records" | "people">("records");
  const [deleteKey, setDeleteKey] = useState(0);
  const todayISO = toISODate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [syncResult, setSyncResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [devToolsUnlocked, setDevToolsUnlocked] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [devPassword, setDevPassword] = useState("");
  const [devPasswordError, setDevPasswordError] = useState("");
  const [pendingDevAction, setPendingDevAction] = useState<
    "test" | "clear" | null
  >(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-arm timer when selectedDate changes
  useEffect(() => {
    const msUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return midnight.getTime() - now.getTime();
    };
    const timer = setTimeout(() => {
      setSelectedDate(toISODate(new Date()));
    }, msUntilMidnight());
    return () => clearTimeout(timer);
  }, [selectedDate]);

  function prevDay() {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() - 1);
    setSelectedDate(toISODate(d));
  }

  function nextDay() {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    setSelectedDate(toISODate(d));
  }

  function handleClearData() {
    if (!devToolsUnlocked) {
      setPendingDevAction("clear");
      setShowDevModal(true);
      return;
    }
    runClearData();
  }

  function handleDevPasswordConfirm() {
    if (devPassword === "1234") {
      setDevToolsUnlocked(true);
      setShowDevModal(false);
      setDevPassword("");
      setDevPasswordError("");
      if (pendingDevAction === "test") runTestSync();
      else if (pendingDevAction === "clear") runClearData();
      setPendingDevAction(null);
    } else {
      setDevPasswordError("Incorrect password. Please try again.");
    }
  }

  function handleDevModalCancel() {
    setShowDevModal(false);
    setDevPassword("");
    setDevPasswordError("");
    setPendingDevAction(null);
  }

  const isToday = selectedDate === todayISO;

  function runTestSync() {
    setSyncResult(null);
    testSyncMutation.mutate(undefined, {
      onSuccess: (msg) =>
        setSyncResult({
          ok:
            msg.toLowerCase().startsWith("success") ||
            msg.toLowerCase().startsWith("ok:"),
          message: msg,
        }),
      onError: (err) =>
        setSyncResult({
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        }),
    });
  }

  function handleTestSync() {
    if (!devToolsUnlocked) {
      setPendingDevAction("test");
      setShowDevModal(true);
      return;
    }
    runTestSync();
  }

  function runClearData() {
    clearMutation.mutate(undefined, {
      onSuccess: () => {
        setSyncResult({ ok: true, message: "All data cleared successfully." });
        refetchStats();
        setDeleteKey((k) => k + 1);
      },
      onError: (err) =>
        setSyncResult({
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        }),
    });
  }

  const today = new Date();
  const todayLabel = today.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      data-ocid="dashboard.page"
    >
      {/* Page Header */}
      <div className="px-4 pt-5 pb-4 bg-background">
        <h1 className="text-2xl font-display text-foreground leading-tight">
          Dashboard
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-body">
          {todayLabel}
        </p>
      </div>

      {/* Stats grid */}
      <div className="px-4 pb-4">
        <StatsGrid
          key={deleteKey}
          totalPeople={totalPeople}
          todayCheckIns={todayCheckIns}
          totalAttendance={totalCheckIns}
          activeMonths={activeMonths}
        />
      </div>

      {/* Tab selector — pill style */}
      <div className="px-4 pb-3">
        <div
          className="flex gap-2 bg-muted/60 rounded-xl p-1"
          data-ocid="dashboard.tab"
        >
          <button
            type="button"
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-body transition-all duration-200 ${
              tab === "records"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("records")}
            data-ocid="dashboard.records.tab"
          >
            Attendance Records
          </button>
          <button
            type="button"
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-body transition-all duration-200 ${
              tab === "people"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("people")}
            data-ocid="dashboard.people.tab"
          >
            Manage People
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 px-4 pb-4">
        {tab === "records" && (
          <div className="flex flex-col gap-3">
            {/* Date navigation bar */}
            <div
              className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2"
              data-ocid="dashboard.date-nav"
            >
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                onClick={prevDay}
                aria-label="Previous day"
                data-ocid="dashboard.date-nav.prev_button"
              >
                <ChevronLeft className="w-4 h-4 text-foreground" />
              </button>

              <div className="flex-1 text-center">
                <p
                  className="text-xs font-body text-foreground"
                  data-ocid="dashboard.date-nav.label"
                >
                  {isToday ? "Today — " : ""}
                  {formatNavDate(selectedDate)}
                </p>
              </div>

              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
                onClick={nextDay}
                disabled={isToday}
                aria-label="Next day"
                data-ocid="dashboard.date-nav.next_button"
              >
                <ChevronRight className="w-4 h-4 text-foreground" />
              </button>

              {!isToday && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 px-2.5 shrink-0 rounded-lg"
                  onClick={() => setSelectedDate(todayISO)}
                  data-ocid="dashboard.date-nav.today_button"
                >
                  Today
                </Button>
              )}
            </div>

            <AttendanceSection sectionType="NSQF" selectedDate={selectedDate} />
            <AttendanceSection sectionType="JIG" selectedDate={selectedDate} />
          </div>
        )}

        {tab === "people" && (
          <ManagePeopleTab
            onDeleteSuccess={async () => {
              await refetchStats();
              setDeleteKey((k) => k + 1);
            }}
          />
        )}
      </div>

      {/* Developer Tools */}
      <div className="px-4 pb-6">
        <div
          className="border border-border rounded-xl overflow-hidden"
          data-ocid="dashboard.dev-tools.panel"
        >
          <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-body text-muted-foreground uppercase tracking-wider">
                Developer Tools
              </p>
            </div>
            {devToolsUnlocked && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span>🔓</span> Unlocked
              </span>
            )}
          </div>
          <div className="px-4 py-3 bg-card flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl text-xs"
                onClick={handleTestSync}
                disabled={testSyncMutation.isPending}
                data-ocid="dashboard.dev-tools.test-sync_button"
              >
                {testSyncMutation.isPending ? "Testing…" : "Test Sheets Sync"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleClearData}
                disabled={clearMutation.isPending}
                data-ocid="dashboard.dev-tools.clear-data_button"
              >
                {clearMutation.isPending ? "Clearing…" : "Clear All Data"}
              </Button>
            </div>

            {syncResult && (
              <div
                className={`rounded-xl border px-3 py-2.5 text-xs font-mono break-all ${
                  syncResult.ok
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
                data-ocid={
                  syncResult.ok
                    ? "dashboard.dev-tools.success_state"
                    : "dashboard.dev-tools.error_state"
                }
              >
                {syncResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Developer Access Password Modal */}
      {showDevModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          data-ocid="dashboard.dev-tools.dialog"
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl">🔐</span>
                <h2 className="text-lg font-body text-foreground">
                  Developer Access
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-body">
                Enter the developer password to use this tool.
              </p>
            </div>
            <div className="px-6 py-4 flex flex-col gap-3">
              <input
                type="password"
                placeholder="Enter password"
                value={devPassword}
                onChange={(e) => {
                  setDevPassword(e.target.value);
                  setDevPasswordError("");
                }}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleDevPasswordConfirm()
                }
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-body"
                data-ocid="dashboard.dev-tools.password_input"
              />
              {devPasswordError && (
                <p
                  className="text-xs text-red-500 font-body"
                  data-ocid="dashboard.dev-tools.password.error_state"
                >
                  {devPasswordError}
                </p>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={handleDevModalCancel}
                data-ocid="dashboard.dev-tools.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                onClick={handleDevPasswordConfirm}
                data-ocid="dashboard.dev-tools.confirm_button"
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
