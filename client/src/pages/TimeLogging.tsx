import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon, Calendar as CalendarIcon, Trash2, Copy } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TimeLogWithRelations, User as UserType, Agency, Account, Project } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Helper function to format dates without timezone issues
const formatLocalDate = (dateValue: Date | string): string => {
  if (typeof dateValue === 'string') {
    const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[0];
  }
  
  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return '';
};

// Helper function to parse date string as local date (not UTC)
const parseLocalDate = (dateString: string | Date): Date => {
  if (dateString instanceof Date) return dateString;
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  return new Date(dateString);
};

// Predefined task types
const TASK_TYPES = [
  "Internal Meetings",
  "Client Meetings",
  "Project Management",
  "Building",
  "Testing",
  "Documentation",
  "Training"
] as const;

type TaskType = typeof TASK_TYPES[number];

export default function TimeLogging() {
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [hideWithoutProjects, setHideWithoutProjects] = useState(false);
  const [timeLogDialogOpen, setTimeLogDialogOpen] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [description, setDescription] = useState("");
  const [pendingActualHours, setPendingActualHours] = useState("");
  const [pendingBilledHours, setPendingBilledHours] = useState("");
  const [tier, setTier] = useState("tier1");
  const [billingType, setBillingType] = useState("billed");
  const [modalUserId, setModalUserId] = useState<string>("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const { toast } = useToast();

  // Generate week days (Monday to Sunday)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  }, [currentWeek]);

  // Check if a date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return formatLocalDate(date) === formatLocalDate(today);
  };

  // Fetch users
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  // Fetch all agencies
  const { data: agencies = [] } = useQuery<Agency[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch all accounts
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  // Fetch all projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch all time logs for the current week
  const { data: timeLogs = [] } = useQuery<TimeLogWithRelations[]>({
    queryKey: ["/api/time-logs", "filtered", currentWeek.toISOString(), selectedUserId],
    queryFn: async () => {
      const weekStart = format(currentWeek, 'yyyy-MM-dd');
      const weekEnd = format(addDays(currentWeek, 6), 'yyyy-MM-dd');
      
      const params = new URLSearchParams({
        start: weekStart,
        end: weekEnd
      });
      
      if (selectedUserId && selectedUserId !== "all") {
        params.append('userId', selectedUserId);
      }
      
      const response = await fetch(`/api/time-logs?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch time logs');
      }
      return response.json();
    },
  });

  // Group data hierarchically: agency → account → project (only active items)
  const hierarchicalData = useMemo(() => {
    return agencies
      .filter(agency => agency.isActive)
      .map(agency => ({
        agency,
        accounts: accounts
          .filter(account => account.agencyId === agency.id && account.isActive)
          .map(account => ({
            account,
            projects: projects
              .filter(project => project.accountId === account.id && project.isActive)
              .filter(project => {
                // If hideWithoutProjects is enabled, only show projects with time logs
                if (!hideWithoutProjects) return true;
                
                return timeLogs.some(log => log.projectId === project.id);
              })
          }))
      }));
  }, [agencies, accounts, projects, hideWithoutProjects, timeLogs]);

  // Get all time logs for specific parameters
  const getTimeLogs = (
    projectId: string,
    taskType: TaskType,
    date: Date
  ): TimeLogWithRelations[] => {
    const targetDateStr = formatLocalDate(date);
    
    const relevantLogs = timeLogs.filter(log => 
      log.projectId === projectId &&
      log.taskName === taskType &&
      log.logDate && 
      formatLocalDate(log.logDate) === targetDateStr &&
      (selectedUserId === "all" || log.userId === selectedUserId)
    );
    
    return relevantLogs;
  };

  // Create time log mutation
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/time-logs"], 
        exact: false 
      });
      await queryClient.refetchQueries({ 
        queryKey: ["/api/analytics"], 
        exact: false 
      });
      await queryClient.refetchQueries({ 
        queryKey: ["analytics"], 
        exact: false 
      });
      setTimeLogDialogOpen(false);
      setPendingActualHours("");
      setPendingBilledHours("");
      toast({
        title: "Success",
        description: "Time logged successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log time.",
        variant: "destructive",
      });
    },
  });

  // Update time log mutation
  const updateTimeLogMutation = useMutation({
    mutationFn: async ({ id, data }: { 
      id: string; 
      data: { 
        actualHours?: string; 
        billedHours?: string; 
        tier?: string; 
        billingType?: string;
        description?: string;
      } 
    }) => {
      return await apiRequest(`/api/time-logs/${id}`, "PATCH", data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/time-logs"], 
        exact: false 
      });
      await queryClient.refetchQueries({ 
        queryKey: ["/api/analytics"], 
        exact: false 
      });
      await queryClient.refetchQueries({ 
        queryKey: ["analytics"], 
        exact: false 
      });
      setTimeLogDialogOpen(false);
      setPendingActualHours("");
      setPendingBilledHours("");
      toast({
        title: "Success",
        description: "Time updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update time.",
        variant: "destructive",
      });
    },
  });

  // Delete time log mutation
  const deleteTimeLogMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/time-logs/${id}`, "DELETE");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/time-logs"], 
        exact: false 
      });
      await queryClient.refetchQueries({ 
        queryKey: ["/api/analytics"], 
        exact: false 
      });
      await queryClient.refetchQueries({ 
        queryKey: ["analytics"], 
        exact: false 
      });
      setTimeLogDialogOpen(false);
      setPendingActualHours("");
      setPendingBilledHours("");
      toast({
        title: "Success",
        description: "Time entry deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete time entry.",
        variant: "destructive",
      });
    },
  });

  // Handle opening time log modal for NEW entry
  const handleOpenTimeLogModal = (
    agency: Agency,
    account: Account,
    project: Project,
    taskType: TaskType,
    date: Date
  ) => {
    // Set context and open modal
    setSelectedAgency(agency);
    setSelectedAccount(account);
    setSelectedProject(project);
    setSelectedTaskType(taskType);
    setSelectedDate(date);

    // Prepopulate modal user with selected user (if not "all")
    const initialUserId = selectedUserId !== "all" ? selectedUserId : "";
    setModalUserId(initialUserId);

    // Always open blank modal for new entry
    setPendingActualHours("0");
    setPendingBilledHours("0");
    setDescription("");
    setTier("tier1");
    setBillingType("billed");
    setEditingLogId(null);
    
    setTimeLogDialogOpen(true);
  };

  // Handle editing existing time log
  const handleEditTimeLog = (log: TimeLogWithRelations) => {
    // Find the related agency, account, and project
    const project = projects.find(p => p.id === log.projectId);
    const account = accounts.find(a => a.id === log.accountId);
    const agency = agencies.find(ag => ag.id === log.agencyId);
    
    if (!project || !account || !agency) return;

    // Set context
    setSelectedAgency(agency);
    setSelectedAccount(account);
    setSelectedProject(project);
    setSelectedTaskType(log.taskName as TaskType);
    setSelectedDate(parseLocalDate(log.logDate));

    // Prefill modal with existing log data
    setModalUserId(log.userId);
    setPendingActualHours(log.actualHours?.toString() || "0");
    setPendingBilledHours(log.billedHours?.toString() || "0");
    setDescription(log.description || "");
    setTier(log.tier || "tier1");
    setBillingType(log.billingType || "billed");
    setEditingLogId(log.id);
    
    setTimeLogDialogOpen(true);
  };

  // Handle time log submission
  const handleTimeLogSubmit = () => {
    if (!selectedProject || !selectedAccount || !selectedAgency || !selectedTaskType || !selectedDate) {
      toast({
        title: "Error",
        description: "Missing required information.",
        variant: "destructive",
      });
      return;
    }

    if (!modalUserId) {
      toast({
        title: "Error",
        description: "Please select a user.",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Error",
        description: "Description is required.",
        variant: "destructive",
      });
      return;
    }

    const actualValue = parseFloat(pendingActualHours || "0");
    const billedValue = parseFloat(pendingBilledHours || "0");
    
    if (isNaN(actualValue) || actualValue < 0) {
      toast({
        title: "Error",
        description: "Please enter valid actual hours.",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(billedValue) || billedValue < 0) {
      toast({
        title: "Error",
        description: "Please enter valid billed hours.",
        variant: "destructive",
      });
      return;
    }

    if (editingLogId) {
      // Update existing log
      if (actualValue === 0 && billedValue === 0) {
        deleteTimeLogMutation.mutate(editingLogId);
      } else {
        updateTimeLogMutation.mutate({
          id: editingLogId,
          data: {
            actualHours: actualValue.toString(),
            billedHours: billedValue.toString(),
            tier,
            billingType,
            description: description.trim()
          }
        });
      }
    } else if (actualValue > 0 || billedValue > 0) {
      // Create new log
      createTimeLogMutation.mutate({
        userId: modalUserId,
        agencyId: selectedAgency.id,
        accountId: selectedAccount.id,
        projectId: selectedProject.id,
        taskName: selectedTaskType,
        description: description.trim(),
        actualHours: actualValue.toString(),
        billedHours: billedValue.toString(),
        tier,
        billingType,
        logDate: formatLocalDate(selectedDate),
      });
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  // Calculate daily totals
  const dailyTotals = useMemo(() => {
    return weekDays.map(day => {
      const dayStr = formatLocalDate(day);
      return timeLogs
        .filter(log => log.logDate && formatLocalDate(log.logDate) === dayStr)
        .reduce((sum, log) => sum + Number(log.billedHours || 0), 0);
    });
  }, [timeLogs, weekDays]);

  const weekTotal = dailyTotals.reduce((sum, total) => sum + total, 0);

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Time Logging</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateWeek('prev')}
              data-testid="button-prev-week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={goToCurrentWeek}
              className="min-w-[200px]"
              data-testid="button-current-week"
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              {format(currentWeek, 'MMM d')} - {format(addDays(currentWeek, 6), 'MMM d, yyyy')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateWeek('next')}
              data-testid="button-next-week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="hide-without-projects"
              checked={hideWithoutProjects}
              onCheckedChange={(checked) => setHideWithoutProjects(checked as boolean)}
              data-testid="checkbox-hide-without-projects"
            />
            <label
              htmlFor="hide-without-projects"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Hide without projects
            </label>
          </div>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-[200px]" data-testid="select-user">
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Time Logging Table */}
      <div className="flex-1 overflow-auto rounded-lg border">
        <div className="min-w-max">
          <table className="w-full">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-left font-medium min-w-[300px]">Task</th>
                {weekDays.map(day => (
                  <th 
                    key={day.toISOString()} 
                    className={`p-2 text-center font-medium min-w-[80px] ${isToday(day) ? 'bg-accent/50' : ''}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">{format(day, 'EEE')}</span>
                      <span className="text-sm">{format(day, 'MMM d')}</span>
                    </div>
                  </th>
                ))}
                <th className="p-4 text-center font-medium min-w-[100px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {hierarchicalData.map(({ agency, accounts }) => {
                // Calculate agency totals
                const agencyLogs = timeLogs.filter(log => {
                  const project = projects.find(p => p.id === log.projectId);
                  if (!project) return false;
                  const account = accounts.find(a => a.account.id === project.accountId);
                  return account !== undefined;
                });
                const agencyActualTotal = agencyLogs.reduce((sum, log) => sum + Number(log.actualHours || 0), 0);
                const agencyBilledTotal = agencyLogs.reduce((sum, log) => sum + Number(log.billedHours || 0), 0);

                return (
                <tr key={agency.id}>
                  <td colSpan={9} className="p-0">
                    <Accordion type="multiple" className="w-full">
                      <AccordionItem value={agency.id} className="border-none">
                        <AccordionTrigger chevronPosition="left" className="px-4 py-2 hover:no-underline hover-elevate bg-muted/30" data-testid={`accordion-agency-${agency.id}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{agency.name}</span>
                            {(agencyActualTotal > 0 || agencyBilledTotal > 0) && (
                              <span className="text-xs text-muted-foreground">
                                (A: {agencyActualTotal.toFixed(2)}h / B: {agencyBilledTotal.toFixed(2)}h)
                              </span>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-0">
                          {accounts.map(({ account, projects }) => {
                            // Calculate account totals
                            const accountLogs = timeLogs.filter(log => {
                              const project = projects.find(p => p.id === log.projectId);
                              return project !== undefined;
                            });
                            const accountActualTotal = accountLogs.reduce((sum, log) => sum + Number(log.actualHours || 0), 0);
                            const accountBilledTotal = accountLogs.reduce((sum, log) => sum + Number(log.billedHours || 0), 0);

                            return (
                            <Accordion key={account.id} type="multiple" className="w-full">
                              <AccordionItem value={account.id} className="border-none">
                                <AccordionTrigger chevronPosition="left" className="px-8 py-2 hover:no-underline hover-elevate bg-muted/20" data-testid={`accordion-account-${account.id}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{account.name}</span>
                                    {(accountActualTotal > 0 || accountBilledTotal > 0) && (
                                      <span className="text-xs text-muted-foreground">
                                        (A: {accountActualTotal.toFixed(2)}h / B: {accountBilledTotal.toFixed(2)}h)
                                      </span>
                                    )}
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-0">
                                  {projects.map(project => {
                                    // Calculate project totals
                                    const projectLogs = timeLogs.filter(log => log.projectId === project.id);
                                    const projectActualTotal = projectLogs.reduce((sum, log) => sum + Number(log.actualHours || 0), 0);
                                    const projectBilledTotal = projectLogs.reduce((sum, log) => sum + Number(log.billedHours || 0), 0);

                                    return (
                                    <Accordion key={project.id} type="multiple" className="w-full">
                                      <AccordionItem value={project.id} className="border-none">
                                        <AccordionTrigger chevronPosition="left" className="px-12 py-2 hover:no-underline hover-elevate bg-muted/10" data-testid={`accordion-project-${project.id}`}>
                                          <div className="flex items-center gap-2">
                                            <span>{project.name}</span>
                                            {(projectActualTotal > 0 || projectBilledTotal > 0) && (
                                              <span className="text-xs text-muted-foreground">
                                                (A: {projectActualTotal.toFixed(2)}h / B: {projectBilledTotal.toFixed(2)}h)
                                              </span>
                                            )}
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-0">
                                          <table className="w-full">
                                            <tbody>
                                              {TASK_TYPES.map(taskType => {
                                                const taskActualTotal = weekDays.reduce((sum, day) => {
                                                  const logs = getTimeLogs(project.id, taskType, day);
                                                  return sum + logs.reduce((s, log) => s + Number(log.actualHours || 0), 0);
                                                }, 0);
                                                
                                                const taskBilledTotal = weekDays.reduce((sum, day) => {
                                                  const logs = getTimeLogs(project.id, taskType, day);
                                                  return sum + logs.reduce((s, log) => s + Number(log.billedHours || 0), 0);
                                                }, 0);

                                                return (
                                                  <tr key={taskType} className="border-t">
                                                    <td className="p-4 pl-16 min-w-[300px]">
                                                      <span className="text-sm">{taskType}</span>
                                                    </td>
                                                    {weekDays.map(day => {
                                                      const logs = getTimeLogs(project.id, taskType, day);

                                                      return (
                                                        <td 
                                                          key={day.toISOString()} 
                                                          className={`p-1 min-w-[80px] ${isToday(day) ? 'bg-accent/50' : ''}`}
                                                        >
                                                          <div className="flex flex-col items-center gap-1">
                                                            <Button
                                                              variant="ghost"
                                                              size="icon"
                                                              className="w-full hover-elevate"
                                                              onClick={() => handleOpenTimeLogModal(agency, account, project, taskType, day)}
                                                              data-testid={`button-add-${project.id}-${taskType}-${format(day, 'yyyy-MM-dd')}`}
                                                            >
                                                              <span className="text-muted-foreground text-xl">+</span>
                                                            </Button>
                                                            {logs.length > 0 && (
                                                              <Popover>
                                                                <PopoverTrigger asChild>
                                                                  <div 
                                                                    className="text-xs text-center space-y-0.5 cursor-pointer hover-elevate rounded p-1 w-full"
                                                                    data-testid={`summary-${project.id}-${taskType}-${format(day, 'yyyy-MM-dd')}`}
                                                                  >
                                                                    <div className="flex items-center justify-center gap-1">
                                                                      {logs.length > 1 && (
                                                                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                                                          {logs.length}
                                                                        </Badge>
                                                                      )}
                                                                    </div>
                                                                    <div className="text-muted-foreground">
                                                                      A: {logs.reduce((sum, log) => sum + Number(log.actualHours || 0), 0).toFixed(2)}
                                                                    </div>
                                                                    <div className="font-medium">
                                                                      B: {logs.reduce((sum, log) => sum + Number(log.billedHours || 0), 0).toFixed(2)}
                                                                    </div>
                                                                  </div>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-64 p-2" align="start">
                                                                  <div className="space-y-1">
                                                                    <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                                                                      {logs.length} log{logs.length !== 1 ? 's' : ''} - Click to edit
                                                                    </div>
                                                                    {logs.map(log => {
                                                                      const actualHours = Number(log.actualHours || 0);
                                                                      const billedHours = Number(log.billedHours || 0);
                                                                      const user = users.find(u => u.id === log.userId);
                                                                      const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
                                                                      
                                                                      return (
                                                                        <div
                                                                          key={log.id}
                                                                          className="text-xs cursor-pointer hover-elevate rounded p-2 border"
                                                                          onClick={() => handleEditTimeLog(log)}
                                                                          data-testid={`log-entry-${log.id}`}
                                                                        >
                                                                          <div className="flex items-center justify-between gap-2">
                                                                            <div className="font-medium">{userName}</div>
                                                                            <div className="flex gap-2 text-muted-foreground">
                                                                              <span>A: {actualHours.toFixed(2)}</span>
                                                                              <span>B: {billedHours.toFixed(2)}</span>
                                                                            </div>
                                                                          </div>
                                                                          {log.description && (
                                                                            <div className="text-muted-foreground mt-1 truncate">
                                                                              {log.description}
                                                                            </div>
                                                                          )}
                                                                        </div>
                                                                      );
                                                                    })}
                                                                  </div>
                                                                </PopoverContent>
                                                              </Popover>
                                                            )}
                                                          </div>
                                                        </td>
                                                      );
                                                    })}
                                                    <td className="p-4 text-center text-sm min-w-[100px]">
                                                      {(taskActualTotal > 0 || taskBilledTotal > 0) ? (
                                                        <div className="flex flex-col gap-0.5">
                                                          <div className="text-xs text-muted-foreground">
                                                            A: {taskActualTotal.toFixed(2)}h
                                                          </div>
                                                          <div className="font-medium">
                                                            B: {taskBilledTotal.toFixed(2)}h
                                                          </div>
                                                        </div>
                                                      ) : "-"}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </AccordionContent>
                                      </AccordionItem>
                                    </Accordion>
                                    );
                                  })}
                                  {projects.length === 0 && (
                                    <div className="px-12 py-4 text-sm text-muted-foreground">
                                      No projects
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                            );
                          })}
                          {accounts.length === 0 && (
                            <div className="px-8 py-4 text-sm text-muted-foreground">
                              No accounts
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </td>
                </tr>
                );
              })}
            </tbody>
            {hierarchicalData.length > 0 && (
              <tfoot className="bg-muted/25 border-t sticky bottom-0">
                <tr>
                  <td className="p-4 font-medium min-w-[300px]">Daily Totals</td>
                  {dailyTotals.map((dayTotal, index) => (
                    <td key={weekDays[index].toISOString()} className="p-4 text-center font-medium min-w-[80px]">
                      {dayTotal > 0 ? `${dayTotal.toFixed(2)}h` : "-"}
                    </td>
                  ))}
                  <td className="p-4 text-center font-bold min-w-[100px]">
                    {weekTotal.toFixed(2)}h
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Time Log Dialog */}
      <Dialog open={timeLogDialogOpen} onOpenChange={setTimeLogDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Time</DialogTitle>
            <DialogDescription>
              {selectedProject && selectedTaskType && selectedDate && (
                <>
                  {selectedProject.name} - {selectedTaskType}
                  <br />
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user">User *</Label>
                <Select value={modalUserId} onValueChange={setModalUserId}>
                  <SelectTrigger data-testid="select-modal-user">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                      data-testid="button-select-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate || undefined}
                      onSelect={(date: Date | undefined) => date && setSelectedDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="actual-hours">Actual Hours *</Label>
                <Input
                  id="actual-hours"
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  value={pendingActualHours}
                  onChange={(e) => setPendingActualHours(e.target.value)}
                  placeholder="0"
                  data-testid="input-actual-hours"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="billed-hours">Billed Hours *</Label>
                <Input
                  id="billed-hours"
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  value={pendingBilledHours}
                  onChange={(e) => setPendingBilledHours(e.target.value)}
                  placeholder="0"
                  data-testid="input-billed-hours"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the work you did..."
                rows={4}
                data-testid="textarea-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tier">Tier</Label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger data-testid="select-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tier1">Tier 1</SelectItem>
                    <SelectItem value="tier2">Tier 2</SelectItem>
                    <SelectItem value="tier3">Tier 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing-type">Billing Type</Label>
                <Select value={billingType} onValueChange={setBillingType}>
                  <SelectTrigger data-testid="select-billing-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billed">Billable</SelectItem>
                    <SelectItem value="prebilled">Pre-billed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between gap-2">
            {editingLogId ? (
              <div className="flex gap-2">
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    if (editingLogId) {
                      deleteTimeLogMutation.mutate(editingLogId);
                    }
                  }}
                  disabled={deleteTimeLogMutation.isPending}
                  data-testid="button-delete-timelog"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteTimeLogMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (!selectedProject || !selectedAccount || !selectedAgency) {
                      toast({
                        title: "Cannot clone",
                        description: "This entry is missing required context (project, account, or client).",
                        variant: "destructive",
                      });
                      return;
                    }
                    setEditingLogId(null);
                    toast({
                      title: "Clone Mode",
                      description: "Modify the entry and save to create a copy.",
                    });
                  }}
                  disabled={createTimeLogMutation.isPending || !selectedProject}
                  data-testid="button-clone-timelog"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Clone
                </Button>
              </div>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTimeLogDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleTimeLogSubmit}
                disabled={createTimeLogMutation.isPending || updateTimeLogMutation.isPending || deleteTimeLogMutation.isPending}
                data-testid="button-save-timelog"
              >
                {createTimeLogMutation.isPending || updateTimeLogMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
