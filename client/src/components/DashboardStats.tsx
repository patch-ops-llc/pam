import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Target, DollarSign, ArrowUp, ArrowDown } from "lucide-react";
import { useState } from "react";

export function DashboardStats() {
  const [efficiencyTimeFilter, setEfficiencyTimeFilter] = useState("monthly");

  // Mock data - todo: replace with real data
  const stats = {
    thisWeek: { actual: 28.5, billed: 24.0, target: 32.0 },
    lastWeek: { actual: 25.0, billed: 21.5 },
    thisMonth: { actual: 127.5, billed: 102.0, target: 180.0 },
    lastMonth: { actual: 165.0, billed: 148.0 },
    efficiency: {
      daily: 75,
      weekly: 84,
      monthly: 82,
      quarterly: 78,
      yearly: 80
    }
  };

  // Calculate percentage changes with safety checks
  const weekActualChange = stats.lastWeek.actual > 0 
    ? ((stats.thisWeek.actual - stats.lastWeek.actual) / stats.lastWeek.actual) * 100 
    : 0;
  const weekBilledChange = stats.lastWeek.billed > 0 
    ? ((stats.thisWeek.billed - stats.lastWeek.billed) / stats.lastWeek.billed) * 100 
    : 0;
  const monthActualChange = stats.lastMonth.actual > 0 
    ? ((stats.thisMonth.actual - stats.lastMonth.actual) / stats.lastMonth.actual) * 100 
    : 0;
  const monthBilledChange = stats.lastMonth.billed > 0 
    ? ((stats.thisMonth.billed - stats.lastMonth.billed) / stats.lastMonth.billed) * 100 
    : 0;

  // Calculate progress to targets
  const weekTargetProgress = (stats.thisWeek.actual / stats.thisWeek.target) * 100;
  const monthTargetProgress = (stats.thisMonth.actual / stats.thisMonth.target) * 100;

  // Get efficiency value based on selected time filter
  const currentEfficiency = stats.efficiency[efficiencyTimeFilter as keyof typeof stats.efficiency];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Weekly Hours with Target & Change */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold">{stats.thisWeek.actual}h</span>
              <Badge variant="secondary">Actual</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg text-muted-foreground">{stats.thisWeek.billed}h</span>
              <Badge variant="outline">Billed</Badge>
            </div>
            
            {/* Target Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Target: {stats.thisWeek.target}h</span>
                <span>{weekTargetProgress.toFixed(0)}%</span>
              </div>
              <Progress value={weekTargetProgress} className="h-2" />
            </div>

            {/* Percentage Changes */}
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1">
                {weekActualChange >= 0 ? (
                  <ArrowUp className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-red-500" />
                )}
                <span className={weekActualChange >= 0 ? "text-green-600" : "text-red-600"}>
                  {Math.abs(weekActualChange).toFixed(1)}%
                </span>
                <span className="text-muted-foreground">actual vs last week</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1">
                {weekBilledChange >= 0 ? (
                  <ArrowUp className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-red-500" />
                )}
                <span className={weekBilledChange >= 0 ? "text-green-600" : "text-red-600"}>
                  {Math.abs(weekBilledChange).toFixed(1)}%
                </span>
                <span className="text-muted-foreground">billed vs last week</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Hours with Target & Change */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold">{stats.thisMonth.actual}h</span>
              <Badge variant="secondary">Actual</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg text-muted-foreground">{stats.thisMonth.billed}h</span>
              <Badge variant="outline">Billed</Badge>
            </div>
            
            {/* Target Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Target: {stats.thisMonth.target}h</span>
                <span>{monthTargetProgress.toFixed(0)}%</span>
              </div>
              <Progress value={monthTargetProgress} className="h-2" />
            </div>

            {/* Percentage Changes */}
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1">
                {monthActualChange >= 0 ? (
                  <ArrowUp className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-red-500" />
                )}
                <span className={monthActualChange >= 0 ? "text-green-600" : "text-red-600"}>
                  {Math.abs(monthActualChange).toFixed(1)}%
                </span>
                <span className="text-muted-foreground">actual vs last month</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1">
                {monthBilledChange >= 0 ? (
                  <ArrowUp className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-red-500" />
                )}
                <span className={monthBilledChange >= 0 ? "text-green-600" : "text-red-600"}>
                  {Math.abs(monthBilledChange).toFixed(1)}%
                </span>
                <span className="text-muted-foreground">billed vs last month</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Billable Efficiency */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
          <DollarSign className="h-4 w-4 text-gold" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-gold">{currentEfficiency}%</div>
              <Select value={efficiencyTimeFilter} onValueChange={setEfficiencyTimeFilter} data-testid="select-efficiency-filter">
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Billed vs Actual Hours
              </div>
              <Progress value={currentEfficiency} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}