import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Calendar, User, Building, FolderOpen, CheckSquare, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import type { TimeLogWithRelations } from "@shared/schema";

export function RecentTimeEntries() {
  const [selectedFilter, setSelectedFilter] = useState<"all" | "today" | "week">("all");

  // Fetch time logs with all relations
  const { data: timeLogs = [], isLoading } = useQuery<TimeLogWithRelations[]>({
    queryKey: ["/api/time-logs"]
  });

  // Filter time logs based on selected period
  const filteredTimeLogs = timeLogs.filter(log => {
    const logDate = new Date(log.logDate || log.createdAt);
    const now = new Date();
    
    switch (selectedFilter) {
      case "today":
        return logDate.toDateString() === now.toDateString();
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return logDate >= weekAgo;
      default:
        return true;
    }
  });

  // Sort by most recent first, then take only the most recent 20 entries for performance
  const recentTimeLogs = filteredTimeLogs
    .sort((a, b) => {
      const dateA = new Date(a.logDate || a.createdAt);
      const dateB = new Date(b.logDate || b.createdAt);
      return dateB.getTime() - dateA.getTime(); // Most recent first
    })
    .slice(0, 20);

  const formatDate = (dateStr: string | Date) => {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      if (date.toDateString() === today.toDateString()) {
        return "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
      } else {
        return format(date, "MMM d");
      }
    } catch {
      return "—";
    }
  };

  const formatHours = (hours: string | number) => {
    const num = parseFloat(hours.toString());
    return isNaN(num) ? "0h" : `${num}h`;
  };

  const getProjectTaskDisplay = (log: TimeLogWithRelations) => {
    const parts = [];
    if (log.project?.name) parts.push(log.project.name);
    if (log.task?.name) parts.push(log.task.name);
    return parts.length > 0 ? parts.join(" › ") : "General";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Time Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading time entries...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Time Entries
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={selectedFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFilter("all")}
              data-testid="filter-all"
            >
              All
            </Button>
            <Button
              variant={selectedFilter === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFilter("today")}
              data-testid="filter-today"
            >
              Today
            </Button>
            <Button
              variant={selectedFilter === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFilter("week")}
              data-testid="filter-week"
            >
              Week
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recentTimeLogs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <div className="text-muted-foreground">No time entries found</div>
              <div className="text-sm text-muted-foreground mt-1">
                {selectedFilter !== "all" && "Try changing the filter or "}
                Start logging time to see entries here
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead className="w-[120px]">User</TableHead>
                  <TableHead>Project › Task</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[80px] text-right">Actual</TableHead>
                  <TableHead className="w-[80px] text-right">Billed</TableHead>
                  <TableHead className="w-[60px]">Efficiency</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTimeLogs.map((log) => {
                  const actualHours = parseFloat(log.actualHours.toString());
                  const billedHours = parseFloat(log.billedHours.toString());
                  const efficiency = actualHours > 0 ? (billedHours / actualHours) * 100 : 0;
                  
                  return (
                    <TableRow key={log.id} data-testid={`time-entry-${log.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(log.logDate || log.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">
                            {log.user?.firstName} {log.user?.lastName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            {log.project ? <FolderOpen className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                          </div>
                          <span className="truncate" title={getProjectTaskDisplay(log)}>
                            {getProjectTaskDisplay(log)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="truncate block max-w-[200px]" title={log.description}>
                          {log.description}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatHours(log.actualHours)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatHours(log.billedHours)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={efficiency >= 100 ? "default" : efficiency >= 80 ? "secondary" : "destructive"}
                          className="text-xs"
                          data-testid={`efficiency-${log.id}`}
                        >
                          {Math.round(efficiency)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          data-testid={`actions-${log.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        
        {recentTimeLogs.length >= 20 && (
          <div className="text-center mt-4">
            <Button variant="outline" size="sm" data-testid="view-all-entries">
              View All Entries
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}