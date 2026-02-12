import { TargetProgress } from "@/components/TargetProgress";
import { PenguinHoursTracker } from "@/components/PenguinHoursTracker";
import { CustomPeriodClientTracker } from "@/components/CustomPeriodClientTracker";
import { ResourceQuotaTracker } from "@/components/ResourceQuotaTracker";
import { AccountHoursByWeekTracker } from "@/components/AccountHoursByWeekTracker";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.firstName || user?.username || "there";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${getGreeting()}, ${firstName}`}
        description={formatDate()}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TargetProgress />
        <ResourceQuotaTracker />
        <PenguinHoursTracker />
        <CustomPeriodClientTracker />
        <AccountHoursByWeekTracker />
      </div>
    </div>
  );
}
