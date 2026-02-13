import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, DollarSign, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ForecastInvoice, ForecastExpense, ForecastRetainer, ForecastPayrollMember } from "@shared/schema";

// Helper function to parse date string as local date (not UTC)
// This matches the backend logic to ensure consistent date handling
const parseAsLocalDate = (dateString: string): Date => {
  const date = new Date(dateString);
  // If the string is in YYYY-MM-DD format, new Date() treats it as UTC
  // We need to adjust it to be interpreted as local
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }
  return date;
};

export function ForecastOverview() {
  const [forecastMonths, setForecastMonths] = useState([0]);
  const { toast } = useToast();
  const today = new Date();
  
  // Start from the beginning of the current month
  const forecastStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
  forecastStartDate.setHours(0, 0, 0, 0);
  
  // Calculate end date based on number of months (0 = current month only)
  const forecastEndDate = new Date(today.getFullYear(), today.getMonth() + forecastMonths[0] + 1, 0);
  forecastEndDate.setHours(23, 59, 59, 999);
  
  // Calculate the actual number of months for the calculation
  const actualForecastMonths = forecastMonths[0] + 1;

  const { data: invoices = [] } = useQuery<ForecastInvoice[]>({
    queryKey: ["/api/forecast/invoices"],
  });

  const { data: expenses = [] } = useQuery<ForecastExpense[]>({
    queryKey: ["/api/forecast/expenses"],
  });

  const { data: payrollMembers = [] } = useQuery<ForecastPayrollMember[]>({
    queryKey: ["/api/forecast/payroll-members"],
  });

  const { data: retainers = [] } = useQuery<ForecastRetainer[]>({
    queryKey: ["/api/forecast/retainers"],
  });

  const { data: quotaConfigs = [] } = useQuery<any[]>({
    queryKey: ["/api/quota-configs"],
  });

  const { data: accountRevenue = [] } = useQuery<any[]>({
    queryKey: ["/api/forecast/account-revenue"],
  });

  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: agencies = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const { data: quotaBreakdown = {} } = useQuery<{ [agencyId: string]: number }>({
    queryKey: ["/api/forecast/quota-breakdown", actualForecastMonths],
    queryFn: async () => {
      const response = await fetch(`/api/forecast/quota-breakdown?months=${actualForecastMonths}`);
      if (!response.ok) throw new Error('Failed to fetch quota breakdown');
      return response.json();
    },
  });

  const { data: invoiceBreakdown = {} } = useQuery<{ [agencyId: string]: number }>({
    queryKey: ["/api/forecast/invoice-breakdown", actualForecastMonths],
    queryFn: async () => {
      const response = await fetch(`/api/forecast/invoice-breakdown?months=${actualForecastMonths}`);
      if (!response.ok) throw new Error('Failed to fetch invoice breakdown');
      return response.json();
    },
  });

  const { data: retainerBreakdown = {} } = useQuery<{ [agencyId: string]: number }>({
    queryKey: ["/api/forecast/retainer-breakdown", actualForecastMonths],
    queryFn: async () => {
      const response = await fetch(`/api/forecast/retainer-breakdown?months=${actualForecastMonths}`);
      if (!response.ok) throw new Error('Failed to fetch retainer breakdown');
      return response.json();
    },
  });

  const { data: projectBreakdown = { agencies: {}, prospects: {} } } = useQuery<{ agencies: { [agencyId: string]: number }, prospects: { [prospectName: string]: number } }>({
    queryKey: ["/api/forecast/project-breakdown", actualForecastMonths],
    queryFn: async () => {
      const response = await fetch(`/api/forecast/project-breakdown?months=${actualForecastMonths}`);
      if (!response.ok) throw new Error('Failed to fetch project breakdown');
      return response.json();
    },
  });

  const { data: monthlyBreakdown = {} } = useQuery<{ [agencyId: string]: { [monthKey: string]: { quota: number; invoices: number; retainers: number; projects: number } } }>({
    queryKey: ["/api/forecast/monthly-breakdown", actualForecastMonths],
    queryFn: async () => {
      const response = await fetch(`/api/forecast/monthly-breakdown?months=${actualForecastMonths}`);
      if (!response.ok) throw new Error('Failed to fetch monthly breakdown');
      return response.json();
    },
  });

  const { data: prospectMonthlyBreakdown = {} } = useQuery<{ [prospectName: string]: { [monthKey: string]: number } }>({
    queryKey: ["/api/forecast/prospect-monthly-breakdown", actualForecastMonths],
    queryFn: async () => {
      const response = await fetch(`/api/forecast/prospect-monthly-breakdown?months=${actualForecastMonths}`);
      if (!response.ok) throw new Error('Failed to fetch prospect monthly breakdown');
      return response.json();
    },
  });

  const { data: forecastSettings } = useQuery<{ id: string; blendedRate: string; updatedAt: Date }>({
    queryKey: ["/api/forecast/settings"],
    queryFn: async () => {
      const response = await fetch('/api/forecast/settings');
      if (!response.ok) throw new Error('Failed to fetch forecast settings');
      return response.json();
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { blendedRate: string }) => {
      return await apiRequest('PUT', '/api/forecast/settings', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/quota-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/monthly-breakdown"] });
      toast({
        title: "Settings updated",
        description: "Blended rate has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const BLENDED_RATE = forecastSettings ? parseFloat(forecastSettings.blendedRate) : 90;

  const calculateForecast = () => {
    // Historical: ALL received invoices (actual revenue)
    const historicalInvoices = invoices.filter(inv => inv.status === 'received');
    const historicalRevenue = historicalInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

    // Forecast window: ALL invoices (pending OR received) within the forecast window
    // This is needed for proper project revenue gating and quota/retainer blocking
    const forecastInvoices = invoices.filter(inv => {
      const relevantDate = inv.forecastMonth
        ? parseAsLocalDate(inv.forecastMonth)
        : inv.realizationDate 
          ? parseAsLocalDate(inv.realizationDate)
          : inv.dueDate 
            ? parseAsLocalDate(inv.dueDate) 
            : parseAsLocalDate(inv.date);
      
      return relevantDate >= forecastStartDate && relevantDate <= forecastEndDate;
    });
    
    // Projected revenue: Only PENDING invoices within the forecast window
    const pendingForecastInvoices = forecastInvoices.filter(inv => inv.status === 'pending');
    const invoiceRevenue = pendingForecastInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

    // Build a set of months that have ANY invoices (pending OR received) for blocking quota/retainers
    const invoicedMonths = new Set<string>();
    // Build a map of ALL forecast invoice amounts by agency-month for subtracting from project revenue
    const invoiceAmountsByMonth = new Map<string, number>();
    
    // Mark months with ANY invoice (pending or received) to block quota/retainers
    invoices.forEach(invoice => {
      // Use forecastMonth if available, otherwise fall back to dueDate or date
      const relevantDate = invoice.forecastMonth
        ? parseAsLocalDate(invoice.forecastMonth)
        : invoice.dueDate 
          ? parseAsLocalDate(invoice.dueDate) 
          : parseAsLocalDate(invoice.date);
      const agencyId = invoice.agencyId || "unassigned";
      const monthKey = `${agencyId}-${relevantDate.getFullYear()}-${relevantDate.getMonth()}`;
      invoicedMonths.add(monthKey);
    });
    
    // Track ALL forecast invoice amounts (pending AND received within window) for subtracting from project revenue
    forecastInvoices.forEach(invoice => {
      // Use forecastMonth if available, otherwise fall back to dueDate or date
      const relevantDate = invoice.forecastMonth
        ? parseAsLocalDate(invoice.forecastMonth)
        : invoice.dueDate 
          ? parseAsLocalDate(invoice.dueDate) 
          : parseAsLocalDate(invoice.date);
      const agencyId = invoice.agencyId || "unassigned";
      const monthKey = `${agencyId}-${relevantDate.getFullYear()}-${relevantDate.getMonth()}`;
      const amount = parseFloat(invoice.amount);
      invoiceAmountsByMonth.set(monthKey, (invoiceAmountsByMonth.get(monthKey) || 0) + amount);
    });

    // Use API breakdown values for quota and retainer revenue (backend handles date logic correctly)
    const quotaRevenue = Object.values(quotaBreakdown).reduce((sum, amount) => sum + amount, 0);
    const retainerRevenue = Object.values(retainerBreakdown).reduce((sum, amount) => sum + amount, 0);

    // Calculate client-level revenue forecasts for the forecast period
    interface ProjectRevenueByAgencyAndClient {
      [agencyId: string]: {
        [accountId: string]: {
          [monthKey: string]: number;
        };
      };
    }
    
    const projectRevenueByAgencyAndClient: ProjectRevenueByAgencyAndClient = {};
    let projectRevenue = 0;

    accountRevenue.forEach(forecast => {
      // Only consider active forecasts
      if (!forecast.isActive) return;
      
      const monthlyAmount = parseFloat(forecast.monthlyAmount);
      if (monthlyAmount <= 0) return;
      
      const startDate = new Date(forecast.startDate);
      const endDate = forecast.endDate ? new Date(forecast.endDate) : null;
      
      // For prospects, use a special "prospects" agency key
      // For agencies, use their agencyId directly
      const agencyKey = forecast.prospectName ? "prospects" : (forecast.agencyId || "unassigned");
      
      // Use agencyId for existing clients, or prospectName for prospects as the client identifier
      const clientKey = forecast.prospectName || forecast.agencyId || "unknown";
      
      // Count full months where forecast is active, then subtract invoices from project revenue
      for (let i = 0; i < actualForecastMonths; i++) {
        const monthStart = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i, 1);
        const monthEnd = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i + 1, 0);
        
        // Check if forecast is active during any part of this month
        // Month is active if: monthStart <= endDate (or no endDate) AND monthEnd >= startDate
        if (monthStart <= (endDate || monthEnd) && monthEnd >= startDate) {
          let monthRevenue = monthlyAmount;
          
          // For agencies (not prospects), exclude project revenue entirely for months with invoices
          if (!forecast.prospectName) {
            const monthKey = `${forecast.agencyId || "unassigned"}-${monthStart.getFullYear()}-${monthStart.getMonth()}`;
            // If this month has any invoices, don't include project revenue at all
            if (invoiceAmountsByMonth.has(monthKey)) {
              monthRevenue = 0;
            }
          }
          
          projectRevenue += monthRevenue;
          
          // Track by agency, client/prospect, and month for breakdown
          const displayMonthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
          if (!projectRevenueByAgencyAndClient[agencyKey]) {
            projectRevenueByAgencyAndClient[agencyKey] = {};
          }
          if (!projectRevenueByAgencyAndClient[agencyKey][clientKey]) {
            projectRevenueByAgencyAndClient[agencyKey][clientKey] = {};
          }
          if (!projectRevenueByAgencyAndClient[agencyKey][clientKey][displayMonthKey]) {
            projectRevenueByAgencyAndClient[agencyKey][clientKey][displayMonthKey] = 0;
          }
          projectRevenueByAgencyAndClient[agencyKey][clientKey][displayMonthKey] += monthRevenue;
        }
      }
    });

    // Calculate total expenses including recurring ones
    // Filter out old "payroll" type expenses since they're now managed through payroll members
    const totalExpenses = expenses.filter(exp => exp.type !== "payroll").reduce((sum, exp) => {
      const expDate = new Date(exp.date);
      const amount = parseFloat(exp.amount);
      
      if (!exp.isRecurring) {
        // Non-recurring expense - check if it's in the forecast window
        if (expDate >= forecastStartDate && expDate <= forecastEndDate) {
          return sum + amount;
        }
        return sum;
      }
      
      // Recurring expense - calculate all occurrences in the forecast window
      const endDate = exp.recurrenceEndDate ? new Date(exp.recurrenceEndDate) : forecastEndDate;
      const actualEndDate = endDate > forecastEndDate ? forecastEndDate : endDate;
      
      let currentDate = new Date(expDate);
      let occurrences = 0;
      let maxIterations = 1000; // Safety limit to prevent infinite loops
      
      while (currentDate <= actualEndDate && maxIterations > 0) {
        maxIterations--;
        
        if (currentDate >= forecastStartDate && currentDate <= forecastEndDate) {
          occurrences++;
        }
        
        // Move to next occurrence based on interval
        if (exp.recurrenceInterval === 'weekly') {
          currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (exp.recurrenceInterval === 'biweekly') {
          currentDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
        } else if (exp.recurrenceInterval === 'monthly') {
          currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());
        } else {
          break;
        }
      }
      
      return sum + (amount * occurrences);
    }, 0);

    // Calculate payroll member expenses with bi-monthly pay logic
    // Pay frequency: 15th and end of month (two paychecks per month, each worth monthlyPay/2)
    // Only count future/outstanding paychecks
    const payrollExpenses = payrollMembers.reduce((sum, member) => {
      if (!member.isActive) return sum;
      
      const monthlyPay = parseFloat(member.monthlyPay);
      const startDate = new Date(member.startDate);
      const endDate = member.endDate ? new Date(member.endDate) : null;
      
      // Normalize today to start of day for date comparisons
      const todayStartOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      // For each month in the forecast period, evaluate both pay periods independently
      for (let i = 0; i < actualForecastMonths; i++) {
        const year = forecastStartDate.getFullYear();
        const month = forecastStartDate.getMonth() + i;
        
        // Define the two pay periods for this month
        const period1Start = new Date(year, month, 1);
        const period1End = new Date(year, month, 15);
        const period1PayDate = new Date(year, month, 15);
        
        const period2Start = new Date(year, month, 16);
        const period2End = new Date(year, month + 1, 0); // Last day of month
        const period2PayDate = new Date(year, month + 1, 0); // Last day of month
        
        // Check period 1 (1st-15th, paid on 15th)
        if (
          period1PayDate >= todayStartOfDay && // Payment hasn't happened yet
          period1PayDate <= forecastEndDate && // Within forecast window
          startDate <= period1End && // Member started by end of period
          (!endDate || endDate >= period1Start) // Member didn't end before period started
        ) {
          sum += monthlyPay / 2;
        }
        
        // Check period 2 (16th-end, paid on last day)
        if (
          period2PayDate >= todayStartOfDay && // Payment hasn't happened yet
          period2PayDate <= forecastEndDate && // Within forecast window
          startDate <= period2End && // Member started by end of period
          (!endDate || endDate >= period2Start) // Member didn't end before period started
        ) {
          sum += monthlyPay / 2;
        }
      }
      
      return sum;
    }, 0);

    const totalExpensesWithPayroll = totalExpenses + payrollExpenses;

    return {
      revenue: invoiceRevenue + quotaRevenue + retainerRevenue + projectRevenue,
      invoiceRevenue,
      quotaRevenue,
      retainerRevenue,
      projectRevenue,
      projectRevenueByAgencyAndClient,
      invoiceCount: pendingForecastInvoices.length,
      expenses: totalExpensesWithPayroll,
      net: (invoiceRevenue + quotaRevenue + retainerRevenue + projectRevenue) - totalExpensesWithPayroll,
      historicalRevenue,
      historicalCount: historicalInvoices.length,
    };
  };

  const forecast = calculateForecast();

  // Helper function to get month name
  const getMonthName = (monthsFromNow: number) => {
    const date = new Date(today.getFullYear(), today.getMonth() + monthsFromNow, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Get display text for the forecast period
  const getForecastPeriodText = () => {
    if (forecastMonths[0] === 0) {
      return getMonthName(0);
    } else {
      return `${getMonthName(0)} - ${getMonthName(forecastMonths[0])}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Forecast Timeline Control */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Timeline</CardTitle>
          <CardDescription>Select forecast period by month</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Forecast Period</Label>
              <span className="text-sm text-muted-foreground">
                {actualForecastMonths} month{actualForecastMonths !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-sm font-medium mb-2">
              {getForecastPeriodText()}
            </div>
            <Slider
              value={forecastMonths}
              onValueChange={setForecastMonths}
              min={0}
              max={12}
              step={1}
              className="w-full"
              data-testid="slider-forecast-days"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Current month</span>
              <span>+12 months</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Historical Revenue</CardTitle>
            <CardDescription>All received invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-historical-revenue">
              ${forecast.historicalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-muted-foreground">
              {forecast.historicalCount} invoice{forecast.historicalCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projected Revenue</CardTitle>
            <CardDescription>Pending invoices - {getForecastPeriodText()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-90day-revenue">
              ${forecast.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-muted-foreground">All revenue sources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Expenses</CardTitle>
            <CardDescription>{getForecastPeriodText()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-90day-expenses">
              ${forecast.expenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-muted-foreground">Recurring expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Net Projection</CardTitle>
            <CardDescription>{getForecastPeriodText()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${forecast.net >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`} data-testid="text-90day-net">
              ${forecast.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-muted-foreground">Revenue - Expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Settings</CardTitle>
          <CardDescription>Configure forecast calculation parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="blendedRate">Assumed Blended Rate ($/hour)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Used to calculate quota-based revenue forecasts
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="blendedRate"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={BLENDED_RATE}
                  onBlur={(e) => {
                    const newRate = e.target.value;
                    if (newRate && parseFloat(newRate) !== BLENDED_RATE) {
                      updateSettingsMutation.mutate({ blendedRate: newRate });
                    }
                  }}
                  className="w-32"
                  data-testid="input-blended-rate"
                />
                <span className="text-sm text-muted-foreground">per hour</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Current Rate</p>
              <p className="text-2xl font-bold">${BLENDED_RATE}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Breakdown</CardTitle>
          <CardDescription>Sources of revenue projection for {getForecastPeriodText()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
              <div>
                <p className="font-medium">Quota-Based Revenue</p>
                <p className="text-sm text-muted-foreground">
                  Monthly targets × {actualForecastMonths} month{actualForecastMonths !== 1 ? 's' : ''} @ ${BLENDED_RATE}/hr
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" data-testid="text-quota-revenue">
                  ${forecast.quotaRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {forecast.revenue > 0 ? ((forecast.quotaRevenue / forecast.revenue) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
              <div>
                <p className="font-medium">Retainer Revenue</p>
                <p className="text-sm text-muted-foreground">
                  Monthly retainers in forecast period
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" data-testid="text-retainer-revenue">
                  ${forecast.retainerRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {forecast.revenue > 0 ? ((forecast.retainerRevenue / forecast.revenue) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
              <div>
                <p className="font-medium">Project Revenue</p>
                <p className="text-sm text-muted-foreground">
                  Manual estimates by client
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" data-testid="text-project-revenue">
                  ${forecast.projectRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {forecast.revenue > 0 ? ((forecast.projectRevenue / forecast.revenue) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
              <div>
                <p className="font-medium">Invoice Revenue</p>
                <p className="text-sm text-muted-foreground">
                  {forecast.invoiceCount} invoice{forecast.invoiceCount !== 1 ? 's' : ''} in forecast period
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" data-testid="text-invoice-revenue">
                  ${forecast.invoiceRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {forecast.revenue > 0 ? ((forecast.invoiceRevenue / forecast.revenue) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <p className="font-semibold">Total Revenue</p>
              <p className="text-xl font-bold">
                ${forecast.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {forecast.invoiceCount === 0 && (
            <div className="text-sm text-muted-foreground italic p-3 bg-yellow-500/10 rounded-md border border-yellow-500/20">
              Note: No invoices in forecast period. Revenue projection is based solely on quota targets, retainers, and project forecasts.
            </div>
          )}

          {/* Revenue Breakdown by Client - Dynamic Section */}
          {(() => {
            // Collect all unique client IDs from all breakdown sources
            const allAgencyIds = new Set<string>();
            Object.keys(monthlyBreakdown).forEach(id => allAgencyIds.add(id));
            
            // Calculate totals per client from filtered monthly data
            const clientTotals: { [agencyId: string]: {
              quota: number;
              invoices: number;
              retainers: number;
              projects: number;
              total: number;
              name: string;
            } } = {};
            
            allAgencyIds.forEach(agencyId => {
              const agency = agencies.find((a: any) => a.id === agencyId);
              const agencyMonthlyData = monthlyBreakdown[agencyId] || {};
              
              // Sum only the months within the forecast period
              let quota = 0;
              let invoices = 0;
              let retainers = 0;
              let projects = 0;
              
              Object.entries(agencyMonthlyData).forEach(([monthKey, monthData]) => {
                const [year, month] = monthKey.split('-');
                const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                
                if (monthDate >= forecastStartDate && monthDate <= forecastEndDate) {
                  quota += (monthData as any).quota || 0;
                  invoices += (monthData as any).invoices || 0;
                  retainers += (monthData as any).retainers || 0;
                  projects += (monthData as any).projects || 0;
                }
              });
              
              const total = quota + invoices + retainers + projects;
              
              if (total > 0) {
                clientTotals[agencyId] = {
                  quota,
                  invoices,
                  retainers,
                  projects,
                  total,
                  name: agencyId === "unassigned" ? "Unassigned Client" : (agency?.name || 'Unknown Client'),
                };
              }
            });
            
            // Sort by total descending
            const sortedClients = Object.entries(clientTotals).sort(([, a], [, b]) => b.total - a.total);
            
            // Add individual prospects with monthly breakdown (filtered)
            const prospectEntries: Array<[string, { quota: number; invoices: number; retainers: number; projects: number; total: number; name: string; isProspect: boolean }]> = [];
            Object.entries(prospectMonthlyBreakdown).forEach(([prospectName, monthlyData]) => {
              // Sum only the months within the forecast period
              const prospectTotal = Object.entries(monthlyData).reduce((sum: number, [monthKey, val]) => {
                const [year, month] = monthKey.split('-');
                const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                
                if (monthDate >= forecastStartDate && monthDate <= forecastEndDate) {
                  return sum + (val as number);
                }
                return sum;
              }, 0);
              
              if (prospectTotal > 0) {
                prospectEntries.push([`prospect-${prospectName}`, {
                  quota: 0,
                  invoices: 0,
                  retainers: 0,
                  projects: prospectTotal,
                  total: prospectTotal,
                  name: prospectName,
                  isProspect: true,
                }]);
              }
            });
            
            // Combine and sort all clients including prospects
            const allClients = [...sortedClients, ...prospectEntries].sort(([, a], [, b]) => b.total - a.total);
            
            if (allClients.length === 0) {
              return null;
            }
            
            return (
              <div className="mt-6 pt-6 border-t">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Revenue Breakdown by Client</h3>
                  <p className="text-sm text-muted-foreground">All revenue sources organized by client for {getForecastPeriodText()}</p>
                </div>
                <div className="space-y-3">
                  {allClients.map(([agencyId, data]) => {
                    // For prospects, use prospectMonthlyBreakdown; for agencies, use monthlyBreakdown
                    const isProspect = 'isProspect' in data && !!(data as any).isProspect;
                    const prospectName = isProspect ? data.name : null;
                    const monthlyData = isProspect && prospectName
                      ? prospectMonthlyBreakdown[prospectName]
                      : monthlyBreakdown[agencyId] || {};
                    const hasMonthlyData = monthlyData && Object.keys(monthlyData).length > 0;
                    
                    return (
                      <div key={agencyId} className="border rounded-lg p-4 bg-muted/10" data-testid={`client-breakdown-${agencyId}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold">
                            {data.name}
                            {isProspect && <span className="ml-2 text-xs text-muted-foreground">(Prospect)</span>}
                          </h4>
                          <span className="text-lg font-bold text-primary">
                            ${data.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        
                        {hasMonthlyData ? (
                          <div className="space-y-2">
                            {Object.entries(monthlyData)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .filter(([monthKey]) => {
                                // Filter to only show months within the forecast period
                                const [year, month] = monthKey.split('-');
                                const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                                return monthDate >= forecastStartDate && monthDate <= forecastEndDate;
                              })
                              .map(([monthKey, monthDataValue]) => {
                                const [year, month] = monthKey.split('-');
                                const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
                                
                                // For prospects, monthDataValue is a number; for agencies, it's an object
                                const monthTotal = isProspect 
                                  ? (monthDataValue as number)
                                  : (monthDataValue as any).quota + (monthDataValue as any).invoices + (monthDataValue as any).retainers + (monthDataValue as any).projects;
                                
                                if (monthTotal === 0) return null;
                                
                                return (
                                  <div key={monthKey} className="p-2 rounded-md bg-background border">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="text-xs font-medium text-muted-foreground">{monthName}</div>
                                      <div className="text-sm font-bold">
                                        ${monthTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                      </div>
                                    </div>
                                    {!isProspect && (
                                      <div className="grid grid-cols-2 gap-1 text-xs">
                                        {(monthDataValue as any).quota > 0 && (
                                          <div className="text-muted-foreground">
                                            Quota: ${(monthDataValue as any).quota.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                          </div>
                                        )}
                                        {(monthDataValue as any).retainers > 0 && (
                                          <div className="text-muted-foreground">
                                            Retainer: ${(monthDataValue as any).retainers.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                          </div>
                                        )}
                                        {(monthDataValue as any).projects > 0 && (
                                          <div className="text-muted-foreground">
                                            Projects: ${(monthDataValue as any).projects.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                          </div>
                                        )}
                                        {(monthDataValue as any).invoices > 0 && (
                                          <div className="text-muted-foreground">
                                            Invoices: ${(monthDataValue as any).invoices.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {isProspect && (
                                      <div className="text-xs text-muted-foreground">
                                        Project Revenue
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {data.quota > 0 && (
                              <div className="p-2 rounded-md bg-background text-sm">
                                <div className="text-xs text-muted-foreground">Quota Revenue</div>
                                <div className="font-semibold">
                                  ${data.quota.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                              </div>
                            )}
                            {data.retainers > 0 && (
                              <div className="p-2 rounded-md bg-background text-sm">
                                <div className="text-xs text-muted-foreground">Retainer Revenue</div>
                                <div className="font-semibold">
                                  ${data.retainers.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                              </div>
                            )}
                            {data.projects > 0 && (
                              <div className="p-2 rounded-md bg-background text-sm">
                                <div className="text-xs text-muted-foreground">Project Revenue</div>
                                <div className="font-semibold">
                                  ${data.projects.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                              </div>
                            )}
                            {data.invoices > 0 && (
                              <div className="p-2 rounded-md bg-background text-sm">
                                <div className="text-xs text-muted-foreground">Invoice Revenue</div>
                                <div className="font-semibold">
                                  ${data.invoices.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Quota Impact Calculator */}
      <QuotaImpactCalculator
        currentQuotaRevenue={forecast.quotaRevenue}
        currentExpenses={forecast.expenses}
        currentTotalRevenue={forecast.revenue}
        currentNet={forecast.net}
        blendedRate={BLENDED_RATE}
        actualForecastMonths={actualForecastMonths}
        quotaBreakdown={quotaBreakdown}
        forecastPeriodText={getForecastPeriodText()}
      />

      {/* Project Revenue by Agency & Client (detailed view with monthly breakdown) */}
      {forecast.projectRevenue > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Project Revenue by Client</CardTitle>
            <CardDescription>Revenue from active projects, organized by client</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(forecast.projectRevenueByAgencyAndClient).map(([agencyId, clientsData]) => {
                const agency = agencyId === "unassigned" ? null : agencyId === "prospects" ? null : agencies.find((a: any) => a.id === agencyId);
                const agencyName = agencyId === "unassigned" ? "Unassigned Agency" : agencyId === "prospects" ? "Prospects" : (agency?.name || 'Unknown Agency');
                
                // Calculate agency total
                const agencyTotal = Object.values(clientsData).reduce((sum, clientMonths) => {
                  return sum + Object.values(clientMonths as { [monthKey: string]: number }).reduce((s: number, val: number) => s + val, 0);
                }, 0);
                
                return (
                  <div key={agencyId} className="border-2 rounded-lg p-4 bg-muted/10">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">{agencyName}</h3>
                      <span className="text-xl font-bold text-primary">
                        ${agencyTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    <div className="space-y-4 pl-4">
                      {Object.entries(clientsData).map(([clientKey, months]) => {
                        // clientKey could be either an agencyId or a prospectName
                        const agency = agencies.find((a: any) => a.id === clientKey);
                        const clientName = agency?.name || clientKey; // Use agency name if found, otherwise it's a prospect name
                        const clientTotal = Object.values(months as { [monthKey: string]: number }).reduce((sum: number, val: number) => sum + val, 0);
                        
                        return (
                          <div key={clientKey} className="border rounded-md p-4 bg-background">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold">{clientName}</h4>
                              <span className="text-lg font-bold">
                                ${clientTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {Object.entries(months as { [monthKey: string]: number })
                                .sort(([a], [b]) => a.localeCompare(b))
                                .filter(([monthKey]) => {
                                  // Filter to only show months within the forecast period
                                  const [year, month] = monthKey.split('-');
                                  const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                                  return monthDate >= forecastStartDate && monthDate <= forecastEndDate;
                                })
                                .map(([monthKey, revenue]) => {
                                  const [year, month] = monthKey.split('-');
                                  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
                                  
                                  return (
                                    <div key={monthKey} className="text-sm p-2 rounded-md bg-muted/30">
                                      <div className="text-muted-foreground">{monthName}</div>
                                      <div className="font-semibold">
                                        ${revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Quota Impact Calculator component
function QuotaImpactCalculator({
  currentQuotaRevenue,
  currentExpenses,
  currentTotalRevenue,
  currentNet,
  blendedRate,
  actualForecastMonths,
  quotaBreakdown,
  forecastPeriodText,
}: {
  currentQuotaRevenue: number;
  currentExpenses: number;
  currentTotalRevenue: number;
  currentNet: number;
  blendedRate: number;
  actualForecastMonths: number;
  quotaBreakdown: { [agencyId: string]: number };
  forecastPeriodText: string;
}) {
  const [quotaHoursInput, setQuotaHoursInput] = useState<string>("");

  // Calculate current total quota hours from breakdown
  const currentTotalQuotaHours = useMemo(() => {
    // Reverse-engineer: currentQuotaRevenue / blendedRate = total hours across all months
    // But we want monthly hours, so divide by forecast months
    return blendedRate > 0 ? currentQuotaRevenue / blendedRate / actualForecastMonths : 0;
  }, [currentQuotaRevenue, blendedRate, actualForecastMonths]);

  const whatIfQuotaHours = parseFloat(quotaHoursInput) || 0;
  const whatIfQuotaRevenue = whatIfQuotaHours * blendedRate * actualForecastMonths;
  const revenueDelta = whatIfQuotaRevenue - currentQuotaRevenue;
  const whatIfTotalRevenue = currentTotalRevenue + revenueDelta;
  const whatIfNet = whatIfTotalRevenue - currentExpenses;
  const netDelta = whatIfNet - currentNet;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Quota Impact Calculator
        </CardTitle>
        <CardDescription>
          See how changing your monthly quota hours affects projected revenue and net income for {forecastPeriodText}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="whatIfQuota">What-If Monthly Quota Hours</Label>
            <div className="flex items-center gap-2">
              <Input
                id="whatIfQuota"
                type="number"
                min="0"
                step="10"
                value={quotaHoursInput}
                onChange={(e) => setQuotaHoursInput(e.target.value)}
                placeholder={`Current: ${Math.round(currentTotalQuotaHours)}h`}
                className="w-48"
                data-testid="input-whatif-quota"
              />
              <span className="text-sm text-muted-foreground">hrs/month</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Current agency total: ~{Math.round(currentTotalQuotaHours)}h/mo @ ${blendedRate}/hr
            </p>
          </div>
        </div>

        {whatIfQuotaHours > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg border bg-muted/20">
              <div className="text-xs text-muted-foreground">Quota Revenue</div>
              <div className="text-lg font-bold mt-1">
                ${whatIfQuotaRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className={cn("text-sm mt-1", revenueDelta >= 0 ? "text-green-600" : "text-red-600")}>
                {revenueDelta >= 0 ? '+' : ''}{revenueDelta.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })} vs current
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {whatIfQuotaHours}h x ${blendedRate} x {actualForecastMonths}mo
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-muted/20">
              <div className="text-xs text-muted-foreground">Total Revenue</div>
              <div className="text-lg font-bold mt-1">
                ${whatIfTotalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className={cn("text-sm mt-1", revenueDelta >= 0 ? "text-green-600" : "text-red-600")}>
                {revenueDelta >= 0 ? '+' : ''}{revenueDelta.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })} vs current
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-muted/20">
              <div className="text-xs text-muted-foreground">Expenses (unchanged)</div>
              <div className="text-lg font-bold mt-1">
                ${currentExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Same as current forecast
              </div>
            </div>

            <div className={cn("p-4 rounded-lg border", whatIfNet >= 0 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800")}>
              <div className="text-xs text-muted-foreground">Net Projection</div>
              <div className={cn("text-xl font-bold mt-1", whatIfNet >= 0 ? "text-green-600" : "text-red-600")}>
                ${whatIfNet.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className={cn("text-sm font-medium mt-1", netDelta >= 0 ? "text-green-600" : "text-red-600")}>
                {netDelta >= 0 ? '+' : ''}{netDelta.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })} vs current net
              </div>
            </div>
          </div>
        )}

        {!whatIfQuotaHours && (
          <div className="text-sm text-muted-foreground italic p-4 bg-muted/20 rounded-lg border border-dashed">
            Enter a monthly quota target above to see how it would affect your revenue and net projections.
            Current quota-based revenue: ${currentQuotaRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} across {actualForecastMonths} month{actualForecastMonths !== 1 ? 's' : ''}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
