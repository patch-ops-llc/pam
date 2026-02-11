import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { CalendarDays, Clock, Plus, AlertCircle, Trash2, TrendingUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
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
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import type { User, ProjectTeamMemberWithUser, UserAvailabilityWithUser } from "@shared/schema";

const availabilitySchema = z.object({
  userId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  notes: z.string().optional()
});

const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "manager", "user"]),
  employmentType: z.enum(["full-time", "part-time"]).default("full-time"),
});

type AvailabilityFormData = z.infer<typeof availabilitySchema>;
type CreateUserData = z.infer<typeof createUserSchema>;

interface TeamMemberWorkload {
  user: User;
  projects: ProjectTeamMemberWithUser[];
  totalActualHours: number;
  totalBilledHours: number;
  availability: UserAvailabilityWithUser[];
}

export default function TeamResources() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isOOODialogOpen, setIsOOODialogOpen] = useState(false);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [deleteOOOId, setDeleteOOOId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"]
  });

  const { data: availability = [] } = useQuery<UserAvailabilityWithUser[]>({
    queryKey: ["/api/user-availability"]
  });

  const { data: allTeamMembers = [] } = useQuery<ProjectTeamMemberWithUser[]>({
    queryKey: ["/api/projects/with-team"],
    select: (data: any[]) => {
      return data.flatMap(project => 
        project.teamMembers?.map((member: any) => ({
          ...member,
          projectName: project.name,
          projectStage: project.stage
        })) || []
      );
    }
  });

  const addOOOMutation = useMutation({
    mutationFn: async (data: AvailabilityFormData) => {
      return apiRequest("/api/user-availability", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-availability"] });
      setIsOOODialogOpen(false);
      form.reset();
      toast({
        title: "OOO Added",
        description: "Out of office entry has been added successfully.",
      });
    }
  });

  const deleteOOOMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/user-availability/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-availability"] });
      setDeleteOOOId(null);
      toast({
        title: "OOO Deleted",
        description: "Out of office entry has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete OOO entry. Please try again.",
        variant: "destructive",
      });
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserData) => {
      return await apiRequest("/api/users", "POST", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-team"] });
      toast({
        title: "Resource Added",
        description: "Team member has been added successfully.",
      });
      setIsCreateUserDialogOpen(false);
      createUserForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add resource",
        variant: "destructive",
      });
    },
  });

  const toggleEmploymentTypeMutation = useMutation({
    mutationFn: async ({ userId, employmentType }: { userId: string; employmentType: string }) => {
      return apiRequest(`/api/users/${userId}`, "PATCH", { employmentType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Employment Type Updated",
        description: "The employment type has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update employment type. Please try again.",
        variant: "destructive",
      });
    }
  });

  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      userId: "",
      startDate: "",
      endDate: "",
      reason: "",
      notes: ""
    }
  });

  const createUserForm = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      email: "",
      firstName: "",
      lastName: "",
      password: "",
      role: "user",
      employmentType: "full-time",
    },
  });

  const teamWorkload: TeamMemberWorkload[] = users.map(user => {
    const userProjects = allTeamMembers.filter(m => m.userId === user.id);
    const totalActualHours = userProjects.reduce((sum, p) => 
      sum + (parseFloat(p.actualHoursPerWeek || "0")), 0
    );
    const totalBilledHours = userProjects.reduce((sum, p) => 
      sum + (parseFloat(p.billedHoursPerWeek || "0")), 0
    );
    const userAvailability = availability.filter(a => a.userId === user.id);

    return {
      user,
      projects: userProjects,
      totalActualHours,
      totalBilledHours,
      availability: userAvailability
    };
  });

  function handleAddOOO(user: User) {
    setSelectedUser(user);
    form.setValue("userId", user.id);
    setIsOOODialogOpen(true);
  }

  function onSubmitOOO(data: AvailabilityFormData) {
    addOOOMutation.mutate(data);
  }

  // Check if user has upcoming OOO
  function hasUpcomingOOO(userAvailability: UserAvailabilityWithUser[]): boolean {
    const today = new Date();
    return userAvailability.some(a => new Date(a.endDate) >= today);
  }

  // Get capacity color based on hours
  function getCapacityColor(actualHours: number): string {
    if (actualHours === 0) return "text-muted-foreground";
    if (actualHours < 20) return "text-green-600 dark:text-green-400";
    if (actualHours < 35) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  }

  function handleToggleEmploymentType(user: User) {
    const newType = user.employmentType === "full-time" ? "part-time" : "full-time";
    toggleEmploymentTypeMutation.mutate({ userId: user.id, employmentType: newType });
  }

  function getWeeklyCapacity(employmentType?: string): number {
    return employmentType === "part-time" ? 20 : 40;
  }

  const onCreateUserSubmit = (data: CreateUserData) => {
    createUserMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Resources"
        description="Capacity planning and availability tracking"
        actions={
          <Button onClick={() => setIsCreateUserDialogOpen(true)} data-testid="button-add-resource">
            <Plus className="h-4 w-4 mr-2" />
            Add Resource
          </Button>
        }
      />

      {/* Team Capacity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {teamWorkload.map((member) => (
          <Card key={member.user.id} className="hover-elevate" data-testid={`card-member-${member.user.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle data-testid={`text-member-name-${member.user.id}`}>
                    {member.user.firstName} {member.user.lastName}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <CardDescription>
                      {member.user.role}
                    </CardDescription>
                    <Badge 
                      variant="outline" 
                      className="cursor-pointer hover-elevate active-elevate-2"
                      onClick={() => handleToggleEmploymentType(member.user)}
                      data-testid={`badge-employment-type-${member.user.id}`}
                    >
                      {member.user.employmentType === "part-time" ? "Part-Time" : "Full-Time"}
                    </Badge>
                  </div>
                </div>
                {hasUpcomingOOO(member.availability) && (
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30 shrink-0">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    OOO
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Capacity */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  <span>Weekly Capacity</span>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Actual</p>
                    <p className={`text-2xl font-bold ${getCapacityColor(member.totalActualHours)}`} data-testid={`text-actual-hours-${member.user.id}`}>
                      {member.totalActualHours}h
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Billed</p>
                    <p className="text-2xl font-bold text-foreground" data-testid={`text-billed-hours-${member.user.id}`}>
                      {member.totalBilledHours}h
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="text-2xl font-bold text-muted-foreground" data-testid={`text-remaining-hours-${member.user.id}`}>
                      {(getWeeklyCapacity(member.user.employmentType) - member.totalActualHours).toFixed(0)}h
                    </p>
                  </div>
                </div>
                
                {member.totalActualHours > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Efficiency</span>
                    <span className="font-medium" data-testid={`text-efficiency-${member.user.id}`}>
                      {(member.totalBilledHours / member.totalActualHours).toFixed(1)}x
                    </span>
                  </div>
                )}
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Utilization</span>
                    <span className="font-medium" data-testid={`text-utilization-${member.user.id}`}>
                      {((member.totalActualHours / getWeeklyCapacity(member.user.employmentType)) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        (member.totalActualHours / getWeeklyCapacity(member.user.employmentType)) >= 0.875 ? 'bg-red-500' :
                        (member.totalActualHours / getWeeklyCapacity(member.user.employmentType)) >= 0.50 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((member.totalActualHours / getWeeklyCapacity(member.user.employmentType)) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Projects */}
              {member.projects.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Assigned Projects ({member.projects.length})</div>
                  <div className="space-y-1">
                    {member.projects.map((project: any) => (
                      <div
                        key={project.id}
                        className="text-sm p-2 rounded bg-muted/30 flex items-center justify-between"
                        data-testid={`project-assignment-${project.id}`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {project.role}
                          </Badge>
                          <span className="truncate">{project.projectName}</span>
                        </div>
                        {project.actualHoursPerWeek && (
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {project.actualHoursPerWeek}h
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No project assignments
                </div>
              )}

              {/* Out of Office */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalendarDays className="h-4 w-4" />
                    <span>Availability</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddOOO(member.user)}
                    data-testid={`button-add-ooo-${member.user.id}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                
                {member.availability.length > 0 ? (
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {member.availability.map((avail) => (
                      <div
                        key={avail.id}
                        className="text-xs p-2 rounded bg-muted/30 flex items-start justify-between gap-2"
                        data-testid={`ooo-entry-${avail.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{avail.reason || "Out of Office"}</span>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {new Date(avail.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(avail.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          {avail.notes && (
                            <p className="text-muted-foreground mt-1">{avail.notes}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => setDeleteOOOId(avail.id)}
                          data-testid={`button-delete-ooo-${avail.id}`}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No upcoming OOO</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add OOO Dialog */}
      <Dialog open={isOOODialogOpen} onOpenChange={setIsOOODialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Out of Office</DialogTitle>
            <DialogDescription>
              Record time off for {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitOOO)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              data-testid="input-start-date"
                            >
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
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
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              data-testid="input-end-date"
                            >
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Vacation, Client work, Conference, etc." 
                        {...field} 
                        data-testid="input-reason" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional details..." 
                        {...field} 
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOOODialogOpen(false)}
                  data-testid="button-cancel-ooo"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addOOOMutation.isPending} data-testid="button-save-ooo">
                  {addOOOMutation.isPending ? "Adding..." : "Add OOO"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete OOO Confirmation Dialog */}
      <AlertDialog open={deleteOOOId !== null} onOpenChange={() => setDeleteOOOId(null)}>
        <AlertDialogContent data-testid="dialog-delete-ooo">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Out of Office Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the OOO entry from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-ooo">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOOOId && deleteOOOMutation.mutate(deleteOOOId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-ooo"
            >
              {deleteOOOMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Resource Dialog */}
      <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Resource</DialogTitle>
            <DialogDescription>
              Add a new team member to the capacity tracker.
            </DialogDescription>
          </DialogHeader>
          <Form {...createUserForm}>
            <form onSubmit={createUserForm.handleSubmit(onCreateUserSubmit)} className="space-y-4">
              <FormField
                control={createUserForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="johndoe" {...field} data-testid="input-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createUserForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createUserForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createUserForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createUserForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createUserForm.control}
                  name="employmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-employment-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="full-time">Full-Time</SelectItem>
                          <SelectItem value="part-time">Part-Time</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateUserDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createUserMutation.isPending}
                  data-testid="button-create-resource"
                >
                  {createUserMutation.isPending ? "Adding..." : "Add Resource"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
