import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock } from "lucide-react";
import { format, eachDayOfInterval, isWeekend, startOfMonth, endOfMonth } from "date-fns";

export function CustomPeriodClientTracker() {
  const { data: agencies = [], isLoading: agenciesLoading } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const { data: timeLogs = [], isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["/api/time-logs"],
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const isLoading = agenciesLoading || logsLoading;

  // Filter clients with custom retainer periods
  const customPeriodClients = agencies.filter(agency => 
    agency.retainerStartDay && agency.retainerStartDay !== 1
  );

  // Calculate custom period date range for a client
  const getCustomPeriodDates = (retainerStartDay: number) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    let periodStart: Date;
    let periodEnd: Date;

    // If we're past the retainer start day this month, the period is this month's start day to next month's (start day - 1)
    if (currentDay >= retainerStartDay) {
      periodStart = new Date(currentYear, currentMonth, retainerStartDay);
      periodEnd = new Date(currentYear, currentMonth + 1, retainerStartDay - 1);
    } else {
      // Otherwise, the period is last month's start day to this month's (start day - 1)
      periodStart = new Date(currentYear, currentMonth - 1, retainerStartDay);
      periodEnd = new Date(currentYear, currentMonth, retainerStartDay - 1);
    }

    return { periodStart, periodEnd };
  };

  // Calculate working days in a custom period
  const calculateWorkingDays = (startDate: Date, endDate: Date): number => {
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    return allDays.filter(day => !isWeekend(day)).length;
  };

  // Get hours logged for a client in their custom period
  const getClientHours = (agencyId: string, startDate: Date, endDate: Date) => {
    // Find all projects for this client
    const clientProjects = projects.filter((p: any) => p.agencyId === agencyId);
    const projectIds = new Set(clientProjects.map((p: any) => p.id));

    // Filter time logs for these projects within the date range
    const clientLogs = timeLogs.filter(log => {
      if (!projectIds.has(log.projectId)) return false;
      if (!log.logDate) return false;

      const logDateStr = log.logDate.toString().split('T')[0];
      const logDate = new Date(logDateStr + 'T00:00:00');

      const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

      return logDate >= startDateOnly && logDate <= endDateOnly;
    });

    const actual = clientLogs.reduce((sum, log) => sum + Number(log.actualHours || 0), 0);
    const billed = clientLogs.reduce((sum, log) => sum + Number(log.billedHours || 0), 0);

    // Get unique users who logged time
    const uniqueUsers = new Set(clientLogs.map(log => log.userId));
    const userCount = uniqueUsers.size;

    return { actual, billed, logCount: clientLogs.length, userCount };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Custom Retainer Period Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (customPeriodClients.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Custom Retainer Period Tracking
        </CardTitle>
        <CardDescription>
          Hours logged for clients with custom billing cycles
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {customPeriodClients.map(client => {
          const { periodStart, periodEnd } = getCustomPeriodDates(client.retainerStartDay);
          const workingDays = calculateWorkingDays(periodStart, periodEnd);
          const hours = getClientHours(client.id, periodStart, periodEnd);
          const periodLabel = `${format(periodStart, 'MMM d')} - ${format(periodEnd, 'MMM d, yyyy')}`;

          return (
            <div 
              key={client.id} 
              className="border rounded-lg p-4 space-y-3"
              data-testid={`custom-period-client-${client.id}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-lg">{client.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Retainer Period: {periodLabel}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Billing cycle starts on day {client.retainerStartDay} of each month
                  </p>
                </div>
                <Badge variant="secondary" className="text-sm">
                  {workingDays} working days
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-md bg-muted/30">
                  <div className="text-xs text-muted-foreground">Actual Hours</div>
                  <div className="text-2xl font-bold" data-testid={`actual-hours-${client.id}`}>
                    {hours.actual.toFixed(2)}
                  </div>
                </div>
                <div className="p-3 rounded-md bg-muted/30">
                  <div className="text-xs text-muted-foreground">Billed Hours</div>
                  <div className="text-2xl font-bold" data-testid={`billed-hours-${client.id}`}>
                    {hours.billed.toFixed(2)}
                  </div>
                </div>
                <div className="p-3 rounded-md bg-muted/30">
                  <div className="text-xs text-muted-foreground">Time Entries</div>
                  <div className="text-2xl font-bold">
                    {hours.logCount}
                  </div>
                </div>
                <div className="p-3 rounded-md bg-muted/30">
                  <div className="text-xs text-muted-foreground">Team Members</div>
                  <div className="text-2xl font-bold">
                    {hours.userCount}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
