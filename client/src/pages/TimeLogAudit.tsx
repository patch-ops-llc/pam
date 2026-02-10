import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TimeLogWithRelations, Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Download, ChevronLeft, ChevronRight, CalendarIcon, X, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfQuarter, endOfQuarter, subQuarters } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

const PAGE_SIZE = 50;

interface HoursMetrics {
  totalActualHours: number;
  totalBilledHours: number;
  tier1ActualHours: number;
  tier1BilledHours: number;
  tier2ActualHours: number;
  tier2BilledHours: number;
  tier3ActualHours: number;
  tier3BilledHours: number;
}

interface AccountMetric {
  accountId: string;
  accountName: string;
  agencyId: string | null;
  agencyName: string;
  totalActual: number;
  totalBilled: number;
  tier1Actual: number;
  tier1Billed: number;
  tier2Actual: number;
  tier2Billed: number;
  tier3Actual: number;
  tier3Billed: number;
}

interface PaginatedTimeLogsResponse {
  data: TimeLogWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  metrics: HoursMetrics;
  accountMetrics: AccountMetric[];
}

export default function TimeLogAudit() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [quickFilter, setQuickFilter] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState<TimeLogWithRelations | null>(null);
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [logToClone, setLogToClone] = useState<TimeLogWithRelations | null>(null);
  const [cloneDate, setCloneDate] = useState<Date | undefined>();
  const [cloneActualHours, setCloneActualHours] = useState("");
  const [cloneBilledHours, setCloneBilledHours] = useState("");
  const [cloneDescription, setCloneDescription] = useState("");

  const startDateStr = startDate ? format(startDate, 'yyyy-MM-dd') : "";
  const endDateStr = endDate ? format(endDate, 'yyyy-MM-dd') : "";

  const handleQuickFilter = (value: string) => {
    setQuickFilter(value);
    const now = new Date();
    
    switch (value) {
      case "this-week":
        setStartDate(startOfWeek(now, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(now, { weekStartsOn: 1 }));
        break;
      case "last-week":
        const lastWeek = subWeeks(now, 1);
        setStartDate(startOfWeek(lastWeek, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(lastWeek, { weekStartsOn: 1 }));
        break;
      case "this-month":
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case "last-month":
        const lastMonth = subMonths(now, 1);
        setStartDate(startOfMonth(lastMonth));
        setEndDate(endOfMonth(lastMonth));
        break;
      case "this-quarter":
        setStartDate(startOfQuarter(now));
        setEndDate(endOfQuarter(now));
        break;
      case "last-quarter":
        const lastQuarter = subQuarters(now, 1);
        setStartDate(startOfQuarter(lastQuarter));
        setEndDate(endOfQuarter(lastQuarter));
        break;
      case "":
        setStartDate(undefined);
        setEndDate(undefined);
        break;
    }
    setCurrentPage(1);
  };

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: agencies = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: paginatedResponse, isLoading, isFetching } = useQuery<PaginatedTimeLogsResponse>({
    queryKey: ["/api/time-logs/paginated", currentPage, startDateStr, endDateStr, selectedUserId, selectedAgencyId, selectedAccountId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('pageSize', PAGE_SIZE.toString());
      
      if (startDateStr) {
        params.append('start', startDateStr);
      }
      if (endDateStr) {
        params.append('end', endDateStr);
      }
      if (selectedUserId) {
        params.append('userId', selectedUserId);
      }
      if (selectedAgencyId) {
        params.append('agencyId', selectedAgencyId);
      }
      if (selectedAccountId) {
        params.append('accountId', selectedAccountId);
      }
      
      const response = await fetch(`/api/time-logs/paginated?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch time logs');
      return response.json();
    },
    placeholderData: (previousData) => previousData,
  });

  const timeLogs = paginatedResponse?.data ?? [];
  const totalRecords = paginatedResponse?.total ?? 0;
  const totalPages = paginatedResponse?.totalPages ?? 1;
  const metrics = paginatedResponse?.metrics;
  const accountMetrics = paginatedResponse?.accountMetrics ?? [];

  const deleteTimeLogMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/time-logs/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-logs"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"], exact: false });
      toast({
        title: "Success",
        description: "Time log deleted successfully",
      });
      setDeleteDialogOpen(false);
      setLogToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete time log",
        variant: "destructive",
      });
    },
  });

  const updateTimeLogMutation = useMutation({
    mutationFn: async ({ id, data }: { 
      id: string; 
      data: { 
        projectId?: string;
        accountId?: string;
        agencyId?: string;
        taskName?: string;
        description?: string;
        logDate?: string;
        actualHours?: string; 
        billedHours?: string; 
        tier?: string; 
        billingType?: string;
      } 
    }) => {
      return await apiRequest(`/api/time-logs/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-logs"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"], exact: false });
      toast({
        title: "Success",
        description: "Time log updated successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.error || "Failed to update time log";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createTimeLogMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      agencyId: string;
      accountId: string;
      projectId: string;
      taskName: string;
      description: string;
      actualHours: string;
      billedHours: string;
      tier: string;
      billingType: string;
      logDate: string;
    }) => {
      return await apiRequest("/api/time-logs", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-logs"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"], exact: false });
      toast({
        title: "Success",
        description: "Time log cloned successfully",
      });
      setCloneDialogOpen(false);
      setLogToClone(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.error || "Failed to clone time log";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleDelete = (log: TimeLogWithRelations) => {
    setLogToDelete(log);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (logToDelete) {
      deleteTimeLogMutation.mutate(logToDelete.id);
    }
  };

  const handleClone = (log: TimeLogWithRelations) => {
    setLogToClone(log);
    const logDateStr = typeof log.logDate === 'string' 
      ? log.logDate 
      : format(log.logDate, 'yyyy-MM-dd');
    const [year, month, day] = logDateStr.split('-').map(Number);
    setCloneDate(new Date(year, month - 1, day));
    setCloneActualHours(log.actualHours?.toString() || "0");
    setCloneBilledHours(log.billedHours?.toString() || "0");
    setCloneDescription(log.description || "");
    setCloneDialogOpen(true);
  };

  const confirmClone = () => {
    if (logToClone && cloneDate) {
      if (!logToClone.projectId) {
        toast({
          title: "Cannot clone",
          description: "This time log has no project assigned and cannot be cloned.",
          variant: "destructive",
        });
        return;
      }
      
      const year = cloneDate.getFullYear();
      const month = String(cloneDate.getMonth() + 1).padStart(2, '0');
      const day = String(cloneDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      
      createTimeLogMutation.mutate({
        userId: logToClone.userId,
        agencyId: logToClone.agencyId,
        accountId: logToClone.accountId,
        projectId: logToClone.projectId,
        taskName: logToClone.taskName,
        description: cloneDescription,
        actualHours: cloneActualHours,
        billedHours: cloneBilledHours,
        tier: logToClone.tier || "tier1",
        billingType: logToClone.billingType || "billed",
        logDate: formattedDate,
      });
    }
  };

  const handleTimeUpdate = (
    logId: string,
    actualHours: string,
    billedHours: string,
    tier: string,
    billingType: string
  ) => {
    const actualValue = parseFloat(actualHours);
    const billedValue = parseFloat(billedHours);
    
    if (isNaN(actualValue) || actualValue < 0) return;
    if (isNaN(billedValue) || billedValue < 0) return;

    updateTimeLogMutation.mutate({
      id: logId,
      data: {
        actualHours: actualValue.toString(),
        billedHours: billedValue.toString(),
        tier,
        billingType
      }
    });
  };

  const formatLocalDate = (dateValue: Date | string): string => {
    if (typeof dateValue === 'string') {
      const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return match[0];
    }
    if (dateValue instanceof Date) {
      const year = dateValue.getUTCFullYear();
      const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return String(dateValue).slice(0, 10);
  };

  const exportToCSV = async () => {
    const params = new URLSearchParams();
    if (startDateStr) params.append('start', startDateStr);
    if (endDateStr) params.append('end', endDateStr);
    if (selectedUserId) params.append('userId', selectedUserId);
    if (selectedAgencyId) params.append('agencyId', selectedAgencyId);
    if (selectedAccountId) params.append('accountId', selectedAccountId);
    
    const response = await fetch(`/api/time-logs/export?${params.toString()}`);
    if (!response.ok) {
      toast({
        title: "Error",
        description: "Failed to export time logs",
        variant: "destructive",
      });
      return;
    }
    
    const allLogs = await response.json();
    
    const headers = [
      "Date",
      "User",
      "Agency",
      "Account",
      "Project",
      "Task",
      "Actual Hours",
      "Billed Hours",
      "Tier",
      "Billing Type",
      "Description"
    ];

    const rows = allLogs.map((log: TimeLogWithRelations) => [
      formatLocalDate(log.logDate),
      log.user ? `${log.user.firstName} ${log.user.lastName}` : '',
      log.agency?.name || '',
      log.account?.name || '',
      log.project?.name || '',
      log.task?.name || '',
      log.actualHours || '0',
      log.billedHours || '0',
      log.tier || 'tier1',
      log.billingType || 'billed',
      `"${(log.description || '').replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map((row: string[]) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const startStr = startDateStr || 'all';
    const endStr = endDateStr || 'all';
    a.download = `time-logs-${startStr}-to-${endStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFilterChange = useCallback((setter: (val: string) => void) => {
    return (value: string) => {
      setter(value);
      setCurrentPage(1);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Time Logs</h1>
        <p className="text-muted-foreground">
          View, filter, and manage all time log records
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">Quick filters:</span>
        <Button
          variant={quickFilter === "this-week" ? "default" : "outline"}
          size="sm"
          onClick={() => handleQuickFilter(quickFilter === "this-week" ? "" : "this-week")}
          data-testid="filter-this-week"
        >
          This Week
        </Button>
        <Button
          variant={quickFilter === "last-week" ? "default" : "outline"}
          size="sm"
          onClick={() => handleQuickFilter(quickFilter === "last-week" ? "" : "last-week")}
          data-testid="filter-last-week"
        >
          Last Week
        </Button>
        <Button
          variant={quickFilter === "this-month" ? "default" : "outline"}
          size="sm"
          onClick={() => handleQuickFilter(quickFilter === "this-month" ? "" : "this-month")}
          data-testid="filter-this-month"
        >
          This Month
        </Button>
        <Button
          variant={quickFilter === "last-month" ? "default" : "outline"}
          size="sm"
          onClick={() => handleQuickFilter(quickFilter === "last-month" ? "" : "last-month")}
          data-testid="filter-last-month"
        >
          Last Month
        </Button>
        <Button
          variant={quickFilter === "this-quarter" ? "default" : "outline"}
          size="sm"
          onClick={() => handleQuickFilter(quickFilter === "this-quarter" ? "" : "this-quarter")}
          data-testid="filter-this-quarter"
        >
          This Quarter
        </Button>
        <Button
          variant={quickFilter === "last-quarter" ? "default" : "outline"}
          size="sm"
          onClick={() => handleQuickFilter(quickFilter === "last-quarter" ? "" : "last-quarter")}
          data-testid="filter-last-quarter"
        >
          Last Quarter
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label>Start Date (optional)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
                data-testid="input-start-date"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "MMM d, yyyy") : "Pick a date"}
                {startDate && (
                  <X 
                    className="ml-auto h-4 w-4 opacity-50 hover:opacity-100" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setStartDate(undefined);
                      setCurrentPage(1);
                    }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => {
                  setStartDate(date);
                  setCurrentPage(1);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>End Date (optional)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
                data-testid="input-end-date"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "MMM d, yyyy") : "Pick a date"}
                {endDate && (
                  <X 
                    className="ml-auto h-4 w-4 opacity-50 hover:opacity-100" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEndDate(undefined);
                      setCurrentPage(1);
                    }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => {
                  setEndDate(date);
                  setCurrentPage(1);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-filter">User (optional)</Label>
          <Select value={selectedUserId || "all"} onValueChange={handleFilterChange((v) => setSelectedUserId(v === "all" ? "" : v))}>
            <SelectTrigger data-testid="select-user">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="agency-filter">Agency (optional)</Label>
          <Select value={selectedAgencyId || "all"} onValueChange={handleFilterChange((v) => setSelectedAgencyId(v === "all" ? "" : v))}>
            <SelectTrigger data-testid="select-agency">
              <SelectValue placeholder="All agencies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agencies</SelectItem>
              {agencies.map(agency => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-filter">Account (optional)</Label>
          <Select value={selectedAccountId || "all"} onValueChange={handleFilterChange((v) => setSelectedAccountId(v === "all" ? "" : v))}>
            <SelectTrigger data-testid="select-account">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map(account => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="hours-metrics">
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-sm">Actual:</span>
                <span className="text-lg font-bold" data-testid="metric-total-actual">{metrics.totalActualHours.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Billed:</span>
                <span className="text-lg font-bold" data-testid="metric-total-billed">{metrics.totalBilledHours.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm font-medium text-muted-foreground">Tier 1 Hours</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-sm">Actual:</span>
                <span className="text-lg font-bold" data-testid="metric-tier1-actual">{metrics.tier1ActualHours.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Billed:</span>
                <span className="text-lg font-bold" data-testid="metric-tier1-billed">{metrics.tier1BilledHours.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm font-medium text-muted-foreground">Tier 2 Hours</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-sm">Actual:</span>
                <span className="text-lg font-bold" data-testid="metric-tier2-actual">{metrics.tier2ActualHours.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Billed:</span>
                <span className="text-lg font-bold" data-testid="metric-tier2-billed">{metrics.tier2BilledHours.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm font-medium text-muted-foreground">Tier 3 Hours</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-sm">Actual:</span>
                <span className="text-lg font-bold" data-testid="metric-tier3-actual">{metrics.tier3ActualHours.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Billed:</span>
                <span className="text-lg font-bold" data-testid="metric-tier3-billed">{metrics.tier3BilledHours.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {accountMetrics && accountMetrics.length > 0 && (
        <div className="border rounded-lg p-4 bg-card" data-testid="account-hours-breakdown">
          <p className="text-sm font-medium text-muted-foreground mb-3">Hours by Account</p>
          <div className="space-y-3">
            {(() => {
              const grouped = accountMetrics.reduce((acc, am) => {
                const key = am.agencyName;
                if (!acc[key]) acc[key] = [];
                acc[key].push(am);
                return acc;
              }, {} as Record<string, AccountMetric[]>);
              return Object.entries(grouped).map(([agencyName, accounts]) => (
                <div key={agencyName} className="space-y-1">
                  <p className="text-sm font-semibold">{agencyName}</p>
                  {accounts.map(am => (
                    <div key={am.accountId} className="flex justify-between text-sm pl-3">
                      <span>{am.accountName}</span>
                      <span className="font-medium">{am.totalActual.toFixed(1)} actual / {am.totalBilled.toFixed(1)} billed</span>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isFetching && <span>Loading...</span>}
          {!isFetching && totalRecords > 0 && (
            <span>
              Showing {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, totalRecords)} of {totalRecords} records
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {totalRecords > 0 && (
            <Button
              variant="outline"
              onClick={exportToCSV}
              className="flex items-center gap-2"
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4" />
              Export All to CSV
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actual Hours</TableHead>
                <TableHead>Billed Hours</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Billing Type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-12">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : timeLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-12 text-muted-foreground">
                    No time logs found
                  </TableCell>
                </TableRow>
              ) : (
                timeLogs.map((log) => (
                  <TableRow key={log.id} data-testid={`log-row-${log.id}`}>
                    <TableCell className="whitespace-nowrap">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-8 px-2 text-xs justify-start font-normal",
                              !log.logDate && "text-muted-foreground"
                            )}
                            disabled={updateTimeLogMutation.isPending || deleteTimeLogMutation.isPending}
                            data-testid={`date-edit-${log.id}`}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {(() => {
                              const dateStr = formatLocalDate(log.logDate);
                              const [year, month, day] = dateStr.split('-').map(Number);
                              const localDate = new Date(year, month - 1, day);
                              return format(localDate, 'MMM d, yyyy');
                            })()}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={(() => {
                              const dateStr = formatLocalDate(log.logDate);
                              const [year, month, day] = dateStr.split('-').map(Number);
                              return new Date(year, month - 1, day);
                            })()}
                            onSelect={(date) => {
                              if (date) {
                                const newDateStr = format(date, 'yyyy-MM-dd');
                                updateTimeLogMutation.mutate({
                                  id: log.id,
                                  data: { logDate: newDateStr }
                                });
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {log.user ? `${log.user.firstName} ${log.user.lastName}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={log.agencyId || ""} 
                        onValueChange={(value) => {
                          if (value) {
                            updateTimeLogMutation.mutate({
                              id: log.id,
                              data: { agencyId: value }
                            });
                          }
                        }}
                        disabled={updateTimeLogMutation.isPending || deleteTimeLogMutation.isPending}
                      >
                        <SelectTrigger className="h-8 w-48 text-xs border-none bg-transparent focus:ring-1 focus:ring-ring hover-elevate" data-testid={`agency-select-${log.id}`}>
                          <SelectValue placeholder="Select agency..." />
                        </SelectTrigger>
                        <SelectContent>
                          {agencies
                            .filter(a => a.isActive)
                            .map(agency => (
                              <SelectItem key={agency.id} value={agency.id}>
                                {agency.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={log.accountId || ""} 
                        onValueChange={(value) => {
                          if (value) {
                            updateTimeLogMutation.mutate({
                              id: log.id,
                              data: { accountId: value }
                            });
                          }
                        }}
                        disabled={updateTimeLogMutation.isPending || deleteTimeLogMutation.isPending}
                      >
                        <SelectTrigger className="h-8 w-48 text-xs border-none bg-transparent focus:ring-1 focus:ring-ring hover-elevate" data-testid={`account-select-${log.id}`}>
                          <SelectValue placeholder="Select account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts
                            .filter(a => a.isActive && (!selectedAgencyId || a.agencyId === log.agencyId))
                            .map(account => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={log.projectId || ""} 
                        onValueChange={(value) => {
                          if (value) {
                            updateTimeLogMutation.mutate({
                              id: log.id,
                              data: { projectId: value }
                            });
                          }
                        }}
                        disabled={updateTimeLogMutation.isPending || deleteTimeLogMutation.isPending}
                      >
                        <SelectTrigger className="h-8 w-48 text-xs border-none bg-transparent focus:ring-1 focus:ring-ring hover-elevate" data-testid={`project-select-${log.id}`}>
                          <SelectValue placeholder="Select project..." />
                        </SelectTrigger>
                        <SelectContent>
                          {projects
                            .filter(p => p.isActive && p.accountId === log.accountId)
                            .map(project => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        defaultValue={log.taskName}
                        disabled={updateTimeLogMutation.isPending || deleteTimeLogMutation.isPending}
                        onBlur={(e) => {
                          const taskName = e.target.value.trim();
                          if (taskName && taskName !== log.taskName) {
                            updateTimeLogMutation.mutate({
                              id: log.id,
                              data: { taskName }
                            });
                          }
                        }}
                        className="h-8 w-32 text-xs border-none bg-transparent focus-visible:ring-1 focus-visible:ring-ring rounded-sm hover-elevate disabled:opacity-50"
                        data-testid={`task-input-${log.id}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {editingDescription === log.id ? (
                        <Textarea
                          defaultValue={log.description || ''}
                          autoFocus
                          onBlur={(e) => {
                            const description = e.target.value.trim();
                            if (description !== log.description) {
                              updateTimeLogMutation.mutate({
                                id: log.id,
                                data: { description }
                              });
                            }
                            setEditingDescription(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setEditingDescription(null);
                            }
                          }}
                          className="min-h-20 text-xs"
                          data-testid={`description-textarea-${log.id}`}
                        />
                      ) : (
                        <div 
                          onClick={() => setEditingDescription(log.id)}
                          className="cursor-pointer hover-elevate p-2 rounded-sm text-xs max-w-xs truncate"
                          data-testid={`description-display-${log.id}`}
                        >
                          {log.description || <span className="text-muted-foreground">Click to add...</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        key={`actual-${log.id}-${log.actualHours}`}
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        defaultValue={Number(log.actualHours || 0).toString()}
                        disabled={updateTimeLogMutation.isPending || deleteTimeLogMutation.isPending}
                        onBlur={(e) => {
                          const actualValue = e.target.value.trim() || "0";
                          const billedInput = e.target.parentElement?.parentElement?.querySelector('[data-type="billed"]') as HTMLInputElement;
                          const tierSelect = e.target.parentElement?.parentElement?.querySelector('[data-type="tier"]') as HTMLSelectElement;
                          const billingTypeSelect = e.target.parentElement?.parentElement?.querySelector('[data-type="billingType"]') as HTMLSelectElement;
                          const billedValue = billedInput?.value || log.billedHours?.toString() || "0";
                          const tierValue = tierSelect?.value || log.tier || "tier1";
                          const billingTypeValue = billingTypeSelect?.value || log.billingType || "billed";
                          
                          handleTimeUpdate(log.id, actualValue, billedValue, tierValue, billingTypeValue);
                        }}
                        className="h-8 w-20 text-center border-none bg-transparent focus-visible:ring-1 focus-visible:ring-ring rounded-sm hover-elevate disabled:opacity-50"
                        data-testid={`actual-input-${log.id}`}
                        data-type="actual"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        key={`billed-${log.id}-${log.billedHours}`}
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        defaultValue={Number(log.billedHours || 0).toString()}
                        disabled={updateTimeLogMutation.isPending || deleteTimeLogMutation.isPending}
                        onBlur={(e) => {
                          const billedValue = e.target.value.trim() || "0";
                          const actualInput = e.target.parentElement?.parentElement?.querySelector('[data-type="actual"]') as HTMLInputElement;
                          const tierSelect = e.target.parentElement?.parentElement?.querySelector('[data-type="tier"]') as HTMLSelectElement;
                          const billingTypeSelect = e.target.parentElement?.parentElement?.querySelector('[data-type="billingType"]') as HTMLSelectElement;
                          const actualValue = actualInput?.value || log.actualHours?.toString() || "0";
                          const tierValue = tierSelect?.value || log.tier || "tier1";
                          const billingTypeValue = billingTypeSelect?.value || log.billingType || "billed";
                          
                          handleTimeUpdate(log.id, actualValue, billedValue, tierValue, billingTypeValue);
                        }}
                        className="h-8 w-20 text-center border-none bg-transparent focus-visible:ring-1 focus-visible:ring-ring rounded-sm hover-elevate disabled:opacity-50"
                        data-testid={`billed-input-${log.id}`}
                        data-type="billed"
                      />
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={log.tier || "tier1"} 
                        onValueChange={(value) => {
                          const actualInput = document.querySelector(`[data-testid="actual-input-${log.id}"]`) as HTMLInputElement;
                          const billedInput = document.querySelector(`[data-testid="billed-input-${log.id}"]`) as HTMLInputElement;
                          const billingTypeSelect = document.querySelector(`[data-testid="billingType-select-${log.id}"]`) as HTMLSelectElement;
                          const actualValue = actualInput?.value || log.actualHours?.toString() || "0";
                          const billedValue = billedInput?.value || log.billedHours?.toString() || "0";
                          const billingTypeValue = billingTypeSelect?.value || log.billingType || "billed";
                          handleTimeUpdate(log.id, actualValue, billedValue, value, billingTypeValue);
                        }}
                        disabled={updateTimeLogMutation.isPending || deleteTimeLogMutation.isPending}
                      >
                        <SelectTrigger className="h-8 w-24 text-xs border-none bg-transparent focus:ring-1 focus:ring-ring hover-elevate" data-type="tier" data-testid={`tier-select-${log.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tier1">Tier 1</SelectItem>
                          <SelectItem value="tier2">Tier 2</SelectItem>
                          <SelectItem value="tier3">Tier 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={log.billingType || "billed"} 
                        onValueChange={(value) => {
                          const actualInput = document.querySelector(`[data-testid="actual-input-${log.id}"]`) as HTMLInputElement;
                          const billedInput = document.querySelector(`[data-testid="billed-input-${log.id}"]`) as HTMLInputElement;
                          const tierSelect = document.querySelector(`[data-testid="tier-select-${log.id}"]`) as HTMLSelectElement;
                          const actualValue = actualInput?.value || log.actualHours?.toString() || "0";
                          const billedValue = billedInput?.value || log.billedHours?.toString() || "0";
                          const tierValue = tierSelect?.value || log.tier || "tier1";
                          handleTimeUpdate(log.id, actualValue, billedValue, tierValue, value);
                        }}
                        disabled={updateTimeLogMutation.isPending || deleteTimeLogMutation.isPending}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs border-none bg-transparent focus:ring-1 focus:ring-ring hover-elevate" data-type="billingType" data-testid={`billingType-select-${log.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="billed">Billable</SelectItem>
                          <SelectItem value="prebilled">Pre-billed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                      {log.createdAt ? format(new Date(log.createdAt), 'MMM d, yyyy h:mm a') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleClone(log)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          data-testid={`button-clone-${log.id}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(log)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-${log.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1 || isFetching}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || isFetching}
            data-testid="button-next-page"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time log entry? This action cannot be undone.
              {logToDelete && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="font-medium">{logToDelete.task?.name || 'No task'}</p>
                  <p className="text-sm">
                    {(() => {
                      const dateStr = formatLocalDate(logToDelete.logDate);
                      const [year, month, day] = dateStr.split('-').map(Number);
                      const localDate = new Date(year, month - 1, day);
                      return format(localDate, 'MMM d, yyyy');
                    })()} - 
                    Actual: {Number(logToDelete.actualHours || 0).toFixed(2)}h, 
                    Billed: {Number(logToDelete.billedHours || 0).toFixed(2)}h
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Time Log</DialogTitle>
            <DialogDescription>
              Create a copy of this time log entry with optional modifications.
            </DialogDescription>
          </DialogHeader>
          
          {logToClone && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{logToClone.user ? `${logToClone.user.firstName} ${logToClone.user.lastName}` : 'Unknown user'}</p>
                <p className="text-sm text-muted-foreground">
                  {logToClone.agency?.name} → {logToClone.account?.name} → {logToClone.project?.name || 'No project'}
                </p>
                <p className="text-sm">{logToClone.taskName}</p>
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !cloneDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {cloneDate ? format(cloneDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={cloneDate}
                      onSelect={setCloneDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Actual Hours</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={cloneActualHours}
                    onChange={(e) => setCloneActualHours(e.target.value)}
                    data-testid="input-clone-actual-hours"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billed Hours</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={cloneBilledHours}
                    onChange={(e) => setCloneBilledHours(e.target.value)}
                    data-testid="input-clone-billed-hours"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  placeholder="Optional description..."
                  data-testid="input-clone-description"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmClone}
              disabled={createTimeLogMutation.isPending || !cloneDate}
              data-testid="button-confirm-clone"
            >
              {createTimeLogMutation.isPending ? "Cloning..." : "Clone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
