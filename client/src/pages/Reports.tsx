import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, ChevronRight, ChevronDown } from "lucide-react";
import { subMonths, subQuarters, startOfQuarter, getMonth, getYear, subWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter as startQ, endOfQuarter } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MonthlyReportRow {
  agencyId: string;
  agencyName: string;
  accountId: string;
  accountName: string;
  projectId: string | null;
  projectName: string | null;
  tier: string;
  totalBilledHours: number;
}

export default function Reports() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [quickFilter, setQuickFilter] = useState<string>("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const handleQuickFilter = (value: string) => {
    if (value === "custom" || value === "") {
      setQuickFilter("");
      return;
    }
    
    setQuickFilter(value);
    const now = new Date();
    
    switch (value) {
      case "this-week": {
        const start = startOfWeek(now, { weekStartsOn: 1 });
        setSelectedYear(getYear(start));
        setSelectedMonth(getMonth(start) + 1);
        break;
      }
      case "last-week": {
        const lastWeek = subWeeks(now, 1);
        const start = startOfWeek(lastWeek, { weekStartsOn: 1 });
        setSelectedYear(getYear(start));
        setSelectedMonth(getMonth(start) + 1);
        break;
      }
      case "this-month":
        setSelectedYear(getYear(now));
        setSelectedMonth(getMonth(now) + 1);
        break;
      case "last-month": {
        const lastMonth = subMonths(now, 1);
        setSelectedYear(getYear(lastMonth));
        setSelectedMonth(getMonth(lastMonth) + 1);
        break;
      }
      case "this-quarter": {
        const qStart = startQ(now);
        setSelectedYear(getYear(qStart));
        setSelectedMonth(getMonth(qStart) + 1);
        break;
      }
      case "last-quarter": {
        const lastQuarter = subQuarters(now, 1);
        const qStart = startOfQuarter(lastQuarter);
        setSelectedYear(getYear(qStart));
        setSelectedMonth(getMonth(qStart) + 1);
        break;
      }
    }
  };

  const toggleClientExpanded = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const { data: reportData, isLoading } = useQuery<MonthlyReportRow[]>({
    queryKey: ['/api/time-logs/reports/monthly', selectedYear, selectedMonth],
    queryFn: async () => {
      const response = await fetch(`/api/time-logs/reports/monthly?year=${selectedYear}&month=${selectedMonth}`);
      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }
      return response.json();
    },
    enabled: !!selectedYear && !!selectedMonth,
  });

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const totalHours = reportData?.reduce((sum, row) => sum + row.totalBilledHours, 0) || 0;

  const clientTierRollup = reportData?.reduce((acc, row) => {
    const key = `${row.agencyId}-${row.tier}`;
    if (!acc[key]) {
      acc[key] = { 
        agencyName: row.agencyName, 
        tier: row.tier, 
        hours: 0 
      };
    }
    acc[key].hours += row.totalBilledHours;
    return acc;
  }, {} as Record<string, { agencyName: string; tier: string; hours: number }>);

  const clientRollup = reportData?.reduce((acc, row) => {
    if (!acc[row.agencyId]) {
      acc[row.agencyId] = { id: row.agencyId, name: row.agencyName, hours: 0, accounts: {} as Record<string, { name: string; hours: number }> };
    }
    acc[row.agencyId].hours += row.totalBilledHours;
    
    if (!acc[row.agencyId].accounts[row.accountId]) {
      acc[row.agencyId].accounts[row.accountId] = { name: row.accountName, hours: 0 };
    }
    acc[row.agencyId].accounts[row.accountId].hours += row.totalBilledHours;
    
    return acc;
  }, {} as Record<string, { id: string; name: string; hours: number; accounts: Record<string, { name: string; hours: number }> }>);

  const accountRollup = reportData?.reduce((acc, row) => {
    const key = `${row.agencyId}-${row.accountId}`;
    if (!acc[key]) {
      acc[key] = { 
        agencyName: row.agencyName, 
        accountName: row.accountName, 
        hours: 0 
      };
    }
    acc[key].hours += row.totalBilledHours;
    return acc;
  }, {} as Record<string, { agencyName: string; accountName: string; hours: number }>);

  const tierRollup = reportData?.reduce((acc, row) => {
    if (!acc[row.tier]) {
      acc[row.tier] = 0;
    }
    acc[row.tier] += row.totalBilledHours;
    return acc;
  }, {} as Record<string, number>);

  const exportToCsv = () => {
    if (!reportData || reportData.length === 0) return;

    const headers = ['Client', 'Account', 'Project', 'Tier', 'Billable Hours'];
    const csvRows = [
      headers.join(','),
      ...reportData.map(row => [
        `"${row.agencyName}"`,
        `"${row.accountName}"`,
        `"${row.projectName || 'No Project'}"`,
        row.tier,
        row.totalBilledHours.toFixed(2)
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-log-report-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Monthly Time Log Reports</h1>
        <p className="text-muted-foreground">
          Generate invoicing reports by account, project, and tier
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
          <CardDescription>Select the month to generate a report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="min-w-[180px]">
              <label className="text-sm font-medium mb-2 block">Quick Filter</label>
              <Select
                value={quickFilter || "custom"}
                onValueChange={handleQuickFilter}
              >
                <SelectTrigger data-testid="select-quick-filter">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-quarter">This Quarter</SelectItem>
                  <SelectItem value="last-quarter">Last Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[120px]">
              <label className="text-sm font-medium mb-2 block">Year</label>
              <Select
                value={String(selectedYear)}
                onValueChange={(value) => {
                  setSelectedYear(Number(value));
                  setQuickFilter("");
                }}
              >
                <SelectTrigger data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-2 block">Month</label>
              <Select
                value={String(selectedMonth)}
                onValueChange={(value) => {
                  setSelectedMonth(Number(value));
                  setQuickFilter("");
                }}
              >
                <SelectTrigger data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={exportToCsv}
              disabled={!reportData || reportData.length === 0}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billable Hours Summary</CardTitle>
          <CardDescription>
            {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading report...</div>
          ) : !reportData || reportData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-data">
              No billable hours logged for this period
            </div>
          ) : (
            <>
              <div className="mb-6 p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Total Billable Hours</div>
                <div className="text-2xl font-bold" data-testid="text-total-hours">{totalHours.toFixed(2)}</div>
              </div>

              <div className="mb-6 space-y-4">
                <h3 className="text-lg font-semibold">Hours by Client & Tier (for Invoicing)</h3>
                <p className="text-sm text-muted-foreground">Each client-tier combination represents a different billing rate</p>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead className="text-right">Billable Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientTierRollup && Object.entries(clientTierRollup)
                        .sort((a, b) => {
                          const clientCmp = a[1].agencyName.localeCompare(b[1].agencyName);
                          if (clientCmp !== 0) return clientCmp;
                          return a[1].tier.localeCompare(b[1].tier);
                        })
                        .map(([key, data]) => (
                          <TableRow key={key} data-testid={`row-client-tier-${key}`}>
                            <TableCell className="font-medium">{data.agencyName}</TableCell>
                            <TableCell className="uppercase text-sm">{data.tier}</TableCell>
                            <TableCell className="text-right font-semibold">{data.hours.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="mb-6 space-y-4">
                <h3 className="text-lg font-semibold">Hours by Client (click to expand accounts)</h3>
                <div className="space-y-2">
                  {clientRollup && Object.entries(clientRollup)
                    .sort((a, b) => a[1].name.localeCompare(b[1].name))
                    .map(([id, data]) => {
                      const isExpanded = expandedClients.has(id);
                      const accountsList = Object.entries(data.accounts).sort((a, b) => a[1].name.localeCompare(b[1].name));
                      const hasAccounts = accountsList.length > 0;
                      
                      return (
                        <Collapsible key={id} open={isExpanded} onOpenChange={() => toggleClientExpanded(id)}>
                          <Card className="overflow-visible">
                            <CollapsibleTrigger asChild>
                              <CardContent className="pt-4 pb-4 cursor-pointer hover-elevate flex items-center justify-between" data-testid={`client-row-${id}`}>
                                <div className="flex items-center gap-2">
                                  {hasAccounts ? (
                                    isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                                  ) : (
                                    <span className="w-4" />
                                  )}
                                  <div className="text-sm font-medium">{data.name}</div>
                                </div>
                                <div className="text-xl font-bold">{data.hours.toFixed(2)} hrs</div>
                              </CardContent>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              {hasAccounts && (
                                <div className="border-t px-6 pb-4">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="pl-8">Account</TableHead>
                                        <TableHead className="text-right">Billable Hours</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {accountsList.map(([accountId, accountData]) => (
                                        <TableRow key={accountId} data-testid={`account-row-${accountId}`}>
                                          <TableCell className="pl-8">{accountData.name}</TableCell>
                                          <TableCell className="text-right">{accountData.hours.toFixed(2)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      );
                    })}
                </div>
              </div>

              <div className="mb-6 space-y-4">
                <h3 className="text-lg font-semibold">Hours by Account</h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Billable Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountRollup && Object.entries(accountRollup)
                        .sort((a, b) => {
                          const agencyCmp = a[1].agencyName.localeCompare(b[1].agencyName);
                          if (agencyCmp !== 0) return agencyCmp;
                          return a[1].accountName.localeCompare(b[1].accountName);
                        })
                        .map(([key, data]) => (
                          <TableRow key={key}>
                            <TableCell className="font-medium">{data.agencyName}</TableCell>
                            <TableCell className="font-medium">{data.accountName}</TableCell>
                            <TableCell className="text-right">{data.hours.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="mb-6 space-y-4">
                <h3 className="text-lg font-semibold">Hours by Tier</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tierRollup && Object.entries(tierRollup)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([tier, hours]) => (
                      <Card key={tier}>
                        <CardContent className="pt-6">
                          <div className="text-sm font-medium text-muted-foreground uppercase">{tier}</div>
                          <div className="text-2xl font-bold">{hours.toFixed(2)} hrs</div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-4">Detailed Breakdown</h3>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Billable Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row, index) => (
                      <TableRow key={index} data-testid={`row-report-${index}`}>
                        <TableCell className="font-medium" data-testid={`text-client-${index}`}>
                          {row.agencyName}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`text-account-${index}`}>
                          {row.accountName}
                        </TableCell>
                        <TableCell data-testid={`text-project-${index}`}>
                          {row.projectName || <span className="text-muted-foreground">No Project</span>}
                        </TableCell>
                        <TableCell data-testid={`text-tier-${index}`}>
                          {row.tier}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-hours-${index}`}>
                          {row.totalBilledHours.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
