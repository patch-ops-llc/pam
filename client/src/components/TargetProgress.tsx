import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ChevronsUpDown, TrendingUp, TrendingDown, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { startOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, isWeekend } from "date-fns";

type Holiday = {
  id: string;
  name: string;
  date: string;
  endDate?: string | null;
};

const STORAGE_KEY = "selected-agencies-filter";

type TargetProgressData = {
  agency: {
    id: string;
    name: string;
  };
  weeklyActual: number;
  monthlyActual: number;
  weeklyBillable: number;
  monthlyBillable: number;
  weeklyPreBilled: number;
  monthlyPreBilled: number;
  weeklyTarget: number;
  monthlyTarget: number;
  showBillable: boolean;
  showPreBilled: boolean;
  noQuota: boolean;
};

type AccountHoursData = {
  account: {
    id: string;
    name: string;
    agencyId: string;
  };
  agency: {
    id: string;
    name: string;
  };
  weeklyActual: number;
  monthlyActual: number;
  weeklyBilled: number;
  monthlyBilled: number;
};

export function TargetProgress() {
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [expandedAgencies, setExpandedAgencies] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  // Fetch target progress by agency
  const { data: targetProgress = [], isLoading } = useQuery<TargetProgressData[]>({
    queryKey: ["/api/analytics/target-progress"],
  });

  // Fetch account hours data
  const { data: accountHoursData = [] } = useQuery<AccountHoursData[]>({
    queryKey: ["/api/analytics/hours-by-account"],
  });

  // Fetch holidays
  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["/api/holidays"],
  });

  // Helper to check if a date is a holiday
  const isHoliday = (date: Date, holidayList: Holiday[]) => {
    return holidayList.some(holiday => {
      const holidayStart = parseISO(holiday.date);
      if (holiday.endDate) {
        const holidayEnd = parseISO(holiday.endDate);
        return date >= holidayStart && date <= holidayEnd;
      }
      return isSameDay(date, holidayStart);
    });
  };

  // Helper to check if a date is a business day (weekday and not a holiday)
  const isBusinessDay = (date: Date, holidayList: Holiday[]) => {
    return !isWeekend(date) && !isHoliday(date, holidayList);
  };

  // Calculate pacing indicators based on business days (excluding weekends and holidays)
  const pacingData = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    
    // Yesterday is the last "completed" day
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // --- Weekly calculation ---
    // Get the start of the week (Monday)
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    // Get all days in the week
    const allDaysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    // Count total business days in the week (Mon-Fri excluding holidays)
    const totalBusinessDaysInWeek = allDaysInWeek.filter(date => isBusinessDay(date, holidays)).length;
    
    // Count completed business days this week (from week start to yesterday)
    let completedBusinessDaysInWeek = 0;
    if (yesterday >= weekStart) {
      const daysUntilYesterday = eachDayOfInterval({ start: weekStart, end: yesterday });
      completedBusinessDaysInWeek = daysUntilYesterday.filter(date => isBusinessDay(date, holidays)).length;
    }
    
    const weekProgress = totalBusinessDaysInWeek > 0 
      ? Math.min(completedBusinessDaysInWeek / totalBusinessDaysInWeek, 1)
      : 0;
    
    // --- Monthly calculation ---
    // Get all days in the month
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Count total business days in the month
    const totalBusinessDaysInMonth = allDaysInMonth.filter(date => isBusinessDay(date, holidays)).length;
    
    // Count completed business days (from month start to yesterday)
    let completedBusinessDays = 0;
    if (yesterday >= monthStart) {
      const daysUntilYesterday = eachDayOfInterval({ start: monthStart, end: yesterday });
      completedBusinessDays = daysUntilYesterday.filter(date => isBusinessDay(date, holidays)).length;
    }
    
    const monthProgress = totalBusinessDaysInMonth > 0 
      ? Math.min(completedBusinessDays / totalBusinessDaysInMonth, 1)
      : 0;
    
    return { weekProgress, monthProgress };
  }, [holidays]);

  const calculatePacing = (actual: number, target: number, timeProgress: number) => {
    if (target === 0) return { expected: 0, difference: 0, isPacing: 'on-pace' as const };
    
    const expected = target * timeProgress;
    const difference = actual - expected;
    const isPacing = difference > 0.5 ? 'ahead' : difference < -0.5 ? 'behind' : 'on-pace';
    
    return { expected, difference, isPacing };
  };

  const getProgressIndicatorClass = (pacing: 'ahead' | 'behind' | 'on-pace') => {
    switch (pacing) {
      case 'ahead': return '[&>div]:bg-emerald-500';
      case 'behind': return '[&>div]:bg-red-500';
      default: return '';
    }
  };

  // Load saved selections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSelectedAgencies(parsed);
      } catch (e) {
        console.error("Failed to parse saved agency selections", e);
      }
    } else if (targetProgress.length > 0 && selectedAgencies.length === 0) {
      // Default to all agencies selected only if no selections exist
      setSelectedAgencies(targetProgress.map((p) => p.agency.id));
    }
  }, []); // Run only once on mount

  // Update selections when target progress data changes
  useEffect(() => {
    if (targetProgress.length > 0 && selectedAgencies.length === 0) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        // Only set defaults if no saved data
        setSelectedAgencies(targetProgress.map((p) => p.agency.id));
      }
    }
  }, [targetProgress.length]); // Only depend on length, not the array itself

  // Save selections to localStorage whenever they change
  useEffect(() => {
    if (selectedAgencies.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedAgencies));
    }
  }, [selectedAgencies]);

  const toggleAgency = (agencyId: string) => {
    setSelectedAgencies((prev) => {
      if (prev.includes(agencyId)) {
        return prev.filter((id) => id !== agencyId);
      } else {
        return [...prev, agencyId];
      }
    });
  };

  const toggleAgencyExpanded = (agencyId: string) => {
    setExpandedAgencies(prev => {
      const next = new Set(prev);
      if (next.has(agencyId)) {
        next.delete(agencyId);
      } else {
        next.add(agencyId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedAgencies(targetProgress.map((p: any) => p.agency.id));
  };

  const clearAll = () => {
    setSelectedAgencies([]);
  };

  // Group accounts by agency
  const accountsByAgency = useMemo(() => {
    const grouped: Record<string, AccountHoursData[]> = {};
    accountHoursData.forEach((account) => {
      const agencyId = account.agency.id;
      if (!grouped[agencyId]) {
        grouped[agencyId] = [];
      }
      grouped[agencyId].push(account);
    });
    return grouped;
  }, [accountHoursData]);

  // All hooks must be called before any early return (Rules of Hooks)
  const filteredProgress = useMemo(() => {
    return selectedAgencies.length > 0
      ? targetProgress.filter((p: any) => selectedAgencies.includes(p.agency.id))
      : targetProgress;
  }, [selectedAgencies, targetProgress]);

  // Aggregate totals for headline: single monthly quota (sum of agency targets) and progress to it
  const totals = useMemo(() => {
    let totalBillable = 0;
    let totalTarget = 0;
    filteredProgress.forEach((p: TargetProgressData) => {
      if (!p.noQuota) {
        totalBillable += Number(p.monthlyBillable) || 0;
        totalTarget += Number(p.monthlyTarget) || 0;
      }
    });
    return { totalBillable, totalTarget };
  }, [filteredProgress]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedCount = selectedAgencies.length;
  const totalCount = targetProgress.length;

  const monthlyPacingHeadline = calculatePacing(totals.totalBillable, totals.totalTarget, pacingData.monthProgress);
  const headlineProgressPercent = totals.totalTarget > 0
    ? Math.min((totals.totalBillable / totals.totalTarget) * 100, 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Monthly Target Progress</CardTitle>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-between min-w-[200px]"
                data-testid="button-agency-filter"
              >
                {selectedCount === 0
                  ? "Select agencies..."
                  : selectedCount === totalCount
                  ? "All agencies"
                  : `${selectedCount} selected`}
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search agencies..." />
                <CommandEmpty>No agencies found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={selectAll}
                    className="cursor-pointer"
                    data-testid="option-select-all"
                  >
                    <span className="font-medium">Select All</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={clearAll}
                    className="cursor-pointer"
                    data-testid="option-clear-all"
                  >
                    <span className="font-medium">Clear All</span>
                  </CommandItem>
                  <div className="border-t my-1" />
                  {targetProgress.map((progress: any) => (
                    <CommandItem
                      key={progress.agency.id}
                      onSelect={() => toggleAgency(progress.agency.id)}
                      className="cursor-pointer"
                      data-testid={`option-agency-${progress.agency.id}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedAgencies.includes(progress.agency.id)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {progress.agency.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-3">
        {filteredProgress.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No agencies selected. Use the filter above to select agencies.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Headline: single monthly hours progress */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-2xl font-bold">
                  {Math.round(totals.totalBillable)}h <span className="text-muted-foreground font-normal">/ {Math.round(totals.totalTarget)}h</span>
                </span>
                {totals.totalTarget > 0 && (
                  <span className="text-lg font-medium text-muted-foreground">
                    {headlineProgressPercent.toFixed(0)}%
                  </span>
                )}
              </div>
              {totals.totalTarget > 0 && (
                <>
                  <Progress value={headlineProgressPercent} className={cn("h-3", getProgressIndicatorClass(monthlyPacingHeadline.isPacing))} />
                  <div className={cn(
                    "flex items-center gap-1 text-sm",
                    monthlyPacingHeadline.isPacing === 'ahead' ? 'text-emerald-600 dark:text-emerald-500' :
                    monthlyPacingHeadline.isPacing === 'behind' ? 'text-red-600 dark:text-red-500' :
                    'text-muted-foreground'
                  )}>
                    {monthlyPacingHeadline.isPacing === 'ahead' && <TrendingUp className="h-4 w-4" />}
                    {monthlyPacingHeadline.isPacing === 'behind' && <TrendingDown className="h-4 w-4" />}
                    <span>
                      {monthlyPacingHeadline.isPacing === 'on-pace' ? 'On pace' :
                       monthlyPacingHeadline.isPacing === 'ahead' ?
                       `${Math.round(Math.abs(monthlyPacingHeadline.difference))}h ahead of pace` :
                       `${Math.round(Math.abs(monthlyPacingHeadline.difference))}h behind pace`}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Subsection: By Agency */}
            <Collapsible defaultOpen={false} className="group">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer py-1 -m-1">
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                  By Agency
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
              <div className="space-y-3 mt-3">
            {[...filteredProgress].sort((a, b) => (Number(b.monthlyBillable) || 0) - (Number(a.monthlyBillable) || 0)).map((progress: any) => {
              const monthlyBillable = Number(progress.monthlyBillable) || 0;
              const monthlyTarget = Number(progress.monthlyTarget) || 0;
              const monthlyPercent = monthlyTarget > 0 ? Math.min((monthlyBillable / monthlyTarget) * 100, 100) : 0;

              const agencyAccounts = accountsByAgency[progress.agency.id] || [];
              const hasAccounts = agencyAccounts.length > 0;
              const isExpanded = expandedAgencies.has(progress.agency.id);

              return (
                <Collapsible key={progress.agency.id} open={isExpanded} onOpenChange={() => hasAccounts && toggleAgencyExpanded(progress.agency.id)}>
                  <div className="space-y-2 py-2 border-b border-muted/50 last:border-0" data-testid={`target-agency-${progress.agency.id}`}>
                    <CollapsibleTrigger asChild disabled={!hasAccounts}>
                      <div className={cn("flex items-center justify-between", hasAccounts && "cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 -my-1")}>
                        <div className="flex items-center gap-2">
                          {hasAccounts ? (
                            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                          ) : (
                            <span className="w-4" />
                          )}
                          <span className="font-medium">{progress.agency.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            {Math.round(monthlyBillable)}h / {Math.round(monthlyTarget)}h
                          </span>
                          <span className="text-sm font-medium">{monthlyPercent.toFixed(0)}%</span>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <div className="min-w-0">
                      <Progress value={monthlyPercent} className="h-2" />
                    </div>
                    
                    <CollapsibleContent>
                      {hasAccounts && (
                        <div className="ml-6 mt-2 border-l-2 border-muted pl-3 space-y-1.5">
                          {[...agencyAccounts].sort((a, b) => (b.monthlyBilled || 0) - (a.monthlyBilled || 0)).map((account) => (
                            <div key={account.account.id} className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded text-sm" data-testid={`account-${account.account.id}`}>
                              <span>{account.account.name}</span>
                              <span className="text-muted-foreground">{Math.round(account.monthlyBilled || 0)}h</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
              </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
