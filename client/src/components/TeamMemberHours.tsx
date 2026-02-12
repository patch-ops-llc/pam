import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Users } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, eachDayOfInterval, isWeekend } from "date-fns";
import type { TimeLogWithRelations, User as UserType, UserAvailability, Holiday } from "@shared/schema";
import { parseAsLocalDate } from "@/pages/forecasting/utils";

export function TeamMemberHours() {
  // Get current date ranges
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  // Fetch time logs
  const { data: timeLogs, isLoading: logsLoading } = useQuery<TimeLogWithRelations[]>({
    queryKey: ["/api/time-logs"],
  });

  // Fetch user availability (OOO data)
  const { data: userAvailability, isLoading: availabilityLoading } = useQuery<UserAvailability[]>({
    queryKey: ["/api/user-availability"],
  });

  // Fetch company holidays
  const { data: holidays, isLoading: holidaysLoading } = useQuery<Holiday[]>({
    queryKey: ["/api/holidays"],
  });

  const isLoading = usersLoading || logsLoading || availabilityLoading || holidaysLoading;

  // Calculate hours for a user in a date range
  const calculateUserHours = (userId: string, startDate: Date, endDate: Date) => {
    if (!timeLogs) return { actual: 0, billed: 0, billable: 0, prebilled: 0 };

    const userLogs = timeLogs.filter(log => {
      if (log.userId !== userId) return false;
      if (!log.logDate) return false;
      
      // Parse the log date using the utility to avoid timezone issues
      const logDate = parseAsLocalDate(log.logDate);
      if (!logDate) return false;
      
      // Compare just the date parts (year, month, day) to avoid time component issues
      const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
      const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      return logDateOnly >= startDateOnly && logDateOnly <= endDateOnly;
    });

    const actual = userLogs.reduce((sum, log) => sum + Number(log.actualHours || 0), 0);
    const billed = userLogs.reduce((sum, log) => sum + Number(log.billedHours || 0), 0);
    
    // Break down by billing type
    const billable = userLogs
      .filter(log => log.billingType === 'billed')
      .reduce((sum, log) => sum + Number(log.actualHours || 0), 0);
    
    const prebilled = userLogs
      .filter(log => log.billingType === 'prebilled')
      .reduce((sum, log) => sum + Number(log.actualHours || 0), 0);

    return { actual, billed, billable, prebilled };
  };

  // Calculate working days in the month (excluding weekends)
  const calculateWorkingDays = (startDate: Date, endDate: Date): number => {
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    return allDays.filter(day => !isWeekend(day)).length;
  };

  // Calculate OOO days for a user in a date range
  const calculateOOODays = (userId: string, startDate: Date, endDate: Date): number => {
    if (!userAvailability) return 0;

    const userOOO = userAvailability.filter(ooo => ooo.userId === userId && ooo.isActive);

    let oooDays = 0;
    for (const ooo of userOOO) {
      const oooStart = new Date(ooo.startDate);
      const oooEnd = new Date(ooo.endDate);
      
      // Find the overlapping period
      const overlapStart = oooStart > startDate ? oooStart : startDate;
      const overlapEnd = oooEnd < endDate ? oooEnd : endDate;
      
      // Only count if there's actual overlap
      if (overlapStart <= overlapEnd) {
        const overlapDays = eachDayOfInterval({ start: overlapStart, end: overlapEnd });
        // Only count working days (exclude weekends)
        oooDays += overlapDays.filter(day => !isWeekend(day)).length;
      }
    }

    return oooDays;
  };

  // Calculate company holiday days in a date range
  const calculateHolidayDays = (startDate: Date, endDate: Date): number => {
    if (!holidays) return 0;

    let totalHolidayDays = 0;

    for (const holiday of holidays) {
      // Parse dates explicitly in local timezone to avoid UTC conversion issues
      const holidayStart = new Date(holiday.date + 'T00:00:00');
      const holidayEnd = holiday.endDate ? new Date(holiday.endDate + 'T00:00:00') : holidayStart;
      
      // Find the overlapping period between holiday and query range
      const overlapStart = holidayStart > startDate ? holidayStart : startDate;
      const overlapEnd = holidayEnd < endDate ? holidayEnd : endDate;
      
      // Only count if there's actual overlap
      if (overlapStart <= overlapEnd) {
        const overlapDays = eachDayOfInterval({ start: overlapStart, end: overlapEnd });
        // Only count working days (exclude weekends)
        totalHolidayDays += overlapDays.filter(day => !isWeekend(day)).length;
      }
    }

    return totalHolidayDays;
  };

  // Get daily hours based on employment type
  const getDailyHours = (employmentType?: string): number => {
    return employmentType === "part-time" ? 4 : 8;
  };

  // Calculate utilization metrics for a user
  const calculateUtilization = (userId: string, startDate: Date, endDate: Date, employmentType?: string) => {
    const totalWorkingDays = calculateWorkingDays(startDate, endDate);
    const oooDays = calculateOOODays(userId, startDate, endDate);
    const holidayDays = calculateHolidayDays(startDate, endDate);
    const availableWorkingDays = totalWorkingDays - oooDays - holidayDays;
    const dailyHours = getDailyHours(employmentType);
    const capacityHours = availableWorkingDays * dailyHours;

    const hours = calculateUserHours(userId, startDate, endDate);
    const billedHours = hours.billed;
    const actualHours = hours.actual;

    const billedUtilizationPercent = capacityHours > 0 ? (billedHours / capacityHours) * 100 : 0;
    const actualUtilizationPercent = capacityHours > 0 ? (actualHours / capacityHours) * 100 : 0;
    
    const billedCapacityPercent = 100 - billedUtilizationPercent;
    const actualCapacityPercent = 100 - actualUtilizationPercent;
    
    const billedCapacityHoursRemaining = capacityHours - billedHours;
    const actualCapacityHoursRemaining = capacityHours - actualHours;

    return {
      billedHours,
      actualHours,
      capacityHours,
      billedUtilizationPercent: Math.min(billedUtilizationPercent, 100), // Cap at 100%
      actualUtilizationPercent: Math.min(actualUtilizationPercent, 100), // Cap at 100%
      billedCapacityPercent: Math.max(billedCapacityPercent, 0), // Floor at 0%
      actualCapacityPercent: Math.max(actualCapacityPercent, 0), // Floor at 0%
      billedCapacityHoursRemaining: Math.max(billedCapacityHoursRemaining, 0),
      actualCapacityHoursRemaining: Math.max(actualCapacityHoursRemaining, 0),
    };
  };

  // Get team member data with both weekly and monthly stats
  const getTeamMemberData = () => {
    if (!users) return [];

    return users
      .map(user => {
        const weekHours = calculateUserHours(user.id, weekStart, weekEnd);
        // Calculate month-to-date hours (not full month) to match utilization calculation
        const monthHours = calculateUserHours(user.id, monthStart, now);
        // Calculate utilization to-date (from month start to today, not full month)
        const monthUtilization = calculateUtilization(user.id, monthStart, now, user.employmentType);
        
        return {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          employmentType: user.employmentType,
          week: weekHours,
          month: monthHours,
          utilization: monthUtilization,
        };
      })
      .filter(member => member.week.actual > 0 || member.month.actual > 0)
      .sort((a, b) => b.month.billed - a.month.billed);
  };

  const teamData = getTeamMemberData();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Hours Logged by Team Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const weekDateRange = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;
  const monthDateRange = format(monthStart, 'MMMM yyyy');

  // Determine progress bar color for billed hours utilization
  const getBilledUtilizationColor = (percent: number): string => {
    if (percent >= 90) return "bg-green-500"; // 90-100%
    if (percent >= 75) return "bg-yellow-500"; // 75-90%
    return "bg-red-500"; // Below 75%
  };

  // Determine progress bar color for actual hours utilization
  const getActualUtilizationColor = (percent: number): string => {
    if (percent > 90) return "bg-purple-500"; // Above 90%
    if (percent >= 75) return "bg-green-500"; // 75-90%
    if (percent >= 60) return "bg-yellow-500"; // 60-75%
    return "bg-red-500"; // Below 60%
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Utilization + Capacity Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {teamData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hours logged this week or month</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header row */}
            <div className="grid grid-cols-[1fr,auto,auto] gap-4 pb-2 border-b text-sm font-medium">
              <div>Team Member</div>
              <div className="text-center min-w-[200px]">
                <div>Hours Logged</div>
                <div className="text-xs text-muted-foreground font-normal">{monthDateRange} (To-Date)</div>
              </div>
              <div className="text-center min-w-[320px]">
                <div>Utilization / Capacity</div>
                <div className="text-xs text-muted-foreground font-normal">{monthDateRange} (To-Date)</div>
              </div>
            </div>

            {/* Team member rows */}
            {teamData.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-[1fr,auto,auto] gap-4 items-center p-3 rounded-lg border bg-card hover-elevate"
                data-testid={`member-hours-${member.id}`}
              >
                {/* Name column */}
                <div>
                  <div className="font-medium" data-testid={`text-member-name-${member.id}`}>
                    {member.name}
                  </div>
                </div>

                {/* Hours breakdown */}
                <div className="min-w-[200px]">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Actual:</span>
                      <span className="font-semibold" data-testid={`text-actual-hours-${member.id}`}>
                        {member.month.actual.toFixed(2)}h
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Billed:</span>
                      <span data-testid={`text-billed-hours-${member.id}`}>
                        {member.month.billed.toFixed(1)}h
                      </span>
                    </div>
                  </div>
                </div>

                {/* Utilization/Capacity metrics */}
                <div className="min-w-[320px]">
                  <div className="space-y-3">
                    {/* Billed Hours Utilization */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Billed Hours</span>
                      </div>
                      <Progress 
                        value={member.utilization.billedUtilizationPercent} 
                        className="h-3"
                        indicatorClassName={getBilledUtilizationColor(member.utilization.billedUtilizationPercent)}
                        data-testid={`progress-billed-utilization-${member.id}`}
                      />
                      <div className="flex justify-between text-xs">
                        <span className="font-medium" data-testid={`text-billed-utilization-${member.id}`}>
                          {member.utilization.billedUtilizationPercent.toFixed(2)}% utilized
                        </span>
                        <span className="text-muted-foreground" data-testid={`text-billed-capacity-hours-${member.id}`}>
                          {member.utilization.billedCapacityHoursRemaining.toFixed(2)}h remaining
                        </span>
                      </div>
                    </div>

                    {/* Actual Hours Utilization */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Actual Hours</span>
                      </div>
                      <Progress 
                        value={member.utilization.actualUtilizationPercent} 
                        className="h-3"
                        indicatorClassName={getActualUtilizationColor(member.utilization.actualUtilizationPercent)}
                        data-testid={`progress-actual-utilization-${member.id}`}
                      />
                      <div className="flex justify-between text-xs">
                        <span className="font-medium" data-testid={`text-actual-utilization-${member.id}`}>
                          {member.utilization.actualUtilizationPercent.toFixed(1)}% utilized
                        </span>
                        <span className="text-muted-foreground" data-testid={`text-actual-capacity-hours-${member.id}`}>
                          {member.utilization.actualCapacityHoursRemaining.toFixed(2)}h remaining
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
