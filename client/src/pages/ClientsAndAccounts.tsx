import { useState, useMemo, Fragment } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Plus,
  Building2,
  FolderOpen,
  CheckSquare,
  Edit,
  Trash2,
  Inbox,
  MoreHorizontal,
  Archive,
  ChevronRight,
} from "lucide-react";
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
import type {
  AccountWithAgency,
  Agency,
  Project,
  Task,
  User,
  TimeLog,
  InsertProject,
  InsertAccount,
  ProjectWithTeamAndRelations,
} from "@shared/schema";

const roleColors: Record<string, string> = {
  comms: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  pm: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  build: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  support: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export default function ClientsAndAccounts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [expandedAgencies, setExpandedAgencies] = useState<Set<string>>(new Set());
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<"create" | "edit">("create");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<AccountWithAgency | null>(null);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [isEditProjectDialogOpen, setIsEditProjectDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountWithAgency | null>(null);
  const [selectedProjectToEdit, setSelectedProjectToEdit] = useState<Project | null>(null);
  const [isCreateAccountDialogOpen, setIsCreateAccountDialogOpen] = useState(false);
  const [accountAgencyId, setAccountAgencyId] = useState<string | null>(null);
  const [isCreateClientDialogOpen, setIsCreateClientDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientType, setNewClientType] = useState<"agency" | "direct">("agency");
  const [newClientRequireTimeTracker, setNewClientRequireTimeTracker] = useState(false);
  const [newClientTimeTrackingSystem, setNewClientTimeTrackingSystem] = useState("");

  const { toast } = useToast();

  const { data: agencies = [], isLoading: agenciesLoading } = useQuery<Agency[]>({
    queryKey: ["/api/clients"],
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<AccountWithAgency[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: projectsWithTeam = [] } = useQuery<ProjectWithTeamAndRelations[]>({
    queryKey: ["/api/projects/with-team"],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: timeLogs = [], isLoading: timeLogsLoading } = useQuery<TimeLog[]>({
    queryKey: ["/api/time-logs"],
  });

  const isLoading =
    agenciesLoading ||
    accountsLoading ||
    projectsLoading ||
    tasksLoading ||
    usersLoading ||
    timeLogsLoading;

  const getAgencyStats = (agencyId: string) => {
    const agencyAccounts = accounts.filter(
      (a) => a.agencyId === agencyId && a.isActive
    );
    const agencyProjects = projects.filter(
      (p) => p.agencyId === agencyId && p.isActive
    );
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();
    const monthlyHours = timeLogs
      .filter((log) => {
        const logDate = new Date(log.logDate || log.createdAt);
        return (
          log.agencyId === agencyId &&
          logDate.getUTCMonth() === currentMonth &&
          logDate.getUTCFullYear() === currentYear
        );
      })
      .reduce((total, log) => total + parseFloat(String(log.actualHours || 0)), 0);
    return {
      activeAccounts: agencyAccounts.length,
      activeProjects: agencyProjects.length,
      monthlyHours: Math.round(monthlyHours * 100) / 100,
    };
  };

  const accountMetrics = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    return accounts.map((account) => {
      const accountTimeLogs = timeLogs.filter((log) => log.accountId === account.id);
      const weeklyTimeLogs = accountTimeLogs.filter((log) => {
        const logDate = new Date(log.logDate || log.createdAt);
        return logDate >= sevenDaysAgo;
      });
      const weeklyHours = weeklyTimeLogs.reduce(
        (sum, log) => sum + Number(log.actualHours || 0),
        0
      );
      const monthlyTimeLogs = accountTimeLogs.filter((log) => {
        const logDate = new Date(log.logDate || log.createdAt);
        return logDate >= thirtyDaysAgo;
      });
      const monthlyHours = monthlyTimeLogs.reduce(
        (sum, log) => sum + Number(log.actualHours || 0),
        0
      );
      const totalActualHours = accountTimeLogs.reduce(
        (sum, log) => sum + Number(log.actualHours || 0),
        0
      );
      const totalBilledHours = accountTimeLogs.reduce(
        (sum, log) => sum + Number(log.billedHours || 0),
        0
      );
      const efficiency =
        totalActualHours > 0 ? (totalBilledHours / totalActualHours) * 100 : 0;
      return {
        ...account,
        metrics: {
          weeklyHours: Math.round(weeklyHours * 100) / 100,
          monthlyHours: Math.round(monthlyHours * 100) / 100,
          efficiency: Math.round(efficiency),
          totalActualHours,
          totalBilledHours,
          recentActivity: monthlyTimeLogs.length,
          totalTimeLogs: accountTimeLogs.length,
        },
      };
    });
  }, [accounts, timeLogs]);

  const filteredAgencies = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return agencies.filter((agency) => {
      if (!showInactive && !agency.isActive) return false;
      if (!searchQuery) return true;
      const agencyAccounts = accounts.filter((a) => a.agencyId === agency.id);
      const matchesAgency = agency.name.toLowerCase().includes(searchLower);
      const matchesAccount = agencyAccounts.some((a) =>
        a.name.toLowerCase().includes(searchLower)
      );
      return matchesAgency || matchesAccount;
    });
  }, [agencies, accounts, searchQuery, showInactive]);

  const selectedAccountData = useMemo(() => {
    if (!selectedAccountId) return null;
    const account = accountMetrics.find((a) => a.id === selectedAccountId);
    if (!account) return null;
    const agency = agencies.find((a) => a.id === account.agencyId);
    const accountProjects = projects
      .filter((p) => p.accountId === account.id)
      .map((project) => {
        const projectTasks = tasks.filter((t) => t.projectId === project.id);
        return { ...project, tasks: projectTasks };
      });
    const unassignedTasks = tasks.filter(
      (t) => t.accountId === account.id && !t.projectId
    );
    return { ...account, agency, projects: accountProjects, unassignedTasks };
  }, [selectedAccountId, accountMetrics, agencies, projects, tasks]);


  const projectHours = useMemo(() => {
    const hours: Record<string, { actual: number; billed: number }> = {};
    projectsWithTeam.forEach((project) => {
      const projectLogs = timeLogs.filter((log) => log.projectId === project.id);
      const actual = projectLogs.reduce(
        (sum, log) => sum + Number(log.actualHours || 0),
        0
      );
      const billed = projectLogs.reduce(
        (sum, log) => sum + Number(log.billedHours || 0),
        0
      );
      hours[project.id] = { actual, billed };
    });
    return hours;
  }, [projectsWithTeam, timeLogs]);

  const toggleAgencyExpanded = (agencyId: string) => {
    setExpandedAgencies((prev) => {
      const next = new Set(prev);
      if (next.has(agencyId)) next.delete(agencyId);
      else next.add(agencyId);
      return next;
    });
  };

  const createClientMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      type: "agency" | "direct";
      requireTimeTrackerConfirmation?: boolean;
      timeTrackingSystem?: string;
    }) => apiRequest("/api/clients", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client Created", description: "New client has been created." });
      setIsCreateClientDialogOpen(false);
      setNewClientName("");
      setNewClientType("agency");
      setNewClientRequireTimeTracker(false);
      setNewClientTimeTrackingSystem("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create client.",
        variant: "destructive",
      });
    },
  });

  const updateAgencyMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        type?: "agency" | "direct";
        isActive?: boolean;
        requireTimeTrackerConfirmation?: boolean;
        timeTrackingSystem?: string | null;
      };
    }) => apiRequest(`/api/clients/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update client.",
        variant: "destructive",
      });
    },
  });

  const deleteAgencyMutation = useMutation({
    mutationFn: async (agencyId: string) =>
      apiRequest(`/api/clients/${agencyId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client Deleted" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete client.",
        variant: "destructive",
      });
    },
  });

  const accountForm = useForm<InsertAccount>({
    resolver: zodResolver(insertAccountSchema),
    defaultValues: {
      agencyId: "",
      name: "",
      description: "",
      isActive: true,
    },
  });


  const createAccountMutation = useMutation({
    mutationFn: async (data: InsertAccount) =>
      apiRequest("/api/accounts", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Success", description: "Account created successfully" });
      setIsCreateAccountDialogOpen(false);
      setAccountAgencyId(null);
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

  const createProjectMutation = useMutation({
    mutationFn: async (data: InsertProject) =>
      apiRequest("/api/projects", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsCreateProjectDialogOpen(false);
      projectForm.reset();
      setSelectedAccount(null);
      toast({ title: "Success", description: "Project created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: InsertProject;
    }) => apiRequest(`/api/projects/${projectId}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-team"] });
      setIsEditProjectDialogOpen(false);
      setSelectedProjectToEdit(null);
      toast({ title: "Success", description: "Project updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project",
        variant: "destructive",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) =>
      apiRequest(`/api/tasks/${taskId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsDeleteTaskDialogOpen(false);
      setTaskToDelete(null);
      toast({ title: "Success", description: "Task deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task",
        variant: "destructive",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: string) =>
      apiRequest(`/api/accounts/${accountId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setIsDeleteAccountDialogOpen(false);
      setAccountToDelete(null);
      toast({ title: "Success", description: "Account deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      richTextContent?: string;
      isActive?: boolean;
      monthlyQuotaHours?: string;
      maxHoursPerWeek?: string;
    }) => apiRequest(`/api/accounts/${id}`, "PATCH", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update account",
        variant: "destructive",
      });
    },
  });

  const openCreateAccountDialog = (agencyId: string) => {
    setAccountAgencyId(agencyId);
    accountForm.reset({
      agencyId,
      name: "",
      description: "",
      isActive: true,
    });
    setIsCreateAccountDialogOpen(true);
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
      estimatedHours: project.estimatedHours
        ? parseFloat(project.estimatedHours)
        : undefined,
      isActive: project.isActive,
    });
    setIsEditProjectDialogOpen(true);
  };

  const openCreateTaskDialog = (project: Project) => {
    setSelectedProject(project);
    setSelectedTask(null);
    setTaskDialogMode("create");
    setIsTaskDialogOpen(true);
  };

  const openEditTaskDialog = (task: Task) => {
    setSelectedTask(task);
    setSelectedProject(projects.find((p) => p.id === task.projectId) || null);
    setTaskDialogMode("edit");
    setIsTaskDialogOpen(true);
  };

  const handleCreateAccount = (data: InsertAccount) => {
    createAccountMutation.mutate(data);
  };

  const handleCreateProject = (data: InsertProject) => {
    if (selectedAccount) {
      createProjectMutation.mutate({
        ...data,
        agencyId: selectedAccount.agencyId,
        accountId: selectedAccount.id,
      });
    }
  };

  const handleUpdateProject = (data: InsertProject) => {
    if (selectedProjectToEdit) {
      updateProjectMutation.mutate({
        projectId: selectedProjectToEdit.id,
        data,
      });
    }
  };

  const toggleAccountStatus = (account: AccountWithAgency) => {
    updateAccountMutation.mutate({
      id: account.id,
      isActive: !account.isActive,
    });
  };


  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Clients & Accounts"
          description="Manage clients and their accounts"
          actions={<Skeleton className="h-9 w-32" />}
        />
        <div className="flex gap-4">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-[160px]" />
        </div>
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 border-b last:border-0"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalClients = filteredAgencies.length;
  const totalAccounts = accounts.filter((a) => a.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients & Accounts"
        description={`${totalClients} client${totalClients !== 1 ? "s" : ""} \u00B7 ${totalAccounts} account${totalAccounts !== 1 ? "s" : ""}`}
        actions={
          <Button
            onClick={() => setIsCreateClientDialogOpen(true)}
            data-testid="button-new-client"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        }
      />

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients and accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <Label htmlFor="show-inactive" className="text-sm">Show inactive</Label>
        </div>
      </div>

      {filteredAgencies.length === 0 ? (
        <Card>
          <CardContent className="py-4">
            <EmptyState
              icon={searchQuery ? Search : Inbox}
              title={searchQuery ? "No results found" : "No clients yet"}
              description={
                searchQuery
                  ? "Try adjusting your search terms."
                  : "Create your first client to get started."
              }
              actionLabel={searchQuery ? undefined : "Create Client"}
              onAction={
                searchQuery ? undefined : () => setIsCreateClientDialogOpen(true)
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Accounts</TableHead>
                <TableHead className="text-center">Projects</TableHead>
                <TableHead className="text-center">Hours (Month)</TableHead>
                <TableHead className="w-12">Active</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgencies.map((agency) => {
                const stats = getAgencyStats(agency.id);
                const agencyAccounts = accountMetrics.filter(
                  (a) => a.agencyId === agency.id
                );
                const isExpanded = expandedAgencies.has(agency.id);

                return (
                  <Fragment key={agency.id}>
                    <TableRow
                      key={agency.id}
                      className={!agency.isActive ? "opacity-60" : ""}
                      data-testid={`client-row-${agency.id}`}
                    >
                      <TableCell className="w-10 p-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleAgencyExpanded(agency.id)}
                          data-testid={`expand-${agency.id}`}
                        >
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{agency.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {agency.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{stats.activeAccounts}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{stats.activeProjects}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{stats.monthlyHours}h</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={agency.isActive}
                          onCheckedChange={(checked) =>
                            updateAgencyMutation.mutate({
                              id: agency.id,
                              data: { isActive: checked },
                            })
                          }
                          disabled={updateAgencyMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openCreateAccountDialog(agency.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Account
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete "${agency.name}"? This will delete all accounts, projects, and tasks.`
                                  )
                                ) {
                                  deleteAgencyMutation.mutate(agency.id);
                                }
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Client
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                            <TableRow
                              key={`${agency.id}-content`}
                              className="bg-muted/30 hover:bg-muted/30"
                            >
                              <TableCell colSpan={8} className="p-0">
                                <div className="p-4 pl-12 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium">
                                      Accounts under {agency.name}
                                    </h4>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        openCreateAccountDialog(agency.id)
                                      }
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Account
                                    </Button>
                                  </div>
                                  {agencyAccounts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4">
                                      No accounts yet. Add an account to manage
                                      projects and track time.
                                    </p>
                                  ) : (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Account</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead className="text-right">
                                            Hrs/Week
                                          </TableHead>
                                          <TableHead className="text-right">
                                            Hrs/Month
                                          </TableHead>
                                          <TableHead className="text-right">
                                            Projects
                                          </TableHead>
                                          <TableHead className="w-10" />
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {agencyAccounts
                                            .filter((a) => showInactive || a.isActive)
                                            .map((account) => (
                                            <TableRow
                                              key={account.id}
                                              className={`cursor-pointer hover:bg-muted/50 ${!account.isActive ? "opacity-60" : ""}`}
                                              onClick={() =>
                                                setSelectedAccountId(account.id)
                                              }
                                            >
                                              <TableCell className="font-medium">
                                                {account.name}
                                              </TableCell>
                                              <TableCell>
                                                <Badge
                                                  variant={
                                                    account.isActive
                                                      ? "secondary"
                                                      : "outline"
                                                  }
                                                >
                                                  {account.isActive
                                                    ? "Active"
                                                    : "Archived"}
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <Input
                                                  type="number"
                                                  step="0.5"
                                                  min="0"
                                                  className="w-20 h-7 text-right text-xs ml-auto"
                                                  defaultValue={account.maxHoursPerWeek ? parseFloat(String(account.maxHoursPerWeek)) : ""}
                                                  key={`${account.id}-wk-${account.maxHoursPerWeek}`}
                                                  placeholder="—"
                                                  onBlur={(e) => {
                                                    const newVal = e.target.value;
                                                    const current = account.maxHoursPerWeek ? String(parseFloat(String(account.maxHoursPerWeek))) : "";
                                                    if (newVal !== current) {
                                                      updateAccountMutation.mutate({
                                                        id: account.id,
                                                        maxHoursPerWeek: newVal || undefined,
                                                      });
                                                    }
                                                  }}
                                                />
                                              </TableCell>
                                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <Input
                                                  type="number"
                                                  step="0.5"
                                                  min="0"
                                                  className="w-20 h-7 text-right text-xs ml-auto"
                                                  defaultValue={account.monthlyQuotaHours ? parseFloat(String(account.monthlyQuotaHours)) : ""}
                                                  key={`${account.id}-mo-${account.monthlyQuotaHours}`}
                                                  placeholder="—"
                                                  onBlur={(e) => {
                                                    const newVal = e.target.value;
                                                    const current = account.monthlyQuotaHours ? String(parseFloat(String(account.monthlyQuotaHours))) : "";
                                                    if (newVal !== current) {
                                                      updateAccountMutation.mutate({
                                                        id: account.id,
                                                        monthlyQuotaHours: newVal || undefined,
                                                      });
                                                    }
                                                  }}
                                                />
                                              </TableCell>
                                              <TableCell className="text-right text-sm">
                                                {
                                                  projects.filter(
                                                    (p) =>
                                                      p.accountId === account.id
                                                  ).length
                                                }
                                              </TableCell>
                                              <TableCell>
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-8 w-8"
                                                      onClick={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                    >
                                                      <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleAccountStatus(
                                                          account
                                                        );
                                                      }}
                                                    >
                                                      <Archive className="h-4 w-4 mr-2" />
                                                      {account.isActive
                                                        ? "Archive"
                                                        : "Unarchive"}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAccountToDelete(
                                                          account
                                                        );
                                                        setIsDeleteAccountDialogOpen(
                                                          true
                                                        );
                                                      }}
                                                      className="text-destructive"
                                                    >
                                                      <Trash2 className="h-4 w-4 mr-2" />
                                                      Delete Account
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Account Detail Sheet - reused from Accounts */}
      <Sheet
        open={!!selectedAccountId}
        onOpenChange={(open) => !open && setSelectedAccountId(null)}
      >
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {selectedAccountData && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle className="text-lg">
                      {selectedAccountData.name}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {selectedAccountData.agency?.name}
                    </p>
                  </div>
                  <Badge
                    variant={
                      selectedAccountData.isActive ? "secondary" : "outline"
                    }
                  >
                    {selectedAccountData.isActive ? "Active" : "Archived"}
                  </Badge>
                </div>
              </SheetHeader>

              <Tabs defaultValue="overview" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="projects">
                    Projects ({selectedAccountData.projects.length})
                  </TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Allotted Hours</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3 space-y-2">
                        <Label className="text-xs text-muted-foreground">Hrs / Week</Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          className="h-8 text-sm"
                          defaultValue={selectedAccountData.maxHoursPerWeek ? parseFloat(String(selectedAccountData.maxHoursPerWeek)) : ""}
                          key={`sheet-wk-${selectedAccountData.id}-${selectedAccountData.maxHoursPerWeek}`}
                          placeholder="Not set"
                          onBlur={(e) => {
                            const newVal = e.target.value;
                            const current = selectedAccountData.maxHoursPerWeek ? String(parseFloat(String(selectedAccountData.maxHoursPerWeek))) : "";
                            if (newVal !== current) {
                              updateAccountMutation.mutate({
                                id: selectedAccountData.id,
                                maxHoursPerWeek: newVal || undefined,
                              });
                            }
                          }}
                        />
                      </div>
                      <div className="rounded-lg border p-3 space-y-2">
                        <Label className="text-xs text-muted-foreground">Hrs / Month</Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          className="h-8 text-sm"
                          defaultValue={selectedAccountData.monthlyQuotaHours ? parseFloat(String(selectedAccountData.monthlyQuotaHours)) : ""}
                          key={`sheet-mo-${selectedAccountData.id}-${selectedAccountData.monthlyQuotaHours}`}
                          placeholder="Not set"
                          onBlur={(e) => {
                            const newVal = e.target.value;
                            const current = selectedAccountData.monthlyQuotaHours ? String(parseFloat(String(selectedAccountData.monthlyQuotaHours))) : "";
                            if (newVal !== current) {
                              updateAccountMutation.mutate({
                                id: selectedAccountData.id,
                                monthlyQuotaHours: newVal || undefined,
                              });
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Logged Hours</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">Last 7 Days</p>
                        <p className="text-lg font-semibold">
                          {selectedAccountData.metrics.weeklyHours}h
                        </p>
                      </div>
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">Last 30 Days</p>
                        <p className="text-lg font-semibold">
                          {selectedAccountData.metrics.monthlyHours}h
                        </p>
                      </div>
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">Efficiency</p>
                        <p className="text-lg font-semibold text-gold">
                          {selectedAccountData.metrics.efficiency > 0
                            ? `${selectedAccountData.metrics.efficiency}%`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="projects" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedAccountData.projects.length} project
                      {selectedAccountData.projects.length !== 1 ? "s" : ""}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        openCreateProjectDialog(
                          selectedAccountData as AccountWithAgency
                        )
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Project
                    </Button>
                  </div>

                  {selectedAccountData.projects.map((project) => {
                    const projectWithTeam = projectsWithTeam.find(
                      (p) => p.id === project.id
                    );
                    return (
                      <div
                        key={project.id}
                        className="rounded-lg border p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {project.name}
                            </span>
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
                            <Badge
                              variant={
                                project.status === "active"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {project.status}
                            </Badge>
                          </div>
                        </div>

                        {project.description && (
                          <p className="text-xs text-muted-foreground">
                            {project.description}
                          </p>
                        )}

                        {project.estimatedHours &&
                          projectHours[project.id] && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>
                                  {projectHours[project.id]?.actual.toFixed(2)}h /{" "}
                                  {parseFloat(
                                    project.estimatedHours
                                  ).toFixed(2)}
                                  h
                                </span>
                                <span className="font-medium text-gold">
                                  {Math.round(
                                    ((projectHours[project.id]?.actual || 0) /
                                      parseFloat(project.estimatedHours)) *
                                      100
                                  )}
                                  %
                                </span>
                              </div>
                              <Progress
                                value={Math.min(
                                  100,
                                  ((projectHours[project.id]?.actual || 0) /
                                    parseFloat(project.estimatedHours)) *
                                    100
                                )}
                                className="h-1.5"
                              />
                            </div>
                          )}

                        {projectWithTeam?.teamMembers &&
                          projectWithTeam.teamMembers.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {projectWithTeam.teamMembers.map((member: any) => (
                                <Badge
                                  key={member.id}
                                  variant="outline"
                                  className={`${roleColors[member.role]} text-xs`}
                                >
                                  {member.user.firstName} {member.user.lastName}
                                </Badge>
                              ))}
                            </div>
                          )}

                        {project.tasks.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">
                                Tasks ({project.tasks.length})
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  openCreateTaskDialog(project)
                                }
                                className="h-6 px-2 text-xs"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            </div>
                            {project.tasks.map((task) => (
                              <div
                                key={task.id}
                                className="flex items-center gap-2 text-sm py-1.5 px-2 rounded bg-muted/50"
                              >
                                <CheckSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="flex-1 truncate text-xs">
                                  {task.name}
                                </span>
                                <StatusBadge status={task.status} />
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() =>
                                      openEditTaskDialog(task)
                                    }
                                    className="h-6 w-6"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      setTaskToDelete(task);
                                      setIsDeleteTaskDialogOpen(true);
                                    }}
                                    className="h-6 w-6 text-destructive"
                                  >
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
                        {projectWithTeam && (
                          <ProjectAttachments projectId={project.id} />
                        )}
                      </div>
                    );
                  })}

                  {selectedAccountData.unassignedTasks.length > 0 && (
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Non-Project Tasks (
                        {selectedAccountData.unassignedTasks.length})
                      </p>
                      {selectedAccountData.unassignedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 text-sm py-1.5 px-2 rounded bg-muted/50"
                        >
                          <CheckSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate text-xs">
                            {task.name}
                          </span>
                          <StatusBadge status={task.status} />
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditTaskDialog(task)}
                              className="h-6 w-6"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setTaskToDelete(task);
                                setIsDeleteTaskDialogOpen(true);
                              }}
                              className="h-6 w-6 text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <TabbedRichTextEditor accountId={selectedAccountData.id} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      <TaskFormDialog
        isOpen={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        mode={taskDialogMode}
        project={selectedProject}
        task={selectedTask}
        users={users}
      />

      {/* Create Client Dialog */}
      <Dialog
        open={isCreateClientDialogOpen}
        onOpenChange={setIsCreateClientDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
            <DialogDescription>
              Add a new client (agency) to your system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Client Name</Label>
              <Input
                id="client-name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Enter client name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-type">Type</Label>
              <Select
                value={newClientType}
                onValueChange={(v: "agency" | "direct") => setNewClientType(v)}
              >
                <SelectTrigger id="client-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agency</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-medium">Time Tracking Settings</h4>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="require-tracker"
                  checked={newClientRequireTimeTracker}
                  onCheckedChange={(c) =>
                    setNewClientRequireTimeTracker(c === true)
                  }
                />
                <Label htmlFor="require-tracker" className="text-sm font-normal">
                  Require confirmation that hours were logged in agency time
                  tracker
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking-system">Time Tracking System</Label>
                <Input
                  id="tracking-system"
                  value={newClientTimeTrackingSystem}
                  onChange={(e) => setNewClientTimeTrackingSystem(e.target.value)}
                  placeholder="e.g., Harvest, Clockify"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateClientDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newClientName.trim()) {
                  toast({
                    title: "Validation Error",
                    description: "Please enter a client name.",
                    variant: "destructive",
                  });
                  return;
                }
                createClientMutation.mutate({
                  name: newClientName.trim(),
                  type: newClientType,
                  requireTimeTrackerConfirmation:
                    newClientRequireTimeTracker,
                  timeTrackingSystem:
                    newClientTimeTrackingSystem.trim() || undefined,
                });
              }}
              disabled={createClientMutation.isPending}
            >
              {createClientMutation.isPending ? "Creating..." : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog
        open={isCreateAccountDialogOpen}
        onOpenChange={(open) => {
          if (!open) setAccountAgencyId(null);
          setIsCreateAccountDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Account</DialogTitle>
            <DialogDescription>
              Add an account under{" "}
              {agencies.find((a) => a.id === accountAgencyId)?.name}
            </DialogDescription>
          </DialogHeader>
          <Form {...accountForm}>
            <form
              onSubmit={accountForm.handleSubmit(handleCreateAccount)}
              className="space-y-4"
            >
              <FormField
                control={accountForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter account name"
                        {...field}
                      />
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
                        placeholder="Optional description"
                        {...field}
                        value={field.value || ""}
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
                        placeholder="Optional"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? e.target.value : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={accountForm.control}
                name="maxHoursPerWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Hours Per Week</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="Optional - cap hours per client per week"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? e.target.value : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateAccountDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAccountMutation.isPending}
                >
                  {createAccountMutation.isPending ? "Creating..." : "Create Account"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>


      {/* Create Project Dialog */}
      <Dialog
        open={isCreateProjectDialogOpen}
        onOpenChange={setIsCreateProjectDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Create a project for {selectedAccount?.name}
            </DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <form
              onSubmit={projectForm.handleSubmit(handleCreateProject)}
              className="space-y-4"
            >
              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} />
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
                      <Input
                        placeholder="Optional"
                        {...field}
                        value={field.value || ""}
                      />
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseFloat(e.target.value)
                                : undefined
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateProjectDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                >
                  {createProjectMutation.isPending
                    ? "Creating..."
                    : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog
        open={isEditProjectDialogOpen}
        onOpenChange={setIsEditProjectDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project {selectedProjectToEdit?.name}
            </DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <form
              onSubmit={projectForm.handleSubmit(handleUpdateProject)}
              className="space-y-4"
            >
              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} />
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
                      <Input
                        placeholder="Optional"
                        {...field}
                        value={field.value || ""}
                      />
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseFloat(e.target.value)
                                : undefined
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditProjectDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateProjectMutation.isPending}
                >
                  {updateProjectMutation.isPending
                    ? "Updating..."
                    : "Update Project"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteTaskDialogOpen}
        onOpenChange={setIsDeleteTaskDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{taskToDelete?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                taskToDelete && deleteTaskMutation.mutate(taskToDelete.id)
              }
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeleteAccountDialogOpen}
        onOpenChange={setIsDeleteAccountDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{accountToDelete?.name}"? This will delete all projects,
              tasks, and time logs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                accountToDelete &&
                deleteAccountMutation.mutate(accountToDelete.id)
              }
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
