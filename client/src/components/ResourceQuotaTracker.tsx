import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";
import { format, addMonths, startOfMonth, subMonths, subQuarters, startOfQuarter } from "date-fns";

type ResourceQuotaData = {
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
  monthlyTarget: number;
  adjustedTarget: number;
  expectedHours: number;
  billedHours: number;
  prebilledHours: number;
  percentageComplete: number;
};

export function ResourceQuotaTracker() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [quickFilter, setQuickFilter] = useState<string>("this-month");

  const handleQuickFilter = (value: string) => {
    if (value === "custom") {
      setQuickFilter("");
      return;
    }
    
    setQuickFilter(value);
    const now = new Date();
    
    switch (value) {
      case "this-month":
        setSelectedMonth(format(now, "yyyy-MM"));
        break;
      case "last-month": {
        const lastMonth = subMonths(now, 1);
        setSelectedMonth(format(lastMonth, "yyyy-MM"));
        break;
      }
      case "this-quarter": {
        const qStart = startOfQuarter(now);
        setSelectedMonth(format(qStart, "yyyy-MM"));
        break;
      }
      case "last-quarter": {
        const lastQuarter = subQuarters(now, 1);
        const qStart = startOfQuarter(lastQuarter);
        setSelectedMonth(format(qStart, "yyyy-MM"));
        break;
      }
    }
  };

  const monthOptions = [];
  const today = new Date();
  for (let i = -6; i <= 6; i++) {
    const monthDate = addMonths(startOfMonth(today), i);
    monthOptions.push({
      value: format(monthDate, "yyyy-MM"),
      label: format(monthDate, "MMMM yyyy"),
    });
  }

  const { data: resourceQuotaData = [], isLoading } = useQuery<ResourceQuotaData[]>({
    queryKey: ["/api/analytics/resource-quota-tracker", selectedMonth],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/resource-quota-tracker?month=${selectedMonth}`);
      if (!response.ok) throw new Error("Failed to fetch resource quota tracker");
      return response.json();
    },
  });

  const formatPacingHours = (hours: number) => {
    const sign = hours >= 0 ? "+" : "";
    return `${sign}${hours.toFixed(1)}h`;
  };

  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

  // Aggregate totals for summary
  const totals = resourceQuotaData.reduce(
    (acc, item) => {
      const totalHours = item.billedHours + item.prebilledHours;
      acc.target += item.adjustedTarget;
      acc.billed += item.billedHours;
      acc.prebilled += item.prebilledHours;
      acc.total += totalHours;
      return acc;
    },
    { target: 0, billed: 0, prebilled: 0, total: 0 }
  );
  const aggregatePercent = totals.target > 0 ? Math.min((totals.total / totals.target) * 100, 100) : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Resource Quota Tracker
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (resourceQuotaData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Resource Quota Tracker
            </CardTitle>
            <CardDescription className="text-xs">Team member monthly quota — {selectedMonthLabel}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={quickFilter || "custom"}
              onValueChange={handleQuickFilter}
            >
              <SelectTrigger className="w-[130px] h-8" data-testid="select-resource-quick-filter">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="this-quarter">This Quarter</SelectItem>
                <SelectItem value="last-quarter">Last Quarter</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={selectedMonth}
              onValueChange={(value) => {
                setSelectedMonth(value);
                setQuickFilter("");
              }}
            >
              <SelectTrigger className="w-[150px] h-8" data-testid="select-resource-month">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-3 pt-0">
        {/* Aggregate summary */}
        <div className="rounded-lg border bg-muted/30 p-3 mb-4">
          <div className="flex items-baseline justify-between gap-4 mb-2">
            <span className="font-semibold">
              {Math.round(totals.total)}h <span className="text-muted-foreground font-normal">/ {Math.round(totals.target)}h</span>
            </span>
            <span className="text-sm text-muted-foreground">{aggregatePercent.toFixed(0)}%</span>
          </div>
          <Progress value={aggregatePercent} className="h-2" />
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>Billed: {totals.billed.toFixed(1)}h</span>
            <span>Prebilled: {totals.prebilled.toFixed(1)}h</span>
            <span>Remaining: {(totals.target - totals.total).toFixed(1)}h</span>
          </div>
        </div>

        {/* Per-team-member progress bars */}
        <div className="space-y-3">
          {resourceQuotaData.map((item) => {
            const totalHours = item.billedHours + item.prebilledHours;
            const remaining = item.adjustedTarget - totalHours;
            const pacingHours = totalHours - item.expectedHours;
            const percent = item.adjustedTarget > 0 ? Math.min((totalHours / item.adjustedTarget) * 100, 100) : 0;
            return (
              <div
                key={item.user.id}
                className="space-y-1.5"
                data-testid={`dashboard-resource-quota-${item.user.id}`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {item.user.firstName} {item.user.lastName}
                  </span>
                  <span className="text-muted-foreground">
                    {totalHours.toFixed(1)}h / {item.adjustedTarget.toFixed(1)}h
                    {remaining !== 0 && (
                      <span className="ml-2">
                        ({remaining > 0 ? remaining.toFixed(1) : `+${(-remaining).toFixed(1)}`}h {remaining > 0 ? "left" : "over"})
                      </span>
                    )}
                  </span>
                </div>
                <Progress value={percent} className="h-2" />
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>Billed: {item.billedHours.toFixed(1)}h</span>
                  <span>Prebilled: {item.prebilledHours.toFixed(1)}h</span>
                  <span>Pacing: {formatPacingHours(pacingHours)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
