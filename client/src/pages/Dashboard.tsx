import { TargetProgress } from "@/components/TargetProgress";
import { BonusScorecard } from "@/components/BonusScorecard";
import { PenguinHoursTracker } from "@/components/PenguinHoursTracker";
import { CustomPeriodClientTracker } from "@/components/CustomPeriodClientTracker";
import { ResourceQuotaTracker } from "@/components/ResourceQuotaTracker";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CalendarDays, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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

type QuickStats = {
  todayHours: number;
  weekHours: number;
  monthHours: number;
};

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.firstName || user?.username || "there";

  const { data: quickStats } = useQuery<QuickStats>({
    queryKey: ["/api/analytics/quick-stats"],
    retry: false,
  });

  return (
    <div className="space-y-8">
      {/* Greeting Banner */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-muted-foreground">
          {formatDate()}
        </p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-2xl font-bold">{quickStats?.todayHours?.toFixed(1) ?? "0.0"}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-2xl font-bold">{quickStats?.weekHours?.toFixed(1) ?? "0.0"}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">{quickStats?.monthHours?.toFixed(1) ?? "0.0"}h</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Primary Card - Full Width */}
      <TargetProgress />
      
      <ResourceQuotaTracker />

      {/* Secondary Cards - 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BonusScorecard />
        <PenguinHoursTracker />
      </div>

      <CustomPeriodClientTracker />
    </div>
  );
}
