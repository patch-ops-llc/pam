import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Timer, Save, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agency, AccountWithAgency, ProjectWithAccountAndAgency, TaskWithRelations, User } from "@shared/schema";

export function QuickTimeLogger() {
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedAgency, setSelectedAgency] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [description, setDescription] = useState("");
  const [actualHours, setActualHours] = useState("");
  const [billedHours, setBilledHours] = useState("");
  const [agencyTimeTrackerLogged, setAgencyTimeTrackerLogged] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const { toast } = useToast();
  const [location] = useLocation();

  // Fetch users from API
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"]
  });

  // Fetch agencies from API
  const { data: agencies = [] } = useQuery<Agency[]>({
    queryKey: ["/api/clients"]
  });

  // Fetch accounts from API
  const { data: allAccounts = [] } = useQuery<AccountWithAgency[]>({
    queryKey: ["/api/accounts"]
  });

  // Fetch projects from API
  const { data: allProjects = [] } = useQuery<ProjectWithAccountAndAgency[]>({
    queryKey: ["/api/projects"]
  });

  // Fetch tasks from API
  const { data: allTasks = [] } = useQuery<TaskWithRelations[]>({
    queryKey: ["/api/tasks"]
  });

  // Pre-select values from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const agencyId = urlParams.get('agencyId');
    const accountId = urlParams.get('accountId');
    const projectId = urlParams.get('projectId');
    const taskId = urlParams.get('taskId');

    // Only set values if data is loaded and IDs are valid
    if (agencyId && agencies.some(agency => agency.id === agencyId)) {
      setSelectedAgency(agencyId);
    }
    if (accountId && allAccounts.some(account => account.id === accountId)) {
      setSelectedAccount(accountId);
    }
    if (projectId && allProjects.some(project => project.id === projectId)) {
      setSelectedProject(projectId);
    }
    if (taskId && allTasks.some(task => task.id === taskId)) {
      setSelectedTask(taskId);
    }
  }, [location, agencies, allAccounts, allProjects, allTasks]); // Re-run when location or data changes

  // Filter data based on selections
  const filteredAccounts = allAccounts.filter(account => 
    !selectedAgency || account.agencyId === selectedAgency
  );

  const filteredProjects = allProjects.filter(project => 
    !selectedAccount || project.accountId === selectedAccount
  );

  const filteredTasks = allTasks.filter(task => 
    (!selectedAccount || task.accountId === selectedAccount) &&
    (!selectedProject || task.projectId === selectedProject)
  );

  // Get the selected agency object to check for time tracker settings
  const selectedAgencyData = agencies.find(agency => agency.id === selectedAgency);
  const requiresTimeTrackerConfirmation = selectedAgencyData?.requireTimeTrackerConfirmation || false;
  const timeTrackingSystemName = selectedAgencyData?.timeTrackingSystem || "agency time tracker";

  // Reset dependent selections when parent changes
  const handleAgencyChange = (value: string) => {
    setSelectedAgency(value);
    setSelectedAccount("");
    setSelectedProject("");
    setSelectedTask("");
    setAgencyTimeTrackerLogged(false); // Reset checkbox when agency changes
  };

  const handleAccountChange = (value: string) => {
    setSelectedAccount(value);
    setSelectedProject("");
    setSelectedTask("");
  };

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
    setSelectedTask("");
  };


  // Mutation for saving time entries
  const saveTimeEntryMutation = useMutation({
    mutationFn: async (timeEntry: {
      userId: string;
      agencyId: string;
      accountId: string;
      projectId?: string;
      taskId?: string;
      description: string;
      actualHours: number;
      billedHours: number;
      logDate?: string;
      agencyTimeTrackerLogged?: boolean;
    }) => {
      const response = await apiRequest("/api/time-logs", "POST", timeEntry);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch time logs
      queryClient.invalidateQueries({ queryKey: ["/api/time-logs"] });
      
      toast({
        title: "Time Entry Saved",
        description: "Your time entry has been successfully logged.",
      });

      // Reset form
      setDescription("");
      setActualHours("");
      setBilledHours("");
      setAgencyTimeTrackerLogged(false);
      setSelectedUser("");
      setSelectedAgency("");
      setSelectedAccount("");
      setSelectedProject("");
      setSelectedTask("");
    },
    onError: (error) => {
      console.error("Error saving time entry:", error);
      toast({
        title: "Error",
        description: "Failed to save time entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      const response = await apiRequest("/api/tasks", "POST", taskData);
      return response.json();
    },
    onSuccess: (newTask) => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      
      // Set the newly created task as selected
      setSelectedTask(newTask.id);
      
      // Reset task form
      setNewTaskName("");
      setNewTaskDescription("");
      setShowTaskForm(false);

      toast({
        title: "Task Created",
        description: `Task "${newTask.name}" has been created successfully.`,
      });
    },
    onError: (error) => {
      console.error("Error creating task:", error);
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateTask = () => {
    if (!selectedAgency || !selectedAccount || !newTaskName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select an agency, account, and enter a task name.",
        variant: "destructive",
      });
      return;
    }

    createTaskMutation.mutate({
      agencyId: selectedAgency,
      accountId: selectedAccount,
      projectId: selectedProject || null,
      name: newTaskName.trim(),
      description: newTaskDescription.trim() || null,
    });
  };

  const handleSaveEntry = () => {
    if (!selectedUser || !selectedAgency || !selectedAccount || !actualHours || !billedHours) {
      toast({
        title: "Missing Information", 
        description: "Please select a user, agency, account and enter hours before saving.",
        variant: "destructive",
      });
      return;
    }

    // Check if agency requires time tracker confirmation and it's not checked
    if (requiresTimeTrackerConfirmation && !agencyTimeTrackerLogged) {
      toast({
        title: "Confirmation Required",
        description: `Please confirm that you have logged these hours in ${timeTrackingSystemName}.`,
        variant: "destructive",
      });
      return;
    }

    saveTimeEntryMutation.mutate({
      userId: selectedUser,
      agencyId: selectedAgency,
      accountId: selectedAccount,
      projectId: selectedProject || undefined,
      taskId: selectedTask || undefined,
      description: description || "Time entry",
      actualHours: parseFloat(actualHours),
      billedHours: parseFloat(billedHours),
      logDate: new Date().toISOString(),
      agencyTimeTrackerLogged: requiresTimeTrackerConfirmation ? agencyTimeTrackerLogged : undefined,
    });
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Quick Time Logger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User and Hierarchy Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="user-select">Person Logging Time *</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser} data-testid="select-user">
              <SelectTrigger>
                <SelectValue placeholder="Select person" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agency-select">Agency *</Label>
            <Select value={selectedAgency} onValueChange={handleAgencyChange} data-testid="select-agency">
              <SelectTrigger>
                <SelectValue placeholder="Select agency" />
              </SelectTrigger>
              <SelectContent>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-select">Account *</Label>
            <Select 
              value={selectedAccount} 
              onValueChange={handleAccountChange}
              disabled={!selectedAgency}
              data-testid="select-account"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {filteredAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-select">Project</Label>
            <Select 
              value={selectedProject} 
              onValueChange={handleProjectChange}
              disabled={!selectedAccount}
              data-testid="select-project"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project (optional)" />
              </SelectTrigger>
              <SelectContent>
                {filteredProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="task-select">Task</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTaskForm(!showTaskForm)}
                disabled={!selectedAccount}
                className="h-auto p-1"
                data-testid="button-add-task"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {showTaskForm && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="new-task-name">Task Name *</Label>
                  <Input
                    id="new-task-name"
                    placeholder="Enter task name"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    data-testid="input-new-task-name"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleCreateTask}
                    disabled={createTaskMutation.isPending || !newTaskName.trim()}
                    size="sm"
                    data-testid="button-create-task"
                  >
                    {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowTaskForm(false);
                      setNewTaskName("");
                      setNewTaskDescription("");
                    }}
                    size="sm"
                    data-testid="button-cancel-task"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            <Select 
              value={selectedTask} 
              onValueChange={setSelectedTask}
              disabled={!selectedAccount}
              data-testid="select-task"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select task (optional)" />
              </SelectTrigger>
              <SelectContent>
                {filteredTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>


        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="What did you work on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="input-description"
          />
        </div>

        {/* Time Input */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="actual-hours">Actual Hours *</Label>
            <Input
              id="actual-hours"
              type="number"
              step="0.25"
              placeholder="2.5"
              value={actualHours}
              onChange={(e) => setActualHours(e.target.value)}
              data-testid="input-actual-hours"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billed-hours">Billed Hours *</Label>
            <Input
              id="billed-hours"
              type="number"
              step="0.25"
              placeholder="2.0"
              value={billedHours}
              onChange={(e) => setBilledHours(e.target.value)}
              data-testid="input-billed-hours"
            />
          </div>
        </div>

        {/* Agency Time Tracker Confirmation */}
        {requiresTimeTrackerConfirmation && (
          <div className="flex items-start space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="agency-time-tracker"
              checked={agencyTimeTrackerLogged}
              onCheckedChange={(checked) => setAgencyTimeTrackerLogged(checked === true)}
              data-testid="checkbox-agency-time-tracker"
            />
            <div className="grid gap-1.5 leading-none">
              <Label 
                htmlFor="agency-time-tracker" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Did you log these hours in {timeTrackingSystemName}? *
              </Label>
              <p className="text-xs text-muted-foreground">
                This client requires confirmation that hours are logged in their time tracking system.
              </p>
            </div>
          </div>
        )}

        {/* Save Button */}
        <Button 
          onClick={handleSaveEntry} 
          disabled={saveTimeEntryMutation.isPending}
          className="w-full flex items-center gap-2" 
          data-testid="button-save-entry"
        >
          <Save className="h-4 w-4" />
          {saveTimeEntryMutation.isPending ? "Saving..." : "Save Time Entry"}
        </Button>
      </CardContent>
    </Card>
  );
}