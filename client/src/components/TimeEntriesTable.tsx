import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Edit, 
  Trash2, 
  Filter,
  Search,
  Calendar,
  User,
  Building2,
  FolderOpen,
  CheckSquare
} from "lucide-react";
import { format } from "date-fns";
import type { TimeLogWithRelations, User as UserType } from "@shared/schema";

export function TimeEntriesTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState("");
  const [selectedUser, setSelectedUser] = useState("all");

  // Fetch time logs with full relations
  const { data: timeLogs = [], isLoading } = useQuery<TimeLogWithRelations[]>({
    queryKey: ["/api/time-logs"]
  });

  // Fetch users for filtering
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"]
  });

  // Filter time logs based on search and user filter
  const filteredTimeLogs = timeLogs.filter(log => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || (
      log.description?.toLowerCase().includes(searchLower) ||
      log.agency?.name?.toLowerCase().includes(searchLower) ||
      log.account?.name?.toLowerCase().includes(searchLower) ||
      log.project?.name?.toLowerCase().includes(searchLower) ||
      log.task?.name?.toLowerCase().includes(searchLower) ||
      log.user?.firstName?.toLowerCase().includes(searchLower) ||
      log.user?.lastName?.toLowerCase().includes(searchLower)
    );
    
    const matchesUser = !selectedUser || selectedUser === "all" || log.userId === selectedUser;
    
    return matchesSearch && matchesUser;
  });

  const formatDuration = (hours: string | number) => {
    const h = typeof hours === 'string' ? parseFloat(hours) : hours;
    const wholeHours = Math.floor(h);
    const minutes = Math.round((h - wholeHours) * 60);
    
    if (wholeHours === 0) {
      return `${minutes}m`;
    }
    if (minutes === 0) {
      return `${wholeHours}h`;
    }
    return `${wholeHours}h ${minutes}m`;
  };

  const getTotalHours = (type: 'actual' | 'billed') => {
    return filteredTimeLogs.reduce((total, log) => {
      const hours = type === 'actual' ? log.actualHours : log.billedHours;
      return total + (typeof hours === 'string' ? parseFloat(hours) : hours);
    }, 0);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 animate-spin" />
            Loading time entries...
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
            Time Entries
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Actual: <strong>{formatDuration(getTotalHours('actual'))}</strong></span>
              <span>Billed: <strong>{formatDuration(getTotalHours('billed'))}</strong></span>
            </div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2 pt-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              data-testid="input-search-entries"
            />
          </div>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by person" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All people</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="flex items-center gap-2" data-testid="button-filter">
            <Filter className="h-4 w-4" />
            More Filters
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {filteredTimeLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No time entries found</h3>
            <p className="text-muted-foreground max-w-sm">
              {searchQuery ? "Try adjusting your search criteria" : "Start logging time to see entries here"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead className="w-[120px]">User</TableHead>
                <TableHead className="w-[150px]">Agency</TableHead>
                <TableHead className="w-[150px]">Account</TableHead>
                <TableHead className="w-[150px]">Project</TableHead>
                <TableHead className="w-[120px]">Task</TableHead>
                <TableHead className="flex-1">Description</TableHead>
                <TableHead className="w-[80px] text-right">Actual</TableHead>
                <TableHead className="w-[80px] text-right">Billed</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTimeLogs.map((log) => (
                <TableRow key={log.id} className="hover-elevate" data-testid={`row-time-entry-${log.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(log.logDate), 'MMM dd')}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {log.user.firstName} {log.user.lastName}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{log.agency.name}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {log.account.name}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    {log.project ? (
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{log.project.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {log.task ? (
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{log.task.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="max-w-[300px]">
                    <p className="text-sm truncate" title={log.description}>
                      {log.description}
                    </p>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <span className="text-sm font-mono">
                      {formatDuration(log.actualHours)}
                    </span>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <span className="text-sm font-mono">
                      {formatDuration(log.billedHours)}
                    </span>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        data-testid={`button-edit-entry-${log.id}`}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        data-testid={`button-delete-entry-${log.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}