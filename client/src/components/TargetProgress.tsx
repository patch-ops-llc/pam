import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
      <CardContent>
        {filteredProgress.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No agencies selected. Use the filter above to select agencies.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Headline: single monthly hours progress */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
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
                  <Progress value={headlineProgressPercent} className={cn("h-4", getProgressIndicatorClass(monthlyPacingHeadline.isPacing))} />
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
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4">By Agency</h3>
              <div className="space-y-6">
            {filteredProgress.map((progress: any) => {
              // Ensure numeric values for all calculations
              const weeklyBillable = Number(progress.weeklyBillable) || 0;
              const weeklyTarget = Number(progress.weeklyTarget) || 0;
              const monthlyBillable = Number(progress.monthlyBillable) || 0;
              const monthlyTarget = Number(progress.monthlyTarget) || 0;
              
              const weeklyPacing = calculatePacing(
                weeklyBillable,
                weeklyTarget,
                pacingData.weekProgress
              );
              const monthlyPacing = calculatePacing(
                monthlyBillable,
                monthlyTarget,
                pacingData.monthProgress
              );

              const agencyAccounts = accountsByAgency[progress.agency.id] || [];
              const hasAccounts = agencyAccounts.length > 0;
              const isExpanded = expandedAgencies.has(progress.agency.id);

              return (
                <Collapsible key={progress.agency.id} open={isExpanded} onOpenChange={() => hasAccounts && toggleAgencyExpanded(progress.agency.id)}>
                  <div className="space-y-3" data-testid={`target-agency-${progress.agency.id}`}>
                    <CollapsibleTrigger asChild disabled={!hasAccounts}>
                      <div className={cn("flex items-center justify-between", hasAccounts && "cursor-pointer hover-elevate rounded-md p-1 -m-1")}>
                        <div className="flex items-center gap-2">
                          {hasAccounts ? (
                            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                          ) : (
                            <span className="w-4" />
                          )}
                          <span className="font-medium">{progress.agency.name}</span>
                        </div>
                        <div className="flex gap-4">
                          <Badge variant="outline">
                            Weekly: {Math.round(weeklyBillable)}h / <span className="text-gold">{weeklyTarget || 0}h</span>
                          </Badge>
                          <Badge variant="outline">
                            Monthly: {Math.round(monthlyBillable)}h / <span className="text-gold">{monthlyTarget || 0}h</span>
                          </Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm text-muted-foreground mb-1">
                            <span>Weekly Progress</span>
                            <span>{weeklyTarget > 0 ? ((weeklyBillable / weeklyTarget) * 100).toFixed(0) : 0}%</span>
                          </div>
                          <Progress value={Math.min(weeklyTarget > 0 ? (weeklyBillable / weeklyTarget) * 100 : 0, 100)} className={cn("h-3", weeklyTarget > 0 && getProgressIndicatorClass(weeklyPacing.isPacing))} />
                          {weeklyTarget > 0 && (
                            <div className={cn(
                              "flex items-center gap-1 text-xs mt-1",
                              weeklyPacing.isPacing === 'ahead' ? 'text-emerald-500' : 
                              weeklyPacing.isPacing === 'behind' ? 'text-red-500' : 
                              'text-muted-foreground'
                            )}>
                              {weeklyPacing.isPacing === 'ahead' && <TrendingUp className="h-3 w-3" />}
                              {weeklyPacing.isPacing === 'behind' && <TrendingDown className="h-3 w-3" />}
                              <span>
                                {weeklyPacing.isPacing === 'on-pace' ? 'On pace' :
                                 weeklyPacing.isPacing === 'ahead' ? 
                                 `${Math.round(Math.abs(weeklyPacing.difference))}h ahead of pace` :
                                 `${Math.round(Math.abs(weeklyPacing.difference))}h behind pace`}
                              </span>
                            </div>
                          )}
                        </div>
                        {progress.showBillable && (
                          <div>
                            <div className="flex justify-between text-sm text-muted-foreground mb-1">
                              <span>Weekly Billable</span>
                              <span>{Math.round(weeklyBillable)}h</span>
                            </div>
                            <Progress value={Math.min(weeklyTarget > 0 ? (weeklyBillable / weeklyTarget) * 100 : 0, 100)} className="h-3 bg-blue-100 dark:bg-blue-950" />
                          </div>
                        )}
                        {progress.showPreBilled && (
                          <div>
                            <div className="flex justify-between text-sm text-muted-foreground mb-1">
                              <span>Weekly Pre-billed</span>
                              <span>{Math.round(Number(progress.weeklyPreBilled) || 0)}h</span>
                            </div>
                            <Progress value={Math.min(weeklyTarget > 0 ? ((Number(progress.weeklyPreBilled) || 0) / weeklyTarget) * 100 : 0, 100)} className="h-3 bg-amber-100 dark:bg-amber-950 [&>div]:bg-amber-500 dark:[&>div]:bg-amber-600" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm text-muted-foreground mb-1">
                            <span>Monthly Progress</span>
                            <span>{monthlyTarget > 0 ? ((monthlyBillable / monthlyTarget) * 100).toFixed(0) : 0}%</span>
                          </div>
                          <Progress value={Math.min(monthlyTarget > 0 ? (monthlyBillable / monthlyTarget) * 100 : 0, 100)} className={cn("h-3", monthlyTarget > 0 && getProgressIndicatorClass(monthlyPacing.isPacing))} />
                          {monthlyTarget > 0 && (
                            <div className={cn(
                              "flex items-center gap-1 text-xs mt-1",
                              monthlyPacing.isPacing === 'ahead' ? 'text-emerald-500' : 
                              monthlyPacing.isPacing === 'behind' ? 'text-red-500' : 
                              'text-muted-foreground'
                            )}>
                              {monthlyPacing.isPacing === 'ahead' && <TrendingUp className="h-3 w-3" />}
                              {monthlyPacing.isPacing === 'behind' && <TrendingDown className="h-3 w-3" />}
                              <span>
                                {monthlyPacing.isPacing === 'on-pace' ? 'On pace' :
                                 monthlyPacing.isPacing === 'ahead' ? 
                                 `${Math.round(Math.abs(monthlyPacing.difference))}h ahead of pace` :
                                 `${Math.round(Math.abs(monthlyPacing.difference))}h behind pace`}
                              </span>
                            </div>
                          )}
                        </div>
                        {progress.showBillable && (
                          <div>
                            <div className="flex justify-between text-sm text-muted-foreground mb-1">
                              <span>Monthly Billable</span>
                              <span>{Math.round(monthlyBillable)}h</span>
                            </div>
                            <Progress value={Math.min(monthlyTarget > 0 ? (monthlyBillable / monthlyTarget) * 100 : 0, 100)} className="h-3 bg-blue-100 dark:bg-blue-950" />
                          </div>
                        )}
                        {progress.showPreBilled && (
                          <div>
                            <div className="flex justify-between text-sm text-muted-foreground mb-1">
                              <span>Monthly Pre-billed</span>
                              <span>{Math.round(Number(progress.monthlyPreBilled) || 0)}h</span>
                            </div>
                            <Progress value={Math.min(monthlyTarget > 0 ? ((Number(progress.monthlyPreBilled) || 0) / monthlyTarget) * 100 : 0, 100)} className="h-3 bg-amber-100 dark:bg-amber-950 [&>div]:bg-amber-500 dark:[&>div]:bg-amber-600" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <CollapsibleContent>
                      {hasAccounts && (
                        <div className="ml-6 mt-3 border-l-2 border-muted pl-4 space-y-2">
                          <div className="text-sm font-medium text-muted-foreground">Accounts</div>
                          {agencyAccounts.map((account) => (
                            <div key={account.account.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md" data-testid={`account-${account.account.id}`}>
                              <span className="text-sm">{account.account.name}</span>
                              <div className="flex gap-3 text-sm">
                                <span className="text-muted-foreground">
                                  Weekly: <span className="font-medium text-foreground">{Math.round(account.weeklyBilled || 0)}h</span>
                                </span>
                                <span className="text-muted-foreground">
                                  Monthly: <span className="font-medium text-foreground">{Math.round(account.monthlyBilled || 0)}h</span>
                                </span>
                              </div>
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
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
