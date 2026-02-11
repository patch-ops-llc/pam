import { useState, useMemo, CSSProperties } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
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
import { Switch } from "@/components/ui/switch";
import { Search, Plus, ChevronDown, ChevronRight, Building2, Users, FolderOpen, Clock, CheckSquare, Edit, Trash2, UserPlus, X, Inbox, MoreHorizontal, Power } from "lucide-react";
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
  const [expandedAgencies, setExpandedAgencies] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  
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
          weeklyHours: Math.round(weeklyHours * 10) / 10,
          monthlyHours: Math.round(monthlyHours * 10) / 10,
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

  // Build hierarchical data structure with enhanced search
  const hierarchicalData = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    
    const filteredData = agencies.map(agency => {
      // Apply status filter to accounts
      const agencyAccounts = accountMetrics.filter(account => {
        if (account.agencyId !== agency.id) return false;
        if (statusFilter === "active") return account.isActive === true;
        if (statusFilter === "inactive") return account.isActive === false;
        return true; // "all" - show all accounts
      });
      
      return {
        ...agency,
        accounts: agencyAccounts.map(account => {
          const accountProjects = projects.filter(project => project.accountId === account.id);
          const unassignedTasks = tasks.filter(task => task.accountId === account.id && !task.projectId);
          return {
            ...account,
            projects: accountProjects.map(project => {
              const projectTasks = tasks.filter(task => task.projectId === project.id);
              return {
                ...project,
                tasks: projectTasks
              };
            }),
            unassignedTasks
          };
        })
      };
    });

    // Apply search filter across all levels (agencies, accounts, projects, tasks)
    if (searchQuery) {
      return filteredData.map(agency => {
        const matchingAccounts = agency.accounts.filter(account => {
          const accountMatches = account.name.toLowerCase().includes(searchLower) ||
                                agency.name.toLowerCase().includes(searchLower);
          
          const projectMatches = account.projects.some(project => {
            const projectNameMatches = project.name.toLowerCase().includes(searchLower) ||
                                     project.description?.toLowerCase().includes(searchLower);
            
            const taskMatches = project.tasks.some(task =>
              task.name.toLowerCase().includes(searchLower) ||
              task.description?.toLowerCase().includes(searchLower)
            );

            return projectNameMatches || taskMatches;
          });

          const unassignedTaskMatches = account.unassignedTasks?.some(task =>
            task.name.toLowerCase().includes(searchLower) ||
            task.description?.toLowerCase().includes(searchLower)
          );

          return accountMatches || projectMatches || unassignedTaskMatches;
        }).map(account => ({
          ...account,
          projects: account.projects.filter(project => {
            const projectMatches = project.name.toLowerCase().includes(searchLower) ||
                                  project.description?.toLowerCase().includes(searchLower) ||
                                  account.name.toLowerCase().includes(searchLower) ||
                                  agency.name.toLowerCase().includes(searchLower);
            
            const taskMatches = project.tasks.some(task =>
              task.name.toLowerCase().includes(searchLower) ||
              task.description?.toLowerCase().includes(searchLower)
            );

            return projectMatches || taskMatches;
          }).map(project => ({
            ...project,
            tasks: project.tasks.filter(task =>
              task.name.toLowerCase().includes(searchLower) ||
              task.description?.toLowerCase().includes(searchLower) ||
              project.name.toLowerCase().includes(searchLower) ||
              project.description?.toLowerCase().includes(searchLower) ||
              account.name.toLowerCase().includes(searchLower) ||
              agency.name.toLowerCase().includes(searchLower)
            )
          })),
          unassignedTasks: account.unassignedTasks?.filter(task =>
            task.name.toLowerCase().includes(searchLower) ||
            task.description?.toLowerCase().includes(searchLower) ||
            account.name.toLowerCase().includes(searchLower) ||
            agency.name.toLowerCase().includes(searchLower)
          ) || []
        }));

        return {
          ...agency,
          accounts: matchingAccounts
        };
      });
    }

    return filteredData;
  }, [agencies, accountMetrics, projects, tasks, searchQuery, statusFilter]);

  // Toggle functions
  const toggleAgency = (agencyId: string) => {
    const newExpanded = new Set(expandedAgencies);
    if (newExpanded.has(agencyId)) {
      newExpanded.delete(agencyId);
    } else {
      newExpanded.add(agencyId);
    }
    setExpandedAgencies(newExpanded);
  };

  const toggleAccount = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

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
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
            <p className="text-muted-foreground">
              Manage client accounts with efficiency and activity insights
            </p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="flex gap-4 items-center">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-[160px]" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">
            Manage client accounts with efficiency and activity insights
          </p>
        </div>
        <Button 
          onClick={() => setIsCreateAccountDialogOpen(true)}
          data-testid="button-new-account"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Account
        </Button>
      </div>

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

      <div className="space-y-4">
        {hierarchicalData.length === 0 ? (
          <Card>
            <CardContent>
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
          hierarchicalData.map((agency) => {
            const isAgencyExpanded = expandedAgencies.has(agency.id);
            
            return (
              <Card key={agency.id} className="overflow-hidden" data-testid={`agency-card-${agency.id}`}>
                <Collapsible open={isAgencyExpanded} onOpenChange={() => toggleAgency(agency.id)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="hover-elevate cursor-pointer">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isAgencyExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <span>{agency.name}</span>
                          <Badge variant="outline" className="ml-2">
                            {agency.accounts.length} account{agency.accounts.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        {agency.accounts.map((account) => {
                          const isAccountExpanded = expandedAccounts.has(account.id);

                          return (
                            <div key={account.id} className="pl-6 border-l-2 border-primary/15" data-testid={`account-section-${account.id}`}>
                              <Collapsible open={isAccountExpanded} onOpenChange={() => toggleAccount(account.id)}>
                                <CollapsibleTrigger asChild>
                                  <div className="p-4 rounded-lg bg-muted/50 hover-elevate cursor-pointer">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        {isAccountExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{account.name}</span>
                                        <Badge variant={account.isActive ? "secondary" : "outline"} className="text-xs">
                                          {account.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                        <Badge variant="outline" className="ml-2">
                                          {account.projects.length} project{account.projects.length !== 1 ? 's' : ''}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {/* Compact metrics */}
                                        <div className="hidden sm:flex items-center gap-3 text-sm">
                                          <span className={`font-medium ${account.metrics.weeklyColor}`}>
                                            {account.metrics.weeklyHours}h <span className="text-xs text-muted-foreground font-normal">wk</span>
                                          </span>
                                          <span className="text-muted-foreground/30">|</span>
                                          <span className={`font-medium ${account.metrics.monthlyColor}`}>
                                            {account.metrics.monthlyHours}h <span className="text-xs text-muted-foreground font-normal">mo</span>
                                          </span>
                                        </div>
                                        {/* Actions menu */}
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
                                      </div>
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                
                                <CollapsibleContent>
                                  <div className="mt-4 space-y-4">
                                    {/* Account Metrics Details */}
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg border">
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-muted-foreground">Efficiency Metrics</h4>
                                        <div className="space-y-1">
                                          <div className="flex justify-between text-sm">
                                            <span>Billed Hours:</span>
                                            <span className="font-medium">{account.metrics.totalBilledHours}h</span>
                                          </div>
                                          <div className="flex justify-between text-sm">
                                            <span>Actual Hours:</span>
                                            <span className="font-medium">{account.metrics.totalActualHours}h</span>
                                          </div>
                                          {account.metrics.totalTimeLogs > 0 && (
                                            <Progress 
                                              value={Math.min(account.metrics.efficiency, 100)} 
                                              className="h-2" 
                                            />
                                          )}
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-muted-foreground">Recent Activity (30 days)</h4>
                                        <div className="space-y-1">
                                          <div className="flex justify-between text-sm">
                                            <span>Time Logs:</span>
                                            <span className="font-medium">{account.metrics.recentActivity}</span>
                                          </div>
                                          <div className="flex justify-between text-sm">
                                            <span>Hours Logged:</span>
                                            <span className="font-medium">{account.metrics.recentHours}h</span>
                                          </div>
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {account.metrics.totalTimeLogs} total logs
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Account Notes */}
                                    <div className="pb-4 border-b">
                                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Account Notes</h4>
                                      <TabbedRichTextEditor accountId={account.id} />
                                    </div>

                                    {/* Projects List */}
                                    {account.projects.length > 0 ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className="text-sm font-medium text-muted-foreground">Projects</h4>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openCreateProjectDialog(account);
                                            }}
                                            className="h-6 px-2 text-xs"
                                            data-testid={`button-add-project-${account.id}`}
                                          >
                                            <Plus className="h-3 w-3 mr-1" />
                                            Add Project
                                          </Button>
                                        </div>
                                        <div className="space-y-2 pl-4 border-l-2 border-muted">
                                          {account.projects.map((project) => {
                                            const isProjectExpanded = expandedProjects.has(project.id);
                                            
                                            return (
                                              <div key={project.id} data-testid={`project-section-${project.id}`}>
                                                <Collapsible open={isProjectExpanded} onOpenChange={() => toggleProject(project.id)}>
                                                  <CollapsibleTrigger asChild>
                                                    <div className="p-3 rounded-lg bg-muted/30 hover-elevate cursor-pointer">
                                                      <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                          {isProjectExpanded ? (
                                                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                          ) : (
                                                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                          )}
                                                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                                          <span className="text-sm font-medium">{project.name}</span>
                                                          <Badge variant="outline" className="text-xs">
                                                            {project.tasks.length} task{project.tasks.length !== 1 ? 's' : ''}
                                                          </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                          <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              openEditProjectDialog(project);
                                                            }}
                                                            className="h-6 w-6"
                                                            data-testid={`button-edit-project-${project.id}`}
                                                          >
                                                            <Edit className="h-3 w-3" />
                                                          </Button>
                                                          <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              openCreateTaskDialog(project);
                                                            }}
                                                            className="h-6 px-2 text-xs"
                                                            data-testid={`button-add-task-${project.id}`}
                                                          >
                                                            <Plus className="h-3 w-3 mr-1" />
                                                            Add Task
                                                          </Button>
                                                          <Badge 
                                                            variant={project.status === 'active' ? 'secondary' : 'outline'} 
                                                            className="text-xs"
                                                          >
                                                            {project.status}
                                                          </Badge>
                                                        </div>
                                                      </div>
                                                      {project.description && (
                                                        <p className="text-xs text-muted-foreground mt-2 ml-5">
                                                          {project.description}
                                                        </p>
                                                      )}
                                                    </div>
                                                  </CollapsibleTrigger>
                                                  
                                                  <CollapsibleContent>
                                                    <div className="mt-2 ml-5 space-y-4">
                                                      {(() => {
                                                        const projectWithTeam = projectsWithTeam.find(p => p.id === project.id);
                                                        
                                                        return (
                                                          <div className="grid gap-4 md:grid-cols-2">
                                                            {/* Left Column: Team & Hours */}
                                                            <div className="space-y-4">
                                                              {/* Team Members */}
                                                              {projectWithTeam && (
                                                                <div className="space-y-2">
                                                                  <div className="flex items-center gap-2 text-sm font-medium">
                                                                    <Users className="h-4 w-4" />
                                                                    <span>Team</span>
                                                                  </div>
                                                                  {projectWithTeam.teamMembers && projectWithTeam.teamMembers.length > 0 ? (
                                                                    <div className="space-y-1">
                                                                      {projectWithTeam.teamMembers.map((member: any) => (
                                                                        <div
                                                                          key={member.id}
                                                                          className="flex items-center justify-between text-xs p-2 rounded bg-background/50"
                                                                        >
                                                                          <div className="flex items-center gap-2 flex-1">
                                                                            <span className="font-medium">
                                                                              {member.user.firstName} {member.user.lastName}
                                                                            </span>
                                                                            <Badge variant="outline" className={`${roleColors[member.role]} text-xs`}>
                                                                              {member.role}
                                                                            </Badge>
                                                                          </div>
                                                                          {member.actualHoursPerWeek && (
                                                                            <span className="text-muted-foreground">
                                                                              {member.actualHoursPerWeek}h/wk
                                                                            </span>
                                                                          )}
                                                                        </div>
                                                                      ))}
                                                                    </div>
                                                                  ) : (
                                                                    <p className="text-xs text-muted-foreground">No team members assigned</p>
                                                                  )}
                                                                </div>
                                                              )}

                                                              {/* Hours Tracking */}
                                                              {(projectHours[project.id] || project.estimatedHours) && (
                                                                <div className="space-y-2">
                                                                  <div className="flex items-center gap-2 text-sm font-medium">
                                                                    <Clock className="h-4 w-4" />
                                                                    <span>Hours Tracker</span>
                                                                  </div>
                                                                  {project.estimatedHours && (
                                                                    <div className="space-y-2">
                                                                      <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-muted-foreground">
                                                                          {projectHours[project.id]?.actual.toFixed(1) || '0.0'}h logged
                                                                        </span>
                                                                        <span className="font-medium">
                                                                          {Math.round((projectHours[project.id]?.actual || 0) / parseFloat(project.estimatedHours) * 100)}%
                                                                        </span>
                                                                      </div>
                                                                      <Progress 
                                                                        value={Math.min(100, (projectHours[project.id]?.actual || 0) / parseFloat(project.estimatedHours) * 100)} 
                                                                        className="h-2"
                                                                      />
                                                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                                        <span>Actual: {projectHours[project.id]?.actual.toFixed(1) || '0.0'}h</span>
                                                                        <span>Total: {parseFloat(project.estimatedHours).toFixed(1)}h</span>
                                                                      </div>
                                                                      {projectHours[project.id]?.billed && (
                                                                        <div className="text-xs text-muted-foreground">
                                                                          Billed: {projectHours[project.id].billed.toFixed(1)}h
                                                                        </div>
                                                                      )}
                                                                    </div>
                                                                  )}
                                                                </div>
                                                              )}
                                                            </div>

                                                            {/* Right Column: Tasks & Attachments */}
                                                            <div className="space-y-4">
                                                              {/* Tasks */}
                                                              <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                                  <CheckSquare className="h-4 w-4" />
                                                                  <span>Tasks {project.tasks.length > 0 && `(${project.tasks.length})`}</span>
                                                                </div>
                                                                {project.tasks.length > 0 ? (
                                                                  <div className="space-y-1">
                                                                    {project.tasks.map((task) => (
                                                                      <div key={task.id} className="flex items-center gap-2 text-sm p-2 rounded bg-background/50 hover-elevate" data-testid={`task-item-${task.id}`}>
                                                                        <CheckSquare className="h-3 w-3 text-muted-foreground" />
                                                                        <span className="flex-1">{task.name}</span>
                                                                        <StatusBadge status={task.status} />
                                                                        <Badge variant={task.billingType === 'prebilled' ? 'outline' : 'secondary'} className="text-xs">
                                                                          {task.billingType === 'prebilled' ? 'Pre-billed' : 'Billable'}
                                                                        </Badge>
                                                                        <div className="flex items-center gap-1">
                                                                          <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            onClick={() => openEditTaskDialog(task)}
                                                                            className="h-6 w-6"
                                                                            data-testid={`button-edit-task-${task.id}`}
                                                                          >
                                                                            <Edit className="h-3 w-3" />
                                                                          </Button>
                                                                          <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            onClick={() => confirmDeleteTask(task)}
                                                                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                            data-testid={`button-delete-task-${task.id}`}
                                                                          >
                                                                            <Trash2 className="h-3 w-3" />
                                                                          </Button>
                                                                        </div>
                                                                      </div>
                                                                    ))}
                                                                  </div>
                                                                ) : (
                                                                  <p className="text-xs text-muted-foreground">No tasks in this project</p>
                                                                )}
                                                              </div>

                                                              {/* Project Attachments */}
                                                              {projectWithTeam && (
                                                                <div className="space-y-2">
                                                                  <ProjectAttachments projectId={project.id} />
                                                                </div>
                                                              )}
                                                            </div>
                                                          </div>
                                                        );
                                                      })()}
                                                    </div>
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      
                                      {/* Non-Project Tasks Section */}
                                      {account.unassignedTasks && account.unassignedTasks.length > 0 && (
                                        <div className="mt-4">
                                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Non-Project Tasks</h4>
                                          <div className="space-y-1 pl-4 border-l-2 border-muted">
                                            {account.unassignedTasks.map((task) => (
                                              <div key={task.id} className="flex items-center gap-2 text-sm p-2 rounded bg-background/50 hover-elevate" data-testid={`non-project-task-item-${task.id}`}>
                                                <CheckSquare className="h-3 w-3 text-muted-foreground" />
                                                <span className="flex-1">{task.name}</span>
                                                <StatusBadge status={task.status} />
                                                <Badge variant={task.billingType === 'prebilled' ? 'outline' : 'secondary'} className="text-xs">
                                                  {task.billingType === 'prebilled' ? 'Pre-billed' : 'Billable'}
                                                </Badge>
                                                <div className="flex items-center gap-1">
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => openEditTaskDialog(task)}
                                                    className="h-6 w-6"
                                                    data-testid={`button-edit-non-project-task-${task.id}`}
                                                  >
                                                    <Edit className="h-3 w-3" />
                                                  </Button>
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => confirmDeleteTask(task)}
                                                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    data-testid={`button-delete-non-project-task-${task.id}`}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="flex items-center justify-between mb-2">
                                          <p className="text-sm text-muted-foreground italic">No projects assigned to this account</p>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openCreateProjectDialog(account);
                                            }}
                                            className="h-6 px-2 text-xs"
                                            data-testid={`button-add-project-empty-${account.id}`}
                                          >
                                            <Plus className="h-3 w-3 mr-1" />
                                            Add Project
                                          </Button>
                                        </div>
                                        
                                        {/* Show non-project tasks even if no projects */}
                                        {account.unassignedTasks && account.unassignedTasks.length > 0 && (
                                          <div className="mt-4">
                                            <h4 className="text-sm font-medium text-muted-foreground mb-2">Non-Project Tasks</h4>
                                            <div className="space-y-1 pl-4 border-l-2 border-muted">
                                              {account.unassignedTasks.map((task) => (
                                                <div key={task.id} className="flex items-center gap-2 text-sm p-2 rounded bg-background/50 hover-elevate" data-testid={`non-project-task-item-${task.id}`}>
                                                  <CheckSquare className="h-3 w-3 text-muted-foreground" />
                                                  <span className="flex-1">{task.name}</span>
                                                  <StatusBadge status={task.status} />
                                                  <Badge variant={task.billingType === 'prebilled' ? 'outline' : 'secondary'} className="text-xs">
                                                    {task.billingType === 'prebilled' ? 'Pre-billed' : 'Billable'}
                                                  </Badge>
                                                  <div className="flex items-center gap-1">
                                                    <Button
                                                      size="icon"
                                                      variant="ghost"
                                                      onClick={() => openEditTaskDialog(task)}
                                                      className="h-6 w-6"
                                                      data-testid={`button-edit-non-project-task-${task.id}`}
                                                    >
                                                      <Edit className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                      size="icon"
                                                      variant="ghost"
                                                      onClick={() => confirmDeleteTask(task)}
                                                      className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                      data-testid={`button-delete-non-project-task-${task.id}`}
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          );
                        })}
                        
                        {/* Add Account button for this client */}
                        <div className="flex justify-center pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              accountForm.reset({
                                agencyId: agency.id,
                                name: "",
                                description: "",
                                isActive: true,
                              });
                              setIsCreateAccountDialogOpen(true);
                            }}
                            data-testid={`button-add-account-${agency.id}`}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Account to {agency.name}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })
        )}
      </div>

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