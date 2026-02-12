import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, TrendingDown, Target, Users, Building2, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, subWeeks, subMonths, startOfWeek, startOfMonth } from "date-fns";

export function AnalyticsDashboard() {
  // Calculate date ranges for analytics - memoized to prevent infinite rerenders
  const dateRanges = useMemo(() => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const twoWeeksAgo = subWeeks(thisWeekStart, 2);

    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const threeMonthsAgo = subMonths(thisMonthStart, 3);

    return {
      now,
      thisWeekStart,
      lastWeekStart,
      twoWeeksAgo,
      thisMonthStart,
      lastMonthStart,
      threeMonthsAgo
    };
  }, []); // Empty dependency array - calculate once per day

  const { now, twoWeeksAgo, threeMonthsAgo } = dateRanges;

  // Fetch weekly data (last 4 weeks)
  const { data: weeklyData = [], isLoading: weeklyLoading, error: weeklyError } = useQuery({
    queryKey: ["analytics", "hours-by-week", twoWeeksAgo.toISOString(), now.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        start: twoWeeksAgo.toISOString(),
        end: now.toISOString(),
      });
      const response = await fetch(`/api/analytics/hours-by-week?${params.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch weekly data');
      return response.json();
    }
  });

  // Fetch monthly data (last 6 months)
  const { data: monthlyData = [], isLoading: monthlyLoading, error: monthlyError } = useQuery({
    queryKey: ["analytics", "hours-by-month", threeMonthsAgo.toISOString(), now.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        start: threeMonthsAgo.toISOString(),
        end: now.toISOString(),
      });
      const response = await fetch(`/api/analytics/hours-by-month?${params.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch monthly data');
      return response.json();
    }
  });


  // Process weekly data for comparison
  const weeklyComparison = useMemo(() => {
    if (weeklyData.length < 2) return { thisWeek: 0, lastWeek: 0, change: 0 };
    
    const sorted = weeklyData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastWeek = sorted[sorted.length - 2]?.actualHours || 0;
    const thisWeek = sorted[sorted.length - 1]?.actualHours || 0;
    const change = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;
    
    return { thisWeek, lastWeek, change };
  }, [weeklyData]);

  // Process monthly data for comparison
  const monthlyComparison = useMemo(() => {
    if (monthlyData.length < 2) return { thisMonth: 0, lastMonth: 0, change: 0 };
    
    const sorted = monthlyData.sort((a: any, b: any) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
    const lastMonth = sorted[sorted.length - 2]?.actualHours || 0;
    const thisMonth = sorted[sorted.length - 1]?.actualHours || 0;
    const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
    
    return { thisMonth, lastMonth, change };
  }, [monthlyData]);

  // Check if any critical data is still loading
  const isLoading = weeklyLoading || monthlyLoading;
  const hasErrors = weeklyError || monthlyError;

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Header Stats Skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Charts Skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (hasErrors) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load analytics data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week vs Last</CardTitle>
            {weeklyComparison.change >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyComparison.thisWeek.toFixed(2)}h</div>
            <div className={`text-xs flex items-center gap-1 ${weeklyComparison.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {weeklyComparison.change >= 0 ? '+' : ''}{weeklyComparison.change.toFixed(1)}%
              <span className="text-muted-foreground">from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month vs Last</CardTitle>
            {monthlyComparison.change >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyComparison.thisMonth.toFixed(2)}h</div>
            <div className={`text-xs flex items-center gap-1 ${monthlyComparison.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthlyComparison.change >= 0 ? '+' : ''}{monthlyComparison.change.toFixed(1)}%
              <span className="text-muted-foreground">from last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Hour Logging Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)}h`,
                    name === 'actualHours' ? 'Actual Hours' : 'Billed Hours'
                  ]}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="actualHours" 
                  stroke="#2563eb" 
                  strokeWidth={3}
                  name="Actual Hours"
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="billedHours" 
                  stroke="#16a34a" 
                  strokeWidth={3}
                  name="Billed Hours"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Hour Logging Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)}h`,
                    name === 'actualHours' ? 'Actual Hours' : 'Billed Hours'
                  ]}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="actualHours" 
                  stroke="#2563eb" 
                  strokeWidth={3}
                  name="Actual Hours"
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="billedHours" 
                  stroke="#16a34a" 
                  strokeWidth={3}
                  name="Billed Hours"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}