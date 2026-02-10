import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Users, Building2, ChevronRight, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ForecastCapacityResource, ForecastCapacityAllocation } from "@shared/schema";
import { format, addMonths, startOfMonth, parseISO, isBefore, isAfter, subMonths, subQuarters, startOfQuarter } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

type ClientQuotaData = {
  agency: {
    id: string;
    name: string;
  };
  monthlyTarget: number;
  billedHours: number;
  expectedHours: number;
  percentageComplete: number;
};

type AccountQuotaData = {
  account: {
    id: string;
    name: string;
    agencyId: string;
    monthlyQuotaHours: string | null;
  };
  agency: {
    id: string;
    name: string;
  };
  monthlyTarget: number;
  billedHours: number;
  expectedHours: number;
  percentageComplete: number;
};

export function ReportsTab() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [quotaMonth, setQuotaMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [quickFilter, setQuickFilter] = useState<string>("");

  const handleQuickFilter = (value: string) => {
    setQuickFilter(value === quickFilter ? "" : value);
    if (value === quickFilter) {
      setQuotaMonth(format(new Date(), "yyyy-MM"));
      return;
    }
    
    const now = new Date();
    switch (value) {
      case "this-month":
        setQuotaMonth(format(now, "yyyy-MM"));
        break;
      case "last-month":
        setQuotaMonth(format(subMonths(now, 1), "yyyy-MM"));
        break;
      case "last-quarter":
        const lastQuarter = subQuarters(now, 1);
        setQuotaMonth(format(startOfQuarter(lastQuarter), "yyyy-MM"));
        break;
    }
  };
  const [showResourceTarget, setShowResourceTarget] = useState<boolean>(true);
  const [showResourceBilled, setShowResourceBilled] = useState<boolean>(true);
  const [showResourcePrebilled, setShowResourcePrebilled] = useState<boolean>(true);
  const [showResourceRemaining, setShowResourceRemaining] = useState<boolean>(true);
  const [showResourceProgress, setShowResourceProgress] = useState<boolean>(true);
  const [showResourcePacing, setShowResourcePacing] = useState<boolean>(true);
  const [showClientTarget, setShowClientTarget] = useState<boolean>(true);
  const [showClientBilled, setShowClientBilled] = useState<boolean>(true);
  const [showClientRemaining, setShowClientRemaining] = useState<boolean>(true);
  const [showClientProgress, setShowClientProgress] = useState<boolean>(true);
  const [showClientPacing, setShowClientPacing] = useState<boolean>(true);
  const [hiddenClientIds, setHiddenClientIds] = useState<Set<string>>(new Set());
  const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(new Set());
  
  const { data: resources = [] } = useQuery<ForecastCapacityResource[]>({
    queryKey: ["/api/forecast/capacity/resources"],
  });
  
  const { data: allocations = [] } = useQuery<ForecastCapacityAllocation[]>({
    queryKey: ["/api/forecast/capacity/allocations"],
  });

  const { data: resourceQuotaData = [] } = useQuery<ResourceQuotaData[]>({
    queryKey: ["/api/analytics/resource-quota-tracker", quotaMonth],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/resource-quota-tracker?month=${quotaMonth}`);
      if (!response.ok) throw new Error("Failed to fetch resource quota tracker");
      return response.json();
    },
  });

  const { data: clientQuotaData = [] } = useQuery<ClientQuotaData[]>({
    queryKey: ["/api/analytics/client-quota-tracker", quotaMonth],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/client-quota-tracker?month=${quotaMonth}`);
      if (!response.ok) throw new Error("Failed to fetch client quota tracker");
      return response.json();
    },
  });

  const { data: accountQuotaData = [] } = useQuery<AccountQuotaData[]>({
    queryKey: ["/api/analytics/account-quota-tracker", quotaMonth],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/account-quota-tracker?month=${quotaMonth}`);
      if (!response.ok) throw new Error("Failed to fetch account quota tracker");
      return response.json();
    },
  });

  const chartData = useMemo(() => {
    const months: { month: string; totalCapacity: number; totalAllocated: number }[] = [];
    const today = new Date();
    
    for (let i = -3; i <= 6; i++) {
      const monthDate = addMonths(startOfMonth(today), i);
      const monthKey = format(monthDate, "MMM yyyy");
      
      const totalBillableHours = resources.reduce((sum, r) => {
        const billableHours = parseFloat(r.defaultBillableHours || "0");
        const efficiency = parseFloat(r.defaultEfficiencyPercent || "100") / 100;
        if (isNaN(billableHours) || isNaN(efficiency)) return sum;
        return sum + billableHours * efficiency;
      }, 0);
      
      const monthAllocations = allocations.filter((a) => {
        const start = parseISO(a.startMonth);
        const end = a.endMonth ? parseISO(a.endMonth) : null;
        return !isBefore(monthDate, start) && (!end || !isAfter(monthDate, end));
      });
      
      const totalAllocatedHours = monthAllocations.reduce((sum, a) => {
        const allocatedHours = parseFloat(a.monthlyBillableHours || "0");
        if (isNaN(allocatedHours)) return sum;
        return sum + allocatedHours;
      }, 0);
      
      months.push({
        month: monthKey,
        totalCapacity: Math.round(totalBillableHours),
        totalAllocated: Math.round(totalAllocatedHours),
      });
    }
    
    return months;
  }, [resources, allocations]);

  const filteredData = useMemo(() => {
    if (selectedMonth === "all") return chartData;
    return chartData.filter(d => d.month === selectedMonth);
  }, [chartData, selectedMonth]);

  const monthOptions = useMemo(() => {
    return chartData.map(d => d.month);
  }, [chartData]);

  const quotaMonthOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = -6; i <= 6; i++) {
      const monthDate = addMonths(startOfMonth(today), i);
      options.push({
        value: format(monthDate, "yyyy-MM"),
        label: format(monthDate, "MMMM yyyy"),
      });
    }
    return options;
  }, []);

  const getPacingColor = (pacingHours: number) => {
    if (pacingHours >= 0) return "bg-green-600 hover:bg-green-600 text-white"; // On track or ahead
    if (pacingHours >= -10) return "bg-yellow-500 hover:bg-yellow-500 text-white"; // Slightly behind
    return "bg-red-600 hover:bg-red-600 text-white"; // Significantly behind
  };

  const formatPacingHours = (hours: number) => {
    const sign = hours >= 0 ? "+" : "";
    return `${sign}${hours.toFixed(1)}h`;
  };

  const toggleClientVisibility = (clientId: string) => {
    setHiddenClientIds(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const toggleClientExpanded = (clientId: string) => {
    setExpandedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const getAccountsForClient = (agencyId: string) => {
    return accountQuotaData.filter(item => item.account.agencyId === agencyId);
  };

  const visibleClientQuotaData = clientQuotaData.filter(
    item => !hiddenClientIds.has(item.agency.id)
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Capacity Reports
              </CardTitle>
              <CardDescription>Filter by month or view all</CardDescription>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48" data-testid="select-month-filter">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {monthOptions.map((month) => (
                  <SelectItem key={month} value={month}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Capacity vs Allocations
          </CardTitle>
          <CardDescription>Monthly team capacity compared to client commitments</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalCapacity" name="Total Capacity" fill="hsl(var(--primary))" />
              <Bar dataKey="totalAllocated" name="Allocated Hours" fill="hsl(var(--chart-2))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Resource Quota Tracker */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Resource Quota Tracker
              </CardTitle>
              <CardDescription>Team member monthly quota progress</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-wrap gap-3 items-center text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResourceTarget}
                    onChange={(e) => setShowResourceTarget(e.target.checked)}
                    className="rounded"
                  />
                  <span>Target</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResourceBilled}
                    onChange={(e) => setShowResourceBilled(e.target.checked)}
                    className="rounded"
                  />
                  <span>Billed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResourcePrebilled}
                    onChange={(e) => setShowResourcePrebilled(e.target.checked)}
                    className="rounded"
                  />
                  <span>Prebilled</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResourceRemaining}
                    onChange={(e) => setShowResourceRemaining(e.target.checked)}
                    className="rounded"
                  />
                  <span>Remaining</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResourceProgress}
                    onChange={(e) => setShowResourceProgress(e.target.checked)}
                    className="rounded"
                  />
                  <span>Progress</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResourcePacing}
                    onChange={(e) => setShowResourcePacing(e.target.checked)}
                    className="rounded"
                  />
                  <span>Pacing</span>
                </label>
              </div>
              <Select value={quotaMonth} onValueChange={setQuotaMonth}>
                <SelectTrigger className="w-48" data-testid="select-quota-month">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {quotaMonthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                {showResourceTarget && <TableHead className="text-right">Adjusted Target</TableHead>}
                {showResourceBilled && <TableHead className="text-right">Billed Hours</TableHead>}
                {showResourcePrebilled && <TableHead className="text-right">Prebilled Hours</TableHead>}
                {showResourceRemaining && <TableHead className="text-right">Remaining</TableHead>}
                {showResourceProgress && <TableHead className="text-right">Progress</TableHead>}
                {showResourcePacing && <TableHead>Pacing</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {resourceQuotaData.map((item) => {
                const totalHours = item.billedHours + item.prebilledHours;
                const remaining = item.adjustedTarget - totalHours;
                const pacingHours = totalHours - item.expectedHours;
                const actualPercentageComplete = item.adjustedTarget > 0 ? (totalHours / item.adjustedTarget) * 100 : 0;
                return (
                  <TableRow key={item.user.id} data-testid={`resource-quota-${item.user.id}`}>
                    <TableCell className="font-medium">
                      {item.user.firstName} {item.user.lastName}
                    </TableCell>
                    {showResourceTarget && <TableCell className="text-right">{item.adjustedTarget.toFixed(1)}h</TableCell>}
                    {showResourceBilled && <TableCell className="text-right">{item.billedHours.toFixed(1)}h</TableCell>}
                    {showResourcePrebilled && <TableCell className="text-right">{item.prebilledHours.toFixed(1)}h</TableCell>}
                    {showResourceRemaining && <TableCell className="text-right">{remaining.toFixed(1)}h</TableCell>}
                    {showResourceProgress && (
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {actualPercentageComplete.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    )}
                    {showResourcePacing && (
                      <TableCell>
                        <Badge className={getPacingColor(pacingHours)}>
                          {formatPacingHours(pacingHours)}
                        </Badge>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Client Quota Tracker */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Client Quota Tracker
              </CardTitle>
              <CardDescription>Client monthly quota progress</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3 items-center text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showClientTarget}
                  onChange={(e) => setShowClientTarget(e.target.checked)}
                  className="rounded"
                />
                <span>Target</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showClientBilled}
                  onChange={(e) => setShowClientBilled(e.target.checked)}
                  className="rounded"
                />
                <span>Billed</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showClientRemaining}
                  onChange={(e) => setShowClientRemaining(e.target.checked)}
                  className="rounded"
                />
                <span>Remaining</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showClientProgress}
                  onChange={(e) => setShowClientProgress(e.target.checked)}
                  className="rounded"
                />
                <span>Progress</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showClientPacing}
                  onChange={(e) => setShowClientPacing(e.target.checked)}
                  className="rounded"
                />
                <span>Pacing</span>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {clientQuotaData.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2 border-b">
              <span className="text-sm text-muted-foreground">Show/Hide Clients:</span>
              {clientQuotaData.map((item) => (
                <label key={item.agency.id} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hiddenClientIds.has(item.agency.id)}
                    onChange={() => toggleClientVisibility(item.agency.id)}
                    className="rounded"
                    data-testid={`toggle-client-${item.agency.id}`}
                  />
                  <span className="text-sm">{item.agency.name}</span>
                </label>
              ))}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                {showClientTarget && <TableHead className="text-right">Monthly Target</TableHead>}
                {showClientBilled && <TableHead className="text-right">Billed Hours</TableHead>}
                {showClientRemaining && <TableHead className="text-right">Remaining</TableHead>}
                {showClientProgress && <TableHead className="text-right">Progress</TableHead>}
                {showClientPacing && <TableHead>Pacing</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleClientQuotaData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No clients selected or no quota data available
                  </TableCell>
                </TableRow>
              ) : (
                visibleClientQuotaData.map((item) => {
                  const remaining = item.monthlyTarget - item.billedHours;
                  const pacingHours = item.billedHours - item.expectedHours;
                  const clientAccounts = getAccountsForClient(item.agency.id);
                  const isExpanded = expandedClientIds.has(item.agency.id);
                  const hasAccounts = clientAccounts.length > 0;
                  return (
                    <>
                      <TableRow key={item.agency.id} data-testid={`client-quota-${item.agency.id}`} className={hasAccounts ? "cursor-pointer hover-elevate" : ""} onClick={() => hasAccounts && toggleClientExpanded(item.agency.id)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {hasAccounts && (
                              <Button variant="ghost" size="icon" className="h-5 w-5 p-0" data-testid={`expand-client-${item.agency.id}`}>
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            )}
                            {!hasAccounts && <span className="w-5" />}
                            {item.agency.name}
                          </div>
                        </TableCell>
                        {showClientTarget && <TableCell className="text-right">{item.monthlyTarget.toFixed(1)}h</TableCell>}
                        {showClientBilled && <TableCell className="text-right">{item.billedHours.toFixed(1)}h</TableCell>}
                        {showClientRemaining && <TableCell className="text-right">{remaining.toFixed(1)}h</TableCell>}
                        {showClientProgress && (
                          <TableCell className="text-right">
                            <Badge variant="outline">
                              {item.percentageComplete.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        )}
                        {showClientPacing && (
                          <TableCell>
                            <Badge className={getPacingColor(pacingHours)}>
                              {formatPacingHours(pacingHours)}
                            </Badge>
                          </TableCell>
                        )}
                      </TableRow>
                      {isExpanded && clientAccounts.map((accountItem) => {
                        const accountRemaining = accountItem.monthlyTarget - accountItem.billedHours;
                        const accountPacingHours = accountItem.billedHours - accountItem.expectedHours;
                        return (
                          <TableRow key={accountItem.account.id} data-testid={`account-quota-${accountItem.account.id}`} className="bg-muted/30">
                            <TableCell className="pl-10 text-muted-foreground">
                              {accountItem.account.name}
                            </TableCell>
                            {showClientTarget && <TableCell className="text-right text-muted-foreground">{accountItem.monthlyTarget.toFixed(1)}h</TableCell>}
                            {showClientBilled && <TableCell className="text-right text-muted-foreground">{accountItem.billedHours.toFixed(1)}h</TableCell>}
                            {showClientRemaining && <TableCell className="text-right text-muted-foreground">{accountRemaining.toFixed(1)}h</TableCell>}
                            {showClientProgress && (
                              <TableCell className="text-right">
                                <Badge variant="outline" className="text-muted-foreground">
                                  {accountItem.percentageComplete.toFixed(1)}%
                                </Badge>
                              </TableCell>
                            )}
                            {showClientPacing && (
                              <TableCell>
                                <Badge className={getPacingColor(accountPacingHours)}>
                                  {formatPacingHours(accountPacingHours)}
                                </Badge>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
