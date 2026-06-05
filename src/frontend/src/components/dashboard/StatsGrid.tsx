import { CalendarCheck, CalendarDays, Clock, Users } from "lucide-react";

interface Props {
  totalPeople: number;
  totalAttendance: number;
  todayCheckIns: number;
  activeMonths: number;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
  accent: string;
}

function StatCard({ icon, label, value, bg, accent }: StatCardProps) {
  return (
    <div className="bg-card rounded-xl p-4 flex items-center gap-3 border border-border shadow-sm">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bg}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p
          className={`text-2xl font-display font-normal leading-tight ${accent}`}
        >
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground font-body leading-tight mt-0.5">
          {label}
        </p>
      </div>
    </div>
  );
}

export default function StatsGrid({
  totalPeople,
  totalAttendance,
  todayCheckIns,
  activeMonths,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3" data-ocid="dashboard.stats">
      <StatCard
        icon={<Users className="w-5 h-5 text-white" />}
        label="Total People"
        value={totalPeople}
        bg="bg-primary"
        accent="text-primary"
      />
      <StatCard
        icon={<CalendarCheck className="w-5 h-5 text-white" />}
        label="Total Attendance"
        value={totalAttendance}
        bg="bg-accent"
        accent="text-accent"
      />
      <StatCard
        icon={<Clock className="w-5 h-5 text-white" />}
        label="Today's Check-ins"
        value={todayCheckIns}
        bg="bg-primary/80"
        accent="text-primary"
      />
      <StatCard
        icon={<CalendarDays className="w-5 h-5 text-white" />}
        label="Active Months"
        value={activeMonths}
        bg="bg-accent/80"
        accent="text-accent"
      />
    </div>
  );
}
