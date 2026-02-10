import { TargetProgress } from "@/components/TargetProgress";
import { BonusScorecard } from "@/components/BonusScorecard";
import { PenguinHoursTracker } from "@/components/PenguinHoursTracker";
import { CustomPeriodClientTracker } from "@/components/CustomPeriodClientTracker";
import { ResourceQuotaTracker } from "@/components/ResourceQuotaTracker";

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Your time tracking overview and quick actions
        </p>
      </div>
      
      <TargetProgress />
      
      <ResourceQuotaTracker />
      
      <BonusScorecard />
      
      <CustomPeriodClientTracker />
      
      <PenguinHoursTracker />
    </div>
  );
}