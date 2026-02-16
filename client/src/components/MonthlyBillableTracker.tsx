import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3 } from "lucide-react";
import { format, addMonths, startOfMonth, subMonths, subQuarters, startOfQuarter } from "date-fns";
import { cn } from "@/lib/utils";

type BillableSummary = {
  totalBilledHours: number;
  totalActualHours: number;
  byAgency: Array<{
    agencyId: string;
    agencyName: string;
    billedHours: number;
    actualHours: number;
    percentage: number;
  }>;
};

type ForecastSettings = {
  id: string;
  blendedRate: string;
  toplineQuotaTarget: string | null;
  updatedAt: string;
};

const AGENCY_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

export function MonthlyBillableTracker() {
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

  const { data: summary, isLoading } = useQuery<BillableSummary>({
    queryKey: ["/api/analytics/monthly-billable-summary", selectedMonth],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/monthly-billable-summary?month=${selectedMonth}`);
      if (!response.ok) throw new Error("Failed to fetch monthly billable summary");
      return response.json();
    },
  });

  const { data: forecastSettings } = useQuery<ForecastSettings>({
    queryKey: ["/api/forecast/settings"],
  });

  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
  const toplineTarget = forecastSettings?.toplineQuotaTarget ? parseFloat(forecastSettings.toplineQuotaTarget) : null;
  const totalBilled = summary?.totalBilledHours || 0;
  const progressPercent = toplineTarget && toplineTarget > 0 ? Math.min((totalBilled / toplineTarget) * 100, 100) : 0;
  const remaining = toplineTarget ? toplineTarget - totalBilled : null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Monthly Billable Hours
          </CardTitle>
          <CardDescription className="text-xs">Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Monthly Billable Hours
            </CardTitle>
            <CardDescription className="text-xs">
              Company-wide billed hours — {selectedMonthLabel}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={quickFilter || "custom"}
              onValueChange={handleQuickFilter}
            >
              <SelectTrigger className="w-[130px] h-8">
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
              <SelectTrigger className="w-[150px] h-8">
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
        {/* Topline summary */}
        <div className="rounded-lg border bg-muted/30 p-3 mb-4">
          <div className="flex items-baseline justify-between gap-4 mb-2">
            <span className="font-semibold text-lg">
              {totalBilled.toFixed(1)}h
              {toplineTarget && (
                <span className="text-muted-foreground font-normal text-base"> / {toplineTarget}h target</span>
              )}
            </span>
            {toplineTarget && (
              <span className="text-sm text-muted-foreground">{progressPercent.toFixed(0)}%</span>
            )}
          </div>
          {toplineTarget && (
            <Progress
              value={progressPercent}
              className={cn(
                "h-2.5",
                progressPercent >= 100 ? "[&>div]:bg-emerald-500" : progressPercent >= 75 ? "" : "[&>div]:bg-amber-500"
              )}
            />
          )}
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>Actual: {(summary?.totalActualHours || 0).toFixed(1)}h</span>
            {remaining !== null && (
              <span>{remaining > 0 ? `${remaining.toFixed(1)}h remaining` : `${(-remaining).toFixed(1)}h over target`}</span>
            )}
          </div>
        </div>

        {/* Agency contribution breakdown */}
        {summary && summary.byAgency.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agency Contribution</div>

            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {summary.byAgency.map((agency, i) => (
                <div
                  key={agency.agencyId}
                  className={cn("transition-all", AGENCY_COLORS[i % AGENCY_COLORS.length])}
                  style={{ width: `${agency.percentage}%` }}
                  title={`${agency.agencyName}: ${agency.billedHours.toFixed(1)}h (${agency.percentage}%)`}
                />
              ))}
            </div>

            {/* Agency rows */}
            <div className="space-y-1.5">
              {summary.byAgency.map((agency, i) => (
                <div key={agency.agencyId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", AGENCY_COLORS[i % AGENCY_COLORS.length])} />
                    <span className="truncate">{agency.agencyName}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-2 tabular-nums">
                    {agency.billedHours.toFixed(1)}h
                    <span className="ml-1.5 font-medium">{agency.percentage}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!summary || summary.byAgency.length === 0) && (
          <p className="text-sm text-muted-foreground italic">No billable hours logged this month.</p>
        )}
      </CardContent>
    </Card>
  );
}
