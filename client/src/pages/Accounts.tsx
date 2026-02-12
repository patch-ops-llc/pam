import { useState, useMemo } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Building2, Users, FolderOpen, Clock, CheckSquare, Edit, Trash2, Inbox, MoreHorizontal, Power } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { TabbedRichTextEditor } from "@/components/TabbedRichTextEditor";
import { ProjectAttachments } from "@/components/ProjectAttachments";
import { PageHeader } from "@/components/PageHeader";
import { insertProjectSchema, insertAccountSchema } from "@shared/schema";
import type { AccountWithAgency, Agency, Project, Task, User, TimeLog, InsertProject, InsertAccount, ProjectWithTeamAndRelations } from "@shared/schema";

const roleColors: Record<string, string> = {
  comms: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  pm: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  build: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  support: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30"
};

export default function Accounts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  
  // Sheet detail panel
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  // Task management state
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<"create" | "edit">("create");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  
  // Account delete state
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<AccountWithAgency | null>(null);
  
  // Project management state
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [isEditProjectDialogOpen, setIsEditProjectDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountWithAgency | null>(null);
  const [selectedProjectToEdit, setSelectedProjectToEdit] = useState<Project | null>(null);

  // Account management state
  const [isCreateAccountDialogOpen, setIsCreateAccountDialogOpen] = useState(false);

  const { toast } = useToast();

  // Fetch all required data
  const { data: agencies = [], isLoading: agenciesLoading } = useQuery<Agency[]>({
    queryKey: ["/api/clients"]
  });
  
  const { data: accounts = [], isLoading: accountsLoading } = useQuery<AccountWithAgency[]>({
    queryKey: ["/api/accounts"]
  });
  
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"]
  });

  // Fetch projects with team members for enhanced display
  const { data: projectsWithTeam = [] } = useQuery<ProjectWithTeamAndRelations[]>({
    queryKey: ["/api/projects/with-team"]
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"]
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"]
  });

  // Fetch time logs for efficiency and activity calculations
  const { data: timeLogs = [], isLoading: timeLogsLoading } = useQuery<TimeLog[]>({
    queryKey: ["/api/time-logs"]
  });

  const isLoading = agenciesLoading || accountsLoading || projectsLoading || tasksLoading || usersLoading || timeLogsLoading;

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest(`/api/tasks/${taskId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsDeleteTaskDialogOpen(false);
      setTaskToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task",
        variant: "destructive",
      });
    },
  });

  // Project creation form
  const projectForm = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
      agencyId: "",
      accountId: "",
      startDate: undefined,
      endDate: undefined,
      estimatedHours: undefined,
      isActive: true,
    },
  });

  // Project creation mutation
  const createProjectMutation = useMutation({
    mutationFn: async (newProject: InsertProject) => {
      return apiRequest("/api/projects", "POST", newProject);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsCreateProjectDialogOpen(false);
      projectForm.reset();
      setSelectedAccount(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const handleCreateProject = (data: InsertProject) => {
    if (selectedAccount) {
      createProjectMutation.mutate({
        ...data,
        agencyId: selectedAccount.agencyId,
        accountId: selectedAccount.id,
      });
    }
  };

  const openCreateProjectDialog = (account: AccountWithAgency) => {
    setSelectedAccount(account);
    projectForm.reset({
      name: "",
      description: "",
      status: "active",
      agencyId: account.agencyId,
      accountId: account.id,
      startDate: undefined,
      endDate: undefined,
      estimatedHours: undefined,
      isActive: true,
    });
    setIsCreateProjectDialogOpen(true);
  };

  // Project update mutation
  const updateProjectMutation = useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: InsertProject }) => {
      return apiRequest(`/api/projects/${projectId}`, "PATCH", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-team"] });
      setIsEditProjectDialogOpen(false);
      projectForm.reset();
      setSelectedProjectToEdit(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project",
        variant: "destructive",
      });
    },
  });

  const handleUpdateProject = (data: InsertProject) => {
    if (selectedProjectToEdit) {
      updateProjectMutation.mutate({
        projectId: selectedProjectToEdit.id,
        data,
      });
    }
  };

  const openEditProjectDialog = (project: Project) => {
    setSelectedProjectToEdit(project);
    projectForm.reset({
      name: project.name,
      description: project.description || "",
      status: project.status,
      agencyId: project.agencyId,
      accountId: project.accountId,
      startDate: project.startDate || undefined,
      endDate: project.endDate || undefined,
      estimatedHours: project.estimatedHours ? parseFloat(project.estimatedHours) : undefined,
      isActive: project.isActive,
    });
    setIsEditProjectDialogOpen(true);
  };

  // Account creation form
  const accountForm = useForm<InsertAccount>({
    resolver: zodResolver(insertAccountSchema),
    defaultValues: {
      agencyId: "",
      name: "",
      description: "",
      isActive: true,
    },
  });

  // Account creation mutation
  const createAccountMutation = useMutation({
    mutationFn: async (newAccount: InsertAccount) => {
      return apiRequest("/api/accounts", "POST", newAccount);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setIsCreateAccountDialogOpen(false);
      accountForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    },
  });

  const handleCreateAccount = (data: InsertAccount) => {
    createAccountMutation.mutate(data);
  };

  // Helper function to get color based on relative quantity
  const getRelativeColor = (value: number, max: number): string => {
    if (value === 0) return "text-muted-foreground";
    const percentage = (value / max) * 100;
    if (percentage >= 75) return "text-green-600 dark:text-green-500";
    if (percentage >= 50) return "text-blue-600 dark:text-blue-500";
    if (percentage >= 25) return "text-yellow-600 dark:text-yellow-500";
    return "text-orange-600 dark:text-orange-500";
  };

  // Calculate weekly and monthly hours metrics
  const accountMetrics = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const metricsData = accounts.map(account => {
      // Get all time logs for this account
      const accountTimeLogs = timeLogs.filter(log => log.accountId === account.id);
      
      // Calculate weekly hours (last 7 days)
      const weeklyTimeLogs = accountTimeLogs.filter(log => {
        const logDate = new Date(log.logDate || log.createdAt);
        return logDate >= sevenDaysAgo;
      });
      const weeklyHours = weeklyTimeLogs.reduce((sum, log) => sum + Number(log.actualHours || 0), 0);
      
      // Calculate monthly hours (last 30 days)
      const monthlyTimeLogs = accountTimeLogs.filter(log => {
        const logDate = new Date(log.logDate || log.createdAt);
        return logDate >= thirtyDaysAgo;
      });
      const monthlyHours = monthlyTimeLogs.reduce((sum, log) => sum + Number(log.actualHours || 0), 0);
      
      // Calculate efficiency for expanded view
      const totalActualHours = accountTimeLogs.reduce((sum, log) => sum + Number(log.actualHours || 0), 0);
      const totalBilledHours = accountTimeLogs.reduce((sum, log) => sum + Number(log.billedHours || 0), 0);
      const efficiency = totalActualHours > 0 ? (totalBilledHours / totalActualHours) * 100 : 0;
      
      // Calculate recent activity for expanded view
      const recentActivity = monthlyTimeLogs.length;
      const recentHours = monthlyHours;
      
      return {
        ...account,
        metrics: {
          weeklyHours: Math.round(weeklyHours * 100) / 100,
          monthlyHours: Math.round(monthlyHours * 100) / 100,
          efficiency: Math.round(efficiency),
          totalActualHours,
          totalBilledHours,
          recentActivity,
          recentHours,
          totalTimeLogs: accountTimeLogs.length
        }
      };
    });

    // Calculate relative color coding based on weekly and monthly hours
    const weeklyValues = metricsData.map(m => m.metrics.weeklyHours).filter(h => h > 0);
    const monthlyValues = metricsData.map(m => m.metrics.monthlyHours).filter(h => h > 0);
    
    const weeklyMax = Math.max(...weeklyValues, 1);
    const monthlyMax = Math.max(...monthlyValues, 1);

    return metricsData.map(account => ({
      ...account,
      metrics: {
        ...account.metrics,
        weeklyColor: getRelativeColor(account.metrics.weeklyHours, weeklyMax),
        monthlyColor: getRelativeColor(account.metrics.monthlyHours, monthlyMax)
      }
    }));
  }, [accounts, timeLogs]);

  // Flat filtered list of accounts with search across accounts, agencies, projects, tasks
  const filteredAccounts = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    
    return accountMetrics.filter(account => {
      // Status filter
      if (statusFilter === "active" && account.isActive !== true) return false;
      if (statusFilter === "inactive" && account.isActive !== false) return false;
      
      // Search filter
      if (searchQuery) {
        const agency = agencies.find(a => a.id === account.agencyId);
        const agencyName = agency?.name?.toLowerCase() || "";
        const accountProjects = projects.filter(p => p.accountId === account.id);
        const accountTasks = tasks.filter(t => t.accountId === account.id);
        
        const accountMatches = account.name.toLowerCase().includes(searchLower) || agencyName.includes(searchLower);
        const projectMatches = accountProjects.some(p => 
          p.name.toLowerCase().includes(searchLower) || p.description?.toLowerCase().includes(searchLower)
        );
        const taskMatches = accountTasks.some(t =>
          t.name.toLowerCase().includes(searchLower) || t.description?.toLowerCase().includes(searchLower)
        );
        
        return accountMatches || projectMatches || taskMatches;
      }
      
      return true;
    });
  }, [accountMetrics, agencies, projects, tasks, searchQuery, statusFilter]);

  // Derive the selected account data for the Sheet panel
  const selectedAccountData = useMemo(() => {
    if (!selectedAccountId) return null;
    const account = accountMetrics.find(a => a.id === selectedAccountId);
    if (!account) return null;
    const agency = agencies.find(a => a.id === account.agencyId);
    const accountProjects = projects.filter(p => p.accountId === account.id).map(project => {
      const projectTasks = tasks.filter(t => t.projectId === project.id);
      return { ...project, tasks: projectTasks };
    });
    const unassignedTasks = tasks.filter(t => t.accountId === account.id && !t.projectId);
    return { ...account, agency, projects: accountProjects, unassignedTasks };
  }, [selectedAccountId, accountMetrics, agencies, projects, tasks]);

  // Task management functions
  const openCreateTaskDialog = (project: Project) => {
    setSelectedProject(project);
    setSelectedTask(null);
    setTaskDialogMode("create");
    setIsTaskDialogOpen(true);
  };

  const openEditTaskDialog = (task: Task) => {
    setSelectedTask(task);
    // Find the project this task belongs to for proper context
    const taskProject = projects.find(p => p.id === task.projectId);
    setSelectedProject(taskProject || null);
    setTaskDialogMode("edit");
    setIsTaskDialogOpen(true);
  };

  const confirmDeleteTask = (task: Task) => {
    setTaskToDelete(task);
    setIsDeleteTaskDialogOpen(true);
  };

  const handleDeleteTask = () => {
    if (taskToDelete) {
      deleteTaskMutation.mutate(taskToDelete.id);
    }
  };

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return apiRequest(`/api/accounts/${accountId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setIsDeleteAccountDialogOpen(false);
      setAccountToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  const confirmDeleteAccount = (account: AccountWithAgency) => {
    setAccountToDelete(account);
    setIsDeleteAccountDialogOpen(true);
  };

  const handleDeleteAccount = () => {
    if (accountToDelete) {
      deleteAccountMutation.mutate(accountToDelete.id);
    }
  };

  // Account update mutation for rich text content and status
  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; richTextContent?: string; isActive?: boolean }) => {
      return apiRequest(`/api/accounts/${id}`, "PATCH", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update account",
        variant: "destructive",
      });
    }
  });

  // Toggle account active status
  const toggleAccountStatus = (account: AccountWithAgency) => {
    updateAccountMutation.mutate({
      id: account.id,
      isActive: !account.isActive
    });
  };

  // Calculate project hours from time logs
  const projectHours = useMemo(() => {
    const hours: Record<string, { actual: number; billed: number }> = {};
    
    projectsWithTeam.forEach(project => {
      const projectLogs = timeLogs.filter(log => log.projectId === project.id);
      const actual = projectLogs.reduce((sum, log) => sum + Number(log.actualHours || 0), 0);
      const billed = projectLogs.reduce((sum, log) => sum + Number(log.billedHours || 0), 0);
      hours[project.id] = { actual, billed };
    });
    
    return hours;
  }, [projectsWithTeam, timeLogs]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Accounts"
          description="Manage client accounts with efficiency and activity insights"
          actions={<Skeleton className="h-9 w-32" />}
        />
        <div className="flex gap-4 items-center">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-[160px]" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="space-y-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalAccounts = filteredAccounts.length;
  const activeCount = filteredAccounts.filter(a => a.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description={`${totalAccounts} account${totalAccounts !== 1 ? 's' : ''} \u00B7 ${activeCount} active`}
        actions={
          <Button 
            onClick={() => setIsCreateAccountDialogOpen(true)}
            data-testid="button-new-account"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Account
          </Button>
        }
      />

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts, agencies, projects, and tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-accounts"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-4">
            <EmptyState
              icon={searchQuery ? Search : Inbox}
              title={searchQuery ? "No results found" : "No accounts yet"}
              description={searchQuery 
                ? "Try adjusting your search terms or filters."
                : "Create your first account to start tracking time and managing projects."
              }
              actionLabel={searchQuery ? undefined : "Create Account"}
              onAction={searchQuery ? undefined : () => setIsCreateAccountDialogOpen(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Weekly</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">Projects</TableHead>
                <TableHead className="text-right">Efficiency</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => {
                const agency = agencies.find(a => a.id === account.agencyId);
                const accountProjectCount = projects.filter(p => p.accountId === account.id).length;
                return (
                  <TableRow
                    key={account.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedAccountId(account.id)}
                    data-testid={`account-row-${account.id}`}
                  >
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="text-sm">{agency?.name || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.isActive ? "secondary" : "outline"} className="text-xs">
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-medium ${account.metrics.weeklyColor}`}>
                        {account.metrics.weeklyHours}h
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-medium ${account.metrics.monthlyColor}`}>
                        {account.metrics.monthlyHours}h
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {accountProjectCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {account.metrics.efficiency > 0 ? (
                        <span className="text-sm font-medium text-gold">{account.metrics.efficiency}%</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-account-menu-${account.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAccountStatus(account);
                            }}
                            data-testid={`menu-toggle-active-${account.id}`}
                          >
                            <Power className="h-4 w-4 mr-2" />
                            {account.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteAccount(account);
                            }}
                            className="text-destructive focus:text-destructive"
                            data-testid={`menu-delete-account-${account.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Account Detail Sheet */}
      <Sheet open={!!selectedAccountId} onOpenChange={(open) => !open && setSelectedAccountId(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {selectedAccountData && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle className="text-lg">{selectedAccountData.name}</SheetTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {selectedAccountData.agency?.name}
                    </p>
                  </div>
                  <Badge variant={selectedAccountData.isActive ? "secondary" : "outline"}>
                    {selectedAccountData.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </SheetHeader>

              <Tabs defaultValue="overview" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                  <TabsTrigger value="projects" className="flex-1">
                    Projects ({selectedAccountData.projects.length})
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Weekly Hours</p>
                      <p className={`text-lg font-semibold ${selectedAccountData.metrics.weeklyColor}`}>
                        {selectedAccountData.metrics.weeklyHours}h
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Monthly Hours</p>
                      <p className={`text-lg font-semibold ${selectedAccountData.metrics.monthlyColor}`}>
                        {selectedAccountData.metrics.monthlyHours}h
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Efficiency</p>
                      <p className="text-lg font-semibold text-gold">
                        {selectedAccountData.metrics.efficiency > 0 ? `${selectedAccountData.metrics.efficiency}%` : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Recent Activity</p>
                      <p className="text-lg font-semibold">{selectedAccountData.metrics.recentActivity}</p>
                      <p className="text-xs text-muted-foreground">logs (30d)</p>
                    </div>
                  </div>

                  {selectedAccountData.metrics.totalTimeLogs > 0 && (
                    <div className="rounded-lg border p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Billed</span>
                        <span className="font-medium">{selectedAccountData.metrics.totalBilledHours.toFixed(2)}h</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Actual</span>
                        <span className="font-medium">{selectedAccountData.metrics.totalActualHours.toFixed(1)}h</span>
                      </div>
                      <Progress value={Math.min(selectedAccountData.metrics.efficiency, 100)} className="h-2" />
                      <p className="text-xs text-muted-foreground">{selectedAccountData.metrics.totalTimeLogs} total time logs</p>
                    </div>
                  )}
                </TabsContent>

                {/* Projects Tab */}
                <TabsContent value="projects" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedAccountData.projects.length} project{selectedAccountData.projects.length !== 1 ? "s" : ""}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCreateProjectDialog(selectedAccountData as any)}
                      data-testid={`sheet-button-add-project-${selectedAccountData.id}`}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Project
                    </Button>
                  </div>

                  {selectedAccountData.projects.map((project) => {
                    const projectWithTeam = projectsWithTeam.find(p => p.id === project.id);
                    return (
                      <div key={project.id} className="rounded-lg border p-3 space-y-3" data-testid={`sheet-project-${project.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{project.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditProjectDialog(project)}
                              className="h-7 w-7"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Badge variant={project.status === 'active' ? 'secondary' : 'outline'} className="text-xs">
                              {project.status}
                            </Badge>
                          </div>
                        </div>

                        {project.description && (
                          <p className="text-xs text-muted-foreground">{project.description}</p>
                        )}

                        {/* Hours progress */}
                        {project.estimatedHours && projectHours[project.id] && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{projectHours[project.id]?.actual.toFixed(2)}h / {parseFloat(project.estimatedHours).toFixed(2)}h</span>
                              <span className="font-medium text-gold">
                                {Math.round((projectHours[project.id]?.actual || 0) / parseFloat(project.estimatedHours) * 100)}%
                              </span>
                            </div>
                            <Progress 
                              value={Math.min(100, (projectHours[project.id]?.actual || 0) / parseFloat(project.estimatedHours) * 100)}
                              className="h-1.5"
                            />
                          </div>
                        )}

                        {/* Team members */}
                        {projectWithTeam?.teamMembers && projectWithTeam.teamMembers.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {projectWithTeam.teamMembers.map((member: any) => (
                              <Badge key={member.id} variant="outline" className={`${roleColors[member.role]} text-xs`}>
                                {member.user.firstName} {member.user.lastName}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Tasks list */}
                        {project.tasks.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">Tasks ({project.tasks.length})</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openCreateTaskDialog(project)}
                                className="h-6 px-2 text-xs"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            </div>
                            {project.tasks.map((task) => (
                              <div key={task.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded bg-muted/50" data-testid={`sheet-task-${task.id}`}>
                                <CheckSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="flex-1 truncate text-xs">{task.name}</span>
                                <StatusBadge status={task.status} />
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Button size="icon" variant="ghost" onClick={() => openEditTaskDialog(task)} className="h-6 w-6">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => confirmDeleteTask(task)} className="h-6 w-6 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {project.tasks.length === 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openCreateTaskDialog(project)}
                            className="text-xs text-muted-foreground w-full justify-center"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Task
                          </Button>
                        )}

                        {/* Attachments */}
                        {projectWithTeam && <ProjectAttachments projectId={project.id} />}
                      </div>
                    );
                  })}

                  {/* Unassigned Tasks */}
                  {selectedAccountData.unassignedTasks.length > 0 && (
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Non-Project Tasks ({selectedAccountData.unassignedTasks.length})</p>
                      {selectedAccountData.unassignedTasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded bg-muted/50">
                          <CheckSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate text-xs">{task.name}</span>
                          <StatusBadge status={task.status} />
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button size="icon" variant="ghost" onClick={() => openEditTaskDialog(task)} className="h-6 w-6">
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => confirmDeleteTask(task)} className="h-6 w-6 text-destructive hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="mt-4">
                  <TabbedRichTextEditor accountId={selectedAccountData.id} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Task Form Dialog */}
      <TaskFormDialog
        isOpen={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        mode={taskDialogMode}
        project={selectedProject}
        task={selectedTask}
        users={users}
      />

      {/* Project Creation Dialog */}
      <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
        <DialogContent className="sm:max-w-[600px]" data-testid="dialog-create-project">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Create a new project for {selectedAccount?.name}
            </DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit(handleCreateProject)} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} data-testid="input-project-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={projectForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project description (optional)" {...field} value={field.value || ""} data-testid="input-project-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={projectForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-project-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on-hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={projectForm.control}
                  name="estimatedHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Hours</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field} 
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          data-testid="input-project-estimated-hours"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateProjectDialogOpen(false)} data-testid="button-cancel-project">
                  Cancel
                </Button>
                <Button type="submit" disabled={createProjectMutation.isPending} data-testid="button-submit-project">
                  {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Project Edit Dialog */}
      <Dialog open={isEditProjectDialogOpen} onOpenChange={setIsEditProjectDialogOpen}>
        <DialogContent className="sm:max-w-[600px]" data-testid="dialog-edit-project">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project details for {selectedProjectToEdit?.name}
            </DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit(handleUpdateProject)} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} data-testid="input-edit-project-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={projectForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project description (optional)" {...field} value={field.value || ""} data-testid="input-edit-project-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={projectForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-project-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on-hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={projectForm.control}
                  name="estimatedHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Hours</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field} 
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          data-testid="input-edit-project-estimated-hours"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditProjectDialogOpen(false)} data-testid="button-cancel-edit-project">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateProjectMutation.isPending} data-testid="button-submit-edit-project">
                  {updateProjectMutation.isPending ? "Updating..." : "Update Project"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Account Creation Dialog */}
      <Dialog open={isCreateAccountDialogOpen} onOpenChange={setIsCreateAccountDialogOpen}>
        <DialogContent className="sm:max-w-[600px]" data-testid="dialog-create-account">
          <DialogHeader>
            <DialogTitle>Create New Account</DialogTitle>
            <DialogDescription>
              Create a new client account
            </DialogDescription>
          </DialogHeader>
          <Form {...accountForm}>
            <form onSubmit={accountForm.handleSubmit(handleCreateAccount)} className="space-y-4">
              <FormField
                control={accountForm.control}
                name="agencyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-account-agency">
                          <SelectValue placeholder="Select agency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agencies.filter(a => a.isActive).map((agency) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={accountForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter account name" {...field} data-testid="input-account-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={accountForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter account description (optional)" 
                        {...field} 
                        value={field.value || ""} 
                        data-testid="input-account-description" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={accountForm.control}
                name="monthlyQuotaHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Quota (Hours)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.5"
                        placeholder="Optional monthly quota hours" 
                        {...field} 
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? e.target.value : undefined)}
                        data-testid="input-account-monthly-quota" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateAccountDialogOpen(false)} data-testid="button-cancel-account">
                  Cancel
                </Button>
                <Button type="submit" disabled={createAccountMutation.isPending} data-testid="button-submit-account">
                  {createAccountMutation.isPending ? "Creating..." : "Create Account"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation Dialog */}
      <AlertDialog open={isDeleteTaskDialogOpen} onOpenChange={setIsDeleteTaskDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the task "{taskToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-task">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              disabled={deleteTaskMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-task"
            >
              {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={isDeleteAccountDialogOpen} onOpenChange={setIsDeleteAccountDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the account "{accountToDelete?.name}"? This will also delete all associated projects, tasks, and time logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-account">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-account"
            >
              {deleteAccountMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}