import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, ChevronDown, ChevronRight } from "lucide-react";
import { format, addMonths, startOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

type PrebilledSummary = {
  totalPrebilledHours: number;
  byAgency: Array<{
    agencyId: string;
    agencyName: string;
    prebilledHours: number;
    actualHours: number;
    percentage: number;
    byAccount: Array<{
      accountId: string;
      accountName: string;
      prebilledHours: number;
    }>;
  }>;
};

const AGENCY_COLORS = [
  "bg-violet-500",
  "bg-teal-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-orange-500",
];

const AGENCY_TEXT_COLORS = [
  "text-violet-500",
  "text-teal-500",
  "text-rose-500",
  "text-sky-500",
  "text-amber-500",
  "text-indigo-500",
  "text-emerald-500",
  "text-orange-500",
];

export function PrebilledHoursTracker() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [expandedAgency, setExpandedAgency] = useState<string | null>(null);

  const monthOptions = [];
  const today = new Date();
  for (let i = -6; i <= 6; i++) {
    const monthDate = addMonths(startOfMonth(today), i);
    monthOptions.push({
      value: format(monthDate, "yyyy-MM"),
      label: format(monthDate, "MMMM yyyy"),
    });
  }

  const { data: summary, isLoading } = useQuery<PrebilledSummary>({
    queryKey: ["/api/analytics/prebilled-hours-by-agency", selectedMonth],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/prebilled-hours-by-agency?month=${selectedMonth}`);
      if (!response.ok) throw new Error("Failed to fetch prebilled hours");
      return response.json();
    },
  });

  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
  const totalPrebilled = summary?.totalPrebilledHours || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Prebilled Hours
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
              <Clock className="h-4 w-4" />
              Prebilled Hours
            </CardTitle>
            <CardDescription className="text-xs">
              Prebilled hours by client — {selectedMonthLabel}
            </CardDescription>
          </div>
          <Select
            value={selectedMonth}
            onValueChange={setSelectedMonth}
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
      </CardHeader>
      <CardContent className="px-4 py-3 pt-0">
        {/* Total */}
        <div className="rounded-lg border bg-muted/30 p-3 mb-4">
          <span className="font-semibold text-lg">
            {totalPrebilled.toFixed(1)}h
            <span className="text-muted-foreground font-normal text-base ml-1">total prebilled</span>
          </span>
        </div>

        {summary && summary.byAgency.length > 0 ? (
          <div className="space-y-2.5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Breakdown by Client</div>

            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {summary.byAgency.map((agency, i) => (
                <div
                  key={agency.agencyId}
                  className={cn("transition-all", AGENCY_COLORS[i % AGENCY_COLORS.length])}
                  style={{ width: `${agency.percentage}%` }}
                  title={`${agency.agencyName}: ${agency.prebilledHours.toFixed(1)}h (${agency.percentage}%)`}
                />
              ))}
            </div>

            {/* Agency rows */}
            <div className="space-y-0.5">
              {summary.byAgency.map((agency, i) => {
                const isExpanded = expandedAgency === agency.agencyId;
                const hasAccounts = agency.byAccount.length > 1;

                return (
                  <div key={agency.agencyId}>
                    <button
                      className={cn(
                        "flex items-center justify-between text-sm w-full py-1.5 px-1 rounded hover:bg-muted/50 transition-colors",
                        !hasAccounts && "cursor-default"
                      )}
                      onClick={() => {
                        if (hasAccounts) {
                          setExpandedAgency(isExpanded ? null : agency.agencyId);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {hasAccounts ? (
                          isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <div className="w-3.5" />
                        )}
                        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", AGENCY_COLORS[i % AGENCY_COLORS.length])} />
                        <span className="truncate">{agency.agencyName}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0 ml-2 tabular-nums">
                        {agency.prebilledHours.toFixed(1)}h
                        <span className="ml-1.5 font-medium">{agency.percentage}%</span>
                      </span>
                    </button>

                    {isExpanded && hasAccounts && (
                      <div className="ml-9 space-y-0.5 mb-1">
                        {agency.byAccount.map((account) => (
                          <div key={account.accountId} className="flex items-center justify-between text-xs py-1 text-muted-foreground">
                            <span className="truncate">{account.accountName}</span>
                            <span className="shrink-0 ml-2 tabular-nums">{account.prebilledHours.toFixed(1)}h</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No prebilled hours logged this month.</p>
        )}
      </CardContent>
    </Card>
  );
}
