import { useState, useMemo, type CSSProperties } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, Plus, MoreHorizontal, CheckCircle2, Circle, Clock, Building2, Users, FolderOpen, Timer, CheckCheck, Trash2, List, Kanban, Grid3X3, Edit, Check, ChevronsUpDown, Tag, Tags, UserPlus, X, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema } from "@shared/schema";
import type { Task, Agency, Account, InsertTask, Project, User, TaskLabel, InsertTaskLabel } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/PageHeader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TaskWithRelations } from "@shared/schema";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { RichTextEditor } from "@/components/RichTextEditor";

// Form schema for new task creation
const createTaskFormSchema = insertTaskSchema.extend({
  name: z.string().min(1, "Task name is required"),
  agencyId: z.string().optional(),
  accountId: z.string().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  collaboratorIds: z.array(z.string()).optional(),
});

type CreateTaskFormData = z.infer<typeof createTaskFormSchema>;

export default function Tasks() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("status");
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "this-week">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkPriority, setBulkPriority] = useState("medium");
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const [quickAccountPopoverOpen, setQuickAccountPopoverOpen] = useState(false);
  const [editAccountPopoverOpen, setEditAccountPopoverOpen] = useState(false);
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");
  const [addingTaskToColumn, setAddingTaskToColumn] = useState<string | null>(null);
  const [inlineTaskName, setInlineTaskName] = useState("");
  const [inlineTaskDescription, setInlineTaskDescription] = useState("");
  const [inlineTaskPriority, setInlineTaskPriority] = useState("medium");
  const [inlineTaskDueDate, setInlineTaskDueDate] = useState<Date | undefined>(undefined);
  const [createStartDateOpen, setCreateStartDateOpen] = useState(false);
  const [createDueDateOpen, setCreateDueDateOpen] = useState(false);
  const [editStartDateOpen, setEditStartDateOpen] = useState(false);
  const [editDueDateOpen, setEditDueDateOpen] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Form setup for new task
  const form = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: {
      name: "",
      description: "",
      notes: "",
      status: "todo",
      priority: "medium",
      size: "medium",
      assignedToUserId: undefined,
      projectId: undefined,
      agencyId: undefined,
      accountId: undefined,
      startDate: undefined,
      dueDate: undefined,
      isActive: true,
    },
  });


  // Mutation for updating task status
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { status?: string; size?: string; name?: string; description?: string | null; priority?: string; estimatedHours?: number | null; dueDate?: string | null } }) => {
      return await apiRequest(`/api/tasks/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task.",
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting task
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/tasks/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Success",
        description: "Task deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task.",
        variant: "destructive",
      });
    },
  });

  // Bulk operations mutations
  const bulkCompleteTasksMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      return await apiRequest("/api/tasks/bulk/complete", "POST", { taskIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSelectedTaskIds([]);
      toast({
        title: "Success",
        description: "Tasks marked as complete.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete tasks.",
        variant: "destructive",
      });
    },
  });

  const bulkUpdatePriorityMutation = useMutation({
    mutationFn: async ({ taskIds, priority }: { taskIds: string[]; priority: string }) => {
      return await apiRequest("/api/tasks/bulk/priority", "POST", { taskIds, priority });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSelectedTaskIds([]);
      toast({
        title: "Success",
        description: "Task priorities updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task priorities.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteTasksMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      return await apiRequest("/api/tasks/bulk/delete", "POST", { taskIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSelectedTaskIds([]);
      toast({
        title: "Success",
        description: "Tasks deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tasks.",
        variant: "destructive",
      });
    },
  });

  // Bulk selection helper functions
  const handleSelectAll = () => {
    setSelectedTaskIds(filteredTasks.map(task => task.id));
  };

  const handleClearSelection = () => {
    setSelectedTaskIds([]);
  };

  const handleTaskSelect = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(prev => {
        const newSet = new Set(prev);
        newSet.add(taskId);
        return Array.from(newSet);
      });
    } else {
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
    }
  };

  const handleBulkComplete = () => {
    if (selectedTaskIds.length === 0) return;
    if (window.confirm(`Mark ${selectedTaskIds.length} task(s) as complete?`)) {
      bulkCompleteTasksMutation.mutate(selectedTaskIds);
    }
  };

  const handleBulkPriorityUpdate = () => {
    if (selectedTaskIds.length === 0) return;
    if (window.confirm(`Change priority for ${selectedTaskIds.length} task(s) to ${bulkPriority}?`)) {
      bulkUpdatePriorityMutation.mutate({ taskIds: selectedTaskIds, priority: bulkPriority });
    }
  };

  const handleBulkDelete = () => {
    if (selectedTaskIds.length === 0) return;
    if (window.confirm(`Delete ${selectedTaskIds.length} task(s)? This action cannot be undone.`)) {
      bulkDeleteTasksMutation.mutate(selectedTaskIds);
    }
  };

  const handleMarkComplete = (taskId: string) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: { status: "complete" },
    });
  };

  const handleLogTime = (task: TaskWithRelations) => {
    // Navigate to time logging page with task pre-selected
    const params = new URLSearchParams({
      ...(task.agencyId && { agencyId: task.agencyId }),
      ...(task.accountId && { accountId: task.accountId }),
      ...(task.projectId && { projectId: task.projectId }),
      taskId: task.id,
    });
    setLocation(`/time-logging?${params.toString()}`);
  };

  const handleDeleteTask = (taskId: string, taskName: string) => {
    if (window.confirm(`Are you sure you want to delete the task "${taskName}"? This action cannot be undone.`)) {
      deleteTaskMutation.mutate(taskId);
    }
  };

  const handleUpdateTask = (taskId: string, field: string, value: any) => {
    const updateData: any = {};
    
    if (field === 'description' || field === 'estimatedHours') {
      updateData[field] = value || null;
    } else {
      updateData[field] = value;
    }

    updateTaskMutation.mutate({
      id: taskId,
      data: updateData,
    });
  };

  // Fetch tasks from API
  const { data: tasks = [], isLoading } = useQuery<TaskWithRelations[]>({
    queryKey: ["/api/tasks"]
  });

  // Fetch agencies for dropdown
  const { data: agencies = [] } = useQuery<Agency[]>({
    queryKey: ["/api/clients"]
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"]
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"]
  });

  // Fetch all labels
  const { data: allLabels = [] } = useQuery<TaskLabel[]>({
    queryKey: ["/api/task-labels"]
  });

  // Fetch labels for editing task (when edit sheet is open)
  const { data: editTaskLabels = [] } = useQuery<TaskLabel[]>({
    queryKey: ["/api/tasks", editingTask?.id, "labels"],
    enabled: !!editingTask
  });

  // Fetch collaborators for editing task (when edit sheet is open)
  const { data: editTaskCollaborators = [] } = useQuery<User[]>({
    queryKey: ["/api/tasks", editingTask?.id, "collaborators"],
    enabled: !!editingTask
  });

  // Create label mutation
  const createLabelMutation = useMutation({
    mutationFn: async (data: InsertTaskLabel) => {
      return await apiRequest("/api/task-labels", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-labels"] });
      setNewLabelName("");
      setNewLabelColor("#3b82f6");
      setIsLabelDialogOpen(false);
      toast({
        title: "Success",
        description: "Label created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create label.",
        variant: "destructive",
      });
    },
  });

  // Assign label to task mutation
  const assignLabelMutation = useMutation({
    mutationFn: async ({ taskId, labelId }: { taskId: string; labelId: string }) => {
      return await apiRequest(`/api/tasks/${taskId}/labels/${labelId}`, "POST");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.taskId, "labels"] });
      toast({
        title: "Success",
        description: "Label added to task.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add label.",
        variant: "destructive",
      });
    },
  });

  // Remove label from task mutation
  const removeLabelMutation = useMutation({
    mutationFn: async ({ taskId, labelId }: { taskId: string; labelId: string }) => {
      return await apiRequest(`/api/tasks/${taskId}/labels/${labelId}`, "DELETE");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.taskId, "labels"] });
      toast({
        title: "Success",
        description: "Label removed from task.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove label.",
        variant: "destructive",
      });
    },
  });

  // Add collaborator to task mutation
  const addCollaboratorMutation = useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string }) => {
      return await apiRequest(`/api/tasks/${taskId}/collaborators/${userId}`, "POST");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.taskId, "collaborators"] });
      toast({
        title: "Success",
        description: "Collaborator added to task.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add collaborator.",
        variant: "destructive",
      });
    },
  });

  // Remove collaborator from task mutation
  const removeCollaboratorMutation = useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string }) => {
      return await apiRequest(`/api/tasks/${taskId}/collaborators/${userId}`, "DELETE");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.taskId, "collaborators"] });
      toast({
        title: "Success",
        description: "Collaborator removed from task.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove collaborator.",
        variant: "destructive",
      });
    },
  });

  // Fetch accounts for filter dropdown (cascading based on agency filter)
  const { data: filterAccounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts/by-agency", agencyFilter],
    enabled: agencyFilter !== "all"
  });

  // Handler for agency filter change
  const handleAgencyFilterChange = (value: string) => {
    setAgencyFilter(value);
    setAccountFilter("all"); // Reset account filter when agency changes
  };

  // Watch form changes for cascading dropdowns - Main form
  const watchedAgencyId = form.watch("agencyId");
  const watchedAccountId = form.watch("accountId");

  // Fetch accounts based on selected agency - Main form
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts/by-agency", watchedAgencyId],
    enabled: !!watchedAgencyId
  });

  // Sort accounts alphabetically
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts]);

  // Fetch projects based on selected account - Main form
  const { data: formProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects/by-account", watchedAccountId],
    enabled: !!watchedAccountId
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: CreateTaskFormData) => {
      return await apiRequest("/api/tasks", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsCreateDialogOpen(false);
      setCreateDueDateOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Task created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task.",
        variant: "destructive",
      });
    },
  });


  // Form handlers
  const handleCreateTask = (data: CreateTaskFormData) => {
    createTaskMutation.mutate(data);
  };


  const handleAgencyChange = (agencyId: string) => {
    form.setValue("agencyId", agencyId);
    form.setValue("accountId", ""); // Reset dependent fields
    form.setValue("projectId", undefined);
  };

  const handleAccountChange = (accountId: string) => {
    form.setValue("accountId", accountId);
    form.setValue("projectId", undefined); // Reset dependent field
  };

  // Inline task creation handler
  const handleInlineTaskCreate = (size: string) => {
    if (!inlineTaskName.trim()) return;
    
    createTaskMutation.mutate({
      name: inlineTaskName,
      description: inlineTaskDescription.trim() || undefined,
      size,
      status: "todo",
      priority: inlineTaskPriority,
      dueDate: inlineTaskDueDate ? format(inlineTaskDueDate, "yyyy-MM-dd") : undefined,
      isActive: true,
    });
    
    setInlineTaskName("");
    setInlineTaskDescription("");
    setInlineTaskPriority("medium");
    setInlineTaskDueDate(undefined);
    setAddingTaskToColumn(null);
  };

  // Edit Task form setup
  const editForm = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "todo",
      priority: "medium",
      size: "medium",
      category: "standard",
      billingType: "billable",
      estimatedHours: undefined,
      agencyId: "",
      accountId: "",
      projectId: undefined,
      startDate: undefined,
      dueDate: undefined
    }
  });

  const editWatchedAgencyId = editForm.watch("agencyId");
  const editWatchedAccountId = editForm.watch("accountId");

  // Fetch accounts for edit form based on selected agency
  const { data: editAccounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts/by-agency", editWatchedAgencyId],
    enabled: !!editWatchedAgencyId && isEditSheetOpen
  });

  // Sort edit accounts alphabetically
  const sortedEditAccounts = useMemo(() => {
    return [...editAccounts].sort((a, b) => a.name.localeCompare(b.name));
  }, [editAccounts]);

  // Fetch projects for edit form based on selected account
  const { data: editProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects/by-account", editWatchedAccountId],
    enabled: !!editWatchedAccountId && isEditSheetOpen
  });

  // Edit task mutation
  const editTaskMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<TaskWithRelations> }) => {
      return await apiRequest(`/api/tasks/${data.id}`, "PATCH", data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsEditSheetOpen(false);
      setEditingTask(null);
      setEditDueDateOpen(false);
      editForm.reset();
      toast({
        title: "Success",
        description: "Task updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task.",
        variant: "destructive",
      });
    },
  });

  // Edit handlers
  const handleEditTask = (task: TaskWithRelations) => {
    setEditingTask(task);
    editForm.reset({
      name: task.name,
      description: task.description || "",
      notes: task.notes || "",
      status: task.status,
      priority: task.priority,
      size: task.size || "medium",
      category: task.category || "standard",
      billingType: task.billingType || "billable",
      estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : undefined,
      agencyId: task.agencyId || undefined,
      accountId: task.accountId || undefined,
      projectId: task.projectId || undefined,
      assignedToUserId: task.assignedToUserId || undefined,
      startDate: task.startDate || undefined,
      dueDate: task.dueDate || undefined
    });
    setIsEditSheetOpen(true);
  };

  const handleEditTaskSubmit = (data: CreateTaskFormData) => {
    if (!editingTask) return;
    // Get current label and collaborator IDs from the task
    const labelIds = editTaskLabels.map(label => label.id);
    const collaboratorIds = editTaskCollaborators.map(user => user.id);
    
    // Convert form data to match Task type structure (Partial allows undefined)
    const updates: Partial<TaskWithRelations> & { labelIds?: string[]; collaboratorIds?: string[] } = {
      name: data.name,
      description: data.description || undefined,
      notes: data.notes || undefined,
      status: data.status,
      priority: data.priority,
      size: data.size || "medium",
      category: data.category || undefined,
      billingType: data.billingType,
      estimatedHours: data.estimatedHours !== undefined ? String(data.estimatedHours) : undefined,
      agencyId: data.agencyId,
      accountId: data.accountId,
      projectId: data.projectId || undefined,
      assignedToUserId: data.assignedToUserId || undefined,
      startDate: data.startDate || undefined,
      dueDate: data.dueDate || undefined,
      isActive: data.isActive,
      labelIds,
      collaboratorIds
    };
    editTaskMutation.mutate({
      id: editingTask.id,
      updates
    });
  };

  const handleEditAgencyChange = (agencyId: string) => {
    editForm.setValue("agencyId", agencyId);
    editForm.setValue("accountId", ""); // Reset dependent fields
    editForm.setValue("projectId", undefined);
  };

  const handleEditAccountChange = (accountId: string) => {
    editForm.setValue("accountId", accountId);
    editForm.setValue("projectId", undefined); // Reset dependent field
  };

  // Board View Components

  const TaskCard = ({ task }: { task: TaskWithRelations }) => {
    const getPriorityColor = (priority: string) => {
      const colors = {
        low: "default" as const,
        medium: "secondary" as const,
        high: "destructive" as const,
        urgent: "destructive" as const
      };
      return colors[priority as keyof typeof colors] || "default";
    };

    return (
      <div
        className="bg-card border rounded-lg p-3 hover-elevate active-elevate-2 transition-colors"
        data-testid={`board-task-card-${task.id}`}
      >
        <div 
          className="space-y-2 cursor-pointer"
          onClick={(e) => {
            // Only open modal if not clicking on interactive elements
            const target = e.target as HTMLElement;
            if (!target.closest('button, input')) {
              handleEditTask(task);
            }
          }}
        >
          <div className="flex items-start gap-2">
            <Checkbox
              checked={selectedTaskIds.includes(task.id)}
              onCheckedChange={(checked) => handleTaskSelect(task.id, !!checked)}
              data-testid={`checkbox-board-task-${task.id}`}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="font-medium text-sm flex-1">{task.name}</div>
          </div>
          {task.description && (
            <div className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <StatusBadge status={task.status} className="text-[10px] py-0 px-1.5" />
            <div className="flex items-center gap-1">
              <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                {task.priority}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {task.startDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarIcon className="h-3 w-3" />
                {format(new Date(task.startDate + "T00:00:00"), "MMM d")}
                {task.dueDate && ` - ${format(new Date(task.dueDate + "T00:00:00"), "MMM d")}`}
              </div>
            )}
            {!task.startDate && task.dueDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarIcon className="h-3 w-3" />
                Due {format(new Date(task.dueDate + "T00:00:00"), "MMM d, yyyy")}
              </div>
            )}
            {task.estimatedHours && (
              <div className="text-xs text-muted-foreground">
                Est: {Number(task.estimatedHours)}h
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                {task.account?.name}
              </div>
              {task.assignedToUser && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {task.assignedToUser.firstName} {task.assignedToUser.lastName}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditTask(task);
                }}
                data-testid={`button-edit-card-${task.id}`}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTask(task.id, task.name);
                }}
                data-testid={`button-delete-card-${task.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const BoardColumn = ({ 
    status, 
    title, 
    tasks, 
    icon: Icon 
  }: { 
    status: string;
    title: string;
    tasks: TaskWithRelations[];
    icon: React.ComponentType<{ className?: string }>;
  }) => {
    const isAdding = addingTaskToColumn === status;

    return (
      <div className="flex flex-col min-h-[500px] w-80 bg-muted/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{title}</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {tasks.length}
          </Badge>
        </div>

        {/* Inline Add Task - Moved to top */}
        <div className="mb-3">
          {isAdding ? (
            <div className="space-y-2 bg-card rounded-lg p-3 border">
              <Input
                value={inlineTaskName}
                onChange={(e) => setInlineTaskName(e.target.value)}
                placeholder="Task name"
                autoFocus
                className="border-primary focus-visible:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inlineTaskName.trim()) {
                    handleInlineTaskCreate(status);
                  } else if (e.key === 'Escape') {
                    setAddingTaskToColumn(null);
                    setInlineTaskName("");
                  }
                }}
                data-testid={`input-inline-task-${status}`}
              />
              <Textarea
                placeholder="Description (optional)"
                className="text-sm min-h-[60px] resize-none"
                value={inlineTaskDescription}
                onChange={(e) => setInlineTaskDescription(e.target.value)}
                data-testid={`textarea-inline-task-description-${status}`}
              />
              <div className="flex flex-wrap gap-2">
                <Select value={inlineTaskPriority} onValueChange={setInlineTaskPriority}>
                  <SelectTrigger className="h-8 w-[110px]" data-testid={`select-inline-priority-${status}`}>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <CalendarIcon className="h-3 w-3 mr-2" />
                      {inlineTaskDueDate ? format(inlineTaskDueDate, "MMM d, yyyy") : "Deadline"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={inlineTaskDueDate}
                      onSelect={(date) => setInlineTaskDueDate(date)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => handleInlineTaskCreate(status)}
                  disabled={!inlineTaskName.trim() || createTaskMutation.isPending}
                  data-testid={`button-inline-task-submit-${status}`}
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingTaskToColumn(null);
                    setInlineTaskName("");
                    setInlineTaskDescription("");
                    setInlineTaskPriority("medium");
                    setInlineTaskDueDate(undefined);
                  }}
                  data-testid={`button-inline-task-cancel-${status}`}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => setAddingTaskToColumn(status)}
              data-testid={`button-add-task-${status}`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add task
            </Button>
          )}
        </div>
        
        <div 
          className="flex-1 space-y-3"
          data-status={status}
          data-testid={`board-column-${status}`}
        >
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>
    );
  };

  // Render Board View
  const renderBoardView = () => {
    const groupedTasks = filteredTasks.reduce((groups, task) => {
      const size = task.size || "medium";
      if (!groups[size]) {
        groups[size] = [];
      }
      groups[size].push(task);
      return groups;
    }, {} as Record<string, typeof filteredTasks>);

    const columns = [
      { 
        status: "small", 
        title: "Small", 
        tasks: groupedTasks["small"] || [], 
        icon: Circle 
      },
      { 
        status: "medium", 
        title: "Medium", 
        tasks: groupedTasks["medium"] || [], 
        icon: Clock 
      },
      { 
        status: "large", 
        title: "Large", 
        tasks: groupedTasks["large"] || [], 
        icon: Timer 
      },
      { 
        status: "xlarge", 
        title: "X-Large", 
        tasks: groupedTasks["xlarge"] || [], 
        icon: CheckCircle2 
      }
    ];

    return (
      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map(column => (
          <div key={column.status} id={column.status}>
            <BoardColumn {...column} />
          </div>
        ))}
      </div>
    );
  };

  // Enhanced grouped view renderer with dynamic grouping
  const renderGroupedView = () => {
    const getGroupKey = (task: TaskWithRelations) => {
      switch (groupBy) {
        case "priority":
          return task.priority || "medium";
        case "assignee":
          return task.assignedToUserId || "unassigned";
        case "project":
          return task.projectId || "no-project";
        case "status":
        default:
          return task.status || "todo";
      }
    };

    const getGroupLabel = (key: string) => {
      switch (groupBy) {
        case "priority":
          const priorityLabels = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" };
          return priorityLabels[key as keyof typeof priorityLabels] || key;
        case "assignee":
          if (key === "unassigned") return "Unassigned";
          const user = users.find(u => u.id === key);
          return user ? `${user.firstName} ${user.lastName}` : "Unknown User";
        case "project":
          if (key === "no-project") return "No Project";
          const project = allProjects.find(p => p.id === key);
          return project?.name || "Unknown Project";
        case "status":
        default:
          const statusLabels: Record<string, string> = { todo: "To Do", in_progress: "In Progress", waiting_on_client: "Waiting on Client", waiting_on_internal_review: "Waiting on Internal Review", complete: "Complete", cancelled: "Cancelled" };
          return statusLabels[key] || key;
      }
    };

    const getGroupIcon = (key: string) => {
      switch (groupBy) {
        case "priority":
          return Clock;
        case "assignee":
          return Users;
        case "project":
          return FolderOpen;
        case "status":
        default:
          const statusIcons: Record<string, any> = { todo: Circle, in_progress: Clock, waiting_on_client: Timer, waiting_on_internal_review: Timer, complete: CheckCircle2, cancelled: Trash2 };
          return statusIcons[key] || Circle;
      }
    };

    const getGroupOrder = () => {
      switch (groupBy) {
        case "priority":
          return ["urgent", "high", "medium", "low"];
        case "assignee":
          return ["unassigned", ...users.map(u => u.id)];
        case "project":
          return ["no-project", ...allProjects.map(p => p.id)];
        case "status":
        default:
          return ["todo", "in_progress", "waiting_on_client", "waiting_on_internal_review", "complete", "cancelled"];
      }
    };

    const groupedTasks = filteredTasks.reduce((groups, task) => {
      const groupKey = getGroupKey(task);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
      return groups;
    }, {} as Record<string, typeof filteredTasks>);

    const groupOrder = getGroupOrder();

    return (
      <Accordion type="multiple" defaultValue={groupOrder} className="w-full space-y-2">
        {groupOrder.map(groupKey => {
          const tasks = groupedTasks[groupKey] || [];
          const GroupIcon = getGroupIcon(groupKey);
          
          return (
            <AccordionItem key={groupKey} value={groupKey} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <GroupIcon className="h-4 w-4" />
                  <span className="font-medium">{getGroupLabel(groupKey)}</span>
                  <Badge variant="secondary">{tasks.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2">
                  {tasks.map(task => (
                    <Card key={task.id} className="p-3 hover-elevate">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <Checkbox
                            checked={selectedTaskIds.includes(task.id)}
                            onCheckedChange={(checked) => handleTaskSelect(task.id, !!checked)}
                            data-testid={`checkbox-grouped-task-${task.id}`}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-1">
                            <h4 className="font-medium">{task.name}</h4>
                            {task.description && (
                              <p className="text-sm text-muted-foreground">{task.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              <span>{task.agency?.name}</span>
                              <Users className="h-3 w-3 ml-2" />
                              <span>{task.account?.name}</span>
                              {task.project && (
                                <>
                                  <FolderOpen className="h-3 w-3 ml-2" />
                                  <span>{task.project.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={task.status} />
                          <Badge variant={task.billingType === 'prebilled' ? 'outline' : 'secondary'} className="text-xs">
                            {task.billingType === 'prebilled' ? 'Pre-billed' : 'Billable'}
                          </Badge>
                          <Badge variant={
                            task.priority === "urgent" ? "destructive" :
                            task.priority === "high" ? "default" :
                            task.priority === "medium" ? "secondary" : "outline"
                          }>
                            {task.priority}
                          </Badge>
                          {task.estimatedHours && (
                            <Badge variant="outline" className="text-xs">
                              {task.estimatedHours}h
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTask(task)}
                            data-testid={`button-edit-grouped-${task.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/time-logging?taskId=${task.id}&agencyId=${task.agencyId}&accountId=${task.accountId}&projectId=${task.projectId || ""}`)}
                            data-testid={`button-log-time-${task.id}`}
                          >
                            <Timer className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteTask(task.id, task.name)}
                            data-testid={`button-delete-grouped-${task.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {tasks.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No tasks in {getGroupLabel(groupKey).toLowerCase()}
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "in_progress":
      case "in-progress": return <Clock className="h-4 w-4 text-blue-600" />;
      case "waiting_on_client": return <Timer className="h-4 w-4 text-amber-500" />;
      case "waiting_on_internal_review": return <Timer className="h-4 w-4 text-blue-500" />;
      case "cancelled": return <Circle className="h-4 w-4 text-red-600" />;
      case "todo": return <Circle className="h-4 w-4 text-gray-400" />;
      default: return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string): { style: CSSProperties } => {
    switch (status) {
      case "complete":
      case "completed": 
        return { 
          style: {
            background: "linear-gradient(135deg, #00ff00 0%, #00cc00 100%)" as any,
            color: "#000000" as any,
            border: "5px solid #00ff00" as any,
            fontWeight: "900" as any,
            padding: "8px 16px" as any,
            borderRadius: "8px" as any,
            textShadow: "0 0 10px #00ff00" as any,
            boxShadow: "0 0 20px #00ff00" as any
          }
        };
      case "in_progress":
      case "in-progress":
      case "active":
        return { 
          style: {
            background: "linear-gradient(135deg, #ff0000 0%, #cc0000 100%)" as any,
            color: "#ffffff" as any,
            border: "5px solid #ff0000" as any,
            fontWeight: "900" as any,
            padding: "8px 16px" as any,
            borderRadius: "8px" as any,
            textShadow: "0 0 10px #ff0000" as any,
            boxShadow: "0 0 20px #ff0000" as any
          }
        };
      case "waiting_on_client":
        return { 
          style: {
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" as any,
            color: "#000000" as any,
            border: "5px solid #f59e0b" as any,
            fontWeight: "900" as any,
            padding: "8px 16px" as any,
            borderRadius: "8px" as any,
            textShadow: "0 0 10px #f59e0b" as any,
            boxShadow: "0 0 20px #f59e0b" as any
          }
        };
      case "waiting_on_internal_review":
        return { 
          style: {
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" as any,
            color: "#ffffff" as any,
            border: "5px solid #3b82f6" as any,
            fontWeight: "900" as any,
            padding: "8px 16px" as any,
            borderRadius: "8px" as any,
            textShadow: "0 0 10px #3b82f6" as any,
            boxShadow: "0 0 20px #3b82f6" as any
          }
        };
      case "cancelled": 
        return { 
          style: {
            background: "linear-gradient(135deg, #666666 0%, #333333 100%)" as any,
            color: "#ffffff" as any,
            border: "5px solid #ff0000" as any,
            fontWeight: "900" as any,
            padding: "8px 16px" as any,
            borderRadius: "8px" as any,
            textShadow: "0 0 10px #ff0000" as any,
            boxShadow: "0 0 20px #666666" as any
          }
        };
      case "todo": 
        return { 
          style: {
            background: "linear-gradient(135deg, #ffff00 0%, #ffcc00 100%)" as any,
            color: "#000000" as any,
            border: "5px solid #ffff00" as any,
            fontWeight: "900" as any,
            padding: "8px 16px" as any,
            borderRadius: "8px" as any,
            textShadow: "0 0 10px #ffff00" as any,
            boxShadow: "0 0 20px #ffff00" as any
          }
        };
      default: 
        return { 
          style: {
            background: "linear-gradient(135deg, #ff00ff 0%, #cc00cc 100%)" as any,
            color: "#ffffff" as any,
            border: "5px solid #ff00ff" as any,
            fontWeight: "900" as any,
            padding: "8px 16px" as any,
            borderRadius: "8px" as any,
            textShadow: "0 0 10px #ff00ff" as any,
            boxShadow: "0 0 20px #ff00ff" as any
          }
        };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.account?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.agency?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.project?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    const matchesAgency = agencyFilter === "all" || task.agencyId === agencyFilter;
    const matchesAccount = accountFilter === "all" || task.accountId === accountFilter;
    
    const matchesProject = projectFilter === "all" || 
      (projectFilter === "no-project" && !task.projectId) ||
      task.projectId === projectFilter;
    
    const matchesAssignee = assigneeFilter === "all" || 
      (assigneeFilter === "unassigned" && !task.assignedToUserId) ||
      task.assignedToUserId === assigneeFilter;
    
    // Date filter logic
    let matchesDate = true;
    if (dateFilter !== "all" && task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dateFilter === "today") {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        matchesDate = dueDate >= today && dueDate < tomorrow;
      } else if (dateFilter === "this-week") {
        const endOfWeek = new Date(today);
        endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);
        matchesDate = dueDate >= today && dueDate <= endOfWeek;
      }
    } else if (dateFilter !== "all" && !task.dueDate) {
      matchesDate = false;
    }
    
    return matchesSearch && matchesStatus && matchesPriority && 
           matchesAgency && matchesAccount && matchesProject && matchesAssignee && matchesDate;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tasks" description="Loading tasks..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Manage and track individual tasks across projects"
        actions={
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-new-task">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        }
      />
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) setCreateDueDateOpen(false); }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                Add a new task to track work and progress.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateTask)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter task name..." {...field} data-testid="input-new-task-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agencyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agency *</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value} 
                          onValueChange={handleAgencyChange}
                        >
                          <SelectTrigger data-testid="select-new-task-agency">
                            <SelectValue placeholder="Select agency..." />
                          </SelectTrigger>
                          <SelectContent>
                            {agencies.filter(a => a.isActive).map((agency) => (
                              <SelectItem key={agency.id} value={agency.id}>
                                {agency.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account *</FormLabel>
                      <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={accountPopoverOpen}
                              disabled={!watchedAgencyId}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="select-new-task-account"
                            >
                              {field.value
                                ? sortedAccounts.find((account) => account.id === field.value)?.name
                                : !watchedAgencyId ? "Select agency first..." : "Select account..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0">
                          <Command>
                            <CommandInput placeholder="Search accounts..." />
                            <CommandList>
                              <CommandEmpty>No account found.</CommandEmpty>
                              <CommandGroup>
                                {sortedAccounts.map((account) => (
                                  <CommandItem
                                    key={account.id}
                                    value={account.name}
                                    onSelect={() => {
                                      handleAccountChange(account.id);
                                      setAccountPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        account.id === field.value ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {account.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project (Optional)</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value || "none"} 
                          onValueChange={(value) => form.setValue("projectId", value === "none" ? undefined : value)}
                          disabled={!watchedAccountId}
                        >
                          <SelectTrigger data-testid="select-new-task-project">
                            <SelectValue placeholder={!watchedAccountId ? "Select account first..." : "Select project (optional)..."} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No project</SelectItem>
                            {formProjects.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assignedToUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To (Optional)</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value || "none"} 
                          onValueChange={(value) => form.setValue("assignedToUserId", value === "none" ? undefined : value)}
                        >
                          <SelectTrigger data-testid="select-new-task-user">
                            <SelectValue placeholder="Select user (optional)..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date (Optional)</FormLabel>
                        <Popover open={createStartDateOpen} onOpenChange={setCreateStartDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-new-task-start-date"
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => {
                                field.onChange(date ? format(date, "yyyy-MM-dd") : undefined);
                                setCreateStartDateOpen(false);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Due Date (Optional)</FormLabel>
                        <Popover open={createDueDateOpen} onOpenChange={setCreateDueDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-new-task-due-date"
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => {
                                field.onChange(date ? format(date, "yyyy-MM-dd") : undefined);
                                setCreateDueDateOpen(false);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger data-testid="select-new-task-priority">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Size</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger data-testid="select-new-task-size">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                              <SelectItem value="xlarge">X-Large</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          content={field.value || ""}
                          onChange={field.onChange}
                          placeholder="Add notes..."
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
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-new-task"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createTaskMutation.isPending}
                    data-testid="button-submit-new-task"
                  >
                    {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
      </Dialog>

      {/* Quick Date Filters */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={dateFilter === "today" ? "default" : "outline"}
          size="sm"
          onClick={() => setDateFilter(dateFilter === "today" ? "all" : "today")}
          data-testid="button-filter-due-today"
        >
          <CalendarIcon className="h-4 w-4 mr-2" />
          Due Today
        </Button>
        <Button
          variant={dateFilter === "this-week" ? "default" : "outline"}
          size="sm"
          onClick={() => setDateFilter(dateFilter === "this-week" ? "all" : "this-week")}
          data-testid="button-filter-due-this-week"
        >
          <CalendarIcon className="h-4 w-4 mr-2" />
          Due This Week
        </Button>
        {dateFilter !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDateFilter("all")}
            data-testid="button-clear-date-filter"
          >
            <X className="h-4 w-4 mr-1" />
            Clear Date Filter
          </Button>
        )}
      </div>

      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-tasks"
          />
        </div>
        <Select value={agencyFilter} onValueChange={handleAgencyFilterChange}>
          <SelectTrigger className="w-[180px]" data-testid="select-agency-filter">
            <SelectValue placeholder="Filter by agency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agencies</SelectItem>
            {agencies.filter(a => a.isActive).map((agency) => (
              <SelectItem key={agency.id} value={agency.id}>
                {agency.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={accountFilter} onValueChange={setAccountFilter} disabled={agencyFilter === "all"}>
          <SelectTrigger className="w-[180px]" data-testid="select-account-filter">
            <SelectValue placeholder={agencyFilter === "all" ? "Select agency first" : "Filter by account"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {filterAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="waiting_on_client">Waiting on Client</SelectItem>
            <SelectItem value="waiting_on_internal_review">Waiting on Internal Review</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-priority-filter">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-project-filter">
            <SelectValue placeholder="Filter by project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            <SelectItem value="no-project">No Project</SelectItem>
            {allProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-assignee-filter">
            <SelectValue placeholder="Filter by assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.firstName} {user.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="w-[180px]" data-testid="select-group-by">
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Group by Status</SelectItem>
            <SelectItem value="priority">Group by Priority</SelectItem>
            <SelectItem value="assignee">Group by Assignee</SelectItem>
            <SelectItem value="project">Group by Project</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Global Bulk Actions - visible in all view modes */}
      {selectedTaskIds.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted/50 border rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{selectedTaskIds.length}</span>
            <span>task{selectedTaskIds.length === 1 ? '' : 's'} selected</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleBulkComplete}
              disabled={bulkCompleteTasksMutation.isPending}
              data-testid="button-bulk-complete"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark Complete
            </Button>
            
            <div className="flex items-center gap-2">
              <Select value={bulkPriority} onValueChange={setBulkPriority}>
                <SelectTrigger className="w-[120px]" data-testid="select-bulk-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkPriorityUpdate}
                disabled={bulkUpdatePriorityMutation.isPending}
                data-testid="button-bulk-priority"
              >
                Update Priority
              </Button>
            </div>
            
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteTasksMutation.isPending}
              data-testid="button-bulk-delete"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearSelection}
              data-testid="button-clear-selection"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="board" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="board" className="flex items-center gap-2">
            <Kanban className="h-4 w-4" />
            Board
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            All
          </TabsTrigger>
        </TabsList>

        {/* Board View - Kanban Board */}
        <TabsContent value="board" className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            Drag and drop tasks between columns to update their status
          </div>
          {renderBoardView()}
        </TabsContent>

        {/* All View - Current Table */}
        <TabsContent value="all" className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            Complete list of all tasks with inline editing
          </div>
          
          
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedTaskIds.length === filteredTasks.length && filteredTasks.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleSelectAll();
                        } else {
                          handleClearSelection();
                        }
                      }}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Task Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Agency/Account</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Billing Type</TableHead>
                  <TableHead className="text-right">Est. Hours</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground h-24">
                  {searchQuery || statusFilter !== "all" || priorityFilter !== "all" || agencyFilter !== "all" || accountFilter !== "all" ? 
                    "No tasks found matching your filters." : 
                    "No tasks available."}
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map((task) => (
                <TableRow 
                  key={task.id} 
                  className="hover-elevate cursor-pointer" 
                  data-testid={`task-row-${task.id}`}
                  onClick={(e) => {
                    // Don't open if clicking on interactive elements
                    const target = e.target as HTMLElement;
                    if (!target.closest('button, input, select, [role="combobox"]')) {
                      handleEditTask(task);
                    }
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedTaskIds.includes(task.id)}
                      onCheckedChange={(checked) => handleTaskSelect(task.id, !!checked)}
                      data-testid={`checkbox-task-${task.id}`}
                    />
                  </TableCell>
                  <TableCell className="min-w-[200px]">
                    <div className="font-medium" data-testid={`text-task-name-${task.id}`}>
                      {task.name}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[250px]">
                    <div className="text-sm text-muted-foreground" data-testid={`text-task-description-${task.id}`}>
                      {task.description || "No description"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {task.agency?.name || "N/A"}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {task.account?.name || "N/A"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.project ? (
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        {task.project.name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={task.status}
                      onValueChange={(value) => handleUpdateTask(task.id, 'status', value)}
                    >
                      <SelectTrigger className="w-[130px] border-none bg-transparent focus:ring-1 focus:ring-ring" data-testid={`select-task-status-${task.id}`}>
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(task.status)}
                            <StatusBadge status={task.status} />
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">
                          <div className="flex items-center gap-2">
                            <Circle className="h-4 w-4 text-gray-400" />
                            To Do
                          </div>
                        </SelectItem>
                        <SelectItem value="in_progress">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            In Progress
                          </div>
                        </SelectItem>
                        <SelectItem value="waiting_on_client">
                          <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-amber-500" />
                            Waiting on Client
                          </div>
                        </SelectItem>
                        <SelectItem value="waiting_on_internal_review">
                          <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-blue-500" />
                            Waiting on Internal Review
                          </div>
                        </SelectItem>
                        <SelectItem value="complete">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Complete
                          </div>
                        </SelectItem>
                        <SelectItem value="cancelled">
                          <div className="flex items-center gap-2">
                            <Circle className="h-4 w-4 text-red-600" />
                            Cancelled
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={task.priority}
                      onValueChange={(value) => handleUpdateTask(task.id, 'priority', value)}
                    >
                      <SelectTrigger className="w-[100px] border-none bg-transparent focus:ring-1 focus:ring-ring" data-testid={`select-task-priority-${task.id}`}>
                        <SelectValue>
                          <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={task.billingType === 'prebilled' ? 'outline' : 'secondary'} className="text-xs">
                      {task.billingType === 'prebilled' ? 'Pre-billed' : 'Billable'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm" data-testid={`text-estimated-hours-${task.id}`}>
                      {task.estimatedHours ? `${Number(task.estimatedHours)}h` : "-"}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-task-menu-${task.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleEditTask(task)}
                          data-testid={`menu-edit-${task.id}`}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleLogTime(task)}
                          data-testid={`menu-log-time-${task.id}`}
                        >
                          <Timer className="h-4 w-4 mr-2" />
                          Log Time
                        </DropdownMenuItem>
                        {task.status !== "complete" && task.status !== "completed" && (
                          <DropdownMenuItem 
                            onClick={() => handleMarkComplete(task.id)}
                            disabled={updateTaskMutation.isPending || deleteTaskMutation.isPending}
                            data-testid={`menu-mark-complete-${task.id}`}
                          >
                            <CheckCheck className="h-4 w-4 mr-2" />
                            Mark Complete
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-destructive" 
                          onClick={() => handleDeleteTask(task.id, task.name)}
                          disabled={updateTaskMutation.isPending || deleteTaskMutation.isPending}
                          data-testid={`menu-delete-${task.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Task Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent side="right" className="w-[500px] sm:w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Task</SheetTitle>
            <SheetDescription>
              Make changes to your task here. Click save when you're done.
            </SheetDescription>
          </SheetHeader>
          
          {editingTask && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditTaskSubmit)} className="space-y-6 mt-6 pb-6">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter task name..." {...field} data-testid="input-edit-task-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter task description..."
                          {...field}
                          value={field.value || ""}
                          rows={3}
                          data-testid="textarea-edit-task-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger data-testid="select-edit-task-status">
                            <SelectValue placeholder="Select status..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="waiting_on_client">Waiting on Client</SelectItem>
                            <SelectItem value="waiting_on_internal_review">Waiting on Internal Review</SelectItem>
                            <SelectItem value="complete">Complete</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="agencyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agency</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={handleEditAgencyChange}
                        >
                          <SelectTrigger data-testid="select-edit-task-agency">
                            <SelectValue placeholder="Select agency..." />
                          </SelectTrigger>
                          <SelectContent>
                            {agencies.filter(a => a.isActive).map((agency) => (
                              <SelectItem key={agency.id} value={agency.id}>
                                {agency.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account</FormLabel>
                      <Popover open={editAccountPopoverOpen} onOpenChange={setEditAccountPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={editAccountPopoverOpen}
                              disabled={!editWatchedAgencyId}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="select-edit-task-account"
                            >
                              {field.value
                                ? sortedEditAccounts.find((account) => account.id === field.value)?.name
                                : !editWatchedAgencyId ? "Select agency first..." : "Select account..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0">
                          <Command>
                            <CommandInput placeholder="Search accounts..." />
                            <CommandList>
                              <CommandEmpty>No account found.</CommandEmpty>
                              <CommandGroup>
                                {sortedEditAccounts.map((account) => (
                                  <CommandItem
                                    key={account.id}
                                    value={account.name}
                                    onSelect={() => {
                                      handleEditAccountChange(account.id);
                                      setEditAccountPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        account.id === field.value ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {account.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project (Optional)</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value || "none"} 
                          onValueChange={(value) => editForm.setValue("projectId", value === "none" ? undefined : value)}
                          disabled={!editWatchedAccountId}
                        >
                          <SelectTrigger data-testid="select-edit-task-project">
                            <SelectValue placeholder={!editWatchedAccountId ? "Select account first..." : "Select project (optional)..."} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No project</SelectItem>
                            {editProjects.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="assignedToUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To (Optional)</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value || "none"} 
                          onValueChange={(value) => editForm.setValue("assignedToUserId", value === "none" ? undefined : value)}
                        >
                          <SelectTrigger data-testid="select-edit-task-user">
                            <SelectValue placeholder="Select user (optional)..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date (Optional)</FormLabel>
                        <Popover open={editStartDateOpen} onOpenChange={setEditStartDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-edit-task-start-date"
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => {
                                field.onChange(date ? format(date, "yyyy-MM-dd") : undefined);
                                setEditStartDateOpen(false);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Due Date (Optional)</FormLabel>
                        <Popover open={editDueDateOpen} onOpenChange={setEditDueDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-edit-task-due-date"
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => {
                                field.onChange(date ? format(date, "yyyy-MM-dd") : undefined);
                                setEditDueDateOpen(false);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger data-testid="select-edit-task-priority">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Size</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger data-testid="select-edit-task-size">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                              <SelectItem value="xlarge">X-Large</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          content={field.value || ""}
                          onChange={field.onChange}
                          placeholder="Add notes..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Labels Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel className="flex items-center gap-2">
                      <Tags className="h-4 w-4" />
                      Labels
                    </FormLabel>
                    <Dialog open={isLabelDialogOpen} onOpenChange={setIsLabelDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-new-label">
                          <Plus className="h-3 w-3 mr-1" />
                          New Label
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create New Label</DialogTitle>
                          <DialogDescription>
                            Create a new label to categorize tasks
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Label Name</label>
                            <Input
                              value={newLabelName}
                              onChange={(e) => setNewLabelName(e.target.value)}
                              placeholder="Enter label name..."
                              data-testid="input-label-name"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Color</label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={newLabelColor}
                                onChange={(e) => setNewLabelColor(e.target.value)}
                                className="w-20 h-10"
                                data-testid="input-label-color"
                              />
                              <Input
                                value={newLabelColor}
                                onChange={(e) => setNewLabelColor(e.target.value)}
                                placeholder="#3b82f6"
                                data-testid="input-label-color-hex"
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setIsLabelDialogOpen(false)}
                            data-testid="button-cancel-label"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => createLabelMutation.mutate({ name: newLabelName, color: newLabelColor })}
                            disabled={!newLabelName || createLabelMutation.isPending}
                            data-testid="button-create-label"
                          >
                            {createLabelMutation.isPending ? "Creating..." : "Create"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  {/* Assigned Labels */}
                  {editTaskLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {editTaskLabels.map((label) => (
                        <Badge
                          key={label.id}
                          style={{ backgroundColor: label.color || "#3b82f6" }}
                          className="text-white flex items-center gap-1"
                          data-testid={`badge-label-${label.id}`}
                        >
                          {label.name}
                          <button
                            onClick={() => editingTask && removeLabelMutation.mutate({ taskId: editingTask.id, labelId: label.id })}
                            className="hover:opacity-70"
                            data-testid={`button-remove-label-${label.id}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Available Labels */}
                  <div className="flex flex-wrap gap-2">
                    {allLabels
                      .filter((label) => !editTaskLabels.some((tl) => tl.id === label.id))
                      .map((label) => (
                        <Badge
                          key={label.id}
                          variant="outline"
                          style={{ borderColor: label.color || "#3b82f6", color: label.color || "#3b82f6" }}
                          className="cursor-pointer hover-elevate"
                          onClick={() => editingTask && assignLabelMutation.mutate({ taskId: editingTask.id, labelId: label.id })}
                          data-testid={`badge-available-label-${label.id}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {label.name}
                        </Badge>
                      ))}
                  </div>
                </div>

                {/* Collaborators Section */}
                <div className="space-y-2">
                  <FormLabel className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Collaborators
                  </FormLabel>
                  
                  {/* Assigned Collaborators */}
                  {editTaskCollaborators.length > 0 && (
                    <div className="space-y-2">
                      {editTaskCollaborators.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 bg-muted rounded-md"
                          data-testid={`collaborator-${user.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                              {user.firstName[0]}{user.lastName[0]}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{user.firstName} {user.lastName}</div>
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editingTask && removeCollaboratorMutation.mutate({ taskId: editingTask.id, userId: user.id })}
                            data-testid={`button-remove-collaborator-${user.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Available Collaborators */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full" data-testid="button-add-collaborator">
                        <UserPlus className="h-3 w-3 mr-2" />
                        Add Collaborator
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <Command>
                        <CommandInput placeholder="Search users..." />
                        <CommandList>
                          <CommandEmpty>No users found.</CommandEmpty>
                          <CommandGroup>
                            {users
                              .filter((user) => !editTaskCollaborators.some((tc) => tc.id === user.id))
                              .map((user) => (
                                <CommandItem
                                  key={user.id}
                                  onSelect={() => editingTask && addCollaboratorMutation.mutate({ taskId: editingTask.id, userId: user.id })}
                                  data-testid={`command-item-user-${user.id}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                                      {user.firstName[0]}{user.lastName[0]}
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium">{user.firstName} {user.lastName}</div>
                                      <div className="text-xs text-muted-foreground">{user.email}</div>
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <SheetFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditSheetOpen(false)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={editTaskMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    {editTaskMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </SheetFooter>
              </form>
            </Form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}