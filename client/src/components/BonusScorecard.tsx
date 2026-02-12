import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type BonusEligibilityData = {
  agency: {
    id: string;
    name: string;
  };
  monthlyTarget: number;
  weeks: Array<{
    weekNumber: number;
    startDate: string;
    endDate: string;
    billedHours: number;
    weeklyTarget: number;
    hitTarget: boolean;
  }>;
  weeksHit: number;
  totalWeeks: number;
  eligibleForBonus: boolean;
};

export function BonusScorecard() {
  const { data: bonusData = [], isLoading } = useQuery<BonusEligibilityData[]>({
    queryKey: ["/api/analytics/bonus-eligibility"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bonusData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Bonus Scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No bonus tracking data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Bonus Scorecard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {bonusData.filter(item => item.agency.name !== 'FlyGuys').map((item) => (
            <div
              key={item.agency.id}
              className="border rounded-lg p-2.5 space-y-1.5"
              data-testid={`bonus-agency-${item.agency.id}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{item.agency.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Monthly target: <span className="text-gold font-medium">{item.monthlyTarget}h</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={item.eligibleForBonus ? "default" : "secondary"}
                    className={cn("gap-1", item.eligibleForBonus && "bg-gold text-gold-foreground hover:bg-gold/90")}
                  >
                    {item.eligibleForBonus ? (
                      <>
                        <Trophy className="h-3 w-3" />
                        Bonus Eligible!
                      </>
                    ) : (
                      `${item.weeksHit}/${item.totalWeeks} weeks`
                    )}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {item.weeks.map((week) => (
                  <div
                    key={week.weekNumber}
                    className={cn(
                      "border rounded-md p-1.5 text-center transition-colors",
                      week.hitTarget
                        ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                        : "bg-muted"
                    )}
                    data-testid={`week-${week.weekNumber}-${item.agency.id}`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {week.hitTarget ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-xs font-medium">Wk {week.weekNumber}</span>
                    </div>
                    <div className="text-sm font-semibold mt-1">
                      {week.billedHours.toFixed(2)}h
                    </div>
                    <div className="text-xs text-muted-foreground">
                      / {week.weeklyTarget.toFixed(2)}h
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
