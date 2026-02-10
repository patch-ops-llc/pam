import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";
import { format, addMonths, startOfMonth, subMonths, subQuarters, startOfQuarter, subWeeks, startOfWeek } from "date-fns";

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

  const getPacingColor = (pacingHours: number) => {
    if (pacingHours >= 0) return "bg-green-600 hover:bg-green-600 text-white";
    if (pacingHours >= -10) return "bg-yellow-500 hover:bg-yellow-500 text-white";
    return "bg-red-600 hover:bg-red-600 text-white";
  };

  const formatPacingHours = (hours: number) => {
    const sign = hours >= 0 ? "+" : "";
    return `${sign}${hours.toFixed(1)}h`;
  };

  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

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
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Resource Quota Tracker
            </CardTitle>
            <CardDescription>Team member monthly quota progress - {selectedMonthLabel}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={quickFilter || "custom"}
              onValueChange={handleQuickFilter}
            >
              <SelectTrigger className="w-[140px]" data-testid="select-resource-quick-filter">
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
              <SelectTrigger className="w-[160px]" data-testid="select-resource-month">
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
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Member</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Billed</TableHead>
              <TableHead className="text-right">Prebilled</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Progress</TableHead>
              <TableHead>Pacing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resourceQuotaData.map((item) => {
              const totalHours = item.billedHours + item.prebilledHours;
              const remaining = item.adjustedTarget - totalHours;
              const pacingHours = totalHours - item.expectedHours;
              const actualPercentageComplete = item.adjustedTarget > 0 ? (totalHours / item.adjustedTarget) * 100 : 0;
              return (
                <TableRow key={item.user.id} data-testid={`dashboard-resource-quota-${item.user.id}`}>
                  <TableCell className="font-medium">
                    {item.user.firstName} {item.user.lastName}
                  </TableCell>
                  <TableCell className="text-right">{item.adjustedTarget.toFixed(1)}h</TableCell>
                  <TableCell className="text-right">{item.billedHours.toFixed(1)}h</TableCell>
                  <TableCell className="text-right">{item.prebilledHours.toFixed(1)}h</TableCell>
                  <TableCell className="text-right">{remaining.toFixed(1)}h</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">
                      {actualPercentageComplete.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPacingColor(pacingHours)}>
                      {formatPacingHours(pacingHours)}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
