import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, ChevronDown, ChevronRight, User } from "lucide-react";
import { format, addMonths, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

type PrebilledSummary = {
  totalPrebilledHours: number;
  byAgency: Array<{
    agencyId: string;
    agencyName: string;
    prebilledHours: number;
    actualHours: number;
    percentage: number;
    byTask: Array<{
      taskName: string;
      prebilledHours: number;
      byUser: Array<{
        userId: string;
        userName: string;
        prebilledHours: number;
      }>;
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

export function PrebilledHoursTracker() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [expandedAgencies, setExpandedAgencies] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleAgency = (id: string) => {
    setExpandedAgencies(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // collapse child tasks too
        setExpandedTasks(pt => {
          const nt = new Set(pt);
          for (const key of pt) {
            if (key.startsWith(id + ":")) nt.delete(key);
          }
          return nt;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTask = (key: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
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
                const agencyExpanded = expandedAgencies.has(agency.agencyId);
                const hasTasks = agency.byTask.length > 0;

                return (
                  <div key={agency.agencyId}>
                    {/* Agency row */}
                    <button
                      className={cn(
                        "flex items-center justify-between text-sm w-full py-1.5 px-1 rounded hover:bg-muted/50 transition-colors",
                        !hasTasks && "cursor-default"
                      )}
                      onClick={() => hasTasks && toggleAgency(agency.agencyId)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {hasTasks ? (
                          agencyExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <div className="w-3.5" />
                        )}
                        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", AGENCY_COLORS[i % AGENCY_COLORS.length])} />
                        <span className="truncate font-medium">{agency.agencyName}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0 ml-2 tabular-nums">
                        {agency.prebilledHours.toFixed(1)}h
                        <span className="ml-1.5 font-medium">{agency.percentage}%</span>
                      </span>
                    </button>

                    {/* Task bucket rows */}
                    {agencyExpanded && hasTasks && (
                      <div className="ml-5 border-l border-muted pl-3 space-y-0.5 my-0.5">
                        {agency.byTask.map((task) => {
                          const taskKey = `${agency.agencyId}:${task.taskName}`;
                          const taskExpanded = expandedTasks.has(taskKey);
                          const hasUsers = task.byUser.length > 1;
                          const taskPercent = agency.prebilledHours > 0
                            ? Math.round((task.prebilledHours / agency.prebilledHours) * 1000) / 10
                            : 0;

                          return (
                            <div key={taskKey}>
                              <button
                                className={cn(
                                  "flex items-center justify-between text-sm w-full py-1 px-1 rounded hover:bg-muted/50 transition-colors",
                                  !hasUsers && "cursor-default"
                                )}
                                onClick={() => hasUsers && toggleTask(taskKey)}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {hasUsers ? (
                                    taskExpanded
                                      ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                                      : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                                  ) : (
                                    <div className="w-3" />
                                  )}
                                  <span className="truncate">{task.taskName}</span>
                                </div>
                                <span className="text-muted-foreground shrink-0 ml-2 tabular-nums text-xs">
                                  {task.prebilledHours.toFixed(1)}h
                                  <span className="ml-1 text-muted-foreground/70">{taskPercent}%</span>
                                </span>
                              </button>

                              {/* User rows */}
                              {taskExpanded && hasUsers && (
                                <div className="ml-5 border-l border-muted/60 pl-3 space-y-0.5 my-0.5">
                                  {task.byUser.map((u) => (
                                    <div key={u.userId} className="flex items-center justify-between text-xs py-0.5 px-1 text-muted-foreground">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <User className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{u.userName}</span>
                                      </div>
                                      <span className="shrink-0 ml-2 tabular-nums">{u.prebilledHours.toFixed(1)}h</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Single user — show inline */}
                              {task.byUser.length === 1 && (
                                <div className="ml-8 text-xs text-muted-foreground/70 -mt-0.5 mb-0.5 flex items-center gap-1">
                                  <User className="h-2.5 w-2.5" />
                                  {task.byUser[0].userName}
                                </div>
                              )}
                            </div>
                          );
                        })}
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
