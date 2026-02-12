import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Agency } from "@shared/schema";

export default function Agencies() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientType, setNewClientType] = useState<"agency" | "direct">("agency");
  const [newClientRequireTimeTracker, setNewClientRequireTimeTracker] = useState(false);
  const [newClientTimeTrackingSystem, setNewClientTimeTrackingSystem] = useState("");
  const { toast } = useToast();

  const { data: agencies = [], isLoading } = useQuery<Agency[]>({
    queryKey: ["/api/clients"]
  });

  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ["/api/accounts"]
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"]
  });

  const { data: timeLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/time-logs"]
  });

  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks"]
  });

  const getAgencyStats = (agencyId: string) => {
    const agencyAccounts = accounts.filter((account: any) => account.agencyId === agencyId && account.isActive);
    const agencyProjects = projects.filter((project: any) => project.agencyId === agencyId && project.isActive);
    const agencyTasks = tasks.filter((task: any) => task.agencyId === agencyId && task.isActive);
    
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();
    
    const monthlyHours = timeLogs
      .filter((log: any) => {
        const logDate = new Date(log.logDate);
        return log.agencyId === agencyId && 
               logDate.getUTCMonth() === currentMonth && 
               logDate.getUTCFullYear() === currentYear;
      })
      .reduce((total: number, log: any) => total + parseFloat(log.actualHours || 0), 0);
    
    return {
      activeAccounts: agencyAccounts.length,
      activeProjects: agencyProjects.length,
      activeTasks: agencyTasks.length,
      monthlyHours: Math.round(monthlyHours * 100) / 100,
    };
  };

  const filteredAgencies = agencies
    .filter(agency => agency.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(agency => showInactive || agency.isActive);

  const createAgencyMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      type: "agency" | "direct";
      requireTimeTrackerConfirmation?: boolean;
      timeTrackingSystem?: string;
    }) => {
      const response = await apiRequest("/api/clients", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({
        title: "Client Created",
        description: "New client has been successfully created.",
      });
      setCreateDialogOpen(false);
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
    mutationFn: async ({ id, data }: { 
      id: string;
      data: { 
        name?: string; 
        type?: "agency" | "direct";
        isActive?: boolean;
        requireTimeTrackerConfirmation?: boolean;
        timeTrackingSystem?: string | null;
      }
    }) => {
      const response = await apiRequest(`/api/clients/${id}`, "PATCH", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-logs"], exact: false });
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
    mutationFn: async (agencyId: string) => {
      return apiRequest(`/api/clients/${agencyId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-logs"] });
      toast({
        title: "Client Deleted",
        description: "Client has been permanently deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete client.",
        variant: "destructive",
      });
    },
  });

  const handleCreateClient = () => {
    if (!newClientName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a client name.",
        variant: "destructive",
      });
      return;
    }

    createAgencyMutation.mutate({
      name: newClientName.trim(),
      type: newClientType,
      requireTimeTrackerConfirmation: newClientRequireTimeTracker,
      timeTrackingSystem: newClientTimeTrackingSystem.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
            <p className="text-muted-foreground">Loading clients...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage your clients and track their activity
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-new-client">
          <Plus className="h-4 w-4 mr-2" />
          New Client
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-clients"
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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Active</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Accounts</TableHead>
              <TableHead className="text-center">Projects</TableHead>
              <TableHead className="text-center">Tasks</TableHead>
              <TableHead className="text-center">Hours (Month)</TableHead>
              <TableHead className="text-center">Require Time Tracker</TableHead>
              <TableHead>Time Tracking System</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAgencies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No clients found
                </TableCell>
              </TableRow>
            ) : (
              filteredAgencies.map((agency) => {
                const stats = getAgencyStats(agency.id);
                return (
                  <TableRow key={agency.id} className={!agency.isActive ? "opacity-60" : ""} data-testid={`client-row-${agency.id}`}>
                    <TableCell>
                      <Switch
                        checked={agency.isActive}
                        onCheckedChange={(checked) => {
                          updateAgencyMutation.mutate({
                            id: agency.id,
                            data: { isActive: checked }
                          });
                        }}
                        disabled={updateAgencyMutation.isPending}
                        data-testid={`toggle-active-${agency.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={agency.name}
                        onBlur={(e) => {
                          const name = e.target.value.trim();
                          if (name && name !== agency.name) {
                            updateAgencyMutation.mutate({
                              id: agency.id,
                              data: { name }
                            });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="h-8 border-none bg-transparent focus-visible:ring-1 focus-visible:ring-ring"
                        disabled={updateAgencyMutation.isPending}
                        data-testid={`input-name-${agency.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={agency.type}
                        onValueChange={(value: "agency" | "direct") => {
                          updateAgencyMutation.mutate({
                            id: agency.id,
                            data: { type: value }
                          });
                        }}
                        disabled={updateAgencyMutation.isPending}
                      >
                        <SelectTrigger className="h-8 w-24 border-none bg-transparent focus:ring-1 focus:ring-ring" data-testid={`select-type-${agency.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agency">Agency</SelectItem>
                          <SelectItem value="direct">Direct</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{stats.activeAccounts}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{stats.activeProjects}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{stats.activeTasks}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{stats.monthlyHours}h</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={agency.requireTimeTrackerConfirmation || false}
                        onCheckedChange={(checked) => {
                          updateAgencyMutation.mutate({
                            id: agency.id,
                            data: { requireTimeTrackerConfirmation: checked === true }
                          });
                        }}
                        disabled={updateAgencyMutation.isPending}
                        data-testid={`checkbox-require-tracker-${agency.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={agency.timeTrackingSystem || ""}
                        placeholder="e.g., Harvest"
                        onBlur={(e) => {
                          const system = e.target.value.trim();
                          if (system !== (agency.timeTrackingSystem || "")) {
                            updateAgencyMutation.mutate({
                              id: agency.id,
                              data: { timeTrackingSystem: system || null }
                            });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="h-8 w-32 border-none bg-transparent focus-visible:ring-1 focus-visible:ring-ring text-xs"
                        disabled={updateAgencyMutation.isPending}
                        data-testid={`input-tracking-system-${agency.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${agency.name}"? This will also delete all associated accounts, projects, and tasks.`)) {
                            deleteAgencyMutation.mutate(agency.id);
                          }
                        }}
                        disabled={deleteAgencyMutation.isPending}
                        data-testid={`button-delete-${agency.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
            <DialogDescription>
              Add a new client to your system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Client Name</Label>
              <Input
                id="name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Enter client name"
                data-testid="input-new-client-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={newClientType}
                onValueChange={(value: "agency" | "direct") => setNewClientType(value)}
              >
                <SelectTrigger id="type" data-testid="select-new-client-type">
                  <SelectValue placeholder="Select client type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agency</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Time Tracking Settings</h4>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="require-time-tracker"
                    checked={newClientRequireTimeTracker}
                    onCheckedChange={(checked) => setNewClientRequireTimeTracker(checked === true)}
                    data-testid="checkbox-require-time-tracker"
                  />
                  <Label htmlFor="require-time-tracker" className="text-sm font-normal">
                    Require confirmation that hours were logged in agency time tracker
                  </Label>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="time-tracking-system">Time Tracking System (optional)</Label>
                  <Input
                    id="time-tracking-system"
                    value={newClientTimeTrackingSystem}
                    onChange={(e) => setNewClientTimeTrackingSystem(e.target.value)}
                    placeholder="e.g., Harvest, Clockify, Toggl"
                    data-testid="input-time-tracking-system"
                  />
                  <p className="text-xs text-muted-foreground">
                    Name of the time tracking system used by this client
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              data-testid="button-cancel-create"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateClient}
              disabled={createAgencyMutation.isPending}
              data-testid="button-create-client"
            >
              {createAgencyMutation.isPending ? "Creating..." : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
